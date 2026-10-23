-- Run against a disposable/local Supabase database with `supabase test db`.
-- The transaction rolls every fixture back. Storage fixtures are metadata only;
-- real upload/download behavior belongs to the application's smoke checklist.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'hub-test-one@example.test', '{"display_name":"Thành viên Một"}'),
  ('22222222-2222-4222-8222-222222222222', 'hub-test-two@example.test', '{"display_name":"Thành viên Hai"}');

select is((select count(*) from public.profiles where email like 'hub-test-%@example.test'), 2::bigint,
  'Auth invitations automatically provision member profiles');
select is((select count(*) from public.networks), 7::bigint, 'The seven required networks are seeded');
select ok((select not public from storage.buckets where id = 'playable-builds'), 'Build bucket is private');
select ok((select not public from storage.buckets where id = 'playable-thumbnails'), 'Thumbnail bucket is private');
select is((select file_size_limit from storage.buckets where id = 'playable-builds'), 52428800::bigint,
  'Build bucket enforces the 50 MiB repository limit');
select is((select file_size_limit from storage.buckets where id = 'playable-thumbnails'), 5242880::bigint,
  'Thumbnail bucket enforces the 5 MiB repository limit');
select ok(not (select prosecdef from pg_proc where oid = 'public.save_playable(uuid,jsonb,text[])'::regprocedure),
  'Save RPC is SECURITY INVOKER');
select ok(not (select prosecdef from pg_proc where oid = 'public.list_playables(jsonb)'::regprocedure),
  'List RPC is SECURITY INVOKER');

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok('select * from public.projects', '42501', null, 'Anonymous users cannot read projects');
select throws_ok('select * from public.profiles', '42501', null, 'Anonymous users cannot read member emails');
select throws_ok('select public.list_playables(''{}''::jsonb)', '42501', null, 'Anonymous users cannot invoke list RPC');
select throws_ok('select public.save_playable()', '42501', null, 'Anonymous users cannot invoke save RPC');
select is((select count(*) from storage.objects where bucket_id in ('playable-builds', 'playable-thumbnails')),
  0::bigint, 'Anonymous users cannot list private objects');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select ok(public.is_member(), 'Invited member is recognized');
select throws_ok($test$
  insert into public.profiles(id, display_name, email)
  values ('33333333-3333-4333-8333-333333333333', 'Unauthorized', 'bad@example.test')
$test$, '42501', null, 'Members cannot provision their own membership records');

insert into public.projects(id, name, owner_id, created_by, updated_by, created_at, updated_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Project Alpha',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222',
  '2000-01-01', '2000-01-01');
