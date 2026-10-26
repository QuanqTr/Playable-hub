import type { Metadata } from "next";
import Link from "next/link";
import { getLookups, getPendingCleanupCount, getProjects } from "@/lib/data";
import { hasSearch, readFilters, type SearchParams } from "@/lib/search";
import { ProjectForm } from "@/components/project-form";
import { FilterBar } from "@/components/filters";
import { EmptyState, Pagination, ResultsHeading, ViewTabs } from "@/components/list-parts";
import { ProjectTable } from "@/components/data-tables";
import { Button } from "@/components/ui/button";
import { CleanupPendingButton } from "@/components/cleanup-pending-button";
export const metadata: Metadata = { title: "Dự án" };
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = readFilters(await searchParams);
  const archived = filters.archived === "true";
  const [result, lookups, pendingCleanupCount] = await Promise.all([getProjects(filters), getLookups(), archived ? getPendingCleanupCount() : Promise.resolve(0)]);
  return <><div className="page-heading"><div><h1>Dự án</h1><p className="page-description">Nhận diện ứng dụng và tìm đúng dự án nhanh hơn.</p></div><ProjectForm profiles={lookups.profiles} /></div><section className="library-surface" aria-label="Danh sách dự án"><ViewTabs path="/projects" filters={filters} noun="Tất cả dự án" /><FilterBar filters={filters} lookups={lookups} path="/projects" kind="projects" /><ResultsHeading total={result.total} noun="dự án" archived={archived} />{archived && pendingCleanupCount > 0 && <CleanupPendingButton count={pendingCleanupCount} />}{result.items.length ? <ProjectTable projects={result.items} profiles={lookups.profiles} query={filters.q} /> : <EmptyState noun="dự án" archived={archived} filtered={hasSearch(filters)} action={hasSearch(filters) ? <Button variant="outline" asChild><Link href={archived ? "/projects?archived=true" : "/projects"}>Xóa bộ lọc</Link></Button> : !archived ? <ProjectForm profiles={lookups.profiles} /> : undefined} />}<Pagination {...result} path="/projects" filters={filters} /></section></>;
}
