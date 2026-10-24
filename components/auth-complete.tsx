"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AUTH_REDIRECT_ERROR, completeAuthRedirect, parseAuthRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

export function AuthComplete() {
  const completion = useRef<Promise<boolean> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!completion.current) {
      const redirect = parseAuthRedirect(window.location.hash);
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      // Clear credentials before creating a client or making any network request.
      window.history.replaceState(window.history.state, "", window.location.pathname);
      if (redirect.kind === "none" && code && code.length <= 4_096 && /^[\w-]+$/.test(code)) {
        window.location.replace(`/auth/callback?${new URLSearchParams({ code, next: "/set-password" })}`);
        completion.current = new Promise(() => {});
      } else {
        completion.current = (async () => {
          if (redirect.kind !== "tokens") return false;
          try { return await completeAuthRedirect(createClient().auth, redirect); } catch { return false; }
        })();
      }
    }

    // Strict Mode reuses the same work after its effect cleanup; tokens are consumed once.
    let active = true;
    void completion.current.then(success => {
      if (!active) return;
      if (success) window.location.replace("/set-password");
      else setFailed(true);
    });
    return () => { active = false; };
  }, []);

  return <>
    <h1>{failed ? "Không thể xác thực liên kết" : "Đang xác thực liên kết"}</h1>
    {failed ? <><p role="alert" className="intro">{AUTH_REDIRECT_ERROR}</p><Link href="/login" className="text-primary underline">Về trang đăng nhập</Link></> : <p role="status" aria-live="polite" className="intro">Vui lòng chờ trong khi Playable Hub xác thực tài khoản của bạn.</p>}
  </>;
}
