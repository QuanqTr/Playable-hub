import type { Filters } from "./types";
import { PROJECT_STATUSES, WIN_LEVELS } from "./constants";
export type SearchParams = Record<string, string | string[] | undefined>;
export function readFilters(params: SearchParams): Filters {
  const result: Filters = {};
  for (const key of ["q", "project", "status", "owner", "win", "network", "archived", "page"] as const) {
    const value = params[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const clean = value.trim();
    if ((key === "project" || key === "owner") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) continue;
    if (key === "status" && !Object.hasOwn(PROJECT_STATUSES, clean)) continue;
    if (key === "win" && !Object.hasOwn(WIN_LEVELS, clean)) continue;
    if (key === "network" && !["unity-ads", "mintegral", "applovin", "meta", "google-ads", "tiktok", "other"].includes(clean)) continue;
    if (key === "archived" && clean !== "true") continue;
    if (key === "page" && (!/^\d+$/.test(clean) || !Number.isSafeInteger(Number(clean)) || Number(clean) < 1 || Number(clean) > 1_000_000)) continue;
    result[key] = clean.slice(0, key === "q" ? 200 : 100);
  }
  return result;
}
export function selectedPlayable(params: SearchParams) { return typeof params.playable === "string" ? params.playable : undefined; }
export function hasSearch(filters: Filters, projectScoped = false) { return !!(filters.q || filters.win || filters.network || (!projectScoped && (filters.project || filters.owner || filters.status))); }
