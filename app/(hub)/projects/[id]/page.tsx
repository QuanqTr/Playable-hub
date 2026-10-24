import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, CalendarDays } from "lucide-react";
import { getLookups, getPlayable, getPlayables, getProject } from "@/lib/data";
import { readFilters, selectedPlayable, type SearchParams } from "@/lib/search";
import { formatDate, queryHref } from "@/lib/utils";
import { Owner } from "@/components/data-tables";
import { ProjectBadge } from "@/components/status-badge";
import { ProjectForm } from "@/components/project-form";
import { PlayableForm } from "@/components/playable-form";
import { PlayableList } from "@/components/playable-list";
import { PlayablePanel } from "@/components/playable-panel";
import { ArchiveButton } from "@/components/archive-button";
export default async function ProjectDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const { id } = await params;
  const query = await searchParams;
  const filters = readFilters(query);
  const selected = selectedPlayable(query);
  const [project, lookups, playable] = await Promise.all([getProject(id), getLookups(), selected ? getPlayable(selected) : null]);
  if (!project) notFound();
  const path = `/projects/${id}`;
  // A project-scoped list always uses its parent, never a forged query project.
  delete filters.project; delete filters.owner; delete filters.status;
  if (project.archived_at) filters.archived = "true";
  const result = await getPlayables({ ...filters, project: id });
  if (selected && (!playable || playable.project_id !== id)) notFound();
  return <><Link href={project.archived_at ? "/projects?archived=true" : "/projects"} className="inline-flex items-center gap-2 text-xs text-muted-foreground mb-6 hover:text-primary"><ArrowLeft size={13} />Danh sách dự án</Link><div className="page-heading mb-3"><div><h1>{project.name}</h1>{project.description && <p className="page-description whitespace-pre-wrap break-words">{project.description}</p>}</div><div className="heading-actions"><ProjectForm key={project.updated_at} profiles={lookups.profiles} project={project} />{!project.archived_at && <PlayableForm lookups={lookups} projectId={id} />}</div></div><div className="detail-summary"><span className="detail-summary-item"><Owner profile={project.owner} /></span><span className="detail-summary-item"><ProjectBadge value={project.status} /></span><span className="detail-summary-item"><CalendarDays size={13} />Cập nhật {formatDate(project.updated_at)}</span><span className="detail-summary-item ml-auto"><ArchiveButton kind="project" id={project.id} archived={!!project.archived_at} name={project.name} /></span></div>{project.archived_at && <p className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-800"><Archive size={15} />Dự án đã lưu trữ. Khôi phục dự án để các playable chưa lưu trữ xuất hiện lại trong kho.</p>}<PlayableList result={result} lookups={lookups} filters={filters} path={path} projectId={id} parentArchived={!!project.archived_at} />{playable && <PlayablePanel key={playable.id} playable={playable} lookups={lookups} closeHref={queryHref(path, { ...filters }, { playable: null })} />}</>;
}
