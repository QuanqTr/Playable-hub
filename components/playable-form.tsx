"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileArchive, ImagePlus, Loader2, Pencil, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { savePlayable } from "@/lib/actions";
import { WIN_LEVELS } from "@/lib/constants";
import { playableSchema, validateUpload } from "@/lib/validation";
import { removeUploadedAssets, uploadAsset, uploadMime, type UploadedAsset } from "@/lib/upload";
import { formatBytes } from "@/lib/utils";
import type { Lookups, Playable, WinLevel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface Props { lookups: Lookups; playable?: Playable; projectId?: string; duplicate?: boolean; onSuccess?: () => void }

export function PlayableForm({ lookups, playable, projectId, duplicate = false, onSuccess }: Props) {
  const router = useRouter();
  const id = useId();
  const edit = !!playable && !duplicate;
  const form = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const thumbInput = useRef<HTMLInputElement>(null);
  const initialName = duplicate && playable ? `${playable.name} (bản sao)`.slice(0, 160) : playable?.name ?? "";
  const availableProjects = lookups.projects.filter(item => !item.archived_at || (edit && item.id === playable?.project_id));
  const candidateProject = projectId ?? playable?.project_id ?? "";
  const initialProject = edit || availableProjects.some(item => item.id === candidateProject) ? candidateProject : "";
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(initialName);
  const [project, setProject] = useState(initialProject);
  const [win, setWin] = useState<WinLevel>(edit ? playable.win_level : "unreviewed");
  const [externalUrl, setExternalUrl] = useState(edit ? playable.external_url ?? "" : "");
  const [releasedAt, setReleasedAt] = useState(edit ? playable.released_at ?? "" : "");
  const [notes, setNotes] = useState(playable?.notes ?? "");
  const [networks, setNetworks] = useState<string[]>(playable?.networks.map(network => network.id) ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  useEffect(() => {
    if (!pending && Object.values(errors).some(Boolean)) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, pending]);
  const projects = availableProjects.some(item => item.id === playable?.project_id) || !edit
    ? availableProjects : [...availableProjects, { id: playable.project_id, name: playable.project.name }];
  const fieldProps = (field: string) => ({ "aria-invalid": !!errors[field], "aria-describedby": errors[field] ? `${id}-${field}-error` : undefined });
  const fieldError = (field: string) => errors[field] ? <p className="field-error" id={`${id}-${field}-error`}>{errors[field]}</p> : null;

  function selectFile(nextFile: File | null, isThumbnail: boolean) {
    if (isThumbnail) { setThumbnail(nextFile); setRemoveThumbnail(false); }
    else setFile(nextFile);
    const field = isThumbnail ? "thumbnail_path" : "storage_path";
    setErrors(previous => ({ ...previous, [field]: nextFile ? validateUpload(nextFile, isThumbnail) ?? "" : "" }));
  }

  function resetNewForm() {
    setName(duplicate ? initialName : "");
    setProject(initialProject);
    setWin("unreviewed"); setExternalUrl(""); setReleasedAt("");
    setNotes(duplicate ? playable?.notes ?? "" : "");
    setNetworks(duplicate ? playable?.networks.map(network => network.id) ?? [] : []);
    setFile(null); setThumbnail(null); setRemoveThumbnail(false);
    if (fileInput.current) fileInput.current.value = "";
    if (thumbInput.current) thumbInput.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(""); setErrors({});
    const fileError = file ? validateUpload(file) : null;
    const thumbError = thumbnail ? validateUpload(thumbnail, true) : null;
    if (fileError || thumbError) {
      setErrors({ ...(fileError ? { storage_path: fileError } : {}), ...(thumbError ? { thumbnail_path: thumbError } : {}) });
      return;
    }
    const placeholderPath = "00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000.html";
    const input = {
      ...(edit ? { id: playable.id } : {}), name, project_id: project, win_level: win,
      external_url: edit ? playable.external_url : externalUrl,
      storage_path: edit ? playable.storage_path : file ? placeholderPath : null,
      file_name: edit ? playable.file_name : file?.name ?? null,
      file_size: edit ? playable.file_size : file?.size ?? null,
      file_mime: edit ? playable.file_mime : file ? uploadMime(file) : null,
      thumbnail_path: thumbnail ? placeholderPath : edit && !removeThumbnail ? playable.thumbnail_path : null,
      released_at: releasedAt, notes, network_ids: networks,
    };
    const parsed = playableSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      return;
    }
    setPending(true);
    const uploaded: UploadedAsset[] = [];
    let saved = false;
    let uploadField = "";
    try {
      const data = parsed.data;
      if (file && !edit) {
        uploadField = "storage_path";
        const asset = await uploadAsset(file, false, percent => setProgress({ label: "Đang tải build", percent }));
        uploaded.push(asset);
        data.storage_path = asset.path; data.file_name = asset.file_name;
        data.file_size = asset.file_size; data.file_mime = asset.file_mime as "text/html" | "application/zip";
      }
      if (thumbnail) {
        uploadField = "thumbnail_path";
        const asset = await uploadAsset(thumbnail, true, percent => setProgress({ label: "Đang tải thumbnail", percent }));
        uploaded.push(asset); data.thumbnail_path = asset.path;
      }
      uploadField = "";
      setProgress(null);
      const result = await savePlayable(data);
      if (!result.ok) {
        setError(result.error); setErrors(result.fieldErrors ?? {});
        return;
      }
      saved = true;
      toast.success(edit ? "Đã cập nhật playable." : "Đã thêm playable.");
      setOpen(false);
      if (!edit) resetNewForm();
      else { setFile(null); setThumbnail(null); if (thumbInput.current) thumbInput.current.value = ""; }
      router.refresh();
      onSuccess?.();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Không lưu được playable. Vui lòng thử lại.";
      if (uploadField) setErrors(previous => ({ ...previous, [uploadField]: message }));
      else setError(message);
    } finally {
      if (!saved && uploaded.length) {
        const cleaned = await removeUploadedAssets(uploaded);
        if (!cleaned) setError(previous => `${previous ? `${previous} ` : ""}Chưa dọn được một số file vừa tải. Vui lòng báo quản trị viên kiểm tra Storage.`);
      }
      setPending(false); setProgress(null);
    }
  }

  const title = edit ? "Chỉnh sửa playable" : duplicate ? "Tạo bản sao" : "Thêm playable";
  return <Dialog open={open} onOpenChange={next => { if (!pending) setOpen(next); }}>
    <DialogTrigger asChild><Button variant={edit || duplicate ? "outline" : "default"}>{edit ? <Pencil size={16} /> : duplicate ? <Copy size={16} /> : <Plus size={17} />}{title}</Button></DialogTrigger>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{edit ? "Cập nhật thông tin và đánh giá tổng thể của build. Tạo bản ghi mới nếu thay đổi file hoặc URL." : duplicate ? "Thông tin được sao chép. Thêm file hoặc URL cho build mới; mã playable sẽ được tạo tự động." : "Lưu một build đã triển khai. Mã playable sẽ được tạo tự động."}</DialogDescription></DialogHeader>
      <form ref={form} noValidate onSubmit={submit} className="space-y-5">
        <fieldset disabled={pending} className="space-y-4">
          <div className="field"><Label htmlFor={`${id}-name`}>Tên playable <span aria-hidden="true">*</span></Label><Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Sort mechanic – US – v03" maxLength={160} required {...fieldProps("name")} />{fieldError("name")}</div>
          <div className="form-grid">
            <div className="field"><Label htmlFor={`${id}-project`}>Dự án <span aria-hidden="true">*</span></Label><select id={`${id}-project`} className="select" value={project} onChange={event => setProject(event.target.value)} required {...fieldProps("project_id")}><option value="">Chọn dự án</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldError("project_id")}</div>
            <div className="field"><Label htmlFor={`${id}-win`}>Mức độ win</Label><select id={`${id}-win`} className="select" value={win} onChange={event => setWin(event.target.value as WinLevel)} {...fieldProps("win_level")}>{Object.entries(WIN_LEVELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>{fieldError("win_level")}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-4">
            <div className="field"><Label htmlFor={`${id}-file`} className="flex items-center gap-2"><FileArchive size={16} />File build HTML / ZIP</Label>
              {edit ? <div className="rounded-md border bg-white px-3 py-2 text-sm text-slate-600">{playable.file_name ? `${playable.file_name} · ${formatBytes(playable.file_size)}` : "Build này sử dụng URL lưu trữ."}</div> : <Input ref={fileInput} id={`${id}-file`} type="file" accept=".html,.zip,text/html,application/zip,application/x-zip-compressed" onChange={event => selectFile(event.target.files?.[0] ?? null, false)} {...fieldProps("storage_path")} />}
              {!edit && file && <p className="text-xs text-slate-600">Đã chọn: {file.name} · {formatBytes(file.size)}</p>}<p className="text-xs text-slate-500">{edit ? "File và URL của build đã lưu được giữ nguyên." : "Tối đa 50 MB theo cấu hình kho. Không giải nén hoặc chạy nội dung trong ứng dụng."}</p>{fieldError("storage_path")}{fieldError("file_name")}{fieldError("file_size")}{fieldError("file_mime")}
            </div>
            <div className="field"><Label htmlFor={`${id}-url`}>URL lưu trữ</Label><Input id={`${id}-url`} type="url" value={externalUrl} onChange={event => setExternalUrl(event.target.value)} disabled={edit} placeholder={edit ? "Không có URL" : "https://…"} maxLength={2048} {...fieldProps("external_url")} />{fieldError("external_url")}{!edit && <p className="text-xs text-slate-500">Cần ít nhất một file hoặc URL http/https.</p>}</div>
          </div>
          <div className="field"><Label htmlFor={`${id}-thumbnail`} className="flex items-center gap-2"><ImagePlus size={16} />Thumbnail</Label>
            {edit && playable.thumbnail_path && !removeThumbnail && !thumbnail && <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span>Đã có thumbnail</span><Button type="button" variant="ghost" size="sm" onClick={() => setRemoveThumbnail(true)}><X size={14} />Gỡ ảnh</Button></div>}
            {removeThumbnail && <p className="text-xs text-slate-500">Thumbnail sẽ được gỡ khi lưu. <button type="button" className="underline" onClick={() => setRemoveThumbnail(false)}>Hoàn tác</button></p>}
            <Input ref={thumbInput} id={`${id}-thumbnail`} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={event => selectFile(event.target.files?.[0] ?? null, true)} {...fieldProps("thumbnail_path")} />{thumbnail && <p className="text-xs text-slate-600">Đã chọn: {thumbnail.name} · {formatBytes(thumbnail.size)}</p>}<p className="text-xs text-slate-500">PNG, JPG hoặc WebP · tối đa 5 MB.</p>{fieldError("thumbnail_path")}
          </div>
          <fieldset className="field"><legend className="mb-2 text-sm font-medium">Network đã triển khai</legend><div className="flex flex-wrap gap-2">{lookups.networks.map(network => <label key={network.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={networks.includes(network.id)} onChange={event => setNetworks(previous => event.target.checked ? [...previous, network.id] : previous.filter(value => value !== network.id))} />{network.name}</label>)}</div>{fieldError("network_ids")}</fieldset>
          <div className="field"><Label htmlFor={`${id}-released`}>Ngày triển khai</Label><Input id={`${id}-released`} type="date" value={releasedAt} onChange={event => setReleasedAt(event.target.value)} {...fieldProps("released_at")} />{fieldError("released_at")}</div>
          <div className="field"><Label htmlFor={`${id}-notes`}>Ghi chú</Label><Textarea id={`${id}-notes`} rows={4} maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Kết quả theo network, thị trường hoặc thông tin cần lưu ý…" {...fieldProps("notes")} />{fieldError("notes")}</div>
        </fieldset>
        {progress && <div className="space-y-2" role="status" aria-live="polite"><div className="flex justify-between text-sm text-slate-600"><span className="flex items-center gap-2"><Upload size={14} />{progress.label}…</span><span>{progress.percent}%</span></div><progress className="h-2 w-full accent-emerald-600" value={progress.percent} max={100} aria-label={progress.label} /></div>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Hủy</Button><Button type="submit" disabled={pending || !projects.length}>{pending && <Loader2 size={16} className="animate-spin" />}{pending ? progress ? "Đang tải lên…" : "Đang lưu…" : edit ? "Lưu thay đổi" : "Lưu playable"}</Button></DialogFooter>
        {!projects.length && <p className="field-error">Tạo hoặc khôi phục dự án trước khi thêm playable.</p>}
      </form>
    </DialogContent>
  </Dialog>;
}
