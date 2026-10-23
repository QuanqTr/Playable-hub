"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type FormEvent } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PROJECT_STATUSES, WIN_LEVELS } from "@/lib/constants";
import type { Filters, Lookups } from "@/lib/types";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
export function FilterBar({ filters, lookups, path, kind = "playables", projectId }: { filters: Filters; lookups: Lookups; path: string; kind?: "projects" | "playables"; projectId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) if (typeof value === "string" && value.trim()) query.set(name, value.trim());
    startTransition(() => router.push(`${path}${query.size ? `?${query}` : ""}`, { scroll: false }));
  }
  const hasFilters = !!(filters.q || filters.owner || filters.status || filters.win || filters.network || (!projectId && filters.project));
  const reset = `${path}${filters.archived === "true" ? "?archived=true" : ""}`;
  return <form key={JSON.stringify(filters)} action={path} method="get" onSubmit={submit} className="filters" role="search" aria-label="Tìm kiếm và lọc" aria-busy={pending}>
    {filters.archived === "true" && <input type="hidden" name="archived" value="true" />}
    <div className="filter-row"><div className="search-field"><label className="filter-label" htmlFor="q">Tìm kiếm</label><div className="relative"><Search size={16} /><Input id="q" name="q" defaultValue={filters.q} placeholder={kind === "projects" ? "Tìm theo tên dự án..." : "Tên, mã playable hoặc dự án..."} maxLength={200} /></div></div>
      {kind === "playables" && !projectId && <Select name="project" label="Dự án" value={filters.project} options={Object.fromEntries(lookups.projects.map(p => [p.id, p.name]))} placeholder="Tất cả dự án" />}
      {!projectId && <><Select name="status" label="Trạng thái dự án" value={filters.status} options={PROJECT_STATUSES} placeholder="Tất cả trạng thái" /><Select name="owner" label="Người phụ trách" value={filters.owner} options={Object.fromEntries(lookups.profiles.map(p => [p.id, p.display_name || p.email]))} placeholder="Tất cả thành viên" /></>}
      {kind === "playables" && <><Select name="win" label="Mức độ win" value={filters.win} options={WIN_LEVELS} placeholder="Tất cả mức độ" /><Select name="network" label="Network" value={filters.network} options={Object.fromEntries(lookups.networks.map(n => [n.id, n.name]))} placeholder="Tất cả network" /></>}
      <Button variant="outline" type="submit" disabled={pending} className="text-xs"><SlidersHorizontal />{pending ? "Đang lọc…" : "Áp dụng"}</Button>{hasFilters && <Button variant="ghost" asChild className="text-xs"><Link href={reset}><X />Xóa bộ lọc</Link></Button>}
    </div>
  </form>;
}
function Select({ name, label, value, options, placeholder }: { name: string; label: string; value?: string; options: Record<string, string>; placeholder: string }) { return <div className="filter-select"><label className="filter-label" htmlFor={name}>{label}</label><select className="select" id={name} name={name} defaultValue={value || ""}><option value="">{placeholder}</option>{Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></div>; }
