import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig, safeNextPath } from "@/lib/supabase/config";

function redirectTo(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  if (!getSupabaseConfig()) return redirectTo(new URL("/setup", url.origin));

  const code = url.searchParams.get("code");
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return redirectTo(new URL(safeNextPath(url.searchParams.get("next"), "/set-password"), url.origin));
      }
    } catch {
      // Invalid or unavailable token exchange cannot establish a session.
    }
  }

  return redirectTo(new URL("/login?error=invalid-invitation", url.origin));
}
