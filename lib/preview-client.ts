"use client";

import { createPreviewDocument, MAX_PREVIEW_BYTES, MAX_THUMBNAIL_BYTES, PREVIEW_HEIGHT, PREVIEW_SANDBOX, PREVIEW_WIDTH, safeExternalPreviewUrl, validThumbnailMessage, type PreviewSource } from "@/lib/preview";

type LoadedPreview = { kind: "html"; html: string } | { kind: "external"; url: string };

export async function loadPlayablePreview(id: string, signal: AbortSignal): Promise<LoadedPreview> {
  signal = AbortSignal.any([signal, AbortSignal.timeout(45_000)]);
  const response = await fetch(`/api/preview/${encodeURIComponent(id)}`, { signal, cache: "no-store" });
  const source = await response.json() as PreviewSource & { error?: string };
  if (!response.ok) throw new Error(source.error || "Chưa tải được preview.");
  if (source.kind === "external") {
    const url = safeExternalPreviewUrl(source.url);
    if (!url) throw new Error("Liên kết preview không hợp lệ.");
    return { kind: "external", url };
  }
  if (source.kind !== "html" || !safeExternalPreviewUrl(source.url)) throw new Error("Nguồn preview không hợp lệ.");
  const file = await fetch(source.url, { signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
  if (!file.ok) throw new Error("Không tải được HTML. Vui lòng thử lại.");
  if (Number(file.headers.get("content-length")) > MAX_PREVIEW_BYTES) throw new Error("File quá lớn để xem trực tiếp.");
  if (!file.body) throw new Error("File HTML trống.");
  const reader = file.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_PREVIEW_BYTES) {
        await reader.cancel();
        throw new Error("File quá lớn để xem trực tiếp.");
      }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) { buffer.set(part, offset); offset += part.byteLength; }
  const html = new TextDecoder().decode(buffer);
  if (!html.trim() || html.includes("\0")) throw new Error("Nội dung HTML không hợp lệ.");
  return { kind: "html", html };
}

let runtime: Promise<string> | undefined;
function captureRuntime() {
  return runtime ??= fetch("/preview-capture-runtime.js", { cache: "force-cache", credentials: "omit", signal: AbortSignal.timeout(8000) }).then(response => {
    if (!response.ok) throw new Error("Không tải được bộ tạo thumbnail.");
    return response.text();
  }).catch(error => { runtime = undefined; throw error; });
}

function captureBridge(channel: string, library: string) {
  return `${library}\n;(() => {
    const channel=${JSON.stringify(channel)}, render=window.htmlToImage.toCanvas;
    const send=image=>parent.postMessage({channel,image},'*');
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    // Background thumbnail work is silent. These changes exist only in this
    // disposable capture frame; the interactive player retains normal audio.
    const volume=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'volume');
    const muted=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'muted');
    const silence=node=>{if(node instanceof HTMLMediaElement){volume.set.call(node,0);muted.set.call(node,true);}};
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){silence(this);return play.apply(this,args);};
    Object.defineProperty(HTMLMediaElement.prototype,'volume',{get(){return 0},set(){volume.set.call(this,0)},configurable:true});
    Object.defineProperty(HTMLMediaElement.prototype,'muted',{get(){return true},set(){muted.set.call(this,true)},configurable:true});
    document.addEventListener('play',event=>silence(event.target),true);
    new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{silence(node);if(node.querySelectorAll)node.querySelectorAll('audio,video').forEach(silence);}))).observe(document,{childList:true,subtree:true});
    if(window.AudioNode&&window.AudioDestinationNode){
      const connect=AudioNode.prototype.connect;
      AudioNode.prototype.connect=function(destination,...args){if(destination instanceof AudioDestinationNode)return destination;return connect.call(this,destination,...args);};
    }
    // WebGL clears its drawing buffer after each frame unless explicitly kept.
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,options){
      if(type==='webgl'||type==='webgl2'||type==='experimental-webgl') options={...options,preserveDrawingBuffer:true};
      return getContext.call(this,type,options);
    };
    async function capture(){
      await sleep(1300);
      try { await Promise.race([document.fonts.ready,sleep(1200)]); } catch {}
      // Chromium may suspend rAF in a non-interactive capture frame. A short
      // timer bounds this wait even when the creative itself never animates.
      await Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),sleep(180)]);
      try {
        const canvases=Array.from(document.querySelectorAll('canvas')).filter(c=>c.width&&c.height);
        const largest=canvases.sort((a,b)=>b.width*b.height-a.width*a.height)[0];
        if(largest&&largest.clientWidth*largest.clientHeight>innerWidth*innerHeight*.55){
          const out=document.createElement('canvas'); out.width=${PREVIEW_WIDTH}; out.height=${PREVIEW_HEIGHT};
          const ctx=out.getContext('2d');
          ctx.fillStyle=getComputedStyle(document.body).backgroundColor||'#fff'; ctx.fillRect(0,0,out.width,out.height);
          const scale=Math.min(out.width/largest.width,out.height/largest.height);
          ctx.drawImage(largest,(out.width-largest.width*scale)/2,(out.height-largest.height*scale)/2,largest.width*scale,largest.height*scale);
          send(out.toDataURL('image/webp',.82)); return;
        }
      } catch {}
      try {
        // Computed styles are already copied inline. Original global styles
        // could also target the renderer's outer SVG and offset the screenshot.
        const canvas=await render(document.body,{width:${PREVIEW_WIDTH},height:${PREVIEW_HEIGHT},canvasWidth:${PREVIEW_WIDTH},canvasHeight:${PREVIEW_HEIGHT},pixelRatio:1,skipFonts:true,cacheBust:false,style:{margin:'0',left:'0',top:'0'},filter:node=>!['SCRIPT','STYLE','LINK','META','BASE','TITLE','IFRAME','OBJECT','EMBED'].includes(node.nodeName.toUpperCase())});
        send(canvas.toDataURL('image/webp',.82));
      } catch { send(null); }
    }
    if(document.readyState==='complete') capture(); else addEventListener('load',capture,{once:true});
  })();`;
}

