-- Playable Hub MVP. Run once in a new Supabase project's SQL Editor, or with
-- `supabase db reset` / `supabase db push`. No service key is required by the app.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  email text not null,
  created_at timestamptz not null default now()
);

-- Only Supabase Auth can provision a member profile. Dashboard invitation/admin
-- account creation still works when public sign-up is disabled.
create function public.sync_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
                  nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
                  nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                  'Thành viên'), 100),
    coalesce(new.email, '')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    email = excluded.email;
  return new;
end;
$$;
revoke all on function public.sync_auth_profile() from public, anon, authenticated;
create trigger sync_playable_hub_profile
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_auth_profile();

-- Include users already invited before the migration was installed.
insert into public.profiles (id, display_name, email)
select id,
       left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'), ''),
                     nullif(btrim(raw_user_meta_data->>'full_name'), ''),
                     nullif(split_part(coalesce(email, ''), '@', 1), ''),
                     'Thành viên'), 100),
       coalesce(email, '')
from auth.users;

alter table public.profiles enable row level security;

-- This narrowly scoped definer exposes only the caller's membership boolean.
-- It avoids recursive profiles RLS while also denying email access to a token
-- whose user/profile has been removed. It cannot provision or edit membership.
create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;
create policy "Members can read member profiles"
  on public.profiles for select to authenticated
  using ((select public.is_member()));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text check (description is null or length(description) <= 4000),
  owner_id uuid not null constraint projects_owner_id_fkey references public.profiles(id),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed')),
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.networks (
  id text primary key,
  name text not null unique,
  sort_order smallint not null unique
);
insert into public.networks (id, name, sort_order) values
  ('unity-ads', 'Unity Ads', 1), ('mintegral', 'Mintegral', 2),
  ('applovin', 'AppLovin', 3), ('meta', 'Meta', 4),
  ('google-ads', 'Google Ads', 5), ('tiktok', 'TikTok', 6), ('other', 'Khác', 7);

