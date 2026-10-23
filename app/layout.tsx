import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Playable Hub", template: "%s · Playable Hub" }, description: "Kho playable ads chung của đội ngũ. Lưu trữ build, tìm kiếm và đánh giá kết quả theo dự án.", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body><a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-white focus:p-3">Đến nội dung chính</a>{children}<Toaster position="bottom-right" richColors closeButton /></body></html>; }
