import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreviewDocument, isHtmlPlayable, MAX_PREVIEW_BYTES, PREVIEW_SANDBOX, safeExternalPreviewUrl, validThumbnailMessage } from "@/lib/preview";

const mocks = vi.hoisted(() => ({ config: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
import { GET } from "@/app/api/preview/[id]/route";
import { beginPreviewPlayback, captureHtmlThumbnail, capturePlayableThumbnail, isPreviewPlaying, loadPlayablePreview, subscribePreviewPlayback } from "@/lib/preview-client";

const id = "33333333-3333-4333-8333-333333333333";
const request = () => new Request(`https://hub.example/api/preview/${id}`);
const context = { params: Promise.resolve({ id }) };
const signedUrl = "https://storage.example/object/sign/build.html?token=short-lived";

function client(record: object | null = { storage_path: "user/build.html", file_name: "build.html", file_mime: "text/html", file_size: 100 }, user: object | null = { id: "member" }) {
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl }, error: null });
  const from = vi.fn().mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: record, error: null }) }) }) });
  const storageFrom = vi.fn().mockReturnValue({ createSignedUrl });
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user }, error: null }) }, from, storage: { from: storageFrom } });
  return { from, storageFrom, createSignedUrl };
}

beforeEach(() => { vi.resetAllMocks(); mocks.config.mockReturnValue({ url: "https://storage.example", key: "public-key" }); });
afterEach(() => vi.unstubAllGlobals());