function aborted() { return new DOMException("Đã hủy tạo thumbnail.", "AbortError"); }

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(aborted()); return; }
    const cancel = () => reject(aborted());
    signal.addEventListener("abort", cancel, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", cancel));
  });
}

async function captureNow(html: string, signal?: AbortSignal): Promise<File | null> {
  if (signal?.aborted) throw aborted();
  const library = await withAbort(captureRuntime(), signal);
  if (signal?.aborted) throw aborted();
  const channel = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", PREVIEW_SANDBOX);
    frame.referrerPolicy = "no-referrer";
    frame.title = "Tạo thumbnail playable";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, { position: "fixed", left: "0", top: "0", width: `${PREVIEW_WIDTH}px`, height: `${PREVIEW_HEIGHT}px`, border: "0", pointerEvents: "none", opacity: "0.001", zIndex: "-1" });
    let finished = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      signal?.removeEventListener("abort", cancel);
      frame.remove();
    };
    const finish = (file: File | null) => { if (!finished) { finished = true; cleanup(); resolve(file); } };
    const cancel = () => { if (!finished) { finished = true; cleanup(); reject(aborted()); } };
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== "null") return;
      if (event.data?.channel === channel && event.data.image === null) { finish(null); return; }
      if (!validThumbnailMessage(event.data, channel)) return;
      const [, mime, encoded] = /^data:(image\/(?:png|webp|jpeg));base64,(.+)$/i.exec(event.data.image)!;
      try {
        const decoded = atob(encoded);
        if (decoded.length > MAX_THUMBNAIL_BYTES) { finish(null); return; }
        const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
        finish(new File([bytes], `preview.${mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp"}`, { type: mime }));
      } catch { finish(null); }
    };
    const timeout = window.setTimeout(() => finish(null), 12_000);
    window.addEventListener("message", receive);
    signal?.addEventListener("abort", cancel, { once: true });
    frame.srcdoc = createPreviewDocument(html, captureBridge(channel, library));
    document.body.append(frame);
  });
}

interface CaptureJob { start: () => Promise<void>; cancel: () => void; signal?: AbortSignal }
const queue: CaptureJob[] = [];
let capturing = false;

let playing = 0;
const playbackListeners = new Set<(active: boolean) => void>();
export function isPreviewPlaying() { return playing > 0; }
export function subscribePreviewPlayback(listener: (active: boolean) => void) {
  playbackListeners.add(listener);
  return () => { playbackListeners.delete(listener); };
}
export function beginPreviewPlayback() {
  playing++;
  playbackListeners.forEach(listener => listener(true));
  return () => {
    playing = Math.max(0, playing - 1);
    playbackListeners.forEach(listener => listener(playing > 0));
  };
}

function drain() {
  if (capturing) return;
  const job = queue.shift();
  if (!job) return;
  if (job.signal?.aborted) { job.cancel(); drain(); return; }
  capturing = true;
  void job.start().finally(() => { capturing = false; drain(); });
}

function enqueueCapture(task: () => Promise<File | null>, signal?: AbortSignal, priority = false): Promise<File | null> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(aborted()); return; }
    const onAbort = () => {
      const index = queue.indexOf(job);
      if (index >= 0) { queue.splice(index, 1); reject(aborted()); }
    };
    const job: CaptureJob = {
      signal,
      cancel: () => { signal?.removeEventListener("abort", onAbort); reject(aborted()); },
      start: async () => {
        signal?.removeEventListener("abort", onAbort);
        try { resolve(await task()); } catch (error) { reject(error); }
      },
    };
    if (priority) queue.unshift(job); else queue.push(job);
    signal?.addEventListener("abort", onAbort, { once: true });
    drain();
  });
}

/** Upload captures take priority over queued gallery covers. */
export function captureHtmlThumbnail(html: string, { signal }: { signal?: AbortSignal } = {}) {
  return enqueueCapture(() => captureNow(html, signal), signal, true);
}

/** Queue the download too: large HTML strings never pile up behind the renderer. */
export function capturePlayableThumbnail(id: string, { signal }: { signal?: AbortSignal } = {}) {
  return enqueueCapture(async () => {
    const source = await loadPlayablePreview(id, signal ?? new AbortController().signal);
    return source.kind === "html" ? captureNow(source.html, signal) : null;
  }, signal);
}

const covers = new Map<string, { url: string; bytes: number }>();
let coverBytes = 0;
export function getPreviewCover(key: string) { return covers.get(key)?.url ?? null; }
export function rememberPreviewCover(key: string, file: File) {
  const previous = covers.get(key);
  if (previous) { URL.revokeObjectURL(previous.url); coverBytes -= previous.bytes; covers.delete(key); }
  const url = URL.createObjectURL(file);
  covers.set(key, { url, bytes: file.size });
  coverBytes += file.size;
  while (covers.size > 40 || coverBytes > 16 * 1024 * 1024) {
    const oldest = covers.entries().next().value!;
    covers.delete(oldest[0]); coverBytes -= oldest[1].bytes; URL.revokeObjectURL(oldest[1].url);
  }
  return url;
}
