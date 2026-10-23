/**
 * Test-only Supabase HTTP fixture. This server is never imported by the app.
 * Browser smoke tests use it to exercise real Next requests and server actions.
 * Actual PostgreSQL/RLS invariants are tested separately in tests/database.mjs.
 */
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const port = Number(process.env.FIXTURE_PORT || 54329);
const origin = `http://127.0.0.1:${port}`;
const secret = "playable-hub-local-browser-test-only";
const userId = "11111111-1111-4111-8111-111111111111";
const secondUserId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const profiles = [
  { id: userId, display_name: "An Nguyễn", email: "member@example.test" },
  { id: secondUserId, display_name: "Minh Trần", email: "minh@example.test" },
];
const networks = ["Unity Ads", "Mintegral", "AppLovin", "Meta", "Google Ads", "TikTok", "Khác"].map((name, i) => ({ id: ["unity-ads", "mintegral", "applovin", "meta", "google-ads", "tiktok", "other"][i], name, sort_order: i + 1 }));
const user = { id: userId, aud: "authenticated", role: "authenticated", email: profiles[0].email, app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { display_name: profiles[0].display_name }, identities: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", email_confirmed_at: "2026-01-01T00:00:00Z", is_anonymous: false };
let projects = [];
let playables = [];
let serial = 0;
let lastTime = Date.now();
let failNext = null;
const objects = new Map();
const signedTokens = new Map();

function timestamp() { lastTime += 1000; return new Date(lastTime).toISOString(); }
function jwt() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", email: user.email, iss: `${origin}/auth/v1`, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, aal: "aal1", session_id: "44444444-4444-4444-8444-444444444444", is_anonymous: false })).toString("base64url");
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
}
function authenticated(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  try { return signature === expected && JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now() / 1000; } catch { return false; }
}
function session() { return { access_token: jwt(), refresh_token: "fixture-refresh-token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }; }
function makeProject(values) {
  const now = timestamp();
  return { id: randomUUID(), name: "", description: null, owner_id: userId, status: "active", archived_at: null, created_by: userId, updated_by: userId, created_at: now, updated_at: now, ...values };
}
function makePlayable(values) {
  const now = timestamp();
  serial += 1;
  return { id: randomUUID(), code: `PL-${String(serial).padStart(6, "0")}`, name: "", project_id: projectId, win_level: "unreviewed", external_url: "https://cdn.example.test/build.html", storage_path: null, file_name: null, file_size: null, file_mime: null, thumbnail_path: null, released_at: null, notes: null, archived_at: null, created_by: userId, updated_by: userId, created_at: now, updated_at: now, network_ids: ["unity-ads"], ...values };
}
function reset(seed = true) {
  projects = []; playables = []; serial = 0; failNext = null; objects.clear(); signedTokens.clear();
  if (seed) {
    projects.push(makeProject({ id: projectId, name: "Dự án mẫu", description: "Dữ liệu fixture dành riêng cho kiểm thử." }));
    for (let i = 1; i <= 14; i += 1) playables.push(makePlayable({ name: `Playable mẫu ${String(i).padStart(2, "0")}`, win_level: i % 2 ? "testing" : "winning", notes: `Ghi chú mẫu ${i}` }));
  }
}
reset();
function enrichProject(project) { return { ...project, owner: profiles.find(p => p.id === project.owner_id), playables: [{ count: playables.filter(p => p.project_id === project.id && !p.archived_at).length }], playable_count: playables.filter(p => p.project_id === project.id && !p.archived_at).length }; }
function enrichPlayable(playable) {
  const project = projects.find(p => p.id === playable.project_id);
  return { ...playable, project: enrichProject(project), networks: networks.filter(n => playable.network_ids.includes(n.id)), network_links: networks.filter(n => playable.network_ids.includes(n.id)).map(network => ({ network })), creator: profiles[0], updater: profiles[0] };
}
function send(res, status, value, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(value === undefined ? undefined : JSON.stringify(value));
}
function sendRows(req, res, rows, total = rows.length) {
  const object = req.headers.accept?.includes("application/vnd.pgrst.object+json");
  if (object && rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows` });
  send(res, 200, object ? rows[0] : rows, { "Content-Range": `0-${Math.max(0, rows.length - 1)}/${total}`, "Access-Control-Expose-Headers": "Content-Range" });
}
function matchRows(rows, url) {
  return rows.filter(row => [...url.searchParams].every(([key, value]) => {
    if (["select", "order", "offset", "limit"].includes(key) || key.includes(".")) return true;
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    if (value === "is.null") return row[key] == null;
    if (value === "not.is.null") return row[key] != null;
    if (value.startsWith("ilike.")) return String(row[key]).toLowerCase().includes(value.slice(6).replace(/^%|%$/g, "").replace(/\\([%_\\])/g, "$1").toLowerCase());
    return true;
  }));
}
function sorted(rows) { return [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id)); }
async function body(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks); }

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization,apikey,content-type,x-client-info,x-upsert,cache-control,prefer,range");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, origin);
  try {
    if (url.pathname === "/__test/health") return send(res, 200, { fixture: true });
    if (url.pathname === "/__test/reset" && req.method === "POST") { const data = JSON.parse((await body(req)).toString() || "{}"); reset(data.seed !== false); return send(res, 200, { ok: true }); }
    if (url.pathname === "/__test/fail-next" && req.method === "POST") { failNext = JSON.parse((await body(req)).toString()).kind; return send(res, 200, { ok: true }); }
    if (url.pathname === "/__test/state") return send(res, 200, { projects, playables, objectCount: objects.size });

    if (url.pathname === "/auth/v1/token" && req.method === "POST") {
      const data = JSON.parse((await body(req)).toString());
      if (url.searchParams.get("grant_type") === "refresh_token" || data.email === user.email && data.password === "Test-password-123") return send(res, 200, session());
      return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
    }
    if (url.pathname === "/auth/v1/user") return authenticated(req) ? send(res, 200, user) : send(res, 401, { msg: "Invalid JWT", code: "bad_jwt" });
    if (url.pathname === "/auth/v1/logout") { res.writeHead(204); res.end(); return; }

    // Signed GETs intentionally do not require a session, just like a real expiring URL.
    if (url.pathname.startsWith("/storage/v1/object/sign/") && req.method === "GET") {
      const token = signedTokens.get(url.searchParams.get("token"));
      const key = decodeURIComponent(url.pathname.slice("/storage/v1/object/sign/".length));
      const object = objects.get(key);
      if (!token || token.key !== key || token.expires < Date.now() || !object) return send(res, 403, { message: "Expired or missing signed object" });
      res.writeHead(200, { "Content-Type": object.type, "Cache-Control": "private, no-store", ...(url.searchParams.has("download") ? { "Content-Disposition": `attachment; filename="${(url.searchParams.get("download") || "build.html").replace(/["\r\n]/g, "")}"` } : {}) });
      res.end(object.bytes); return;
    }
    if (!authenticated(req)) return send(res, 401, { code: "42501", message: "Authentication required by test fixture" });

    if (url.pathname.startsWith("/storage/v1/object/sign/") && req.method === "POST") {
      const key = decodeURIComponent(url.pathname.slice("/storage/v1/object/sign/".length));
      const data = JSON.parse((await body(req)).toString());
      if (!objects.has(key)) return send(res, 404, { message: "Object not found" });
      const token = randomUUID(); signedTokens.set(token, { key, expires: Date.now() + data.expiresIn * 1000 });
      return send(res, 200, { signedURL: `/object/sign/${key}?token=${token}` });
    }
    if (url.pathname.startsWith("/storage/v1/object/")) {
      const key = decodeURIComponent(url.pathname.slice("/storage/v1/object/".length));
      if (req.method === "POST") {
        if (failNext === "upload") { failNext = null; return send(res, 500, { message: "Fixture: upload thất bại." }); }
        if (objects.has(key)) return send(res, 409, { message: "Object already exists" });
        objects.set(key, { bytes: await body(req), type: req.headers["content-type"] });
        return send(res, 200, { Key: key, Id: randomUUID() });
      }
      if (req.method === "DELETE") {
        const data = JSON.parse((await body(req)).toString());
        for (const path of data.prefixes || []) objects.delete(`${key}/${path}`);
        return send(res, 200, []);
      }
    }

    if (url.pathname === "/rest/v1/rpc/list_playables") {
      const { p_filters: f = {} } = JSON.parse((await body(req)).toString());
      const rows = sorted(playables.filter(p => {
        const pr = projects.find(project => project.id === p.project_id);
        const isArchived = !!(p.archived_at || pr.archived_at);
        return isArchived === (f.archived === true || f.archived === "true") && (!f.q || `${p.name} ${p.code} ${pr.name}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.project || p.project_id === f.project) && (!f.status || pr.status === f.status) && (!f.owner || pr.owner_id === f.owner) && (!f.win || p.win_level === f.win) && (!f.network || p.network_ids.includes(f.network));
      }));
      const page = Math.max(1, Number(f.page) || 1);
      return send(res, 200, { items: rows.slice((page - 1) * 12, page * 12).map(enrichPlayable), total: rows.length, page, pageSize: 12 });
    }
    if (url.pathname === "/rest/v1/rpc/save_playable") {
      const { p_id, p_data, p_network_ids } = JSON.parse((await body(req)).toString());
      if (failNext === "playable") { failNext = null; return send(res, 400, { code: "P0001", message: "Fixture: lưu dữ liệu thất bại. Vui lòng thử lại." }); }
      let saved;
      if (p_id) {
        saved = playables.find(p => p.id === p_id);
        if (!saved) return send(res, 404, { code: "P0002", message: "Không tìm thấy playable." });
        for (const key of ["storage_path", "external_url", "file_name", "file_size", "file_mime"]) if (saved[key] !== p_data[key]) return send(res, 400, { code: "22023", message: "Build đã lưu không thể thay đổi." });
        Object.assign(saved, p_data, { network_ids: p_network_ids, updated_at: timestamp(), updated_by: userId });
      } else { saved = makePlayable({ ...p_data, network_ids: p_network_ids }); playables.push(saved); }
      return send(res, 200, saved.id);
    }
    const table = url.pathname.replace("/rest/v1/", "");
    if (["profiles", "projects", "playables", "networks"].includes(table)) {
      const rows = table === "profiles" ? profiles : table === "networks" ? networks : table === "projects" ? projects : playables;
      if (req.method === "GET") {
        const matched = matchRows(rows, url);
        const offset = Number(url.searchParams.get("offset") || 0), limit = Number(url.searchParams.get("limit") || matched.length);
        const ordered = ["projects", "playables"].includes(table) ? sorted(matched) : matched;
        return sendRows(req, res, ordered.slice(offset, offset + limit).map(row => table === "projects" ? enrichProject(row) : table === "playables" ? enrichPlayable(row) : row), matched.length);
      }
      if (req.method === "POST" && table === "projects") {
        const values = JSON.parse((await body(req)).toString());
        if (failNext === "project") { failNext = null; return send(res, 500, { code: "P0001", message: "Fixture: lưu dự án thất bại." }); }
        const saved = makeProject(Array.isArray(values) ? values[0] : values); projects.push(saved);
        return sendRows(req, res, [enrichProject(saved)]);
      }
      if (req.method === "PATCH") {
        const values = JSON.parse((await body(req)).toString());
        const matched = matchRows(rows, url);
        matched.forEach(row => Object.assign(row, values, { updated_at: timestamp(), updated_by: userId }));
        return sendRows(req, res, matched.map(row => table === "projects" ? enrichProject(row) : enrichPlayable(row)));
      }
    }
    send(res, 404, { message: `Fixture does not implement ${req.method} ${url.pathname}` });
  } catch (error) { console.error(error); send(res, 500, { message: "Fixture internal error" }); }
});
server.listen(port, "127.0.0.1", () => console.log(`Test-only Supabase fixture listening on ${origin}`));
