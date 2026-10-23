import { type EmailOtpType } from "@supabase/supabase-js";
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

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && (type === "invite" || type === "recovery")) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });
      if (!error) {
        return redirectTo(new URL(safeNextPath(url.searchParams.get("next"), "/set-password"), url.origin));
      }
    } catch {
      // Failed or unavailable verification never opens an authenticated page.
    }
  }

  return redirectTo(new URL("/login?error=invalid-invitation", url.origin));
}
