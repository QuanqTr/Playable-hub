"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteArchived } from "@/lib/actions";
import { Button } from "./ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "./ui/alert-dialog";

export function PermanentDeleteButton({ kind, id, name, compact = false, redirectTo, onSuccess }: {
  kind: "project" | "playable"; id: string; name: string; compact?: boolean; redirectTo?: string; onSuccess?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = kind === "project" ? "dự án" : "playable";

  async function apply() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const result = await deleteArchived(kind, id);
      if (!result.ok) { setError(result.error); return; }
      setOpen(false);
      if (result.data.cleanupPending) toast.warning("Đã xóa bản ghi. Một số file còn chờ dọn trong mục Đã lưu trữ.");
      else toast.success(`Đã xóa vĩnh viễn ${label}.`);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
      onSuccess?.();
    } catch { setError("Không xóa được. Vui lòng thử lại."); }
    finally { setPending(false); }
  }

  return <AlertDialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); if (next) setError(""); } }}>
    <AlertDialogTrigger asChild><Button variant="destructive" size={compact ? "sm" : "default"}><Trash2 size={16} />Xóa vĩnh viễn</Button></AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Xóa vĩnh viễn {label}?</AlertDialogTitle>
        <AlertDialogDescription className="leading-6">
          “{name}” sẽ biến mất khỏi kho và không thể khôi phục.
          {kind === "project" ? " Toàn bộ playable trong dự án cũng bị xóa." : ""} File build và ảnh bìa liên quan sẽ được xóa khỏi Storage.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel><AlertDialogAction disabled={pending} className="bg-red-600 text-white hover:bg-red-700" onClick={event => { event.preventDefault(); void apply(); }}>{pending && <Loader2 size={16} className="animate-spin" />}{pending ? "Đang xóa…" : "Xóa vĩnh viễn"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
