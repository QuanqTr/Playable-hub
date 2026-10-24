export function PageSkeleton({ kind = "playables", detail = false }: { kind?: "projects" | "playables"; detail?: boolean }) {
  return <div className="page-loading" role="status" aria-label="Đang tải dữ liệu" aria-busy="true">
    {detail && <div className="skeleton h-4 w-32 mb-6" />}
    <div className="page-heading" aria-hidden="true"><div className="skeleton h-9 w-48" /><div className="skeleton h-10 w-36" /></div>
    {detail && <div className="flex gap-5 mb-7" aria-hidden="true"><div className="skeleton h-8 w-32" /><div className="skeleton h-8 w-24" /></div>}
    <div className={kind === "playables" ? "library-surface gallery-surface" : "library-surface"} aria-hidden="true">
      <div className="view-tabs"><div className="skeleton h-4 w-32" /><div className="skeleton h-4 w-24" /></div>
      <div className="filters"><div className="filter-row"><div className="skeleton h-10 grow basis-64" />{[1, 2, 3].map(i => <div key={i} className="skeleton h-10 w-32 max-w-full" />)}</div></div>
      <div className="results-heading"><div className="skeleton h-4 w-24" /></div>
      {kind === "playables" ? <div className="playable-gallery skeleton-gallery">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-playable-card" key={i}>
        <div className="flex items-center gap-3 p-4"><div className="skeleton size-10 shrink-0 rounded-xl" /><div className="space-y-2 flex-1"><div className="skeleton h-4 w-4/5" /><div className="skeleton h-3 w-1/2" /></div></div>
        <div className="skeleton skeleton-preview" />
        <div className="flex items-center justify-between gap-3 p-4"><div className="skeleton h-5 w-20" /><div className="skeleton h-7 w-24" /></div>
      </div>)}</div> : <div className="project-grid skeleton-project-gallery">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton-project-card"><div className="flex items-center gap-3 mb-5"><div className="skeleton size-10 shrink-0 rounded-xl" /><div className="skeleton h-5 w-3/4" /></div><div className="skeleton h-4 w-1/2 mb-6" /><div className="flex justify-between gap-4"><div className="skeleton h-7 w-24" /><div className="skeleton h-7 w-16" /></div></div>)}</div>}
      <div className="pagination"><div className="skeleton h-3 w-24" /><div className="skeleton h-8 w-36" /></div>
    </div>
    <span className="sr-only">Đang tải {kind === "projects" ? "dự án" : "playable"}…</span>
  </div>;
}
