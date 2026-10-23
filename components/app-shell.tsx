"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Boxes, ChevronRight, FolderClosed, Library, Loader2, LockKeyhole, LogOut, Play } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/actions";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { Button } from "./ui/button";
export function Brand() { return <span className="brand"><span className="brand-mark"><Play size={17} fill="currentColor" strokeWidth={0} /></span>playable<span className="font-normal text-[#85958e] -ml-1.5">hub</span></span>; }
export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const projects = pathname.startsWith("/projects");
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/projects" aria-label="Playable Hub — Dự án"><Brand /></Link>
      <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
      <nav aria-label="Điều hướng chính">
        <Link href="/projects" className={`nav-link ${projects ? "active" : ""}`} aria-current={projects ? "page" : undefined}><FolderClosed size={17} />Dự án</Link>
        <Link href="/playables" className={`nav-link ${!projects ? "active" : ""}`} aria-current={!projects ? "page" : undefined}><Library size={17} />Kho playable</Link>
      </nav>
      <div className="sidebar-note"><div className="flex items-center gap-2 mb-2 text-[#7b9085]"><Boxes size={15} /><span>Kho tài sản chung</span></div>Lưu lại mỗi build.<br />Tìm đúng playable bạn cần.</div>
      <div className="user-profile"><span className="avatar">{initials(profile.display_name || profile.email)}</span><div className="user-info min-w-0 flex-1"><p className="text-[11px] font-semibold truncate">{profile.display_name || profile.email}</p><p className="text-[10px] text-muted-foreground mt-1">Thành viên</p></div>
        <Button variant="ghost" size="icon" aria-label="Đăng xuất" title="Đăng xuất" disabled={pending} onClick={() => startTransition(async () => { try { await signOut(); } catch (error) { if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error; toast.error("Chưa đăng xuất được. Vui lòng thử lại."); } })}>{pending ? <Loader2 className="animate-spin" /> : <LogOut size={15} />}</Button>
      </div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="flex items-center gap-2"><span>Không gian làm việc</span><ChevronRight size={12} /><span className="text-[#425466]">{projects ? "Dự án" : "Kho playable"}</span></div><span className="workspace-tag"><LockKeyhole size={11} />Nội bộ</span></header><main id="main-content" className="main-content">{children}</main></div>
  </div>;
}
