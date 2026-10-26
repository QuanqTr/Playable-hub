"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { setArchived } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

interface Props { kind: "project" | "playable"; id: string; archived: boolean; name?: string; onSuccess?: () => void; compact?: boolean }

export function ArchiveButton({ kind, id, archived, name, onSuccess, compact = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = kind === "project" ? "dự án" : "playable";

  async function apply() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = await setArchived(kind, id, !archived);
      if (!result.ok) { setError(result.error); return; }
      toast.success(archived ? `Đã khôi phục ${label}.` : `Đã xóa ${label} khỏi danh sách.`);
      setOpen(false); router.refresh(); onSuccess?.();
    } catch { setError("Không lưu được thay đổi. Vui lòng thử lại."); }
    finally { setPending(false); }
  }

  if (archived) return <div className="space-y-2"><Button variant="outline" size={compact ? "sm" : "default"} disabled={pending} onClick={apply}>{pending ? <Loader2 size={16} className="animate-spin" /> : <ArchiveRestore size={16} />}{pending ? "Đang khôi phục…" : "Khôi phục"}</Button>{error && <p role="alert" className="field-error">{error}</p>}</div>;

  return <AlertDialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); if (next) setError(""); } }}>
    <AlertDialogTrigger asChild><Button variant="outline" size={compact ? "sm" : "default"} className="delete-trigger"><Trash2 size={16} />Xóa</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle className="text-lg font-semibold">Xóa {label} khỏi danh sách?</AlertDialogTitle><AlertDialogDescription className="text-sm leading-6 text-slate-500">{name ? `“${name}” sẽ ` : `${kind === "project" ? "Dự án" : "Playable"} sẽ `}được chuyển vào mục Đã lưu trữ.{kind === "project" ? " Các playable trong dự án cũng được ẩn khỏi danh sách mặc định." : ""} Bạn có thể khôi phục sau.</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel><AlertDialogAction disabled={pending} className="bg-red-600 text-white hover:bg-red-700" onClick={event => { event.preventDefault(); void apply(); }}>{pending && <Loader2 size={16} className="animate-spin" />}{pending ? "Đang xóa…" : "Xóa khỏi danh sách"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
