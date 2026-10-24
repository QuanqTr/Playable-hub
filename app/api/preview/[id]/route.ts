import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isHtmlPlayable, MAX_PREVIEW_BYTES, safeExternalPreviewUrl } from "@/lib/preview";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!getSupabaseConfig()) return fail("Chưa cấu hình Supabase.", 503);
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail("Vui lòng đăng nhập.", 401);
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail("Không tìm thấy playable.", 404);
    // The user's regular client applies project membership and playable RLS.
    const { data: playable, error } = await supabase.from("playables")
      .select("storage_path,external_url,file_name,file_size,file_mime").eq("id", id).maybeSingle();
    if (error || !playable) return fail("Không tìm thấy playable.", 404);
    if (playable.storage_path && isHtmlPlayable(playable)) {
      if (playable.file_size > MAX_PREVIEW_BYTES) return fail("File quá lớn để xem trực tiếp. Bạn có thể tải về.", 413);
      const { data, error: storageError } = await supabase.storage.from("playable-builds").createSignedUrl(playable.storage_path, 60);
      if (storageError || !data?.signedUrl) return fail("Chưa tải được preview. Vui lòng thử lại.", 502);
      // The parent fetches this short-lived URL without credentials. It is never
      // embedded in the game's sandbox, logged, or stored on the device.
      return NextResponse.json({ kind: "html", url: data.signedUrl }, { headers });
    }
    const url = safeExternalPreviewUrl(playable.external_url);
    if (url) return NextResponse.json({ kind: "external", url }, { headers });
    return fail(playable.storage_path ? "File ZIP cần tải về để chạy. Preview trực tiếp hỗ trợ HTML hoặc liên kết." : "Playable chưa có nội dung để xem.", 422);
  } catch { return fail("Không kết nối được preview. Vui lòng thử lại.", 502); }
}
