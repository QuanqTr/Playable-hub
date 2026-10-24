import { CalendarDays, Play } from "lucide-react";
import type { Filters, Playable } from "@/lib/types";
import { formatDate, initials, queryHref } from "@/lib/utils";
import { PlayableCover } from "./playable-cover";
import { PlayableRowMenu } from "./playable-row-menu";
import { WinBadge } from "./status-badge";
import { PendingLink } from "./pending-link";

export function PlayableCards({ playables, path, filters }: { playables: Playable[]; path: string; filters: Filters }) {
  return <div className="playable-grid" aria-label="Danh sách playable">
    {playables.map(playable => {
      const href = queryHref(path, { ...filters }, { playable: playable.id });
      const owner = playable.project.owner.display_name || playable.project.owner.email;
      return <article className="playable-card" key={playable.id}>
        <header className="playable-card-header">
          <span className="project-mark" aria-hidden="true">{initials(playable.project.name)}</span>
          <div className="playable-card-heading"><h2><PendingLink href={href} intentPrefetch scroll={false}>{playable.name}</PendingLink></h2><PendingLink href={`/projects/${playable.project.id}`} intentPrefetch className="playable-project">{playable.project.name}</PendingLink></div>
          <PlayableRowMenu playable={playable} href={href} />
        </header>
        <div className="playable-artwork">
          <PlayableCover playable={playable} />
          <div className="playable-card-badge"><WinBadge value={playable.win_level} /></div>
        </div>
        <footer className="playable-card-footer">
          <div className="playable-card-networks"><div className="network-chips">{playable.networks.slice(0, 2).map(network => <span key={network.id} className="network-chip">{network.name}</span>)}{playable.networks.length > 2 && <span className="network-chip" title={playable.networks.slice(2).map(network => network.name).join(", ")}>+{playable.networks.length - 2}</span>}{!playable.networks.length && <span className="network-unassigned"><Play size={12} />Playable</span>}</div><span className="avatar card-owner" title={`Phụ trách: ${owner}`} aria-label={`Phụ trách: ${owner}`}>{initials(owner)}</span></div>
          <div className="playable-card-meta"><span className="mono">{playable.code}</span><span title={playable.released_at ? "Ngày triển khai" : "Cập nhật gần nhất"}><CalendarDays size={12} />{formatDate(playable.released_at || playable.updated_at)}</span></div>
        </footer>
      </article>;
    })}
  </div>;
}
