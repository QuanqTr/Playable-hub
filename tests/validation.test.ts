import { describe, expect, it } from "vitest";
import { isDateOnly, playableSchema, projectSchema, safeNextPath, validateUpload } from "../lib/validation";
import { queryHref } from "../lib/utils";
import { readFilters } from "../lib/search";
import { parseStoreUrl } from "../lib/store-url";
const uuid = "11111111-1111-4111-8111-111111111111";
const valid = { name: "Build 1", project_id: uuid, win_level: "unreviewed", external_url: "https://example.com/build.html", network_ids: ["unity-ads", "meta"] };
describe("Dữ liệu dự án và playable", () => {
  it("bắt buộc tên, owner và trạng thái hợp lệ", () => { expect(projectSchema.safeParse({ name: " ", owner_id: "bad", status: "other" }).success).toBe(false); expect(projectSchema.parse({ name: " Project ", owner_id: uuid, status: "completed" }).name).toBe("Project"); });
  it("chỉ nhận URL app từ hai store và lấy đúng mã ứng dụng", () => {
    expect(parseStoreUrl("https://play.google.com/store/apps/details?id=com.example.game&hl=vi")?.id).toBe("com.example.game");
    expect(parseStoreUrl("https://apps.apple.com/vn/app/example/id284882215")?.id).toBe("284882215");
    for (const store_url of ["http://play.google.com/store/apps/details?id=com.example.game", "https://play.google.com.evil.test/store/apps/details?id=com.example.game", "https://apps.apple.com@evil.test/app/id284882215", "https://apps.apple.com/app/not-an-app"]) {
      expect(projectSchema.safeParse({ name: "Project", owner_id: uuid, status: "active", store_url }).success).toBe(false);
    }
  });
  it("yêu cầu file hoặc URL và không nhận script/protocol ngoài http", () => { for (const external_url of ["", "javascript:alert(1)", "file:///tmp/a", "data:text/html,hello", "https://user:password@example.com"]) expect(playableSchema.safeParse({ ...valid, external_url }).success).toBe(false); expect(playableSchema.safeParse(valid).success).toBe(true); });
  it("file phải có toàn bộ metadata", () => { const source = { ...valid, external_url: null, storage_path: `${uuid}/${uuid}.html`, file_name: "build.html", file_size: 100, file_mime: "text/html" }; expect(playableSchema.safeParse(source).success).toBe(true); expect(playableSchema.safeParse({ ...source, file_size: null }).success).toBe(false); expect(playableSchema.safeParse({ ...source, storage_path: "../build.html" }).success).toBe(false); });
  it("không cho metadata file thiếu object", () => { expect(playableSchema.safeParse({ ...valid, file_size: 100, file_name: "old.zip" }).success).toBe(false); });
  it("loại network không có trong kho, loại win tự nhập, loại file sai bị chặn", () => { expect(playableSchema.safeParse({ ...valid, network_ids: ["invalid"] }).success).toBe(false); expect(playableSchema.safeParse({ ...valid, win_level: "auto" }).success).toBe(false); expect(playableSchema.safeParse({ ...valid, file_mime: "application/octet-stream" }).success).toBe(false); });
  it("chuẩn hóa network trùng nhưng không tự suy luận win", () => { const result = playableSchema.parse({ ...valid, network_ids: ["meta", "meta"], win_level: "winning" }); expect(result.network_ids).toEqual(["meta"]); expect(result.win_level).toBe("winning"); });
  it("ngày cũ hợp lệ, ngày sai không throw", () => { expect(isDateOnly("2024-02-29")).toBe(true); for (const released_at of ["2026-02-29", "2026-99-99", "2026-02-31", "wrong"]) expect(playableSchema.safeParse({ ...valid, released_at }).success).toBe(false); });
});
describe("Upload", () => {
  it("kiểm tra giới hạn dung lượng kho và đuôi file", () => { expect(validateUpload({ name: "a.zip", size: 50 * 1024 * 1024, type: "application/zip" })).toBeNull(); expect(validateUpload({ name: "a.zip", size: 50 * 1024 * 1024 + 1, type: "application/zip" })).toMatch(/50 MB/); expect(validateUpload({ name: "a.exe", size: 100, type: "" })).toBeTruthy(); expect(validateUpload({ name: "a.html", size: 0, type: "text/html" })).toBeTruthy(); });
  it("thumbnail chỉ nhận raster đúng loại và tối đa 5MB", () => { expect(validateUpload({ name: "a.svg", size: 100, type: "image/svg+xml" }, true)).toBeTruthy(); expect(validateUpload({ name: "a.png", size: 100, type: "image/png" }, true)).toBeNull(); expect(validateUpload({ name: "a.png", size: 6 * 1024 * 1024, type: "image/png" }, true)).toBeTruthy(); });
});
describe("URL chia sẻ và điều hướng", () => {
  it("panel và phân trang giữ toàn bộ bộ lọc", () => { const filters = { q: "Sort & match", win: "winning", network: "meta", page: "3", owner: uuid }; const open = queryHref("/playables", filters, { playable: uuid }); const closed = queryHref("/playables", new URLSearchParams(open.split("?")[1]), { playable: null }); expect(new URL(closed, "https://hub.test").searchParams.get("q")).toBe(filters.q); expect(closed).toContain("page=3"); expect(closed).toContain("win=winning"); expect(closed).not.toContain("playable="); });
  it("chặn open redirect gồm ký tự điều khiển và dấu gạch chéo ngược", () => { for (const target of ["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\r\nLocation:evil", "javascript:alert(1)"]) expect(safeNextPath(target)).toBe("/projects"); expect(safeNextPath("/playables?win=winning&page=2")).toBe("/playables?win=winning&page=2"); });
  it("chỉ đọc tham số được phép và giới hạn search", () => { expect(readFilters({ q: " x ", win: ["winning"], fake: "secret", page: "2" })).toEqual({ q: "x", page: "2" }); expect(readFilters({ q: "x".repeat(999) }).q?.length).toBe(200); });
  it("query filter sai kiểu không gây lỗi ép UUID/boolean ở database", () => { expect(readFilters({ owner: "invalid", project: "invalid", archived: "anything", page: "99999999999999999999", status: "invalid", win: "invalid", network: "invalid" })).toEqual({}); });
});
