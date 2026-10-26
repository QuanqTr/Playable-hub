import { CalendarDays, Play } from "lucide-react";
import type { Filters, Playable } from "@/lib/types";
import { formatDate, initials, queryHref } from "@/lib/utils";
import { PlayableCover } from "./playable-cover";
import { PlayableRowMenu } from "./playable-row-menu";
import { WinBadge } from "./status-badge";
import { PendingLink } from "./pending-link";
import { NetworkTag } from "./network-tag";
import { ArchiveButton } from "./archive-button";
import { PermanentDeleteButton } from "./permanent-delete-button";

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
        </div>
        <footer className="playable-card-footer">
          <div className="playable-card-win"><span>Mức độ win</span><WinBadge value={playable.win_level} /></div>
          {playable.notes && <p className="playable-card-note" title={playable.notes}>{playable.notes}</p>}
          <div className="playable-card-networks"><div className="network-chips">{playable.networks.slice(0, 2).map(network => <NetworkTag key={network.id} network={network} />)}{playable.networks.length > 2 && <span className="network-chip" title={playable.networks.slice(2).map(network => network.name).join(", ")}>+{playable.networks.length - 2}</span>}{!playable.networks.length && <span className="network-unassigned"><Play size={12} />Playable</span>}</div><span className="avatar card-owner" title={`Phụ trách: ${owner}`} aria-label={`Phụ trách: ${owner}`}>{initials(owner)}</span></div>
          <div className="playable-card-meta"><span className="mono">{playable.code}</span><span title={playable.released_at ? "Ngày triển khai" : "Cập nhật gần nhất"}><CalendarDays size={12} />{formatDate(playable.released_at || playable.updated_at)}</span></div>
          <div className="playable-card-actions">{(!filters.archived || (playable.archived_at && !playable.project.archived_at)) && <ArchiveButton kind="playable" id={playable.id} archived={!!playable.archived_at} name={playable.name} compact />}{filters.archived === "true" && <PermanentDeleteButton kind="playable" id={playable.id} name={playable.name} compact />}</div>
        </footer>
      </article>;
    })}
  </div>;
}
