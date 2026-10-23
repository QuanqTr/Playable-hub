import { PROJECT_STATUSES, WIN_LEVELS } from "@/lib/constants";
import type { ProjectStatus, WinLevel } from "@/lib/types";
export function WinBadge({ value }: { value: WinLevel }) { return <span className={`badge win-${value}`}><span className="badge-dot" />{WIN_LEVELS[value]}</span>; }
export function ProjectBadge({ value }: { value: ProjectStatus }) { return <span className={`badge status-${value}`}><span className="badge-dot" />{PROJECT_STATUSES[value]}</span>; }
