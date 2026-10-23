import Link from "next/link";
import { Brand } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { requireUser } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function SetPasswordPage() { await requireUser(); return <div className="auth-shell"><Link href="/"><Brand /></Link><main id="main-content" className="auth-center"><div className="auth-card"><h1>Thiết lập mật khẩu</h1><p className="intro">Chọn mật khẩu cho tài khoản được mời của bạn để bắt đầu sử dụng Playable Hub.</p><AuthForm mode="password" /></div></main><footer className="auth-footer">Playable Hub · Không gian làm việc nội bộ</footer></div>; }
