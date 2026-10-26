"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig, safeNextPath } from "@/lib/supabase/config";
import { playableSchema, projectSchema } from "@/lib/validation";
import { getStoreIcon } from "@/lib/store-icon";
import { parseStoreUrl } from "@/lib/store-url";
import type { ActionResult } from "@/lib/types";

function validationFailure(error: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0]?.toString();
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return { ok: false, error: "Vui lòng kiểm tra các trường được đánh dấu.", fieldErrors };
}

function databaseMessage(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === "42501") return "Phiên đăng nhập không có quyền lưu dữ liệu. Vui lòng đăng nhập lại.";
  if (error.code === "23503") return "Dự án, network hoặc thành viên đã thay đổi. Tải lại trang và thử lại.";
  if (error.code === "23514") return "Dữ liệu hoặc thông tin file không hợp lệ. Vui lòng kiểm tra lại.";
  if (["42703", "PGRST204"].includes(error.code ?? "")) return "Chưa cập nhật cấu trúc Supabase. Hãy chạy migration mới trong supabase/migrations.";
  if (["P0001", "P0002", "22023"].includes(error.code ?? "") && error.message) return error.message;
  return fallback;
}

async function authenticatedClient() {
  if (!getSupabaseConfig()) throw new Error("Chưa cấu hình kết nối Supabase.");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  return { supabase, user };
}

function refreshLists(projectId?: string, playableId?: string) {
  revalidatePath("/projects");
  revalidatePath("/playables");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  if (playableId) revalidatePath(`/playables/${playableId}`);
}

export async function saveProject(input: unknown): Promise<ActionResult<{ id: string; iconFound: boolean }>> {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await authenticatedClient();
    const { id, ...values } = parsed.data;
    const storeUrl = values.store_url ? parseStoreUrl(values.store_url)?.url ?? null : null;
    let appIconUrl: string | null = null;
    if (id) {
      const { data: previous, error: previousError } = await supabase.from("projects")
        .select("store_url,app_icon_url").eq("id", id).maybeSingle();
      if (previousError || !previous) return { ok: false, error: databaseMessage(previousError ?? {}, "Không tìm thấy dự án để chỉnh sửa.") };
      appIconUrl = previous.store_url === storeUrl ? previous.app_icon_url : null;
    }
    if (storeUrl && !appIconUrl) appIconUrl = await getStoreIcon(storeUrl);
    const projectValues = { ...values, store_url: storeUrl, app_icon_url: appIconUrl };
    const request = id
      ? supabase.from("projects").update({ ...projectValues, updated_by: user.id }).eq("id", id)
      : supabase.from("projects").insert({ ...projectValues, created_by: user.id, updated_by: user.id });
    const { data, error } = await request.select("id").single();
    if (error || !data) return { ok: false, error: databaseMessage(error ?? {}, "Không lưu được dự án. Vui lòng thử lại.") };
    refreshLists(data.id);
    return { ok: true, data: { id: data.id, iconFound: !storeUrl || !!appIconUrl } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không kết nối được máy chủ. Vui lòng thử lại." };
  }
}

export async function savePlayable(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = playableSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase } = await authenticatedClient();
    const { id, network_ids, ...values } = parsed.data;
    // The RPC writes metadata and network relations in a single transaction.
    // The database also enforces immutable build source and storage ownership.
    const { data, error } = await supabase.rpc("save_playable", {
      p_id: id ?? null,
      p_data: values,
      p_network_ids: network_ids,
    });
    if (error || !data) return { ok: false, error: databaseMessage(error ?? {}, "Không lưu được playable. Vui lòng thử lại.") };
    refreshLists(values.project_id, data);
    return { ok: true, data: { id: data } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không kết nối được máy chủ. Vui lòng thử lại." };
  }
}

