// Executable PostgreSQL/RLS checks without an external Supabase account.
// PGlite runs real PostgreSQL; auth/storage below are minimal explicit stubs.
// This does not run GoTrue, PostgREST, Storage HTTP or signed-download behavior.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const database = new PGlite();
let checks = 0;
const memberOne = '11111111-1111-4111-8111-111111111111';
const memberTwo = '22222222-2222-4222-8222-222222222222';
const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const buildPath = `${memberOne}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html`;
const unusedPath = `${memberOne}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.zip`;
const thumbnailPath = `${memberOne}/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png`;
const query = (text, params = []) => database.query(text, params);
async function scalar(text, params = []) {
  const result = await query(text, params);
  return Object.values(result.rows[0])[0];
}
function equal(actual, expected, description) {
  assert.deepEqual(actual, expected, description);
  checks++;
  console.log(`ok ${checks} - ${description}`);
}
async function rejects(text, params, expectedCode, description) {
  await assert.rejects(query(text, params), error => error.code === expectedCode, description);
  checks++;
  console.log(`ok ${checks} - ${description}`);
}
async function asMember(id) {
  await database.exec(`reset role; set role authenticated; set request.jwt.claims = '${JSON.stringify({ sub: id, role: 'authenticated' })}';`);
}
async function save(id, data, networks = []) {
  return scalar('select public.save_playable($1::uuid, $2::jsonb, $3::text[])', [id, JSON.stringify(data), networks]);
}
async function list(filters = {}) {
  return scalar('select public.list_playables($1::jsonb)', [JSON.stringify(filters)]);
}