-- PostgreSQL sequences allocate unique values across concurrent transactions.
-- Gaps after failed/rolled-back writes are intentional; codes are never reused.
create sequence public.playable_code_seq;
create table public.playables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^PL-[0-9]{6,}$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  project_id uuid not null constraint playables_project_id_fkey references public.projects(id),
  win_level text not null default 'unreviewed'
    check (win_level in ('unreviewed', 'testing', 'not_winning', 'promising', 'winning', 'scaling')),
  storage_path text,
  -- Internal references are assigned by the trigger, never by clients. Foreign
  -- keys protect save/cleanup races in addition to the Storage DELETE policy.
  build_object_id uuid references storage.objects(id) on delete no action,
  external_url text check (external_url is null or external_url ~* '^https?://[^/[:space:]?#]+[^[:space:]]*$'),
  file_name text,
  file_size bigint,
  file_mime text,
  thumbnail_path text,
  thumbnail_object_id uuid references storage.objects(id) on delete no action,
  released_at date,
  notes text check (notes is null or length(notes) <= 10000),
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playables_source_required check (storage_path is not null or external_url is not null),
  constraint playables_build_object_reference check ((storage_path is null) = (build_object_id is null)),
  constraint playables_thumbnail_object_reference check ((thumbnail_path is null) = (thumbnail_object_id is null)),
  constraint playables_file_metadata check (
    (storage_path is null and file_name is null and file_size is null and file_mime is null)
    or (storage_path is not null and file_name is not null
        and length(btrim(file_name)) between 1 and 255
        and file_size is not null and file_size between 1 and 52428800
        and file_mime is not null and file_mime in ('text/html', 'application/zip', 'application/x-zip-compressed'))
  ),
  constraint playables_build_path check (storage_path is null or storage_path ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(html|zip)$'),
  constraint playables_thumbnail_path check (thumbnail_path is null or thumbnail_path ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$')
);

create table public.playable_networks (
  playable_id uuid not null references public.playables(id) on delete cascade,
  network_id text not null references public.networks(id),
  primary key (playable_id, network_id)
);

create index projects_owner_id_idx on public.projects(owner_id);
create index projects_status_archive_idx on public.projects(status, archived_at);
create index projects_updated_at_idx on public.projects(updated_at desc, id desc);
create index playables_project_id_idx on public.playables(project_id);
create index playables_win_archive_idx on public.playables(win_level, archived_at);
create index playables_updated_at_idx on public.playables(updated_at desc, id desc);
create index playables_storage_path_idx on public.playables(storage_path) where storage_path is not null;
create index playables_thumbnail_path_idx on public.playables(thumbnail_path) where thumbnail_path is not null;
create index playables_build_object_idx on public.playables(build_object_id) where build_object_id is not null;
create index playables_thumbnail_object_idx on public.playables(thumbnail_object_id) where thumbnail_object_id is not null;
create index playable_networks_network_idx on public.playable_networks(network_id, playable_id);

create function public.audit_project() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_member() then
    raise exception 'Bạn cần đăng nhập bằng tài khoản được mời.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := actor;
    new.created_at := now();
  else
    if new.id is distinct from old.id then
      raise exception 'Không thể thay đổi ID dự án.' using errcode = '22023';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := actor;
  new.updated_at := now();
  new.name := btrim(new.name);
  return new;
end;
$$;
create trigger audit_project before insert or update on public.projects
  for each row execute function public.audit_project();
revoke all on function public.audit_project() from public, anon, authenticated;

create function public.audit_playable() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := auth.uid();
  sequence_value text;
begin
  if actor is null or not public.is_member() then
    raise exception 'Bạn cần đăng nhập bằng tài khoản được mời.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.build_object_id := null;
    new.thumbnail_object_id := null;
    sequence_value := nextval('public.playable_code_seq')::text;
    new.code := 'PL-' || lpad(sequence_value, greatest(6, length(sequence_value)), '0');
    new.created_by := actor;
    new.created_at := now();
  else
    if new.id is distinct from old.id or new.code is distinct from old.code then
      raise exception 'Không thể thay đổi ID hoặc mã playable.' using errcode = '22023';
    end if;
    if new.storage_path is distinct from old.storage_path
       or new.external_url is distinct from old.external_url
       or new.file_name is distinct from old.file_name
       or new.file_size is distinct from old.file_size
       or new.file_mime is distinct from old.file_mime then
      raise exception 'Build đã lưu không thể thay đổi. Hãy tạo bản sao cho build mới.' using errcode = '22023';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.build_object_id := old.build_object_id;
    new.thumbnail_object_id := old.thumbnail_object_id;
  end if;

  if tg_op = 'INSERT' and new.storage_path is not null then
    if split_part(new.storage_path, '/', 1) <> actor::text then
      raise exception 'Chỉ được đính kèm file vừa tải lên từ tài khoản của bạn.' using errcode = '42501';
    end if;
    select o.id into new.build_object_id from storage.objects o
      where o.bucket_id = 'playable-builds' and o.name = new.storage_path
        and (o.metadata->>'size')::bigint = new.file_size
        and o.metadata->>'mimetype' = new.file_mime;
    if new.build_object_id is null then
      raise exception 'Không tìm thấy file hoặc metadata file không khớp.' using errcode = '22023';
    end if;
  end if;

  if new.thumbnail_path is null then
    new.thumbnail_object_id := null;
  elsif tg_op = 'INSERT' or new.thumbnail_path is distinct from old.thumbnail_path then
    if split_part(new.thumbnail_path, '/', 1) <> actor::text then
      raise exception 'Chỉ được đính kèm thumbnail tải lên từ tài khoản của bạn.' using errcode = '42501';
    end if;
    select o.id into new.thumbnail_object_id from storage.objects o
      where o.bucket_id = 'playable-thumbnails' and o.name = new.thumbnail_path
        and (o.metadata->>'size')::bigint between 1 and 5242880
        and o.metadata->>'mimetype' in ('image/png', 'image/jpeg', 'image/webp');
    if new.thumbnail_object_id is null then
      raise exception 'Không tìm thấy thumbnail hợp lệ.' using errcode = '22023';
    end if;
  end if;
  new.name := btrim(new.name);
  new.updated_by := actor;
  new.updated_at := now();
  return new;
end;
$$;
create trigger audit_playable before insert or update on public.playables
  for each row execute function public.audit_playable();
revoke all on function public.audit_playable() from public, anon, authenticated;

-- Junction permissions are needed by the SECURITY INVOKER save RPC. Preserve
-- audit integrity even when a member edits that table directly through the API.
create function public.audit_playable_network_change() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.playables set updated_at = now()
  where id = case when tg_op = 'DELETE' then old.playable_id else new.playable_id end;
  return null;
end;
$$;
create trigger audit_playable_network_change after insert or delete on public.playable_networks
  for each row execute function public.audit_playable_network_change();
revoke all on function public.audit_playable_network_change() from public, anon, authenticated;

alter table public.projects enable row level security;
alter table public.playables enable row level security;
alter table public.networks enable row level security;
alter table public.playable_networks enable row level security;

create policy "Members read projects" on public.projects for select to authenticated using ((select public.is_member()));
create policy "Members create projects" on public.projects for insert to authenticated with check ((select public.is_member()));
create policy "Members edit projects" on public.projects for update to authenticated using ((select public.is_member())) with check ((select public.is_member()));
create policy "Members read playables" on public.playables for select to authenticated using ((select public.is_member()));
create policy "Members create playables" on public.playables for insert to authenticated with check ((select public.is_member()));
create policy "Members edit playables" on public.playables for update to authenticated using ((select public.is_member())) with check ((select public.is_member()));
create policy "Members read networks" on public.networks for select to authenticated using ((select public.is_member()));
create policy "Members read playable networks" on public.playable_networks for select to authenticated using ((select public.is_member()));
create policy "Members create playable networks" on public.playable_networks for insert to authenticated with check ((select public.is_member()));
create policy "Members remove playable networks" on public.playable_networks for delete to authenticated using ((select public.is_member()));

revoke all on public.profiles, public.projects, public.playables, public.networks, public.playable_networks from anon, authenticated;
grant select on public.profiles, public.networks to authenticated;
grant select, insert, update on public.projects, public.playables to authenticated;
grant select, insert, delete on public.playable_networks to authenticated;
grant usage on sequence public.playable_code_seq to authenticated;

-- One RPC call is one PostgreSQL transaction: validation failures roll metadata
-- and the entire network replacement back together. This function never bypasses RLS.
create function public.save_playable(
  p_id uuid default null,
  p_data jsonb default '{}'::jsonb,
  p_network_ids text[] default '{}'::text[]
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid;
begin
  if not public.is_member() then
    raise exception 'Bạn cần đăng nhập bằng tài khoản được mời.' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Dữ liệu playable phải là một object.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_network_ids, '{}'::text[])) as selected(id)
    where selected.id is null or not exists (select 1 from public.networks n where n.id = selected.id)
  ) then
    raise exception 'Network không hợp lệ.' using errcode = '23503';
  end if;

  if p_id is null then
    insert into public.playables (
      name, project_id, win_level, storage_path, external_url,
      file_name, file_size, file_mime, thumbnail_path, released_at, notes, archived_at
    ) values (
      p_data->>'name', (p_data->>'project_id')::uuid,
      coalesce(p_data->>'win_level', 'unreviewed'), p_data->>'storage_path', p_data->>'external_url',
      p_data->>'file_name', (p_data->>'file_size')::bigint, p_data->>'file_mime',
      p_data->>'thumbnail_path', (p_data->>'released_at')::date,
      p_data->>'notes', (p_data->>'archived_at')::timestamptz
    ) returning id into saved_id;
  else
    update public.playables set
      name = case when p_data ? 'name' then p_data->>'name' else name end,
      project_id = case when p_data ? 'project_id' then (p_data->>'project_id')::uuid else project_id end,
      win_level = case when p_data ? 'win_level' then p_data->>'win_level' else win_level end,
      storage_path = case when p_data ? 'storage_path' then p_data->>'storage_path' else storage_path end,
      external_url = case when p_data ? 'external_url' then p_data->>'external_url' else external_url end,
      file_name = case when p_data ? 'file_name' then p_data->>'file_name' else file_name end,
      file_size = case when p_data ? 'file_size' then (p_data->>'file_size')::bigint else file_size end,
      file_mime = case when p_data ? 'file_mime' then p_data->>'file_mime' else file_mime end,
      thumbnail_path = case when p_data ? 'thumbnail_path' then p_data->>'thumbnail_path' else thumbnail_path end,
      released_at = case when p_data ? 'released_at' then (p_data->>'released_at')::date else released_at end,
      notes = case when p_data ? 'notes' then p_data->>'notes' else notes end,
      archived_at = case when p_data ? 'archived_at' then (p_data->>'archived_at')::timestamptz else archived_at end
    where id = p_id returning id into saved_id;
    if saved_id is null then
      raise exception 'Không tìm thấy playable.' using errcode = 'P0002';
    end if;
  end if;

  delete from public.playable_networks where playable_id = saved_id;
  insert into public.playable_networks (playable_id, network_id)
  select saved_id, selected.id
  from (select distinct unnest(coalesce(p_network_ids, '{}'::text[])) as id) selected;
  return saved_id;
