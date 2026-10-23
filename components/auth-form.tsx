"use client";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { setPassword, signIn } from "@/lib/actions";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
export function AuthForm({ mode = "login", next, disabled = false }: { mode?: "login" | "password"; next?: string; disabled?: boolean }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [show, setShow] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      const result = await (mode === "login" ? signIn(data) : setPassword(data));
      if (result?.error) setError(result.error);
    });
  }
  return <form onSubmit={submit} className="space-y-5">
    {next && <input name="next" value={next} type="hidden" />}
    <fieldset disabled={pending || disabled} className="space-y-5">
      {mode === "login" && <div className="field"><Label htmlFor="email">Email công việc</Label><Input name="email" id="email" type="email" autoComplete="username" placeholder="ban@congty.com" required maxLength={254} /></div>}
      <div className="field"><Label htmlFor="password">{mode === "password" ? "Mật khẩu mới" : "Mật khẩu"}</Label><div className="relative"><Input name="password" id="password" type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Nhập mật khẩu" : "Tối thiểu 8 ký tự"} minLength={mode === "password" ? 8 : undefined} maxLength={128} required className="pr-10" /><button type="button" className="absolute right-0 top-0 size-10 flex items-center justify-center text-muted-foreground rounded-r-lg focus-visible:outline-primary" aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShow(!show)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
      {mode === "password" && <div className="field"><Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label><Input name="confirmPassword" id="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="Nhập lại mật khẩu mới" /></div>}
    </fieldset>
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button type="submit" className="w-full" disabled={pending || disabled}>{pending ? <Loader2 className="animate-spin" /> : null}{pending ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Lưu mật khẩu"}{!pending && <ArrowRight />}</Button>
  </form>;
}
