import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!getSupabaseConfig()) return NextResponse.json({ error: "Chưa cấu hình Supabase." }, { status: 503, headers: noStore });

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401, headers: noStore });

    const { id } = await context.params;
    const thumbnail = request.nextUrl.searchParams.get("thumbnail") === "true";
    const { data: playable, error } = await supabase.from("playables")
      .select("storage_path,thumbnail_path,file_name").eq("id", id).maybeSingle();
    if (error || !playable) return NextResponse.json({ error: "Không tìm thấy file." }, { status: 404, headers: noStore });

    const path = thumbnail ? playable.thumbnail_path : playable.storage_path;
    if (!path) return NextResponse.json({ error: "Playable chưa có file này." }, { status: 404, headers: noStore });

    const { data, error: storageError } = await supabase.storage
      .from(thumbnail ? "playable-thumbnails" : "playable-builds")
      .createSignedUrl(path, 60, thumbnail ? undefined : { download: playable.file_name || true });
    if (storageError || !data?.signedUrl) {
      return NextResponse.json({ error: "Chưa tải được file. Vui lòng thử lại." }, { status: 502, headers: noStore });
    }
    const response = NextResponse.redirect(data.signedUrl, 307);
    Object.entries(noStore).forEach(([key, value]) => response.headers.set(key, value));
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.json({ error: "Không kết nối được kho file. Vui lòng thử lại." }, { status: 502, headers: noStore });
  }
}