export async function setArchived(kind: "project" | "playable", id: string, archived: boolean): Promise<ActionResult> {
  if (!["project", "playable"].includes(kind) || !/^[0-9a-f-]{36}$/i.test(id) || typeof archived !== "boolean") {
    return { ok: false, error: "Thao tác không hợp lệ." };
  }
  try {
    const { supabase, user } = await authenticatedClient();
    if (kind === "playable" && !archived) {
      const { data, error } = await supabase.from("playables")
        .select("project:projects!playables_project_id_fkey(archived_at)").eq("id", id).single();
      if (error) return { ok: false, error: "Không tìm thấy playable để khôi phục." };
      const project = data.project as unknown as { archived_at: string | null };
      if (project.archived_at) return { ok: false, error: "Khôi phục dự án trước khi khôi phục playable này." };
    }
    const { data, error } = await supabase.from(kind === "project" ? "projects" : "playables")
      .update({ archived_at: archived ? new Date().toISOString() : null, updated_by: user.id })
      .eq("id", id).select("id").single();
    if (error || !data) return { ok: false, error: databaseMessage(error ?? {}, "Không lưu được thay đổi. Vui lòng thử lại.") };
    refreshLists(kind === "project" ? id : undefined, kind === "playable" ? id : undefined);
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không kết nối được máy chủ. Vui lòng thử lại." };
  }
}

async function clearPendingAssets(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  try {
    const { data: rows, error } = await supabase.from("pending_asset_deletions")
      .select("bucket_id,path").order("id").limit(100);
    if (error || !rows) return true;
    if (!rows.length) return false;
    for (const bucket of ["playable-builds", "playable-thumbnails"] as const) {
      const assets = rows.filter(row => row.bucket_id === bucket);
      if (!assets.length) continue;
      await supabase.storage.from(bucket).remove(assets.map(row => row.path));
    }
    const { count, error: countError } = await supabase.from("pending_asset_deletions")
      .select("id", { count: "exact", head: true });
    return !!countError || (count ?? 0) > 0;
  } catch {
    return true;
  }
}

export async function deleteArchived(kind: "project" | "playable", id: string): Promise<ActionResult<{ cleanupPending: boolean }>> {
  if (!["project", "playable"].includes(kind) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: "Thao tác không hợp lệ." };
  }
  try {
    const { supabase } = await authenticatedClient();
    const { data: projectId, error } = await supabase.rpc(kind === "project" ? "delete_archived_project" : "delete_archived_playable", { p_id: id });
    if (error || !projectId) return { ok: false, error: databaseMessage(error ?? {}, "Không thể xóa vĩnh viễn. Vui lòng thử lại.") };
    const cleanupPending = await clearPendingAssets(supabase);
    refreshLists(kind === "project" ? id : projectId, kind === "playable" ? id : undefined);
    return { ok: true, data: { cleanupPending } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không kết nối được máy chủ. Vui lòng thử lại." };
  }
}

export async function retryPendingAssetCleanup(): Promise<ActionResult<{ cleanupPending: boolean }>> {
  try {
    const { supabase } = await authenticatedClient();
    return { ok: true, data: { cleanupPending: await clearPendingAssets(supabase) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Không dọn được file. Vui lòng thử lại." };
  }
}

export async function signIn(formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Nhập email và mật khẩu." };
  if (!getSupabaseConfig()) return { error: "Chưa cấu hình kết nối Supabase." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Email hoặc mật khẩu chưa đúng, hoặc tài khoản chưa được mời." };
  } catch {
    return { error: "Không kết nối được dịch vụ đăng nhập. Vui lòng thử lại." };
  }
  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  if (getSupabaseConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Chưa đăng xuất được. Vui lòng thử lại.");
  }
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function setPassword(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? formData.get("confirm_password") ?? "");
  if (password.length < 8 || password.length > 128) return { error: "Mật khẩu cần từ 8 đến 128 ký tự." };
  if (password !== confirmation) return { error: "Mật khẩu xác nhận chưa khớp." };
  try {
    const { supabase } = await authenticatedClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "Không đặt được mật khẩu. Kiểm tra yêu cầu mật khẩu trong Supabase hoặc mở lại thư mời." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Liên kết mời đã hết hạn. Vui lòng mở lại thư mời." };
  }
  redirect("/projects");
}
