/** Shared preview protocol. HTML is always executed in an opaque sandbox. */
export const PREVIEW_SANDBOX = "allow-scripts";
export const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
export const PREVIEW_WIDTH = 390;
export const PREVIEW_HEIGHT = 694;

export type PreviewSource = { kind: "html"; url: string } | { kind: "external"; url: string };
export interface PreviewPlayable {
  id: string;
  name: string;
  storage_path?: string | null;
  external_url?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  thumbnail_path?: string | null;
}

export function isHtmlPlayable(playable: Pick<PreviewPlayable, "file_name" | "file_mime">) {
  return playable.file_mime === "text/html" || /\.html?$/i.test(playable.file_name ?? "");
}

export function safeExternalPreviewUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function scriptText(script: string) {
  return script.replace(/<\/script/gi, "<\\/script");
}

/** Insert policy before any user markup; srcDoc never receives a Storage URL. */
export function createPreviewDocument(html: string, bridge = "") {
  const policy = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https: http: data: blob:; style-src 'unsafe-inline' https: http: data:; img-src https: http: data: blob:; font-src https: http: data:; media-src https: http: data: blob:; connect-src https: http:; worker-src blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  // A new base cannot be supplied by the untrusted HTML. Relative resources
  // resolve to about:blank instead of authenticated application endpoints.
  return `<!doctype html><html><head><base href="about:blank"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;}html{color-scheme:normal}</style>${bridge ? `<script>${scriptText(bridge)}</script>` : ""}</head><body>${html}</body></html>`;
}

export function validThumbnailMessage(data: unknown, channel: string): data is { channel: string; image: string } {
  if (!data || typeof data !== "object") return false;
  const message = data as Record<string, unknown>;
  return message.channel === channel && typeof message.image === "string"
    && message.image.length <= Math.ceil(MAX_THUMBNAIL_BYTES * 4 / 3) + 100
    && /^data:image\/(?:png|webp|jpeg);base64,[a-z\d+/]+=*$/i.test(message.image);
}
