"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Download, ExternalLink, Maximize, Minimize, Monitor, Play, RotateCcw, Smartphone } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const fullscreenOwner = useRef<HTMLElement | null>(null);
  const [deviceId, setDeviceId] = useState<string>(PREVIEW_DEVICES[0].id);
  const deviceSelectId = useId();
  const [loaded, setLoaded] = useState(false);
  const [available, setAvailable] = useState({ width: 390, height: 694 });
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const device = PREVIEW_DEVICES.find(item => item.id === deviceId) ?? PREVIEW_DEVICES[0];
  const width = landscape ? device.height : device.width;
  const height = landscape ? device.width : device.height;
  const scale = Math.max(0.01, Math.min((available.width - 12) / width, (available.height - 12) / height));

  useEffect(() => beginPreviewPlayback(), []);

  useEffect(() => {
    const changed = () => {
      if (fullscreenOwner.current && document.fullscreenElement !== fullscreenOwner.current) {
        fullscreenOwner.current = null;
        setExpanded(false);
      }
    };
    document.addEventListener("fullscreenchange", changed);
    return () => {
      document.removeEventListener("fullscreenchange", changed);
      if (fullscreenOwner.current && document.fullscreenElement === fullscreenOwner.current) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  async function toggleExpanded() {
    if (expanded) {
      if (document.fullscreenElement === dialog.current) await document.exitFullscreen().catch(() => {});
      setExpanded(false);
      return;
    }
    setExpanded(true);
    const element = dialog.current;
    // The edge-to-edge layout also works when browser fullscreen is unavailable.
    if (element && document.fullscreenEnabled && element.requestFullscreen) {
      fullscreenOwner.current = element;
      try { await element.requestFullscreen(); }
      catch { fullscreenOwner.current = null; }
    }
  }

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

  return <DialogContent ref={dialog} data-expanded={expanded} data-landscape={landscape} className="preview-dialog flex flex-col gap-0 overflow-hidden p-0" style={expanded ? { translate: "none" } : undefined} aria-describedby="preview-description" onEscapeKeyDown={event => { if (expanded) { event.preventDefault(); void toggleExpanded(); } }}>
    <div className="preview-header">
      <DialogTitle className="min-w-0 flex-1 truncate text-base" aria-label={`Xem trực tiếp ${playable.name}`}>{playable.name}</DialogTitle>
      <div className="preview-actions">
        <Button variant="ghost" size="icon" aria-label="Chạy lại preview" onClick={restart}><RotateCcw /></Button>
        {playable.storage_path && <Button asChild variant="ghost" size="icon"><a href={`/api/files/${playable.id}`} aria-label="Tải playable"><Download /></a></Button>}
        {playable.external_url && <Button asChild variant="ghost" size="icon"><a href={playable.external_url} target="_blank" rel="noopener noreferrer" aria-label="Mở liên kết gốc"><ExternalLink /></a></Button>}
        <Button variant="outline" size="sm" className="preview-expand-button" aria-label={expanded ? "Thu nhỏ preview" : "Xem toàn màn hình"} title={expanded ? "Thu nhỏ preview" : "Xem toàn màn hình"} aria-pressed={expanded} onClick={() => void toggleExpanded()}>{expanded ? <Minimize /> : <Maximize />}<span>{expanded ? "Thu nhỏ" : "Xem full"}</span></Button>
      </div>
    </div>
    <div className="preview-device-toolbar">
      <label htmlFor={deviceSelectId} className="sr-only">Thiết bị preview</label>
      <select id={deviceSelectId} className="select preview-device-select" value={deviceId} onChange={event => setDeviceId(event.target.value)}>
        {PREVIEW_DEVICES.map(item => <option key={item.id} value={item.id}>{item.name} · {item.width} × {item.height} {item.unit}</option>)}
      </select>
      <Button variant="outline" size="sm" aria-label={landscape ? "Chuyển màn hình dọc" : "Chuyển màn hình ngang"} aria-pressed={landscape} onClick={() => setLandscape(value => !value)}>{landscape ? <Monitor /> : <Smartphone />}<span className="preview-orientation-label">{landscape ? "Ngang" : "Dọc"}</span></Button>
      <output className="sr-only" aria-live="polite" aria-label="Kích thước preview">{width} × {height} {device.unit}</output>
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
    <DialogDescription id="preview-description" className="sr-only">Chọn thiết bị, xoay khung hoặc xem toàn màn hình. Nhấp hoặc chạm vào playable để trải nghiệm. Liên kết ngoài có thể được mở bằng nút Mở liên kết gốc.</DialogDescription>
  </DialogContent>;
}
