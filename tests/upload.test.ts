import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ config: vi.fn(), createClient: vi.fn(), getSession: vi.fn(), remove: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: mocks.config }));

import { removeUploadedAssets, uploadAsset } from "@/lib/upload";

const userId = "11111111-1111-4111-8111-111111111111";
let response: "success" | "network" | "timeout" | "conflict" = "success";

class UploadRequest {
  static instances: UploadRequest[] = [];
  status = 200;
  timeout = 0;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: File | null = null;
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onabort?: () => void;
  constructor() { UploadRequest.instances.push(this); }
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send(file: File) {
    this.body = file;
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 4, total: 8 });
      if (response === "network") this.onerror?.();
      else if (response === "timeout") this.ontimeout?.();
      else { this.status = response === "conflict" ? 409 : 200; this.onload?.(); }
    });
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  response = "success";
  UploadRequest.instances = [];
  vi.stubGlobal("XMLHttpRequest", UploadRequest);
  mocks.config.mockReturnValue({ url: "https://storage.example.test/", key: "public-test-key" });
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: userId }, access_token: "session-test-token" } }, error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue({ remove: mocks.remove });
  mocks.createClient.mockReturnValue({ auth: { getSession: mocks.getSession }, storage: { from: mocks.from } });
});
afterEach(() => vi.unstubAllGlobals());

describe("private direct Storage uploads", () => {
  it("uses authenticated direct uploads, unique paths, canonical MIME and actual progress", async () => {
    const file = new File([new Uint8Array([80, 75, 3, 4, 1, 2, 3, 4])], "build.zip", { type: "application/octet-stream" });
    const progress = vi.fn();
    const asset = await uploadAsset(file, false, progress);
    const request = UploadRequest.instances[0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`https://storage.example.test/storage/v1/object/playable-builds/${asset.path}`);
    expect(asset.path).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.zip$`));
    expect(request.headers).toEqual({ Authorization: "Bearer session-test-token", apikey: "public-test-key", "Content-Type": "application/zip", "x-upsert": "false" });
    expect(request.body).toBe(file);
    expect(asset).toMatchObject({ file_name: "build.zip", file_size: 8, file_mime: "application/zip", thumbnail: false });
    expect(progress.mock.calls.map(call => call[0])).toEqual([0, 50, 100]);
    const next = await uploadAsset(file);
    expect(next.path).not.toBe(asset.path);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rejects a mismatched file header before touching Auth or Storage", async () => {
    await expect(uploadAsset(new File(["fake zip"], "build.zip", { type: "application/zip" }))).rejects.toThrow("ZIP không có định dạng hợp lệ");
    await expect(uploadAsset(new File(["fake png"], "thumbnail.png", { type: "image/png" }), true)).rejects.toThrow("Nội dung ảnh không khớp");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(UploadRequest.instances).toHaveLength(0);
  });

  it.each(["network", "timeout"] as const)("cleans the exact attempted object after an ambiguous %s failure", async mode => {
    response = mode;
    await expect(uploadAsset(new File(["<!doctype html>"], "build.html", { type: "text/html" }))).rejects.toThrow(mode === "network" ? "Mất kết nối" : "quá thời gian");
    const path = UploadRequest.instances[0].url.split("/playable-builds/")[1];
    expect(mocks.from).toHaveBeenCalledWith("playable-builds");
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([path]);
  });

  it("never deletes an existing path rejected as a conflict", async () => {
    response = "conflict";
    await expect(uploadAsset(new File(["<html>"], "build.html"))).rejects.toThrow("Không tải được file");
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("reports best-effort cleanup failure while preserving the upload error", async () => {
    response = "network";
    mocks.remove.mockResolvedValue({ error: { message: "offline" } });
    await expect(uploadAsset(new File(["<html>"], "build.html"))).rejects.toThrow("Mất kết nối khi tải file. Dữ liệu form vẫn được giữ lại. Chưa xác nhận dọn được file vừa tải");
  });

  it("cleans only newly uploaded paths in their own buckets after a save failure", async () => {
    const build = { path: `${userId}/new.html`, file_name: "build.html", file_size: 10, file_mime: "text/html", thumbnail: false };
    const thumbnail = { path: `${userId}/new.png`, file_name: "thumb.png", file_size: 20, file_mime: "image/png", thumbnail: true };
    expect(await removeUploadedAssets([build, thumbnail])).toBe(true);
    expect(mocks.from.mock.calls.map(call => call[0])).toEqual(["playable-builds", "playable-thumbnails"]);
    expect(mocks.remove.mock.calls.map(call => call[0])).toEqual([[build.path], [thumbnail.path]]);
    mocks.remove.mockResolvedValue({ error: { message: "offline" } });
    expect(await removeUploadedAssets([build])).toBe(false);
  });
});
