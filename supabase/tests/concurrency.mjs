/**
 * Optional real Supabase integration test, using an explicitly provided invited
 * TEST account. Creates a project + 24 builds, then archives the fixtures.
 * Run: node --env-file=.env.local supabase/tests/concurrency.mjs
 * Required extra env: SUPABASE_TEST_EMAIL, SUPABASE_TEST_PASSWORD.
 * Do not point this at production unless archived test fixtures are acceptable.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_TEST_EMAIL;
const password = process.env.SUPABASE_TEST_PASSWORD;
if (!url || !key || !email || !password) {
  console.error('Missing Supabase URL/public key or SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD. No test data was written.');
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password });
if (authError) throw authError;
assert.ok(auth.user);
const fixtureId = randomUUID();
const { error: projectError } = await client.from('projects').insert({
  id: fixtureId, name: `Concurrency test ${fixtureId}`, owner_id: auth.user.id, status: 'active',
});
if (projectError) throw projectError;

try {
  const writes = await Promise.all(Array.from({ length: 24 }, (_, index) => client.rpc('save_playable', {
    p_id: null,
    p_data: {
      name: `Concurrent build ${index + 1}`, project_id: fixtureId,
      external_url: `https://example.test/concurrent/${fixtureId}/${index + 1}`,
    },
    p_network_ids: ['meta', 'unity-ads'],
  })));
  const errors = writes.filter(result => result.error);
  assert.equal(errors.length, 0, JSON.stringify(errors.map(result => result.error)));
  assert.equal(new Set(writes.map(result => result.data)).size, 24, 'All concurrent IDs must be unique');

  const { data: records, error: readError } = await client.from('playables').select('id,code,created_by').eq('project_id', fixtureId);
  if (readError) throw readError;
  assert.equal(records.length, 24);
  assert.equal(new Set(records.map(record => record.code)).size, 24, 'All concurrent codes must be unique');
  assert.ok(records.every(record => /^PL-\d{6,}$/.test(record.code) && record.created_by === auth.user.id));

  const { data: firstPage, error: firstError } = await client.rpc('list_playables', { p_filters: { project: fixtureId, page: 1 } });
  const { data: secondPage, error: secondError } = await client.rpc('list_playables', { p_filters: { project: fixtureId, page: 2 } });
  if (firstError || secondError) throw firstError || secondError;
  assert.equal(firstPage.total, 24);
  assert.equal(firstPage.items.length, 12);
  assert.equal(secondPage.items.length, 12);
  assert.equal(new Set([...firstPage.items, ...secondPage.items].map(record => record.id)).size, 24);
  console.log('Passed: 24 parallel creates produced unique codes; server pagination returned two complete, distinct pages.');
} finally {
  // Preserve the immutable build records, matching the application's no-delete UI.
  const { error: archiveError } = await client.from('projects').update({ archived_at: new Date().toISOString() }).eq('id', fixtureId);
  await client.auth.signOut();
  if (archiveError) throw new Error(`Test fixture ${fixtureId} could not be archived: ${archiveError.message}`);
  console.log(`Archived test project ${fixtureId}. Its builds are accessible in the archive view.`);
}
