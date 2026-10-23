import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  config: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/config", async () => {
  const { safeNextPath } = await import("@/lib/validation");
  return { getSupabaseConfig: mocks.config, safeNextPath };
});
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { savePlayable, saveProject, setArchived, signIn } from "@/lib/actions";
import { GET as downloadFile } from "@/app/api/files/[id]/route";
import { GET as confirmInvitation } from "@/app/auth/confirm/route";
import { GET as authCallback } from "@/app/auth/callback/route";

const userId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const playableId = "33333333-3333-4333-8333-333333333333";
const playable = { name: "Build 24", project_id: projectId, win_level: "testing", external_url: "https://cdn.example.com/playable.html", network_ids: ["unity-ads", "meta"] };

function authenticated() {
  return { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({ url: "https://example.supabase.co", key: "publishable-test-key" });
  mocks.redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
});

describe("authenticated data mutations", () => {
  it("rejects an invalid playable before contacting the backend", async () => {
    const result = await savePlayable({ ...playable, external_url: "javascript:alert(1)" });
    expect(result).toMatchObject({ ok: false, fieldErrors: { external_url: expect.any(String) } });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("saves playable metadata and networks through one transactional RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: playableId, error: null });
    mocks.createClient.mockResolvedValue({ auth: authenticated(), rpc });
    const result = await savePlayable({ ...playable, created_by: "forged", updated_by: "forged" });
    expect(result).toEqual({ ok: true, data: { id: playableId } });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("save_playable", {
      p_id: null,
      p_data: expect.objectContaining({ name: "Build 24", project_id: projectId, external_url: playable.external_url }),
      p_network_ids: ["unity-ads", "meta"],
    });
    expect(rpc.mock.calls[0][1].p_data).not.toHaveProperty("created_by");
    expect(rpc.mock.calls[0][1].p_data).not.toHaveProperty("network_ids");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/projects/${projectId}`);
  });

  it("preserves a database rejection and never reports success or revalidates", async () => {
    const message = "Build đã lưu không thể thay đổi. Hãy tạo bản sao cho build mới.";
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "22023", message } });
    mocks.createClient.mockResolvedValue({ auth: authenticated(), rpc });
    expect(await savePlayable({ ...playable, id: playableId })).toEqual({ ok: false, error: message });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("does not mutate after the server fails to verify a session", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) }, rpc });
    expect(await savePlayable(playable)).toMatchObject({ ok: false, error: expect.stringContaining("đăng nhập") });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("takes project audit fields from the verified user", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: projectId }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    mocks.createClient.mockResolvedValue({ auth: authenticated(), from });
    expect(await saveProject({ name: "Pocket Builder", owner_id: userId, status: "active", created_by: "forged" })).toEqual({ ok: true, data: { id: projectId } });
    expect(from).toHaveBeenCalledWith("projects");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ created_by: userId, updated_by: userId }));
  });

  it("requires restoring a parent project before its playable", async () => {
    const update = vi.fn();
    const single = vi.fn().mockResolvedValue({ data: { project: { archived_at: "2026-10-23T00:00:00Z" } }, error: null });
    const from = vi.fn().mockReturnValue({ select: () => ({ eq: () => ({ single }) }), update });
    mocks.createClient.mockResolvedValue({ auth: authenticated(), from });
    expect(await setArchived("playable", playableId, false)).toMatchObject({ ok: false, error: expect.stringContaining("Khôi phục dự án") });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("private file download", () => {
  function fileClient(user: { id: string } | null = { id: userId }, data: object | null = {
    storage_path: `${userId}/${playableId}.html`, thumbnail_path: `${userId}/${playableId}.webp`, file_name: "release.html",
  }) {
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://example.supabase.co/storage/v1/object/sign/private-file?token=short-lived" }, error: null });
    const bucket = vi.fn().mockReturnValue({ createSignedUrl });
    const from = vi.fn().mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) }) }) });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, from, storage: { from: bucket } });
    return { createSignedUrl, bucket, from };
  }

  it("denies anonymous access before looking up data or storage", async () => {
    const client = fileClient(null);
    const response = await downloadFile(new NextRequest(`http://localhost/api/files/${playableId}`), { params: Promise.resolve({ id: playableId }) });
    expect(response.status).toBe(401);
    expect(client.from).not.toHaveBeenCalled();
    expect(client.bucket).not.toHaveBeenCalled();
  });

  it("downloads the saved build with attachment disposition and a 60 second URL", async () => {
    const client = fileClient();
    const response = await downloadFile(new NextRequest(`http://localhost/api/files/${playableId}`), { params: Promise.resolve({ id: playableId }) });
    expect(client.bucket).toHaveBeenCalledWith("playable-builds");
    expect(client.createSignedUrl).toHaveBeenCalledWith(`${userId}/${playableId}.html`, 60, { download: "release.html" });
    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).toContain("token=short-lived");
  });

  it("uses the thumbnail bucket and never signs a missing record", async () => {
    const client = fileClient();
    await downloadFile(new NextRequest(`http://localhost/api/files/${playableId}?thumbnail=true`), { params: Promise.resolve({ id: playableId }) });
    expect(client.bucket).toHaveBeenCalledWith("playable-thumbnails");
    expect(client.createSignedUrl).toHaveBeenCalledWith(`${userId}/${playableId}.webp`, 60, undefined);
    const missing = fileClient({ id: userId }, null);
    const response = await downloadFile(new NextRequest(`http://localhost/api/files/${playableId}`), { params: Promise.resolve({ id: playableId }) });
    expect(response.status).toBe(404);
    expect(missing.createSignedUrl).not.toHaveBeenCalled();
  });
});

describe("invitation and login redirects", () => {
  it("verifies invitation tokens before opening password setup", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { verifyOtp } });
    const response = await confirmInvitation(new NextRequest("http://localhost/auth/confirm?token_hash=invitation-token&type=invite"));
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "invitation-token", type: "invite" });
    expect(response.headers.get("location")).toBe("http://localhost/set-password");
  });

  it("rejects unapproved OTP types and failed verification", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: { message: "expired" } });
    mocks.createClient.mockResolvedValue({ auth: { verifyOtp } });
    const unsupported = await confirmInvitation(new NextRequest("http://localhost/auth/confirm?token_hash=test&type=signup"));
    expect(unsupported.headers.get("location")).toContain("/login?error=invalid-invitation");
    expect(verifyOtp).not.toHaveBeenCalled();
    const expired = await confirmInvitation(new NextRequest("http://localhost/auth/confirm?token_hash=test&type=invite"));
    expect(expired.headers.get("location")).toContain("/login?error=invalid-invitation");
  });

  it("exchanges callback codes and prevents an external next URL", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { exchangeCodeForSession } });
    const response = await authCallback(new NextRequest("http://localhost/auth/callback?code=pkce-code&next=%2F%2Fevil.example"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(response.headers.get("location")).toBe("http://localhost/set-password");
  });

  it("only redirects after successful password authentication, to a safe local path", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ auth: { signInWithPassword } });
    const form = new FormData();
    form.set("email", "member@example.com");
    form.set("password", "a-valid-password");
    form.set("next", "//evil.example");
    await expect(signIn(form)).rejects.toThrow("REDIRECT:/projects");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "member@example.com", password: "a-valid-password" });
    signInWithPassword.mockResolvedValue({ error: { message: "invalid" } });
    mocks.redirect.mockClear();
    expect(await signIn(form)).toMatchObject({ error: expect.any(String) });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
