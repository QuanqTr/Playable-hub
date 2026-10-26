export type StoreListing = { kind: "google"; id: string; url: string } | { kind: "apple"; id: string; country: string; url: string };

export function parseStoreUrl(value: string): StoreListing | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.hostname === "play.google.com" && url.pathname === "/store/apps/details") {
      const id = url.searchParams.get("id");
      if (!id || !/^[a-zA-Z][a-zA-Z0-9_.]{2,199}$/.test(id)) return null;
      return { kind: "google", id, url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}` };
    }
    if (url.hostname === "apps.apple.com") {
      const match = url.pathname.match(/(?:^|\/)id(\d{5,20})\/?$/);
      if (!match) return null;
      const country = url.pathname.match(/^\/([a-z]{2})\//i)?.[1].toLowerCase() || "us";
      return { kind: "apple", id: match[1], country, url: `${url.origin}${url.pathname.replace(/\/$/, "")}` };
    }
  } catch {
    return null;
  }
  return null;
}
