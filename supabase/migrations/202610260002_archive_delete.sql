begin;

-- Keep file paths until Storage confirms deletion. This makes failed cleanup
-- retryable without retaining the deleted playable or project.
create table public.pending_asset_deletions (
  id bigint generated always as identity primary key,
  bucket_id text not null check (bucket_id in ('playable-builds', 'playable-thumbnails')),
  path text not null,
  object_id uuid not null references storage.objects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bucket_id, path)
);
alter table public.pending_asset_deletions enable row level security;
create policy "Members read pending asset cleanup" on public.pending_asset_deletions
  for select to authenticated using ((select public.is_member()));
revoke all on public.pending_asset_deletions from anon, authenticated;
grant select on public.pending_asset_deletions to authenticated;

-- Only an archived record may be permanently removed. Direct table DELETE
-- remains denied; the functions validate membership and archival state.
create function public.delete_archived_playable(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_project_id uuid;
  v_archived boolean;
begin
  if not public.is_member() then
    raise exception 'Bạn cần đăng nhập bằng tài khoản được mời.' using errcode = '42501';
  end if;
  select p.project_id, p.archived_at is not null or pr.archived_at is not null
    into v_project_id, v_archived
    from public.playables p join public.projects pr on pr.id = p.project_id
    where p.id = p_id for update of p, pr;
  if v_project_id is null then
    raise exception 'Không tìm thấy playable.' using errcode = 'P0002';
  end if;
  if not v_archived then
    raise exception 'Lưu trữ playable trước khi xóa vĩnh viễn.' using errcode = '22023';
  end if;

  insert into public.pending_asset_deletions(bucket_id, path, object_id)
  select 'playable-builds', storage_path, build_object_id from public.playables where id = p_id and storage_path is not null
  union all
  select 'playable-thumbnails', thumbnail_path, thumbnail_object_id from public.playables where id = p_id and thumbnail_path is not null
  on conflict (bucket_id, path) do nothing;
  delete from public.playables where id = p_id;
  return v_project_id;
end;
$$;
revoke all on function public.delete_archived_playable(uuid) from public, anon;
grant execute on function public.delete_archived_playable(uuid) to authenticated;

create function public.delete_archived_project(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_archived timestamptz;
begin
  if not public.is_member() then
    raise exception 'Bạn cần đăng nhập bằng tài khoản được mời.' using errcode = '42501';
  end if;
  select archived_at into v_archived from public.projects where id = p_id for update;
  if not found then
    raise exception 'Không tìm thấy dự án.' using errcode = 'P0002';
  end if;
  if v_archived is null then
    raise exception 'Lưu trữ dự án trước khi xóa vĩnh viễn.' using errcode = '22023';
  end if;

  perform 1 from public.playables where project_id = p_id for update;
  insert into public.pending_asset_deletions(bucket_id, path, object_id)
  select 'playable-builds', storage_path, build_object_id from public.playables where project_id = p_id and storage_path is not null
  union all
  select 'playable-thumbnails', thumbnail_path, thumbnail_object_id from public.playables where project_id = p_id and thumbnail_path is not null
  on conflict (bucket_id, path) do nothing;
  delete from public.playables where project_id = p_id;
  delete from public.projects where id = p_id;
  return p_id;
end;
$$;
revoke all on function public.delete_archived_project(uuid) from public, anon;
grant execute on function public.delete_archived_project(uuid) to authenticated;

-- A member may remove a queued object only after no playable references it.
-- The original policy still permits uploaders to clean their own unused files.
create policy "Members remove queued unreferenced Playable Hub assets"
on storage.objects for delete to authenticated
using (
  (select public.is_member())
  and exists (
    select 1 from public.pending_asset_deletions q
    where q.bucket_id = storage.objects.bucket_id and q.path = storage.objects.name and q.object_id = storage.objects.id
  )
  and (
    (bucket_id = 'playable-builds' and not exists (
      select 1 from public.playables p where p.storage_path = storage.objects.name
    ))
    or (bucket_id = 'playable-thumbnails' and not exists (
      select 1 from public.playables p where p.thumbnail_path = storage.objects.name
    ))
  )
);

comment on function public.delete_archived_project(uuid) is
  'Member-only permanent delete of an archived project and its playables; queues Storage cleanup.';
comment on function public.delete_archived_playable(uuid) is
  'Member-only permanent delete of an archived playable; queues Storage cleanup.';

commit;
