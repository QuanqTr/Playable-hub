import { z } from "zod";
import { BUILD_MAX_BYTES, THUMBNAIL_MAX_BYTES } from "./constants";
import { parseStoreUrl } from "./store-url";
const optionalText = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`).nullish().transform(v => v || null);
const uuid = z.string().uuid("Vui lòng chọn giá trị hợp lệ.");
const storagePath = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/, "Đường dẫn file không hợp lệ.").nullish().transform(v => v || null);
export const projectSchema = z.object({
  id: uuid.optional(), name: z.string().trim().min(1, "Nhập tên dự án.").max(160, "Tối đa 160 ký tự."),
  description: optionalText(4000),
  store_url: optionalText(2048).refine(v => !v || !!parseStoreUrl(v), "Dùng URL ứng dụng từ Google Play hoặc App Store."),
  owner_id: uuid, status: z.enum(["active", "paused", "completed"])
});
export const playableSchema = z.object({
  id: uuid.optional(), name: z.string().trim().min(1, "Nhập tên playable.").max(160, "Tối đa 160 ký tự."),
  project_id: uuid, win_level: z.enum(["unreviewed", "testing", "not_winning", "promising", "winning", "scaling"]),
  external_url: optionalText(2048).refine(v => !v || isHttpUrl(v), "Chỉ chấp nhận URL http hoặc https hợp lệ."),
  storage_path: storagePath, thumbnail_path: storagePath,
  file_name: optionalText(255), file_size: z.number().int().positive().max(BUILD_MAX_BYTES).nullish().transform(v => v ?? null),
  file_mime: z.enum(["text/html", "application/zip", "application/x-zip-compressed"]).nullish().transform(v => v || null),
  released_at: optionalText(10).refine(v => !v || isDateOnly(v), "Ngày không hợp lệ."),
  notes: optionalText(10000), network_ids: z.array(z.enum(["unity-ads", "mintegral", "applovin", "meta", "google-ads", "tiktok", "other"])).max(7).transform(v => [...new Set(v)])
}).superRefine((v, ctx) => {
  if (!v.storage_path && !v.external_url) ctx.addIssue({ code: "custom", path: ["external_url"], message: "Thêm file HTML/ZIP hoặc URL lưu trữ." });
  if (v.storage_path && (!v.file_name || !v.file_size || !v.file_mime)) ctx.addIssue({ code: "custom", path: ["storage_path"], message: "Thiếu thông tin file. Vui lòng tải lại file." });
  if (!v.storage_path && (v.file_name || v.file_size || v.file_mime)) ctx.addIssue({ code: "custom", path: ["storage_path"], message: "Thông tin file phải đi kèm file đã tải lên." });
});
export function isHttpUrl(value: string) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password; } catch { return false; } }
export function isDateOnly(value: string) { const date = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
export function safeNextPath(value: string | null | undefined, fallback = "/projects") {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20\x7f]/.test(value)) return fallback;
  try { return new URL(value, "https://playable-hub.invalid").origin === "https://playable-hub.invalid" ? value : fallback; } catch { return fallback; }
}
export function validateUpload(file: { name: string; size: number; type: string }, thumbnail = false): string | null {
  if (!file.size) return "File đang trống.";
  if (file.size > (thumbnail ? THUMBNAIL_MAX_BYTES : BUILD_MAX_BYTES)) return `File vượt quá giới hạn ${thumbnail ? 5 : 50} MB của kho.`;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (thumbnail) return ["png", "jpg", "jpeg", "webp"].includes(ext || "") && ["image/png", "image/jpeg", "image/webp"].includes(file.type) ? null : "Thumbnail phải là ảnh PNG, JPG hoặc WebP.";
  if (!["html", "zip"].includes(ext || "")) return "Chỉ chấp nhận file HTML hoặc ZIP.";
  if (file.type && !["text/html", "application/zip", "application/x-zip-compressed", "application/octet-stream"].includes(file.type)) return "Loại nội dung file không hợp lệ.";
  return null;
}
