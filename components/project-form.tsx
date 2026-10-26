"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { saveProject } from "@/lib/actions";
import { PROJECT_STATUSES } from "@/lib/constants";
import { projectSchema } from "@/lib/validation";
import type { Profile, Project, ProjectStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export function ProjectForm({ profiles, project, onSuccess }: { profiles: Profile[]; project?: Project; onSuccess?: () => void }) {
  const router = useRouter();
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [storeUrl, setStoreUrl] = useState(project?.store_url ?? "");
  const [owner, setOwner] = useState(project?.owner_id ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    if (!pending && Object.values(errors).some(Boolean)) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, pending]);
  const fieldError = (field: string) => errors[field] ? <p className="field-error" id={`${id}-${field}-error`}>{errors[field]}</p> : null;
  const fieldProps = (field: string) => ({ "aria-invalid": !!errors[field], "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setErrors({});
    const input = { ...(project ? { id: project.id } : {}), name, description, store_url: storeUrl, owner_id: owner, status };
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return;
    }
    setPending(true);
    try {
      const result = await saveProject(parsed.data);
      if (!result.ok) { setError(result.error); setErrors(result.fieldErrors ?? {}); return; }
      if (result.data.iconFound) toast.success(project ? "Đã cập nhật dự án." : "Đã tạo dự án.");
      else toast.warning("Đã lưu dự án, nhưng chưa lấy được icon từ URL store. Hãy kiểm tra lại liên kết.");
      setOpen(false);
      if (!project) { setName(""); setDescription(""); setStoreUrl(""); setOwner(""); setStatus("active"); }
      router.refresh();
      onSuccess?.();
    } catch { setError("Không lưu được dự án. Vui lòng thử lại; dữ liệu đã nhập vẫn được giữ."); }
    finally { setPending(false); }
  }

  return <Dialog open={open} onOpenChange={next => { if (!pending) setOpen(next); }}>
    <DialogTrigger asChild><Button variant={project ? "outline" : "default"}>{project ? <Pencil size={16} /> : <Plus size={17} />}{project ? "Chỉnh sửa" : "Tạo dự án"}</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{project ? "Chỉnh sửa dự án" : "Tạo dự án"}</DialogTitle><DialogDescription>Quản lý thông tin và người phụ trách chính của dự án.</DialogDescription></DialogHeader>
      <form ref={form} onSubmit={submit} noValidate className="space-y-5">
        <fieldset disabled={pending} className="space-y-4">
          <div className="field"><Label htmlFor={`${id}-name`}>Tên dự án <span aria-hidden="true">*</span></Label><Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} maxLength={160} required placeholder="Ví dụ: Color Sort" {...fieldProps("name")} />{fieldError("name")}</div>
          <div className="field"><Label htmlFor={`${id}-description`}>Mô tả</Label><Textarea id={`${id}-description`} value={description} onChange={event => setDescription(event.target.value)} maxLength={4000} rows={3} placeholder="Mô tả ngắn về dự án…" {...fieldProps("description")} />{fieldError("description")}</div>
          <div className="field"><Label htmlFor={`${id}-store-url`}>URL Google Play hoặc App Store</Label><Input id={`${id}-store-url`} type="url" value={storeUrl} onChange={event => setStoreUrl(event.target.value)} maxLength={2048} placeholder="https://play.google.com/store/apps/details?id=..." {...fieldProps("store_url")} />{fieldError("store_url")}<p className="field-hint">Icon ứng dụng sẽ được lấy tự động khi lưu dự án. Để trống nếu chưa phát hành trên store.</p></div>
          <div className="form-grid">
            <div className="field"><Label htmlFor={`${id}-owner`}>Người phụ trách <span aria-hidden="true">*</span></Label><select className="select" id={`${id}-owner`} value={owner} onChange={event => setOwner(event.target.value)} required {...fieldProps("owner_id")}><option value="">Chọn thành viên</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.display_name || profile.email}</option>)}</select>{fieldError("owner_id")}</div>
            <div className="field"><Label htmlFor={`${id}-status`}>Trạng thái</Label><select className="select" id={`${id}-status`} value={status} onChange={event => setStatus(event.target.value as ProjectStatus)} {...fieldProps("status")}>{Object.entries(PROJECT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{fieldError("status")}</div>
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Hủy</Button><Button type="submit" disabled={pending || !profiles.length}>{pending && <Loader2 size={16} className="animate-spin" />}{pending ? "Đang lưu…" : project ? "Lưu thay đổi" : "Tạo dự án"}</Button></DialogFooter>
        {!profiles.length && <p className="field-error">Chưa có hồ sơ thành viên để chọn người phụ trách.</p>}
      </form>
    </DialogContent>
  </Dialog>;
}
