import "server-only";
import { parseStoreUrl } from "./store-url";

function allowedArtwork(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.replaceAll("&amp;", "&"));
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.hostname !== "play-lh.googleusercontent.com" && !/^is\d+-ssl\.mzstatic\.com$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function getStoreIcon(value: string): Promise<string | null> {
  const listing = parseStoreUrl(value);
  if (!listing) return null;
  try {
    if (listing.kind === "apple") {
      const response = await fetch(`https://itunes.apple.com/lookup?id=${listing.id}&country=${listing.country}`, {
        redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!response.ok) return null;
      const result = await response.json() as { results?: { artworkUrl512?: string }[] };
      return allowedArtwork(result.results?.[0]?.artworkUrl512);
    }
    const response = await fetch(listing.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlayableHub/1.0)" },
      redirect: "error", signal: AbortSignal.timeout(8000), cache: "no-store",
    });
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 4_000_000) return null;
    const html = await response.text();
    const tag = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*>/i)?.[0];
    const image = tag?.match(/content=["']([^"']+)["']/i)?.[1];
    return allowedArtwork(image);
  } catch {
    return null;
  }
}