try {
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $fn$
      select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
    $fn$;
  `);
  await database.exec(`
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null, owner_id text, metadata jsonb not null default '{}'::jsonb,
      unique(bucket_id, name)
    );
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    grant select on storage.buckets to anon, authenticated;
  `);
  const migration = await readFile(new URL('../supabase/migrations/202610230001_initial.sql', import.meta.url), 'utf8');
  await database.exec(migration);
  const storeMigration = await readFile(new URL('../supabase/migrations/202610260001_project_store.sql', import.meta.url), 'utf8');
  await database.exec(storeMigration);
  const deleteMigration = await readFile(new URL('../supabase/migrations/202610260002_archive_delete.sql', import.meta.url), 'utf8');
  await database.exec(deleteMigration);
  equal(await scalar("select count(*)::int from information_schema.columns where table_schema='public' and table_name='projects' and column_name in ('store_url','app_icon_url')"), 2, 'Project store link and icon columns exist');
  equal(await scalar("select count(*)::int from public.networks"), 7, 'Migration executes and seeds all required networks');
  equal(await scalar("select bool_and(not public) from storage.buckets"), true, 'Both Storage buckets are private');
  equal(await scalar("select file_size_limit::int from storage.buckets where id='playable-builds'"), 52428800, 'Build bucket has 50 MiB maximum');
  equal(await scalar("select file_size_limit::int from storage.buckets where id='playable-thumbnails'"), 5242880, 'Thumbnail bucket has 5 MiB maximum');
  equal(await scalar("select prosecdef from pg_proc where oid='public.save_playable(uuid,jsonb,text[])'::regprocedure"), false, 'Save RPC cannot bypass RLS');

  await query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3),($4,$5,$6)', [
    memberOne, 'one@example.test', JSON.stringify({ display_name: 'Member One' }),
    memberTwo, 'two@example.test', JSON.stringify({ display_name: 'Member Two' }),
  ]);
  equal(await scalar('select count(*)::int from public.profiles'), 2, 'Auth trigger provisions profiles');

  await database.exec(`set role anon; set request.jwt.claims = '{"role":"anon"}';`);
  await rejects('select * from public.projects', [], '42501', 'Anonymous table access is denied');
  await rejects('select * from public.profiles', [], '42501', 'Anonymous member-email access is denied');
  await rejects('select public.list_playables()', [], '42501', 'Anonymous RPC execution is denied');
  equal(await scalar('select count(*)::int from storage.objects'), 0, 'Anonymous Storage listing returns nothing');

  await asMember(memberOne);
  equal(await scalar('select public.is_member()'), true, 'An invited member is recognized');
  await rejects('insert into public.profiles(id,display_name,email) values ($1,$2,$3)',
    ['33333333-3333-4333-8333-333333333333', 'Intruder', 'intruder@example.test'], '42501', 'Members cannot grant membership');
  await query('insert into public.projects(id,name,owner_id,created_by,updated_by,created_at) values ($1,$2,$3,$4,$4,$5)',
    [projectId, 'Project Alpha', memberOne, memberTwo, '2000-01-01']);
  equal(await scalar('select created_by from public.projects where id=$1', [projectId]), memberOne, 'Project audit ignores a spoofed creator');
  equal(await scalar("select created_at > '2020-01-01' from public.projects where id=$1", [projectId]), true, 'Project timestamp is generated by the database');
  await rejects('update public.projects set store_url=$1 where id=$2', ['https://play.google.com.evil.test/store/apps/details?id=com.example.game', projectId], '23514', 'Database rejects a forged store domain');
  await query('update public.projects set store_url=$1,app_icon_url=$2 where id=$3', ['https://play.google.com/store/apps/details?id=com.example.game', 'https://play-lh.googleusercontent.com/icon', projectId]);
  equal(await scalar('select store_url from public.projects where id=$1', [projectId]), 'https://play.google.com/store/apps/details?id=com.example.game', 'Project retains its store listing');
  await rejects('select public.save_playable(null,$1::jsonb,$2::text[])',
    [JSON.stringify({ name: 'Missing source', project_id: projectId }), []], '23514', 'A build must have a source');
  await rejects('select public.save_playable(null,$1::jsonb,$2::text[])',
    [JSON.stringify({ name: 'Unsafe source', project_id: projectId, external_url: 'javascript:alert(1)' }), []], '23514', 'Database rejects unsafe URL protocols');

  const urlId = await save(null, { name: 'URL build', project_id: projectId, external_url: 'https://example.test/build.html' }, ['meta', 'meta', 'unity-ads']);
  equal(await scalar('select count(*)::int from public.playable_networks where playable_id=$1', [urlId]), 2, 'Metadata and distinct network selections save together');
  equal(/^PL-\d{6,}$/.test(await scalar('select code from public.playables where id=$1', [urlId])), true, 'Build code is server generated');
  await rejects('select public.save_playable($1,$2::jsonb,$3::text[])',
    [urlId, JSON.stringify({ name: 'Must roll back' }), ['unknown-network']], '23503', 'Invalid network rejects the transaction');
  equal(await scalar('select name from public.playables where id=$1', [urlId]), 'URL build', 'Failed save keeps original metadata');
  equal(await scalar('select count(*)::int from public.playable_networks where playable_id=$1', [urlId]), 2, 'Failed save keeps original relationships');
  // Inject a relation write failure AFTER metadata UPDATE and relationship
  // DELETE, establishing rollback rather than only testing input prevalidation.
  await database.exec(`reset role;
    create function public.test_network_write_failure() returns trigger language plpgsql as $fn$
    begin raise exception 'Injected network write failure'; end;
    $fn$;
    create trigger test_network_write_failure before insert on public.playable_networks
      for each row execute function public.test_network_write_failure();`);
  await asMember(memberOne);
  await rejects('select public.save_playable($1,$2::jsonb,$3::text[])',
    [urlId, JSON.stringify({ name: 'Partial write must roll back' }), ['other']], 'P0001', 'A relation-write failure rolls the RPC transaction back');
  equal(await scalar('select name from public.playables where id=$1', [urlId]), 'URL build', 'A failure after metadata UPDATE restores original metadata');
  equal(await scalar('select count(*)::int from public.playable_networks where playable_id=$1', [urlId]), 2, 'A failure after relation DELETE restores original networks');
  await database.exec(`reset role;
    drop trigger test_network_write_failure on public.playable_networks;
    drop function public.test_network_write_failure();`);
  await asMember(memberOne);
  await rejects('update public.playables set external_url=$1 where id=$2', ['https://example.test/replaced.html', urlId], '22023', 'External source is immutable through direct SQL');
  await rejects('update public.playables set code=$1 where id=$2', ['PL-999999', urlId], '22023', 'Code is immutable through direct SQL');

  await rejects('insert into storage.objects(bucket_id,name,metadata) values ($1,$2,$3)',
    ['playable-builds', `${memberTwo}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html`, '{"size":128,"mimetype":"text/html"}'],
    '42501', 'Storage upload cannot use another member path');
  await rejects('insert into storage.objects(bucket_id,name,metadata) values ($1,$2,$3)',
    ['playable-builds', `${memberOne}/build.html`, '{"size":128,"mimetype":"text/html"}'],
    '42501', 'Storage upload requires a unique UUID object name');
  await query('insert into storage.objects(bucket_id,name,metadata) values ($1,$2,$3),($1,$4,$5),($6,$7,$8)',
    ['playable-builds', buildPath, '{"size":128,"mimetype":"text/html"}', unusedPath, '{"size":256,"mimetype":"application/zip"}',
      'playable-thumbnails', thumbnailPath, '{"size":64,"mimetype":"image/png"}']);
  const fileData = { name: 'File build', project_id: projectId, storage_path: buildPath, file_name: 'build.html',
    file_size: 128, file_mime: 'text/html', thumbnail_path: thumbnailPath };
  await rejects('select public.save_playable(null,$1::jsonb,$2::text[])',
    [JSON.stringify({ ...fileData, file_size: 999 }), []], '22023', 'File size must match the stored object');
  const fileId = await save(null, fileData, ['mintegral']);
  equal(await scalar('select storage_path from public.playables where id=$1', [fileId]), buildPath, 'Build path saves without a signed URL');
  await rejects('update public.playables set storage_path=$1 where id=$2', [unusedPath, fileId], '22023', 'Original build file cannot be replaced');
  equal((await query('update storage.objects set metadata=$1 where name=$2 returning name', ['{}', buildPath])).rows.length,
    0, 'Storage UPDATE policy prevents overwrite');
  equal((await query('delete from storage.objects where name=$1 returning name', [buildPath])).rows.length,
    0, 'Referenced build cannot be deleted');
  equal((await query('delete from storage.objects where name=$1 returning name', [thumbnailPath])).rows.length,
    0, 'Referenced thumbnail cannot be deleted');
  await query('update public.playables set build_object_id=null,thumbnail_object_id=null where id=$1', [fileId]);
  equal(await scalar('select build_object_id is not null and thumbnail_object_id is not null from public.playables where id=$1', [fileId]),
    true, 'Clients cannot detach internal object references to bypass cleanup protection');
  await database.exec('reset role');
  await rejects('delete from storage.objects where name=$1', [buildPath], '23503', 'Foreign key protects a referenced build even independently of RLS');
  await rejects('delete from storage.objects where name=$1', [thumbnailPath], '23503', 'Foreign key protects a referenced thumbnail even independently of RLS');

  await asMember(memberTwo);
  equal((await list()).total, 2, 'A second member sees the shared repository');
  await save(fileId, { win_level: 'winning', notes: 'Edited by Member Two' }, ['meta', 'google-ads']);
  equal(await scalar('select win_level from public.playables where id=$1', [fileId]), 'winning', 'Collaborator updates persist');
  equal(await scalar('select created_by from public.playables where id=$1', [fileId]), memberOne, 'Edit preserves creator');
  equal(await scalar('select updated_by from public.playables where id=$1', [fileId]), memberTwo, 'Edit records the authenticated updater');
  await rejects('select public.save_playable(null,$1::jsonb,$2::text[])',
    [JSON.stringify({ ...fileData, name: 'Stolen build' }), []], '42501', 'Another member cannot attach an upload they do not own');
  equal((await query('delete from storage.objects where name=$1 returning name', [unusedPath])).rows.length,
    0, 'Another member cannot clean up an unreferenced upload');
  await query('update public.projects set owner_id=$1,status=$2 where id=$3', [memberTwo, 'paused', projectId]);
  const combined = await list({ q: 'Project Alpha', project: projectId, owner: memberTwo, status: 'paused', win: 'winning', network: 'meta' });
  equal(combined.total, 1, 'Search combines with project, owner, status, win and network filters');
  equal(combined.items[0].project.owner.display_name, 'Member Two', 'Filtered rows include the project owner');
  equal((await list({ q: 'nothing matches' })).total, 0, 'No-results count is distinct from total repository count');
  equal((await list({ project: '', owner: '', archived: '', page: '' })).total, 2, 'Empty URL filter values are handled');

  await query('update public.playables set archived_at=now() where id=$1', [urlId]);
  equal((await list()).total, 1, 'Default list hides an archived playable');
  equal((await list({ archived: true })).total, 1, 'Archive list includes archived playables');
  await query('update public.playables set archived_at=null where id=$1', [urlId]);
  await query('update public.projects set archived_at=now() where id=$1', [projectId]);
  equal((await list()).total, 0, 'Archived parent hides unarchived children from the main list');
  equal((await list({ archived: true })).total, 2, 'Archive list includes children of archived projects');
  await query('update public.projects set archived_at=null where id=$1', [projectId]);
  equal((await list()).total, 2, 'Restoring the parent restores list visibility');

  await query("insert into public.playables(name,project_id,external_url) select 'Pagination ' || n,$1,'https://example.test/build/' || n from generate_series(1,15) n", [projectId]);
  const pageOne = await list({ page: 1 });
  const pageTwo = await list({ page: 2 });
  equal(pageOne.total, 17, 'Server pagination reports the full filtered count');
  equal(pageOne.items.length, 12, 'First server page has twelve rows');
  equal(pageTwo.items.length, 5, 'Second server page contains only remaining rows');
  equal(new Set([...pageOne.items, ...pageTwo.items].map(record => record.id)).size, 17, 'Pages never repeat records');
  equal((await list({ page: 1 })).items.map(record => record.id), pageOne.items.map(record => record.id), 'Ordering stays deterministic for tied timestamps');
  equal(await scalar('select count(distinct code)::int from public.playables'), 17, 'Sequence generates unique codes across multi-row inserts');
  await rejects('delete from public.playables', [], '42501', 'Members cannot permanently delete playable records');
  await rejects('delete from public.projects', [], '42501', 'Members cannot permanently delete projects');

  await asMember(memberOne);
  await query('delete from public.playable_networks where playable_id=$1 and network_id=$2', [fileId, 'meta']);
  equal(await scalar('select updated_by from public.playables where id=$1', [fileId]), memberOne,
    'Direct junction edits also record the authenticated updater on the playable');
  equal((await query('delete from storage.objects where name=$1 returning name', [unusedPath])).rows.length,
    1, 'Uploader can clean up their own unreferenced upload');
  await asMember('99999999-9999-4999-8999-999999999999');
  equal(await scalar('select public.is_member()'), false, 'A forged nonmember identity has no membership');
  equal(await scalar('select count(*)::int from public.projects'), 0, 'RLS hides projects from a nonmember authenticated identity');
  equal(await scalar('select count(*)::int from public.profiles'), 0, 'RLS also hides member emails from a nonmember authenticated identity');
  await rejects('select public.list_playables()', [], '42501', 'RPC rejects a nonmember authenticated identity');
  await rejects('select public.delete_archived_playable($1::uuid)', [fileId], '42501', 'Nonmembers cannot permanently delete a playable');

  // Regression: codes must expand beyond six digits rather than be truncated.
  await database.exec("reset role; select setval('public.playable_code_seq',999999);");
  await asMember(memberOne);
  const millionthId = await save(null, { name: 'Millionth code', project_id: projectId, external_url: 'https://example.test/million' });
  equal(await scalar('select code from public.playables where id=$1', [millionthId]), 'PL-1000000', 'Code allocator remains unique after six digits');
  await rejects('select public.delete_archived_playable($1::uuid)', [fileId], '22023', 'Active playables cannot be permanently deleted');
  await rejects('select public.delete_archived_project($1::uuid)', [projectId], '22023', 'Active projects cannot be permanently deleted');
  await asMember(memberTwo);
  await query('update public.playables set archived_at=now() where id=$1', [fileId]);
  equal(await scalar('select public.delete_archived_playable($1::uuid)', [fileId]), projectId, 'Member can permanently delete an archived playable');
  equal(await scalar('select count(*)::int from public.pending_asset_deletions'), 2, 'Build and thumbnail remain queued for Storage cleanup');
  equal((await query('delete from storage.objects where name=$1 returning name', [buildPath])).rows.length, 1, 'Another member can remove a queued build after metadata deletion');
  equal((await query('delete from storage.objects where name=$1 returning name', [thumbnailPath])).rows.length, 1, 'Another member can remove a queued thumbnail after metadata deletion');
  equal(await scalar('select count(*)::int from public.pending_asset_deletions'), 0, 'Storage deletion automatically clears the cleanup queue');
  await rejects('delete from public.pending_asset_deletions', [], '42501', 'Members cannot discard queued file cleanup');
  await query('update public.projects set archived_at=now() where id=$1', [projectId]);
  equal(await scalar('select public.delete_archived_project($1::uuid)', [projectId]), projectId, 'Archived project can be permanently deleted with its playables');
  equal(await scalar('select count(*)::int from public.playables'), 0, 'Project deletion removes all child playable records');

  console.log(`\nPassed ${checks} PostgreSQL/RLS checks using PGlite with explicit Auth/Storage stubs.`);
  console.log('Real Supabase Auth, Storage MIME/size enforcement, signed URLs and parallel HTTP requests still require configured integration checks.');
} finally {
  await database.close();
}
