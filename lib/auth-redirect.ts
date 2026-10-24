export const AUTH_REDIRECT_ERROR = "Liên kết đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng mở lại thư mời hoặc nhờ quản trị viên gửi lại.";

const MAX_FRAGMENT_LENGTH = 32_768;
const AUTH_FRAGMENT_KEYS = ["access_token", "refresh_token", "error", "error_code", "error_description"];

export type AuthRedirect =
  | { kind: "none" }
  | { kind: "error" }
  | { kind: "tokens"; type: "invite" | "recovery"; accessToken: string; refreshToken: string };

/** Normal document anchors must never trigger the authentication flow. */
export function hasAuthRedirectFragment(fragment: string): boolean {
  const value = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (value.length > MAX_FRAGMENT_LENGTH) {
    return /(?:^|&)(?:access_token|refresh_token|error(?:_code|_description)?)=/.test(value);
  }
  const params = new URLSearchParams(value);
  return AUTH_FRAGMENT_KEYS.some(key => params.has(key));
}

export function parseAuthRedirect(fragment: string): AuthRedirect {
  if (!hasAuthRedirectFragment(fragment)) return { kind: "none" };
  if (fragment.length > MAX_FRAGMENT_LENGTH || /%(?![\da-f]{2})/i.test(fragment)) return { kind: "error" };

  const params = new URLSearchParams(fragment.startsWith("#") ? fragment.slice(1) : fragment);
  if (["error", "error_code", "error_description"].some(key => params.has(key))) return { kind: "error" };
  if (["access_token", "refresh_token", "type"].some(key => params.getAll(key).length !== 1)) return { kind: "error" };

  const type = params.get("type");
  const accessToken = params.get("access_token") ?? "";
  const refreshToken = params.get("refresh_token") ?? "";
  if ((type !== "invite" && type !== "recovery") ||
    accessToken.length > 16_384 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(accessToken) ||
    refreshToken.length > 4_096 || !/^[\w-]+$/.test(refreshToken)) {
    return { kind: "error" };
  }
  return { kind: "tokens", type, accessToken, refreshToken };
}

type RedirectAuth = {
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<{ error: unknown }>;
  getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
};

/** Only a user verified by Supabase Auth may continue to the password form. */
export async function completeAuthRedirect(auth: RedirectAuth, redirect: AuthRedirect): Promise<boolean> {
  if (redirect.kind !== "tokens") return false;
  let established = false;
  try {
    const { error } = await auth.setSession({ access_token: redirect.accessToken, refresh_token: redirect.refreshToken });
    if (error) return false;
    established = true;
    const { data, error: userError } = await auth.getUser();
    if (!userError && data.user?.id) return true;
  } catch {
    // Never surface upstream errors: they may include credentials or user data.
  }
  if (established) {
    try { await auth.signOut({ scope: "local" }); } catch { /* A failed verification cannot establish a trusted session. */ }
  }
  return false;
}
