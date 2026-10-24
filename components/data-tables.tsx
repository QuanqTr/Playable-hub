import { ArrowUpRight, FolderClosed, Layers3 } from "lucide-react";
import type { Profile, Project } from "@/lib/types";
import { formatDate, initials } from "@/lib/utils";
import { ProjectBadge } from "./status-badge";
import { PendingLink } from "./pending-link";

export function Owner({ profile }: { profile?: Profile }) {
  return <span className="owner-cell"><span className="avatar">{initials(profile?.display_name || profile?.email || "?")}</span><span>{profile?.display_name || profile?.email || "Chưa xác định"}</span></span>;
}

export function ProjectTable({ projects }: { projects: Project[] }) {
  return <div className="project-grid" aria-label="Danh sách dự án">{projects.map(project => <article className="project-card" key={project.id}>
    <div className="project-card-top"><span className="project-folder"><FolderClosed size={22} /></span><ProjectBadge value={project.status} /></div>
    <h2><PendingLink href={`/projects/${project.id}`} intentPrefetch>{project.name}<ArrowUpRight size={17} aria-hidden="true" /></PendingLink></h2>
    <div className="project-card-count"><Layers3 size={15} /><strong>{project.playable_count}</strong> playable</div>
    <div className="project-card-bottom"><Owner profile={project.owner} /><span title="Cập nhật gần nhất">{formatDate(project.updated_at)}</span></div>
  </article>)}</div>;
}
