"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Download, FileArchive, ImageOff, Play } from "lucide-react";
import { PlayablePreview } from "@/components/playable-preview";
import { capturePlayableThumbnail, getPreviewCover, isPreviewPlaying, rememberPreviewCover, subscribePreviewPlayback } from "@/lib/preview-client";
import { isHtmlPlayable, safeExternalPreviewUrl, type PreviewPlayable } from "@/lib/preview";
import { cn } from "@/lib/utils";

export function PlayableCover({ playable, className }: { playable: PreviewPlayable; className?: string }) {
  const node = useRef<HTMLDivElement>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = `${playable.id}:${playable.storage_path ?? ""}`;
  const html = !!playable.storage_path && isHtmlPlayable(playable);
  const storedThumbnail = !!playable.thumbnail_path && failedThumbnail !== playable.thumbnail_path;

  useEffect(() => {
    if (storedThumbnail || !html || !node.current) return;
    const cached = getPreviewCover(key);
    if (cached) { queueMicrotask(() => setCover(cached)); return; }
    let controller: AbortController | null = null;
    let completed = false;
    let visible = false;
    const start = () => {
      if (!visible || completed || controller || isPreviewPlaying()) return;
      controller = new AbortController();
      const signal = controller.signal;
      setLoading(true);
      void capturePlayableThumbnail(playable.id, { signal }).then(file => {
        if (signal.aborted) return;
        completed = true;
        if (file) setCover(rememberPreviewCover(key, file)); else setFailed(true);
        setLoading(false);
      }).catch(() => { if (!signal.aborted) { completed = true; setFailed(true); setLoading(false); } });
    };
    const unsubscribe = subscribePreviewPlayback(active => {
      if (active) { controller?.abort(); controller = null; setLoading(false); }
      else start();
    });
    const observer = new IntersectionObserver(entries => {
      visible = !!entries[0]?.isIntersecting;
      if (!visible) { controller?.abort(); controller = null; return; }
      start();
    }, { rootMargin: "100px 0px", threshold: 0.01 });
    observer.observe(node.current);
    return () => { completed = true; observer.disconnect(); controller?.abort(); unsubscribe(); };
  }, [playable.id, storedThumbnail, html, key]);

  const image = storedThumbnail ? `/api/files/${playable.id}?thumbnail=true` : cover;
  const canPreview = html || !!safeExternalPreviewUrl(playable.external_url);
  const actionClass = "absolute inset-0 flex items-center justify-center bg-slate-950/0 transition-colors duration-200 hover:bg-slate-950/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary";
  const pillClass = "absolute bottom-[18px] flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-[15px] py-2.5 text-xs font-semibold text-slate-900 shadow-lg backdrop-blur transition-transform duration-200 group-hover/cover:scale-105";
  const initials = playable.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <div ref={node} className={cn("playable-cover group/cover relative h-full min-h-72 w-full overflow-hidden bg-slate-100", className)}>
    {/* Private signed images and in-memory blob captures bypass the public image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {image ? <img key={storedThumbnail ? playable.thumbnail_path : image} src={image} alt={`${playable.name} — preview`} data-preview-cover={storedThumbnail ? "uploaded" : "captured"} className="h-full w-full object-cover transition-transform duration-500 group-hover/cover:scale-[1.025]" loading="lazy" decoding="async" onError={() => { if (storedThumbnail) setFailedThumbnail(playable.thumbnail_path!); else { setCover(null); setFailed(true); } }} /> : <div className={cn("relative flex h-full min-h-72 items-center justify-center overflow-hidden bg-gradient-to-br from-violet-100 via-slate-100 to-indigo-200", loading && !failed && "preview-shimmer")}>
      <span aria-hidden="true" className="absolute -right-12 -top-12 size-64 rounded-full border-[40px] border-white/35" />
      <span aria-hidden="true" className="absolute -bottom-20 -left-12 size-64 rounded-full bg-white/35" />
      <div className="relative flex flex-col items-center gap-4 text-indigo-400/70"><span className="flex size-24 items-center justify-center rounded-[28px] border border-white/70 bg-white/60 text-3xl font-semibold shadow-xl shadow-indigo-200/30">{playable.external_url ? <ArrowUpRight size={35} /> : html ? initials : <FileArchive size={35} />}</span>{failed && <span className="flex items-center gap-1.5 text-xs text-slate-500"><ImageOff size={14} />Chưa có ảnh preview</span>}</div>
    </div>}
    {canPreview ? <PlayablePreview playable={playable} trigger={<button type="button" aria-label={`Xem trực tiếp ${playable.name}`} className={actionClass}>
      <span className={pillClass}><Play className="size-4 fill-current" />Xem trực tiếp</span>
    </button>} /> : playable.storage_path ? <a href={`/api/files/${playable.id}`} aria-label={`Tải ZIP ${playable.name}`} className={actionClass}>
      <span className={pillClass}><Download className="size-4" />Tải ZIP</span>
    </a> : <div className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className={pillClass}>Chưa có nội dung</span></div>}
  </div>;
}
