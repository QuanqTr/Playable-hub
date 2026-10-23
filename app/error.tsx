"use client";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main id="main-content" className="min-h-[65dvh] flex items-center justify-center p-8"><div className="max-w-md text-center"><AlertCircle size={32} className="mx-auto mb-5 text-amber-500" /><h1 className="text-xl font-semibold mb-3">Chưa tải được dữ liệu</h1><p className="text-sm leading-6 text-muted-foreground mb-6">Kiểm tra kết nối rồi thử lại. Nếu lỗi tiếp tục, nhờ quản trị viên kiểm tra kết nối Supabase và migration.</p><Button onClick={reset} variant="outline"><RotateCw />Thử lại</Button></div></main>; }