end;
$$;
revoke all on function public.save_playable(uuid, jsonb, text[]) from public, anon;
grant execute on function public.save_playable(uuid, jsonb, text[]) to authenticated;

-- Filtering and pagination happen in Postgres, never by downloading the full
-- repository. A single snapshot provides the result count and page of records.
create function public.list_playables(p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  result jsonb;
  page_number integer := greatest(1, coalesce(nullif(p_filters->>'page', '')::integer, 1));
  page_size constant integer := 12;
  search_text text := btrim(coalesce(p_filters->>'q', ''));
  show_archived boolean := coalesce(nullif(p_filters->>'archived', '')::boolean, false);
begin
  if not public.is_member() then
    raise exception 'Bạn cần đăng nhập bằng tài khoản được mời.' using errcode = '42501';
  end if;
  with filtered as materialized (
    select p.id, p.updated_at
    from public.playables p
    join public.projects pr on pr.id = p.project_id
    where case when show_archived then p.archived_at is not null or pr.archived_at is not null
               else p.archived_at is null and pr.archived_at is null end
      and (search_text = '' or position(lower(search_text) in lower(p.name)) > 0
        or position(lower(search_text) in lower(p.code)) > 0
        or position(lower(search_text) in lower(pr.name)) > 0)
      and (coalesce(p_filters->>'project', '') = '' or p.project_id = nullif(p_filters->>'project', '')::uuid)
      and (coalesce(p_filters->>'status', '') = '' or pr.status = p_filters->>'status')
      and (coalesce(p_filters->>'owner', '') = '' or pr.owner_id = nullif(p_filters->>'owner', '')::uuid)
      and (coalesce(p_filters->>'win', '') = '' or p.win_level = p_filters->>'win')
      and (coalesce(p_filters->>'network', '') = '' or exists (
        select 1 from public.playable_networks pn
        where pn.playable_id = p.id and pn.network_id = p_filters->>'network'
      ))
  ), page_ids as (
    select id, updated_at from filtered order by updated_at desc, id desc
    limit page_size offset ((page_number::bigint - 1) * page_size)
  ), page_rows as (
    select p.*,
      to_jsonb(pr) || jsonb_build_object('owner', to_jsonb(owner)) as project,
      coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name) order by n.sort_order)
        from public.playable_networks pn join public.networks n on n.id = pn.network_id
        where pn.playable_id = p.id), '[]'::jsonb) as networks,
      to_jsonb(creator) as creator, to_jsonb(updater) as updater
    from page_ids selected
    join public.playables p on p.id = selected.id
    join public.projects pr on pr.id = p.project_id
    join public.profiles owner on owner.id = pr.owner_id
    join public.profiles creator on creator.id = p.created_by
    join public.profiles updater on updater.id = p.updated_by
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(r) order by r.updated_at desc, r.id desc) from page_rows r), '[]'::jsonb),
    'total', (select count(*) from filtered), 'page', page_number, 'pageSize', page_size
  ) into result;
  return result;
