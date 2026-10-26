import Image from "next/image";
import { ArrowUpRight, FolderClosed, Layers3 } from "lucide-react";
import type { Profile, Project } from "@/lib/types";
import { formatDate, initials } from "@/lib/utils";
import { ProjectBadge } from "./status-badge";
import { PendingLink } from "./pending-link";
import { Button } from "./ui/button";
import { ProjectForm } from "./project-form";
import { ArchiveButton } from "./archive-button";
import { PermanentDeleteButton } from "./permanent-delete-button";

export function Owner({ profile }: { profile?: Profile }) {
  return <span className="owner-cell"><span className="avatar">{initials(profile?.display_name || profile?.email || "?")}</span><span>{profile?.display_name || profile?.email || "Chưa xác định"}</span></span>;
}

function HighlightedName({ name, query }: { name: string; query?: string }) {
  const term = query?.trim();
  const index = term ? name.toLocaleLowerCase("vi").indexOf(term.toLocaleLowerCase("vi")) : -1;
  if (index < 0 || !term) return name;
  return <>{name.slice(0, index)}<mark>{name.slice(index, index + term.length)}</mark>{name.slice(index + term.length)}</>;
}

export function ProjectTable({ projects, profiles, query }: { projects: Project[]; profiles: Profile[]; query?: string }) {
  return <div className="project-grid" aria-label="Danh sách dự án">{projects.map(project => <article className="project-card" data-status={project.status} key={project.id}>
    <div className="project-card-visual">
      <div className="project-card-top"><span className="project-card-eyebrow">Ứng dụng · Dự án</span><ProjectBadge value={project.status} /></div>
      <PendingLink href={`/projects/${project.id}`} intentPrefetch className="project-card-icon-link" aria-label={`Xem dự án ${project.name}`}>
        <span className="project-card-icon">{project.app_icon_url ? <Image src={project.app_icon_url} alt={`Icon ${project.name}`} width={100} height={100} unoptimized /> : <FolderClosed size={42} strokeWidth={1.4} aria-hidden="true" />}</span>
      </PendingLink>
    </div>
    <div className="project-card-content">
      <h2><PendingLink href={`/projects/${project.id}`} intentPrefetch><HighlightedName name={project.name} query={query} /><ArrowUpRight size={17} aria-hidden="true" /></PendingLink></h2>
      <p className="project-card-description">{project.description || "Khám phá các playable của dự án này."}</p>
      <div className="project-card-facts"><span className="project-card-count"><Layers3 size={16} /><strong>{project.playable_count}</strong> playable</span><span title="Cập nhật gần nhất">Cập nhật {formatDate(project.updated_at)}</span></div>
      <div className="project-card-bottom"><Owner profile={project.owner} />{project.store_url && <a href={project.store_url} target="_blank" rel="noopener noreferrer" className="project-store-link">Xem trên store<ArrowUpRight size={13} /></a>}</div>
      <div className="project-card-actions" data-archived={!!project.archived_at}><Button asChild className="project-open-button"><PendingLink href={`/projects/${project.id}`} intentPrefetch>Xem dự án<ArrowUpRight size={15} /></PendingLink></Button>{!project.archived_at && <ProjectForm key={project.updated_at} profiles={profiles} project={project} />}<ArchiveButton kind="project" id={project.id} archived={!!project.archived_at} name={project.name} />{project.archived_at && <PermanentDeleteButton kind="project" id={project.id} name={project.name} compact />}</div>
    </div>
  </article>)}</div>;
}
