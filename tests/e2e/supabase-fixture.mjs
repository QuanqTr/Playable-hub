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
let delayNext = null;
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
// Self-contained ad creatives for local visual QA only. No remote images, fonts,
// analytics or production data are needed to exercise HTML capture and play.
function previewHtml(index) {
  const themes = [
    { title: "NEON DRIFT", label: "RACE THE NIGHT", background: "#11152d", glow: "#a858ff", accent: "#7df9e5", scene: `<path d="M125 65h140l110 360H15z" fill="#282345"/><path d="M188 65h14l4 65h-22zm-8 105h30l6 95h-44zm-16 145h60l12 110h-84z" fill="#f7d3ff"/><path d="m125 65-110 360m250-360 110 360" stroke="#e54dff" stroke-width="7"/><ellipse cx="196" cy="343" rx="85" ry="22" fill="#a858ff" opacity=".5"/><path d="m133 260 20-58h82l23 58 8 77H124z" fill="#7df9e5"/><path d="m161 214-12 48h92l-15-48z" fill="#182344"/><path d="M135 290h26m71 0h23" stroke="#fff" stroke-width="10"/><path d="M146 324h98" stroke="#44b7ad" stroke-width="5"/>` },
    { title: "GARDEN MERGE", label: "GROW YOUR LITTLE WORLD", background: "#123d37", glow: "#81d887", accent: "#f4d16d", scene: `<ellipse cx="195" cy="318" rx="174" ry="69" fill="#32634d"/><path d="m41 263 154-66 153 66-153 77z" fill="#b4d99b"/><path d="m41 263 154 77 153-77v45l-153 77L41 308z" fill="#75b37b"/><path d="M194 266V147m0 56c-85 3-80-78-80-78 73-4 80 78 80 78m1-22c78 1 80-76 80-76-76-6-80 76-80 76" stroke="#4e8e66" stroke-width="7" fill="#b4eb89"/><path d="M88 278v-51m0 18c-45 3-42-37-42-37 35-4 42 37 42 37m0-4c40 2 42-36 42-36-36-3-42 36-42 36" stroke="#447f58" stroke-width="5" fill="#f4d16d"/><path d="M289 278v-54" stroke="#447f58" stroke-width="6"/><circle cx="289" cy="215" r="30" fill="#ff9fba"/><circle cx="289" cy="215" r="11" fill="#ffe98a"/><circle cx="195" cy="107" r="24" fill="#f4d16d"/>` },
    { title: "COSMIC MATCH", label: "ONE MOVE. PURE MAGIC.", background: "#24204a", glow: "#d18cf5", accent: "#ffa55c", scene: `<circle cx="195" cy="225" r="150" fill="#42306a"/><path d="m195 90 58 86-58 87-58-87z" fill="#b8afff"/><path d="m195 90 12 86-12 87-58-87z" fill="#7e6fe3"/><path d="m85 204 48 64-48 65-48-65z" fill="#ffbc6d"/><path d="m85 204 9 64-9 65-48-65z" fill="#ee874d"/><path d="m300 204 48 64-48 65-48-65z" fill="#78dfd3"/><path d="m300 204 9 64-9 65-48-65z" fill="#3bb8ad"/><path d="m195 280 51 68-51 67-51-67z" fill="#f7a3d0"/><path d="m195 280 9 68-9 67-51-67z" fill="#d665a6"/><path d="m54 122 7 18 19 6-19 6-7 18-7-18-19-6 19-6zm270-43 6 16 17 5-17 5-6 16-6-16-17-5 17-5z" fill="#ffe5b1"/>` },
    { title: "CASTLE QUEST", label: "YOUR KINGDOM AWAITS", background: "#163757", glow: "#80c7e7", accent: "#ffc575", scene: `<circle cx="280" cy="108" r="56" fill="#f9d7a4"/><path d="m0 325 84-135 77 92 60-159 169 202v100H0z" fill="#315270"/><path d="m0 368 92-81 83 72 100-128 115 137v57H0z" fill="#486781"/><path d="M91 207h53v155H91zm155 0h53v155h-53z" fill="#b4c9d7"/><path d="M88 198h60v23H88zm155 0h60v23h-60z" fill="#dae7ed"/><path d="m85 198 33-48 33 48zm155 0 33-48 33 48z" fill="#d77a6c"/><path d="M141 254h108v110H141z" fill="#d4e2e8"/><path d="M179 364v-62c0-25 33-25 33 0v62" fill="#476480"/><path d="M191 254v-90m0 0 56 18-56 17z" stroke="#ffc575" stroke-width="5" fill="#ffc575"/>` },
  ];
  const theme = themes[(index - 1) % themes.length];
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${theme.title}</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Arial,sans-serif;background:${theme.background};color:white}.creative{position:relative;width:100%;height:100%;min-height:500px;overflow:hidden;background:radial-gradient(ellipse at 50% 38%,${theme.glow}44,transparent 62%)}.tag{position:absolute;top:25px;left:24px;font-size:10px;letter-spacing:2px;opacity:.65}.score{position:absolute;right:22px;top:21px;padding:7px 10px;border:1px solid #ffffff36;border-radius:20px;font-size:11px}.copy{position:absolute;top:76px;width:100%;padding:0 22px;text-align:center}.copy p{font-size:10px;letter-spacing:3px;color:${theme.accent};margin:0 0 10px}.copy h1{margin:0;font-weight:900;font-size:39px;line-height:.96;letter-spacing:-2px;text-shadow:0 5px 24px ${theme.background}}svg{position:absolute;width:100%;height:63%;left:0;top:23%}.bottom{position:absolute;bottom:27px;left:23px;right:23px;text-align:center}.bottom p{font-size:12px;color:#ffffffbb;letter-spacing:.2px;margin:0 0 15px}button{border:0;background:${theme.accent};color:${theme.background};border-radius:16px;padding:17px 20px;width:100%;font-weight:800;font-size:16px;box-shadow:0 8px 25px #0004;cursor:pointer}.dots{font-size:14px;letter-spacing:7px;opacity:.5;margin-top:17px}</style></head><body><main class="creative"><span class="tag">PLAYABLE STUDIO</span><span class="score">LEVEL ${String(index).padStart(2, "0")}</span><div class="copy"><p>${theme.label}</p><h1>${theme.title}</h1></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 440">${theme.scene}</svg><div class="bottom"><p id="message">A little challenge. A big adventure.</p><button id="start" onclick="document.getElementById('message').textContent='Bạn đã bắt đầu!';this.textContent='Chơi lại'">Bắt đầu chơi</button><div class="dots">● ○ ○</div></div></main></body></html>`;
}
function reset(seed = true) {
  projects = []; playables = []; serial = 0; failNext = null; delayNext = null; objects.clear(); signedTokens.clear();
  if (seed) {
    projects.push(makeProject({ id: projectId, name: "Dự án mẫu", description: "Dữ liệu fixture dành riêng cho kiểm thử." }));
    const names = ["Neon Drift", "Garden Merge", "Cosmic Match", "Castle Quest"];
    for (let i = 1; i <= 14; i += 1) {
      const storagePath = `${userId}/${randomUUID()}.html`;
      const bytes = Buffer.from(previewHtml(i));
      objects.set(`playable-builds/${storagePath}`, { bytes, type: "text/html" });
      playables.push(makePlayable({ name: `${names[(i - 1) % names.length]} · Concept ${String(i).padStart(2, "0")}`, win_level: i % 2 ? "testing" : "winning", notes: `Creative HTML fixture ${i}, chỉ dùng trong kiểm thử.`, external_url: null, storage_path: storagePath, file_name: `creative-${i}.html`, file_mime: "text/html", file_size: bytes.length, released_at: "2026-10-24" }));
    }
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
    if (url.pathname === "/__test/delay-next" && req.method === "POST") { const data = JSON.parse((await body(req)).toString()); delayNext = { kind: data.kind, ms: Math.max(0, Math.min(2000, Number(data.ms) || 0)) }; return send(res, 200, { ok: true }); }
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
      if (delayNext?.kind === "playables") { const { ms } = delayNext; delayNext = null; await new Promise(resolve => setTimeout(resolve, ms)); }
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
