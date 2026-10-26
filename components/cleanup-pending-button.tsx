"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { retryPendingAssetCleanup } from "@/lib/actions";
import { Button } from "./ui/button";

export function CleanupPendingButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function retry() {
    if (pending) return;
    setPending(true);
    try {
      const result = await retryPendingAssetCleanup();
      if (!result.ok) toast.error(result.error);
      else if (result.data.cleanupPending) toast.warning("Một số file vẫn đang chờ dọn. Vui lòng thử lại sau.");
      else toast.success("Đã dọn xong các file chờ xóa.");
      router.refresh();
    } catch { toast.error("Không dọn được file. Vui lòng thử lại."); }
    finally { setPending(false); }
  }
  return <div className="archive-cleanup-toolbar"><span>{count} file chờ xóa khỏi Storage</span><Button variant="outline" size="sm" disabled={pending} onClick={retry}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{pending ? "Đang dọn…" : "Dọn file chờ xóa"}</Button></div>;
}
