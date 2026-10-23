export type ProjectStatus = "active" | "paused" | "completed";
export type WinLevel = "unreviewed" | "testing" | "not_winning" | "promising" | "winning" | "scaling";
export interface Profile { id: string; display_name: string; email: string }
export interface Network { id: string; name: string }
export interface Project {
  id: string; name: string; description: string | null; owner_id: string;
  status: ProjectStatus; archived_at: string | null;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
  owner: Profile; playable_count: number;
}
export interface Playable {
  id: string; code: string; name: string; project_id: string; win_level: WinLevel;
  storage_path: string | null; external_url: string | null; file_name: string | null;
  file_size: number | null; file_mime: string | null; thumbnail_path: string | null;
  released_at: string | null; notes: string | null; archived_at: string | null;
  created_by: string; updated_by: string; created_at: string; updated_at: string;
  project: { id: string; name: string; status: ProjectStatus; owner: Profile; archived_at?: string | null };
  networks: Network[]; creator?: Profile; updater?: Profile;
}
export interface Filters { q?: string; project?: string; status?: string; owner?: string; win?: string; network?: string; archived?: string; page?: string }
export interface PageResult<T> { items: T[]; total: number; page: number; pageSize: number }
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
export interface Lookups { profiles: Profile[]; projects: (Pick<Project, "id" | "name"> & { archived_at?: string | null })[]; networks: Network[] }
