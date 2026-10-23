"use client";

import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { validateUpload } from "@/lib/validation";

export interface UploadedAsset {
  path: string;
  file_name: string;
  file_size: number;
  file_mime: string;
  thumbnail: boolean;
}

export function uploadMime(file: File, thumbnail = false) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!thumbnail) return extension === "zip" ? "application/zip" : "text/html";
  return extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
}

async function verifyHeader(file: File, thumbnail: boolean) {
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (thumbnail) {
    const valid = extension === "png" ? starts(137, 80, 78, 71, 13, 10, 26, 10)
      : extension === "webp" ? starts(82, 73, 70, 70) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80
        : starts(255, 216, 255);
    if (!valid) throw new Error("Nội dung ảnh không khớp định dạng PNG, JPG hoặc WebP.");
  } else if (extension === "zip" && !(starts(80, 75, 3, 4) || starts(80, 75, 5, 6) || starts(80, 75, 7, 8))) {
    throw new Error("File ZIP không có định dạng hợp lệ.");
  } else if (extension === "html" && bytes.includes(0)) {
    throw new Error("File HTML phải là tài liệu văn bản.");
  }
}

/** Upload directly to private Storage. XHR provides actual byte progress. */
export async function uploadAsset(file: File, thumbnail = false, onProgress?: (percent: number) => void): Promise<UploadedAsset> {
  const validationError = validateUpload(file, thumbnail);
  if (validationError) throw new Error(validationError);
  await verifyHeader(file, thumbnail);
  const config = getSupabaseConfig();
  if (!config) throw new Error("Chưa cấu hình kết nối Supabase.");
  const supabase = createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const extension = file.name.split(".").pop()!.toLowerCase();
  const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`;
  const bucket = thumbnail ? "playable-thumbnails" : "playable-builds";
  const contentType = uploadMime(file, thumbnail);
  let mayHaveUploaded = false;
  onProgress?.(0);
  try { await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${config.url.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path}`);
    request.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    request.setRequestHeader("apikey", config.key);
    request.setRequestHeader("Content-Type", contentType);
    request.setRequestHeader("x-upsert", "false");
    request.timeout = 10 * 60 * 1000;
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.min(99, Math.round(event.loaded / event.total * 100)));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) { onProgress?.(100); resolve(); }
      else {
        // A rejected request has not created our object. In particular, never
        // delete an existing object if Storage reported a UUID path conflict.
        if (request.status >= 400 && request.status < 500) mayHaveUploaded = false;
        reject(new Error(request.status === 413 ? "File vượt quá giới hạn dung lượng của kho." : request.status === 401 || request.status === 403 ? "Không có quyền tải file. Kiểm tra phiên đăng nhập và chính sách Storage." : "Không tải được file lên kho. Kiểm tra kết nối và cấu hình Storage rồi thử lại."));
      }
    };
    request.onerror = () => reject(new Error("Mất kết nối khi tải file. Dữ liệu form vẫn được giữ lại."));
    request.ontimeout = () => reject(new Error("Tải file quá thời gian chờ. Vui lòng thử lại."));
    request.onabort = () => reject(new Error("Đã hủy tải file."));
    mayHaveUploaded = true;
    request.send(file);
  }); } catch (failure) {
    // A timeout or lost response can happen after Storage committed the file.
    // Clean only the exact UUID path generated for this upload attempt.
    if (mayHaveUploaded) {
      try {
        const { error: cleanupError } = await supabase.storage.from(bucket).remove([path]);
        if (cleanupError) throw cleanupError;
      } catch {
        const message = failure instanceof Error ? failure.message : "Tải file thất bại.";
        throw new Error(`${message} Chưa xác nhận dọn được file vừa tải. Vui lòng báo quản trị viên kiểm tra Storage.`);
      }
    }
    throw failure;
  }
  return { path, file_name: file.name, file_size: file.size, file_mime: contentType, thumbnail };
}

export async function removeUploadedAssets(assets: UploadedAsset[]): Promise<boolean> {
  if (!assets.length) return true;
  try {
    const supabase = createClient();
    const results = await Promise.all(([false, true] as const).map(async thumbnail => {
      const paths = assets.filter(asset => asset.thumbnail === thumbnail).map(asset => asset.path);
      if (!paths.length) return true;
      const { error } = await supabase.storage.from(thumbnail ? "playable-thumbnails" : "playable-builds").remove(paths);
      return !error;
    }));
    return results.every(Boolean);
  } catch {
    return false;
  }
}
