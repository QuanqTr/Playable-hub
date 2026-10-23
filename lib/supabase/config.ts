import { safeNextPath as validateNextPath } from "@/lib/validation";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
  } catch {
    return null;
  }
  return { url, key };
}

/** Redirects must stay on this application, including when supplied by email. */
export function safeNextPath(value: unknown, fallback = "/projects") {
  return validateNextPath(typeof value === "string" ? value : null, fallback);
}
