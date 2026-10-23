import type { Metadata } from "next";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Brand } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { isConfigured } from "@/lib/data";
import type { SearchParams } from "@/lib/search";
import { safeNextPath } from "@/lib/validation";
export const metadata: Metadata = { title: "Đăng nhập" };
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const configured = isConfigured();
  return <div className="auth-shell"><Link href="/"><Brand /></Link><main id="main-content" className="auth-center"><div className="auth-card"><div className="inline-flex size-10 items-center justify-center rounded-xl bg-[#edf6f1] text-primary mb-6"><LockKeyhole size={19} /></div><h1>Chào mừng trở lại</h1><p className="intro">Đăng nhập để truy cập kho playable chung<br />và tiếp tục công việc của bạn.</p>{params.error && <p role="alert" className="form-error mb-5">Liên kết đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng mở lại thư mời hoặc nhờ quản trị viên gửi lại.</p>}{!configured && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-6 mb-5">Chưa cấu hình Supabase. <Link href="/setup" className="underline">Xem hướng dẫn thiết lập</Link>.</p>}<AuthForm next={safeNextPath(typeof params.next === "string" ? params.next : undefined)} disabled={!configured} /><p className="text-[11px] leading-6 text-[#9aa59e] mt-6 pt-5 border-t">Chỉ dành cho thành viên được mời. Liên hệ quản trị viên nếu bạn chưa có tài khoản hoặc cần đặt lại mật khẩu.</p></div><p className="text-[11px] text-[#9ca9a1] mt-7">Một nơi cho mọi build của đội ngũ.</p></main><footer className="auth-footer">Playable Hub · Không gian làm việc nội bộ</footer></div>;
}
