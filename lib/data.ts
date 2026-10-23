import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { PAGE_SIZE, PROJECT_STATUSES } from "@/lib/constants";
import type { Filters, Lookups, Network, PageResult, Playable, Profile, Project } from "@/lib/types";

export function isConfigured() {
  return getSupabaseConfig() !== null;
}

export const requireUser = cache(async () => {
  if (!isConfigured()) redirect("/setup");
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name,email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Chưa tìm thấy hồ sơ thành viên. Kiểm tra migration và tài khoản được mời trong Supabase.");
  }
  return { supabase, user, profile: profile as Profile };
});

function pageNumber(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 1_000_000) : 1;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function readableDataError(error: { message?: string } | null, fallback: string) {
  if (error) throw new Error(fallback);
}

const projectSelect = "*,owner:profiles!projects_owner_id_fkey(id,display_name,email),playables(count)";

function mapProject(row: Record<string, unknown>): Project {
  const counts = row.playables as { count: number }[] | undefined;
  const { playables: _counts, ...project } = row;
  void _counts;
  return { ...project, playable_count: counts?.[0]?.count ?? 0 } as unknown as Project;
}

export const getLookups = cache(async (): Promise<Lookups> => {
  const { supabase } = await requireUser();
  const results = await Promise.all([
    supabase.from("profiles").select("id,display_name,email").order("display_name"),
    supabase.from("projects").select("id,name,status,archived_at").order("name"),
    supabase.from("networks").select("id,name").order("sort_order"),
  ]);
  results.forEach(result => readableDataError(result.error, "Không tải được danh mục. Vui lòng thử lại."));
  return {
    profiles: results[0].data ?? [],
    projects: results[1].data ?? [],
    networks: results[2].data ?? [],
  } as Lookups;
});

export async function getProjects(filters: Filters = {}): Promise<PageResult<Project>> {
  const { supabase } = await requireUser();
  const page = pageNumber(filters.page);
  if (filters.owner && !isUuid(filters.owner)) return { items: [], total: 0, page, pageSize: PAGE_SIZE };
  let query = supabase.from("projects").select(projectSelect, { count: "exact" });
  query = filters.archived === "true" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  // Count current builds inside each project without fetching their records.
  query = query.is("playables.archived_at", null);
  if (filters.q?.trim()) {
    const term = filters.q.trim().slice(0, 200).replace(/[\\%_]/g, "\\$&");
    query = query.ilike("name", `%${term}%`);
  }
  if (filters.status && Object.hasOwn(PROJECT_STATUSES, filters.status)) query = query.eq("status", filters.status);
  if (filters.owner) query = query.eq("owner_id", filters.owner);

  const { data, count, error } = await query.order("updated_at", { ascending: false }).order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  readableDataError(error, "Không tải được dự án. Vui lòng thử lại.");
  return { items: (data ?? []).map(row => mapProject(row)), total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getProject(id: string): Promise<Project | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("projects").select(projectSelect)
    .eq("id", id).is("playables.archived_at", null).maybeSingle();
  if (error?.code === "22P02") return null;
  readableDataError(error, "Không tải được dự án. Vui lòng thử lại.");
  return data ? mapProject(data) : null;
}

export async function getPlayables(filters: Filters = {}): Promise<PageResult<Playable>> {
  const { supabase } = await requireUser();
  const page = pageNumber(filters.page);
  if ((filters.owner && !isUuid(filters.owner)) || (filters.project && !isUuid(filters.project))) {
    return { items: [], total: 0, page, pageSize: PAGE_SIZE };
  }
  const normalized = {
    ...filters,
    q: filters.q?.trim().slice(0, 200),
    page: String(page),
    archived: filters.archived === "true",
  };
  const { data, error } = await supabase.rpc("list_playables", { p_filters: normalized });
  readableDataError(error, "Không tải được kho playable. Vui lòng thử lại.");
  if (!data || !Array.isArray(data.items)) throw new Error("Dữ liệu kho playable chưa sẵn sàng. Kiểm tra migration Supabase.");
  return data as PageResult<Playable>;
}

export async function getPlayable(id: string): Promise<Playable | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("playables")
    .select("*,project:projects!playables_project_id_fkey(id,name,status,archived_at,owner:profiles!projects_owner_id_fkey(id,display_name,email)),network_links:playable_networks(network:networks(id,name)),creator:profiles!playables_created_by_fkey(id,display_name,email),updater:profiles!playables_updated_by_fkey(id,display_name,email)")
    .eq("id", id).maybeSingle();
  if (error?.code === "22P02") return null;
  readableDataError(error, "Không tải được playable. Vui lòng thử lại.");
  if (!data) return null;
  const { network_links, ...playable } = data;
  return { ...playable, networks: network_links.map((link: { network: Network }) => link.network) } as unknown as Playable;
}
