"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Profile, Project } from "@/lib/types";
import { setArchived } from "@/lib/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { ProjectForm } from "./project-form";
import { ArchiveButton } from "./archive-button";
import { PermanentDeleteButton } from "./permanent-delete-button";

export function ProjectCardMenu({ project, profiles }: { project: Project; profiles: Profile[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const archived = !!project.archived_at;

  async function restore() {
    if (restoring) return;
    setRestoring(true);
    try {
      const result = await setArchived("project", project.id, false);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Đã khôi phục dự án.");
      router.refresh();
    } catch {
      toast.error("Không khôi phục được dự án. Vui lòng thử lại.");
    } finally {
      setRestoring(false);
    }
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="project-card-menu-trigger" aria-label={`Tùy chọn dự án ${project.name}`}>
          <MoreHorizontal size={20} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="project-card-menu-content">
        {archived ? <>
          <DropdownMenuItem disabled={restoring} onSelect={() => { void restore(); }}><ArchiveRestore aria-hidden="true" />{restoring ? "Đang khôi phục…" : "Khôi phục"}</DropdownMenuItem>
          <DropdownMenuSeparator className="project-card-menu-separator" />
          <DropdownMenuItem className="project-card-menu-danger" onSelect={() => setDeleteOpen(true)}><Trash2 aria-hidden="true" />Xóa vĩnh viễn</DropdownMenuItem>
        </> : <>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}><Pencil aria-hidden="true" />Chỉnh sửa</DropdownMenuItem>
          <DropdownMenuSeparator className="project-card-menu-separator" />
          <DropdownMenuItem className="project-card-menu-danger" onSelect={() => setArchiveOpen(true)}><Trash2 aria-hidden="true" />Xóa vào lưu trữ</DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
    {!archived && <>
      <ProjectForm key={project.updated_at} profiles={profiles} project={project} open={editOpen} onOpenChange={setEditOpen} hideTrigger />
      <ArchiveButton kind="project" id={project.id} archived={false} name={project.name} open={archiveOpen} onOpenChange={setArchiveOpen} hideTrigger />
    </>}
    {archived && <PermanentDeleteButton kind="project" id={project.id} name={project.name} open={deleteOpen} onOpenChange={setDeleteOpen} hideTrigger />}
  </>;
}