select is((select created_by::text from public.projects where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '11111111-1111-4111-8111-111111111111', 'Project creator comes from the session, ignoring client spoofing');
select ok((select created_at > '2020-01-01' from public.projects where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Project timestamps come from the server');

select throws_ok($test$
  select public.save_playable(null, '{"name":"Missing source","project_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}', '{}')
$test$, '23514', null, 'A playable must have a build file or external URL');
select throws_ok($test$
  select public.save_playable(null, '{"name":"Unsafe URL","project_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","external_url":"javascript:alert(1)"}', '{}')
$test$, '23514', null, 'Non HTTP/HTTPS URLs are rejected in the database');

select lives_ok($test$
  select public.save_playable(null,
    '{"name":"URL build","project_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","external_url":"https://example.test/build.html","notes":"Initial notes"}',
    array['unity-ads','meta','meta'])
$test$, 'A URL build and its distinct network associations save together');
select is((select count(*) from public.playable_networks pn join public.playables p on p.id = pn.playable_id where p.name = 'URL build'),
  2::bigint, 'Duplicate network selections are normalized');
select matches((select code from public.playables where name = 'URL build'), '^PL-[0-9]{6,}$', 'Playable code is generated');

select throws_ok($test$
  select public.save_playable((select id from public.playables where name = 'URL build'),
    '{"name":"Partial save must not remain"}', array['does-not-exist'])
$test$, '23503', null, 'An invalid network causes the entire save to fail');
select is((select count(*) from public.playables where name = 'URL build'), 1::bigint, 'Failed save keeps original metadata');
select is((select count(*) from public.playable_networks pn join public.playables p on p.id = pn.playable_id where p.name = 'URL build'),
  2::bigint, 'Failed save keeps the original networks');

-- Inject a database failure AFTER metadata UPDATE and network DELETE to verify
-- true transactional rollback, beyond the preceding validation failure.
reset role;
create function public.test_network_write_failure() returns trigger language plpgsql as $$
begin raise exception 'Injected network write failure'; end;
$$;
create trigger test_network_write_failure before insert on public.playable_networks
  for each row execute function public.test_network_write_failure();
set local role authenticated;
select throws_ok($test$
  select public.save_playable((select id from public.playables where name = 'URL build'),
    '{"name":"Partial write must roll back"}', array['other'])
$test$, 'P0001', null, 'A relation-write failure aborts the complete transaction');
select is((select count(*) from public.playables where name = 'URL build'), 1::bigint,
  'Failure after metadata UPDATE restores the metadata');
select is((select count(*) from public.playable_networks pn join public.playables p on p.id = pn.playable_id where p.name = 'URL build'),
  2::bigint, 'Failure after network DELETE restores the original network relations');
reset role;
drop trigger test_network_write_failure on public.playable_networks;
drop function public.test_network_write_failure();
set local role authenticated;

select throws_ok($test$
  update public.playables set external_url = 'https://example.test/replaced.html' where name = 'URL build'
$test$, '22023', null, 'Original external URL cannot be replaced by a direct table update');
select throws_ok($test$
  update public.playables set code = 'PL-999999' where name = 'URL build'
$test$, '22023', null, 'Playable code is immutable even through direct table access');

select throws_ok($test$
  insert into storage.objects(bucket_id, name, metadata)
  values ('playable-builds', '22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html',
    '{"size":128,"mimetype":"text/html"}')
$test$, '42501', null, 'Members cannot upload into another member UUID path');
select throws_ok($test$
  insert into storage.objects(bucket_id, name, metadata)
  values ('playable-builds', '11111111-1111-4111-8111-111111111111/build.html',
    '{"size":128,"mimetype":"text/html"}')
$test$, '42501', null, 'Object names require a random UUID, not a reusable filename');

insert into storage.objects(bucket_id, name, metadata) values
  ('playable-builds', '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html', '{"size":128,"mimetype":"text/html"}'),
  ('playable-builds', '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.zip', '{"size":256,"mimetype":"application/zip"}'),
  ('playable-thumbnails', '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png', '{"size":64,"mimetype":"image/png"}');
select throws_ok($test$
  select public.save_playable(null,
    '{"name":"Wrong metadata","project_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","storage_path":"11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html","file_name":"build.html","file_size":999,"file_mime":"text/html"}', '{}')
$test$, '22023', null, 'Declared build size must match the uploaded object metadata');
select lives_ok($test$
  select public.save_playable(null,
    '{"name":"File build","project_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","storage_path":"11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html","file_name":"build.html","file_size":128,"file_mime":"text/html","thumbnail_path":"11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png"}',
    array['mintegral'])
$test$, 'An existing private file with matching metadata can be attached');
select throws_ok($test$
  update public.playables set storage_path = '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.zip' where name = 'File build'
$test$, '22023', null, 'Original build object cannot be replaced');
select is_empty($test$
  update storage.objects set metadata = '{"size":999,"mimetype":"text/html"}'
  where name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html' returning name
$test$, 'No storage UPDATE policy permits file overwrite');
select is_empty($test$
  delete from storage.objects where name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html' returning name
$test$, 'Referenced builds cannot be deleted by their uploader');
select is_empty($test$
  delete from storage.objects where name = '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png' returning name
$test$, 'Referenced thumbnails cannot be deleted');
update public.playables set build_object_id = null, thumbnail_object_id = null where name = 'File build';
select ok((select build_object_id is not null and thumbnail_object_id is not null from public.playables where name = 'File build'),
  'Clients cannot detach internal object references to bypass cleanup protection');
reset role;
select throws_ok($test$
  delete from storage.objects where name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html'
$test$, '23503', null, 'Foreign key protects referenced build independently of a policy snapshot');
select throws_ok($test$
  delete from storage.objects where name = '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png'
$test$, '23503', null, 'Foreign key protects referenced thumbnail independently of a policy snapshot');
set local role authenticated;

set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((public.list_playables('{}')->>'total')::integer, 2, 'A second invited member sees the entire shared repository');
select lives_ok($test$
  select public.save_playable((select id from public.playables where name = 'File build'),
    '{"win_level":"winning","notes":"Updated by another member"}', array['meta','google-ads'])
$test$, 'Every member can edit another member metadata and networks');
select is((select win_level from public.playables where name = 'File build'), 'winning', 'Win assessment persists');
select is((select updated_by::text from public.playables where name = 'File build'),
  '22222222-2222-4222-8222-222222222222', 'Updater is the authenticated collaborator');
select is((select created_by::text from public.playables where name = 'File build'),
  '11111111-1111-4111-8111-111111111111', 'Original creator remains unchanged');
select throws_ok($test$
  select public.save_playable(null,
    '{"name":"Stolen attachment","project_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","storage_path":"11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.html","file_name":"build.html","file_size":128,"file_mime":"text/html"}', '{}')
$test$, '42501', null, 'A member cannot attach another member upload to a new record');
select is_empty($test$
  delete from storage.objects where name = '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.zip' returning name
$test$, 'Other members cannot delete even an unreferenced upload');

update public.projects set owner_id = '22222222-2222-4222-8222-222222222222', status = 'paused'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is((public.list_playables('{"q":"Project Alpha","owner":"22222222-2222-4222-8222-222222222222","status":"paused","win":"winning","network":"meta"}')->>'total')::integer,
  1, 'Project search, owner, project status, win and network filters combine');
select is((public.list_playables('{"q":"does not exist"}')->>'total')::integer, 0, 'No-results count is zero');
select is((public.list_playables('{}')->'items'->0->'project'->'owner'->>'display_name'),
  'Thành viên Hai', 'List items include nested project owner metadata');

update public.playables set archived_at = now() where name = 'URL build';
select is((public.list_playables('{}')->>'total')::integer, 1, 'Default view hides archived playables');
select is((public.list_playables('{"archived":true}')->>'total')::integer, 1, 'Archive view contains archived playables');
update public.playables set archived_at = null where name = 'URL build';
update public.projects set archived_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is((public.list_playables('{}')->>'total')::integer, 0, 'Archiving a parent hides its unarchived playables');
select is((public.list_playables('{"archived":true}')->>'total')::integer, 2, 'Archive view includes playables with archived parents');
update public.projects set archived_at = null where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
select is((public.list_playables('{}')->>'total')::integer, 2, 'Restoring the parent makes its playables visible again');

-- Multi-row inserts exercise the same sequence used by independent transactions.
-- For real parallel-client verification, run tests/concurrency.mjs separately.
insert into public.playables(name, project_id, external_url)
select 'Pagination build ' || n, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://example.test/build/' || n
from generate_series(1, 15) n;
select is((select count(distinct code) from public.playables), (select count(*) from public.playables),
  'All allocated codes are unique across multiple writes');
select is(jsonb_array_length(public.list_playables('{}')->'items'), 12, 'First page contains only twelve rows');
select is(jsonb_array_length(public.list_playables('{"page":2}')->'items'), 5, 'Second page contains the remaining five rows');
select is((public.list_playables('{"page":2}')->>'total')::integer, 17, 'Every page reports the total filtered count');
select is(public.list_playables('{}')->'items', public.list_playables('{}')->'items', 'Ordering is deterministic when timestamps tie');
select is((
  select count(*) from jsonb_array_elements(public.list_playables('{}')->'items') a
  join jsonb_array_elements(public.list_playables('{"page":2}')->'items') b on a->>'id' = b->>'id'
), 0::bigint, 'Adjacent pages never repeat a playable');

select throws_ok('delete from public.playables', '42501', null, 'Permanent deletion is not granted to members');
select throws_ok('delete from public.projects', '42501', null, 'Permanent project deletion is not granted to members');
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
delete from public.playable_networks where playable_id = (select id from public.playables where name = 'File build') and network_id = 'meta';
select is((select updated_by::text from public.playables where name = 'File build'),
  '11111111-1111-4111-8111-111111111111', 'Direct junction changes also audit the authenticated updater');
delete from storage.objects where name = '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.zip';
select is((select count(*) from storage.objects where name = '11111111-1111-4111-8111-111111111111/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.zip'),
  0::bigint, 'Uploader can clean up their own unreferenced object after a failed save');

set local request.jwt.claims = '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}';
select ok(not public.is_member(), 'An authenticated identity without a profile is not a member');
select is((select count(*) from public.projects), 0::bigint, 'RLS rejects a nonmember authenticated identity');
select is((select count(*) from public.profiles), 0::bigint, 'RLS also hides member emails from a nonmember authenticated identity');
select throws_ok('select public.list_playables(''{}''::jsonb)', '42501', null, 'The RPC also rejects a nonmember identity');
reset role;

select * from finish();
rollback;
