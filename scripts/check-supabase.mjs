// Run with: node --env-file=.env.local scripts/check-supabase.mjs
// Uses only the public application key. This script never signs up, signs in,
// invokes a mutation RPC, or changes database/storage data.
const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!configuredUrl || !publicKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or public Supabase key. Load .env.local with --env-file=.env.local.');
  process.exitCode = 1;
} else {
  let baseUrl;
  try {
    baseUrl = new URL(configuredUrl);
    if (!['https:', 'http:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) throw new Error('Invalid URL');
  } catch {
    console.error('NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL without credentials.');
    process.exitCode = 1;
  }

  if (baseUrl) await checkProject(baseUrl, publicKey);
}

async function checkProject(baseUrl, publicKey) {
  const totals = { denied: 0, hidden: 0, readable: 0, errors: 0 };
  console.log(`Read-only Supabase check: ${baseUrl.origin}`);
  console.log('Using the anonymous role; no signup, login, data writes, or file writes.');

  async function request(path, options = {}) {
    try {
      const response = await fetch(new URL(path, baseUrl), {
        ...options,
        headers: { apikey: publicKey, 'Content-Type': 'application/json', ...options.headers },
        signal: AbortSignal.timeout(12_000),
        redirect: 'error',
      });
      let body;
      try { body = await response.json(); } catch { body = null; }
      // Never print response bodies, user records, the key, or request headers.
      return { status: response.status, ok: response.ok, body };
    } catch (error) {
      const causeCode = error?.cause?.code || error?.cause?.errors?.[0]?.code;
      const code = typeof causeCode === 'string' && /^[A-Z_0-9]+$/.test(causeCode) ? causeCode : error?.name;
      return { networkError: code === 'TimeoutError' ? 'TIMEOUT' : code || 'NETWORK_ERROR' };
    }
  }

  function reportAccess(label, result, storage = false) {
    if (result.networkError) {
      totals.errors++;
      console.log(`[ERROR] ${label}: network ${result.networkError}`);
      return;
    }
    const rawCode = result.body?.code || result.body?.error;
    const code = typeof rawCode === 'string' && /^[A-Za-z_0-9-]{1,64}$/.test(rawCode) ? rawCode : '';
    const status = `HTTP ${result.status}${code ? ` / ${code}` : ''}`;
    if (code === 'PGRST205' || code === 'PGRST202') {
      totals.hidden++;
      console.log(`[UNVERIFIED] ${label}: ${status}; absent from exposed schema cache. Migration may be missing, or anon visibility may hide it.`);
    } else if (code === '42501' || [401, 403].includes(result.status)) {
      totals.denied++;
      console.log(`[DENIED] ${label}: ${status}; anonymous access rejected as expected. This does not verify the complete schema/policies.`);
    } else if (result.ok) {
      totals.readable++;
      const count = Array.isArray(result.body) ? result.body.length : null;
      if (count === 0) {
        console.log(`[UNVERIFIED] ${label}: ${status}; empty anonymous result. RLS may hide ${storage ? 'objects or a missing bucket' : 'rows'}; readiness is not established.`);
      } else {
        console.log(`[REVIEW] ${label}: ${status}; anonymous response ${count === null ? 'received' : `contains ${count} visible item(s)`}. Check access policies.`);
      }
    } else {
      totals.errors++;
      console.log(`[ERROR] ${label}: ${status}; requires investigation${storage && result.status === 404 ? '; bucket existence cannot be confirmed anonymously' : ''}.`);
    }
  }

  const settings = await request('/auth/v1/settings');
  if (settings.networkError) {
    totals.errors++;
    console.log(`[ERROR] Auth settings: network ${settings.networkError}`);
  } else if (!settings.ok) {
    totals.errors++;
    console.log(`[ERROR] Auth settings: HTTP ${settings.status}`);
  } else {
    const disabled = settings.body?.disable_signup;
    console.log(`[${disabled === true ? 'OK' : 'REVIEW'}] Auth signup disabled: ${typeof disabled === 'boolean' ? disabled : 'not returned'}`);
    const providers = Object.entries(settings.body?.external || {})
      .filter(([name, enabled]) => /^[a-zA-Z0-9_]+$/.test(name) && typeof enabled === 'boolean')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, enabled]) => `${name}=${enabled}`);
    console.log(`[INFO] Auth external provider flags: ${providers.length ? providers.join(', ') : 'not returned'}`);
  }

  for (const table of ['profiles', 'projects', 'networks', 'playables', 'playable_networks']) {
    reportAccess(`Table ${table}`, await request(`/rest/v1/${table}?select=*&limit=1`));
  }
  // list_playables is declared STABLE and read-only in this project's migration.
  // Its GET endpoint cannot invoke a VOLATILE mutation function.
  reportAccess('RPC list_playables (read-only GET)', await request('/rest/v1/rpc/list_playables?p_filters=%7B%22page%22%3A1%7D'));

  for (const bucket of ['playable-builds', 'playable-thumbnails']) {
    // Supabase Storage uses POST for its read-only object listing operation.
    reportAccess(`Storage object listing ${bucket}`, await request(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: '', limit: 1, offset: 0 }),
    }), true);
  }

  console.log(`Summary: ${totals.denied} anonymous access rejections; ${totals.hidden} hidden/missing schema entries; ${totals.readable} readable/empty responses; ${totals.errors} request errors.`);
  console.log('Cloud readiness remains unverified: anonymous probes cannot establish migration completeness, membership, private bucket configuration, or authenticated app behavior.');
  if (totals.errors) process.exitCode = 1;
}
