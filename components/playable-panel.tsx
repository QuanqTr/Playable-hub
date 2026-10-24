"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, CalendarDays, Download, ExternalLink, FileArchive, UserRound, X } from "lucide-react";
import type { Lookups, Playable } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlayableForm } from "@/components/playable-form";
import { ArchiveButton } from "@/components/archive-button";
import { ProjectBadge, WinBadge } from "@/components/status-badge";
import { PlayableCover } from "@/components/playable-cover";
import { NetworkTag } from "@/components/network-tag";

export function PlayablePanel({ playable, lookups, closeHref }: { playable: Playable; lookups: Lookups; closeHref: string }) {
  const router = useRouter();
  const isArchived = !!playable.archived_at;
  const hasSource = !!playable.storage_path || !!playable.external_url;
  const close = () => router.push(closeHref, { scroll: false });
  const projectHref = `/projects/${playable.project_id}`;

  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px]" />
      <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl focus:outline-none" onCloseAutoFocus={event => event.preventDefault()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
          <div className="min-w-0"><p className="mb-1 font-mono text-xs font-medium tracking-wide text-primary">{playable.code}</p><Dialog.Title className="text-xl font-semibold leading-7 tracking-tight text-slate-900 break-words">{playable.name}</Dialog.Title><Dialog.Description className="sr-only">Chi tiết và xem trực tiếp playable</Dialog.Description></div>
          <Link href={closeHref} scroll={false} className="flex size-9 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary" aria-label="Đóng chi tiết playable"><X size={20} /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7 space-y-6">
          {isArchived && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Playable này đã được lưu trữ.</div>}
          {playable.project.archived_at && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Dự án đã được lưu trữ. Khôi phục dự án để hiển thị playable trong kho.</div>}
          <div className="panel-preview overflow-hidden rounded-xl border border-slate-200"><PlayableCover playable={playable} /></div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><dt className="mb-1 text-xs font-medium text-slate-500">Dự án</dt><dd><Link href={projectHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">{playable.project.name}<ArrowUpRight size={14} /></Link></dd></div>
            <div><dt className="mb-2 text-xs font-medium text-slate-500">Mức độ win</dt><dd><WinBadge value={playable.win_level} /></dd></div>
            <div><dt className="mb-2 text-xs font-medium text-slate-500">Trạng thái dự án</dt><dd><ProjectBadge value={playable.project.status} /></dd></div>
            <div><dt className="mb-1 text-xs font-medium text-slate-500">Người phụ trách</dt><dd className="flex items-center gap-2 text-sm text-slate-800"><UserRound size={14} className="text-slate-400" />{playable.project.owner.display_name || playable.project.owner.email}</dd></div>
            <div><dt className="mb-1 text-xs font-medium text-slate-500">Ngày triển khai</dt><dd className="flex items-center gap-2 text-sm text-slate-800"><CalendarDays size={14} className="text-slate-400" />{formatDate(playable.released_at)}</dd></div>
            <div className="sm:col-span-2"><dt className="mb-2 text-xs font-medium text-slate-500">Network đã triển khai</dt><dd className="flex flex-wrap gap-2">{playable.networks.length ? playable.networks.map(network => <NetworkTag key={network.id} network={network} />) : <span className="text-sm text-slate-400">Chưa chọn network</span>}</dd></div>
          </dl>
          <section className="space-y-3 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-900">File và liên kết</h3>
            {playable.storage_path && <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div className="flex min-w-0 items-center gap-3"><FileArchive size={22} className="shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{playable.file_name ?? "File build"}</p><p className="mt-0.5 text-xs text-slate-500">{formatBytes(playable.file_size)} · {playable.file_mime === "text/html" ? "HTML" : "ZIP"}</p></div></div><Button asChild variant="outline" size="sm"><a href={`/api/files/${playable.id}`}><Download size={14} />Tải file</a></Button></div>}
            {playable.external_url && <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><p className="min-w-0 truncate text-sm text-slate-600" title={playable.external_url}>{playable.external_url}</p><Button asChild variant="outline" size="sm"><a href={playable.external_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Mở URL</a></Button></div>}
            {!hasSource && <p className="text-sm text-slate-500">Chưa có file hoặc liên kết.</p>}
          </section>
          <section className="space-y-2 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-900">Ghi chú</h3><p className={`whitespace-pre-wrap break-words text-sm leading-6 ${playable.notes ? "text-slate-600" : "text-slate-400"}`}>{playable.notes || "Chưa có ghi chú."}</p></section>
          <div className="space-y-2 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500"><p>Tạo bởi <span className="font-medium text-slate-700">{playable.creator?.display_name || playable.creator?.email || "Thành viên"}</span> · {formatDate(playable.created_at, true)}</p><p>Cập nhật bởi <span className="font-medium text-slate-700">{playable.updater?.display_name || playable.updater?.email || "Thành viên"}</span> · {formatDate(playable.updated_at, true)}</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-7"><PlayableForm key={`edit-${playable.updated_at}`} lookups={lookups} playable={playable} /><PlayableForm key={`copy-${playable.updated_at}`} lookups={lookups} playable={playable} duplicate /><div className="ml-auto"><ArchiveButton kind="playable" id={playable.id} archived={isArchived} name={playable.name} onSuccess={close} /></div></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