end;
$$;
revoke all on function public.list_playables(jsonb) from public, anon;
grant execute on function public.list_playables(jsonb) to authenticated;

-- Limits are repository settings, not an ad-network validation standard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('playable-builds', 'playable-builds', false, 52428800,
    array['text/html', 'application/zip', 'application/x-zip-compressed']),
  ('playable-thumbnails', 'playable-thumbnails', false, 5242880,
    array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Members read private Playable Hub objects"
on storage.objects for select to authenticated
using (bucket_id in ('playable-builds', 'playable-thumbnails') and (select public.is_member()));

create policy "Members upload new uniquely named Playable Hub objects"
on storage.objects for insert to authenticated
with check (
  (select public.is_member())
  and (
    (bucket_id = 'playable-builds' and name ~ (
      '^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(html|zip)$'))
    or (bucket_id = 'playable-thumbnails' and name ~ (
      '^' || (select auth.uid())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp)$'))
  )
);

-- No UPDATE policy: upload({upsert:true}) and object replacement are forbidden.
-- DELETE is solely for cleanup of the caller's unreferenced uploads. Referenced
-- objects remain protected even after their playable/project has been archived.
create policy "Members clean up their own unreferenced Playable Hub uploads"
on storage.objects for delete to authenticated
using (
  (select public.is_member())
  and split_part(name, '/', 1) = (select auth.uid())::text
  and (
    (bucket_id = 'playable-builds' and not exists (
      select 1 from public.playables p where p.storage_path = storage.objects.name
    ))
    or (bucket_id = 'playable-thumbnails' and not exists (
      select 1 from public.playables p where p.thumbnail_path = storage.objects.name
    ))
  )
);

comment on function public.save_playable(uuid, jsonb, text[]) is
  'Authenticated members only. Atomically create/edit metadata and replace networks. Original source is immutable.';
comment on function public.list_playables(jsonb) is
  'Authenticated members only. Server-side search, combined filters and stable 12-row pages; archived includes archived parents.';
comment on column public.playables.storage_path is 'Private Storage object path; never store expiring signed URLs.';

commit;
