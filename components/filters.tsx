"use client";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { ArrowRight, ChevronDown, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { PROJECT_STATUSES, WIN_LEVELS } from "@/lib/constants";
import type { Filters, Lookups } from "@/lib/types";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { PendingLink } from "./pending-link";
export function FilterBar({ filters, lookups, path, kind = "playables", projectId }: { filters: Filters; lookups: Lookups; path: string; kind?: "projects" | "playables"; projectId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const optionsId = useId();
  const activeCount = [kind === "playables" && !projectId && filters.project, !projectId && filters.status, !projectId && filters.owner, kind === "playables" && filters.win, kind === "playables" && filters.network].filter(Boolean).length;
  const [expanded, setExpanded] = useState(activeCount > 0);
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
    <div className="filter-row"><div className="search-field"><label className="sr-only" htmlFor="q">Tìm kiếm</label><div className="relative"><Search size={16} /><Input id="q" name="q" defaultValue={filters.q} placeholder={kind === "projects" ? "Tìm dự án…" : "Tìm tên, mã playable hoặc dự án…"} maxLength={200} /></div></div>
      <Button variant="outline" type="button" className="filter-toggle text-xs" aria-expanded={expanded} aria-controls={optionsId} onClick={() => setExpanded(value => !value)}><SlidersHorizontal />Bộ lọc{activeCount > 0 && <span className="filter-count">{activeCount}</span>}<ChevronDown size={13} className={expanded ? "rotate-180" : ""} /></Button>
      <Button type="submit" disabled={pending} className="text-xs">{pending ? <Loader2 className="animate-spin" /> : <ArrowRight />}{pending ? "Đang tìm…" : "Áp dụng"}</Button>{hasFilters && <Button variant="ghost" asChild className="text-xs"><PendingLink href={reset} intentPrefetch scroll={false}><X />Xóa bộ lọc</PendingLink></Button>}
    </div>
    <div className="filter-options" id={optionsId} hidden={!expanded} role="group" aria-label="Bộ lọc nâng cao">
      {kind === "playables" && !projectId && <Select name="project" label="Dự án" value={filters.project} options={Object.fromEntries(lookups.projects.map(p => [p.id, p.name]))} placeholder="Tất cả dự án" />}
      {!projectId && <><Select name="status" label="Trạng thái dự án" value={filters.status} options={PROJECT_STATUSES} placeholder="Tất cả trạng thái" /><Select name="owner" label="Người phụ trách" value={filters.owner} options={Object.fromEntries(lookups.profiles.map(p => [p.id, p.display_name || p.email]))} placeholder="Tất cả thành viên" /></>}
      {kind === "playables" && <><Select name="win" label="Mức độ win" value={filters.win} options={WIN_LEVELS} placeholder="Tất cả mức độ" /><Select name="network" label="Network" value={filters.network} options={Object.fromEntries(lookups.networks.map(n => [n.id, n.name]))} placeholder="Tất cả network" /></>}
    </div>
    {pending && <><div className="navigation-progress" aria-hidden="true" /><span className="sr-only" role="status">Đang cập nhật kết quả tìm kiếm…</span></>}
  </form>;
}
function Select({ name, label, value, options, placeholder }: { name: string; label: string; value?: string; options: Record<string, string>; placeholder: string }) { return <div className="filter-select"><label className="filter-label" htmlFor={name}>{label}</label><select className="select" id={name} name={name} defaultValue={value || ""}><option value="">{placeholder}</option>{Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></div>; }