describe("private preview source", () => {
  it("verifies the member before accessing the record or signing an object", async () => {
    const storage = client(undefined, null);
    const response = await GET(request(), context);
    expect(response.status).toBe(401);
    expect(storage.from).not.toHaveBeenCalled();
    expect(storage.storageFrom).not.toHaveBeenCalled();
  });

  it("only signs an RLS-visible HTML object and returns non-executable private JSON", async () => {
    const storage = client();
    const response = await GET(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({ kind: "html", url: signedUrl });
    expect(storage.createSignedUrl).toHaveBeenCalledWith("user/build.html", 60);
    const missing = client(null);
    expect((await GET(request(), context)).status).toBe(404);
    expect(missing.createSignedUrl).not.toHaveBeenCalled();
  });

  it("describes external previews without ever server-fetching their URL", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const storage = client({ external_url: "https://cdn.example/play.html" });
    const response = await GET(request(), context);
    expect(await response.json()).toEqual({ kind: "external", url: "https://cdn.example/play.html" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it("gives ZIP/oversized builds a truthful download fallback and rejects executable URLs", async () => {
    client({ storage_path: "user/build.zip", file_name: "build.zip", file_mime: "application/zip" });
    expect((await GET(request(), context)).status).toBe(422);
    const large = client({ storage_path: "user/build.html", file_name: "build.html", file_size: MAX_PREVIEW_BYTES + 1 });
    expect((await GET(request(), context)).status).toBe(413);
    expect(large.createSignedUrl).not.toHaveBeenCalled();
    client({ external_url: "javascript:alert(document.cookie)" });
    expect((await GET(request(), context)).status).toBe(422);
  });
});

describe("sandbox and thumbnail protocol", () => {
  it("uses an opaque script-only sandbox and installs restrictions before untrusted HTML", () => {
    expect(PREVIEW_SANDBOX).toBe("allow-scripts");
    const doc = createPreviewDocument('<script>parent.document.body.innerHTML="attack"</script>', 'const value="</script>";');
    expect(doc.indexOf("Content-Security-Policy")).toBeLessThan(doc.indexOf('parent.document'));
    expect(doc).toContain("frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'");
    expect(createPreviewDocument("<p>Live player</p>")).toContain("frame-src 'none'");
    expect(doc).toContain('name="referrer" content="no-referrer"');
    expect(doc).toContain('const value="<\\/script>";');
    expect(doc).not.toContain("allow-same-origin");
  });

  it("accepts only bounded raster data matching the current capture channel", () => {
    expect(validThumbnailMessage({ channel: "capture", image: "data:image/webp;base64,UklGRg==" }, "capture")).toBe(true);
    expect(validThumbnailMessage({ channel: "other", image: "data:image/png;base64,AAAA" }, "capture")).toBe(false);
    expect(validThumbnailMessage({ channel: "capture", image: "data:image/svg+xml;base64,AAAA" }, "capture")).toBe(false);
    expect(validThumbnailMessage({ channel: "capture", image: "https://tracker.example" }, "capture")).toBe(false);
    expect(validThumbnailMessage({ channel: "capture", image: `data:image/png;base64,${"A".repeat(3_000_000)}` }, "capture")).toBe(false);
  });

  it("recognizes HTML and only allows absolute credential-free HTTP links", () => {
    expect(isHtmlPlayable({ file_name: "creative.HTML" })).toBe(true);
    expect(isHtmlPlayable({ file_mime: "text/html" })).toBe(true);
    expect(isHtmlPlayable({ file_name: "creative.zip" })).toBe(false);
    expect(safeExternalPreviewUrl("https://example.com/preview")).toBe("https://example.com/preview");
    for (const url of ["/api/private", "javascript:alert(1)", "data:text/html,attack", "https://user:secret@example.com/"]) expect(safeExternalPreviewUrl(url)).toBeNull();
  });
});

describe("parent HTML download", () => {
  it("downloads privately without forwarding application credentials and keeps the source URL out of HTML", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ kind: "html", url: signedUrl })).mockResolvedValueOnce(new Response("<html><body>Creative</body></html>"));
    vi.stubGlobal("fetch", fetcher);
    const source = await loadPlayablePreview(id, new AbortController().signal);
    expect(source).toEqual({ kind: "html", html: "<html><body>Creative</body></html>" });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
    expect(JSON.stringify(source)).not.toContain("short-lived");
  });

  it("bounds streamed responses even when the server omits Content-Length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_PREVIEW_BYTES + 1)); }, cancel });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ kind: "html", url: signedUrl })).mockResolvedValueOnce(new Response(stream)));
    await expect(loadPlayablePreview(id, new AbortController().signal)).rejects.toThrow("quá lớn");
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("gallery resource limits", () => {
  it("pauses background work while any live player remains mounted", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePreviewPlayback(listener);
    const first = beginPreviewPlayback();
    const second = beginPreviewPlayback();
    first();
    expect(isPreviewPlaying()).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(true);
    second();
    expect(isPreviewPlaying()).toBe(false);
    expect(listener).toHaveBeenLastCalledWith(false);
    unsubscribe();
  });

  it("bounds the entire gallery download queue, prioritizes uploads and releases slots on abort", async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url === "/preview-capture-runtime.js") return new Promise(() => {});
      return Promise.resolve(url.startsWith("/api/preview/") ? Response.json({ kind: "html", url: signedUrl }) : new Response("<html>Creative</html>"));
    });
    vi.stubGlobal("fetch", fetcher);
    const a = new AbortController(), b = new AbortController(), upload = new AbortController();
    const first = capturePlayableThumbnail("first", { signal: a.signal }).catch(error => error);
    const second = capturePlayableThumbnail("second", { signal: b.signal }).catch(error => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(fetcher.mock.calls.filter(([url]) => String(url).startsWith("/api/preview/"))).toEqual([["/api/preview/first", expect.any(Object)]]);
    const priority = captureHtmlThumbnail("<html>Upload</html>", { signal: upload.signal }).catch(error => error);
    a.abort();
    expect((await first).name).toBe("AbortError");
    // Priority capture waits for the shared runtime; the second build has still
    // not downloaded a byte while that capture owns the only slot.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetcher).toHaveBeenCalledTimes(3);
    upload.abort();
    expect((await priority).name).toBe("AbortError");
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
    b.abort();
    expect((await second).name).toBe("AbortError");
  });
});
