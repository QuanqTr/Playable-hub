"use client";

import { useEffect } from "react";
import { hasAuthRedirectFragment } from "@/lib/auth-redirect";

/** Supabase's default emails can return to Site URL with credentials in a fragment. */
export function AuthRedirectListener() {
  useEffect(() => {
    const handleRedirect = () => {
      if (window.location.pathname !== "/auth/complete" && hasAuthRedirectFragment(window.location.hash)) {
        window.location.replace(`/auth/complete${window.location.hash}`);
      }
    };
    handleRedirect();
    window.addEventListener("hashchange", handleRedirect);
    return () => window.removeEventListener("hashchange", handleRedirect);
  }, []);
  return null;
}
