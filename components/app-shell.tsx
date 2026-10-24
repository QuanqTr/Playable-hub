"use client";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { FolderClosed, Library, Loader2, LogOut, Play } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/actions";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { Button } from "./ui/button";
import { PendingLink } from "./pending-link";
export function Brand() { return <span className="brand"><span className="brand-mark"><Play size={17} fill="currentColor" strokeWidth={0} /></span>playable<span className="font-normal text-[#85958e] -ml-1.5">hub</span></span>; }
export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const projects = pathname.startsWith("/projects");
  return <div className="app-shell">
    <aside className="sidebar">
      <PendingLink href="/playables" prefetch={true} aria-label="Playable Hub — Kho playable"><Brand /></PendingLink>
      <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
      <nav aria-label="Điều hướng chính">
        <PendingLink href="/projects" prefetch={true} className={`nav-link ${projects ? "active" : ""}`} aria-current={projects ? "page" : undefined}><FolderClosed size={17} />Dự án</PendingLink>
        <PendingLink href="/playables" prefetch={true} className={`nav-link ${!projects ? "active" : ""}`} aria-current={!projects ? "page" : undefined}><Library size={17} />Kho playable</PendingLink>
      </nav>
      <div className="user-profile mt-auto"><span className="avatar">{initials(profile.display_name || profile.email)}</span><div className="user-info min-w-0 flex-1"><p className="text-[11px] font-semibold truncate">{profile.display_name || profile.email}</p></div>
        <Button variant="ghost" size="icon" aria-label="Đăng xuất" title="Đăng xuất" disabled={pending} onClick={() => startTransition(async () => { try { await signOut(); } catch (error) { if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error; toast.error("Chưa đăng xuất được. Vui lòng thử lại."); } })}>{pending ? <Loader2 className="animate-spin" /> : <LogOut size={15} />}</Button>
      </div>
    </aside>
    <div className="app-main"><main id="main-content" className="main-content">{children}</main></div>
  </div>;
}
