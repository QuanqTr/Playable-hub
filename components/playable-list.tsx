import Link from "next/link";
import type { Filters, Lookups, PageResult, Playable } from "@/lib/types";
import { hasSearch } from "@/lib/search";
import { FilterBar } from "./filters";
import { EmptyState, Pagination, ResultsHeading, ViewTabs } from "./list-parts";
import { PlayableTable } from "./data-tables";
import { PlayableForm } from "./playable-form";
import { Button } from "./ui/button";
export function PlayableList({ result, lookups, filters, path, projectId, parentArchived }: { result: PageResult<Playable>; lookups: Lookups; filters: Filters; path: string; projectId?: string; parentArchived?: boolean }) {
  const archived = filters.archived === "true";
  const filtered = hasSearch(filters, !!projectId);
  return <section className="library-surface" aria-label="Kho playable"><ViewTabs path={path} filters={filters} noun="Tất cả playable" /><FilterBar filters={filters} lookups={lookups} path={path} projectId={projectId} /><ResultsHeading total={result.total} noun="playable" archived={archived} />{result.items.length ? <PlayableTable playables={result.items} path={path} filters={filters} /> : <EmptyState noun="playable" archived={archived} filtered={filtered} action={filtered ? <Button variant="outline" asChild><Link href={`${path}${archived ? "?archived=true" : ""}`}>Xóa bộ lọc</Link></Button> : !archived && !parentArchived && lookups.projects.length > 0 ? <PlayableForm lookups={lookups} projectId={projectId} /> : undefined} />}<Pagination {...result} path={path} filters={filters} /></section>;
}
