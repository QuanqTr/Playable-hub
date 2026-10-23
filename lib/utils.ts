import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatDate(value?: string | null, withTime = false) {
  if (!value) return "Chưa có";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } as const : {}), timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value));
}
export function formatBytes(bytes?: number | null) { return bytes == null ? "" : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
export function initials(name: string) { return name.trim().split(/\s+/).map(p => p[0]).slice(-2).join("").toUpperCase(); }
export function queryHref(path: string, params: URLSearchParams | Record<string, string | undefined>, updates: Record<string, string | null>) {
  const query = params instanceof URLSearchParams ? new URLSearchParams(params) : new URLSearchParams(Object.entries(params).filter((x): x is [string, string] => x[1] !== undefined));
  for (const [key, value] of Object.entries(updates)) { if (value === null || value === "") query.delete(key); else query.set(key, value); }
  return `${path}${query.size ? `?${query}` : ""}`;
}
