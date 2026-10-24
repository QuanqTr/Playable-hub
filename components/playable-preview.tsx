"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Download, ExternalLink, Monitor, Play, RotateCcw, Smartphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createPreviewDocument, PREVIEW_DEVICES, PREVIEW_SANDBOX, type PreviewPlayable } from "@/lib/preview";
import { beginPreviewPlayback, loadPlayablePreview } from "@/lib/preview-client";

type Source = Awaited<ReturnType<typeof loadPlayablePreview>>;
type LoadState = { status: "loading" } | { status: "ready"; source: Source } | { status: "error"; message: string };

export function PlayablePreview({ playable, trigger }: { playable: PreviewPlayable; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>{trigger ?? <Button variant="outline"><Play />Xem trực tiếp</Button>}</DialogTrigger>
    {open && <PreviewPlayer playable={playable} />}
  </Dialog>;
}

function PreviewPlayer({ playable }: { playable: PreviewPlayable }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reload, setReload] = useState(0);
  const [landscape, setLandscape] = useState(false);
  const [deviceId, setDeviceId] = useState<string>(PREVIEW_DEVICES[0].id);
  const deviceSelectId = useId();
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState({ width: 390, height: 694 });
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const device = PREVIEW_DEVICES.find(item => item.id === deviceId) ?? PREVIEW_DEVICES[0];
  const width = landscape ? device.height : device.width;
  const height = landscape ? device.width : device.height;
  const scale = Math.max(0.1, Math.min(1, (available.width - 32) / width, (available.height - 32) / height));

  useEffect(() => beginPreviewPlayback(), []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPlayablePreview(playable.id, controller.signal)
      .then(source => { if (!controller.signal.aborted) setState({ status: "ready", source }); })
      .catch(error => { if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error ? error.message : "Chưa tải được preview." }); });
    return () => controller.abort();
  }, [playable.id, reload]);

  useEffect(() => {
    if (!stage) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  function restart() { setLoaded(false); setState({ status: "loading" }); setReload(value => value + 1); }
  const source = state.status === "ready" ? state.source : null;

  return <DialogContent className="preview-dialog flex h-[min(92dvh,880px)] max-w-[1100px] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[1100px]" aria-describedby="preview-description">
    <div className="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-4 pr-14">
      <div className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[.18em] text-primary">PLAYABLE PREVIEW</span><DialogTitle className="truncate text-lg" aria-label={`Xem trực tiếp ${playable.name}`}>{playable.name}</DialogTitle></div>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" aria-label="Chạy lại preview" onClick={restart}><RotateCcw /></Button>
        {playable.storage_path && <Button asChild variant="ghost" size="icon"><a href={`/api/files/${playable.id}`} aria-label="Tải playable"><Download /></a></Button>}
        {playable.external_url && <Button asChild variant="ghost" size="icon"><a href={playable.external_url} target="_blank" rel="noopener noreferrer" aria-label="Mở liên kết gốc"><ExternalLink /></a></Button>}
      </div>
    </div>
    <div className="preview-device-toolbar">
      <label htmlFor={deviceSelectId} className="sr-only">Thiết bị preview</label>
      <select id={deviceSelectId} className="select preview-device-select" value={deviceId} onChange={event => setDeviceId(event.target.value)}>
        {PREVIEW_DEVICES.map(item => <option key={item.id} value={item.id}>{item.name} · {item.width} × {item.height} {item.unit}</option>)}
      </select>
      <Button variant="outline" size="sm" aria-label={landscape ? "Chuyển màn hình dọc" : "Chuyển màn hình ngang"} aria-pressed={landscape} onClick={() => setLandscape(value => !value)}>{landscape ? <Monitor /> : <Smartphone />}{landscape ? "Ngang" : "Dọc"}</Button>
      <output className="preview-viewport-size" aria-live="polite" aria-label="Kích thước preview">{width} × {height} {device.unit}</output>
    </div>
    <div ref={setStage} className="preview-stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-100" style={{ backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
      {state.status === "loading" && <div className="preview-shimmer relative overflow-hidden rounded-3xl bg-slate-200" role="status" aria-label="Đang tải preview" style={{ width: width * scale, height: height * scale }}><div className="absolute inset-x-6 bottom-8 h-12 rounded-xl bg-white/45" /><span className="sr-only">Đang tải preview…</span></div>}
      {state.status === "error" && <div className="max-w-sm px-6 text-center"><span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white text-slate-400"><Play size={24} /></span><p className="text-sm leading-6 text-slate-600">{state.message}</p><div className="mt-5 flex justify-center gap-2"><Button variant="outline" onClick={restart}>Thử lại</Button>{playable.storage_path && <Button asChild><a href={`/api/files/${playable.id}`}><Download />Tải file</a></Button>}</div></div>}
      {source && <div className="relative shrink-0 overflow-hidden rounded-[22px] bg-white shadow-2xl outline outline-1 outline-slate-200" style={{ width: width * scale, height: height * scale }}>
        {!loaded && <div aria-hidden="true" className="preview-shimmer absolute inset-0 z-10 bg-slate-200" />}
        <div style={{ position: "absolute", inset: 0, width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <iframe key={reload} title={`Preview ${playable.name}`} sandbox={PREVIEW_SANDBOX} referrerPolicy="no-referrer" srcDoc={source.kind === "html" ? createPreviewDocument(source.html) : undefined} src={source.kind === "external" ? source.url : undefined} width={width} height={height} style={{ display: "block", width, height, border: 0, maxWidth: "none" }} onLoad={() => setLoaded(true)} />
        </div>
      </div>}
    </div>
    <DialogDescription id="preview-description" className="shrink-0 border-t bg-white px-5 py-3 text-center text-xs leading-5">{source?.kind === "external" ? <>Nếu trang không hiển thị, <a className="font-medium text-primary underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer">mở liên kết gốc</a>.</> : "Chạm hoặc nhấp vào màn hình để trải nghiệm."}</DialogDescription>
  </DialogContent>;
}
