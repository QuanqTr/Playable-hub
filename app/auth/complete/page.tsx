import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/app-shell";
import { AuthComplete } from "@/components/auth-complete";

export const metadata: Metadata = { title: "Xác thực liên kết", referrer: "no-referrer" };

export default function AuthCompletePage() {
  return <div className="auth-shell"><Link href="/"><Brand /></Link><main id="main-content" className="auth-center"><div className="auth-card"><AuthComplete /></div></main><footer className="auth-footer">Playable Hub · Không gian làm việc nội bộ</footer></div>;
}
