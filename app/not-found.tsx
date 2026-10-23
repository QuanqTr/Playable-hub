import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function NotFound() { return <main id="main-content" className="min-h-[75dvh] flex items-center justify-center p-8"><div className="text-center max-w-sm"><FileSearch className="text-muted-foreground mx-auto mb-5" size={35} /><h1 className="text-xl font-semibold mb-3">Không tìm thấy nội dung</h1><p className="text-sm text-muted-foreground mb-6 leading-6">Liên kết có thể chưa đúng hoặc nội dung không còn khả dụng.</p><Button asChild><Link href="/projects">Về danh sách dự án</Link></Button></div></main>; }
