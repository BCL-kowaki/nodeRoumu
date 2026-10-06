"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { File, FileImage, FileSpreadsheet, FileText, Loader2, Paperclip, Presentation, Trash2, type LucideIcon } from "lucide-react";
import { attachmentKind, formatBytes, type AttachmentKind } from "@/lib/work/attachments";
import { api } from "./types";

type Attachment = { id: string; name: string; mimeType: string; size: number; webViewLink: string; createdAt: string };
type Uploading = { key: string; name: string; progress: number };

const KIND_ICON: Record<AttachmentKind, LucideIcon> = {
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  slide: Presentation,
  image: FileImage,
  text: FileText,
  other: File,
};

// ファイル本体を Google ドライブのアップロード用URLへ直接送る。進み具合を onProgress で知らせ、ドライブのファイルIDを返す
function putToDrive(uploadUrl: string, file: globalThis.File, onProgress: (ratio: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve((JSON.parse(xhr.responseText) as { id: string }).id);
        } catch {
          reject(new Error("Google ドライブからの応答を読み取れませんでした"));
        }
      } else reject(new Error(`Google ドライブへの送信に失敗しました（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error("Google ドライブへの送信に失敗しました（通信エラー）"));
    xhr.send(file);
  });
}

// タスクの添付資料（PDF・Word・Excel・テキストなど）。ファイルは代表者の Google ドライブに保存する
export default function TaskAttachments({ taskId, onChanged }: { taskId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<Attachment[]>(`/api/work/tasks/${taskId}/attachments`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    const errors: string[] = [];
    // 1つずつ順に送る（回線が細くても進み具合が分かりやすいように）
    for (const file of list) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      setUploading((u) => [...u, { key, name: file.name, progress: 0 }]);
      try {
        const { uploadUrl } = await api<{ uploadUrl: string }>(`/api/work/tasks/${taskId}/attachments/session`, {
          method: "POST",
          body: JSON.stringify({ name: file.name, mimeType: file.type, size: file.size }),
        });
        const fileId = await putToDrive(uploadUrl, file, (p) =>
          setUploading((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x)))
        );
        const saved = await api<Attachment>(`/api/work/tasks/${taskId}/attachments`, {
          method: "POST",
          body: JSON.stringify({ fileId }),
        });
        setItems((xs) => [...xs, saved]);
      } catch (e) {
        errors.push(`${file.name}: ${(e as Error).message}`);
      } finally {
        setUploading((u) => u.filter((x) => x.key !== key));
      }
    }
    if (errors.length) setError(errors.join("\n"));
    if (inputRef.current) inputRef.current.value = "";
    onChanged?.();
  };

  const remove = async (a: Attachment) => {
    if (!window.confirm(`「${a.name}」の添付を外しますか？\n（Google ドライブではごみ箱に移ります。30日以内なら戻せます）`)) return;
    setError(null);
    try {
      await api(`/api/work/attachments/${a.id}`, { method: "DELETE" });
      setItems((xs) => xs.filter((x) => x.id !== a.id));
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1 text-xs font-semibold text-app-sub">
          <Paperclip size={13} aria-hidden />
          添付資料{items.length > 0 && `（${items.length}）`}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-2.5 py-1 rounded-lg border border-app-border text-xs text-app-text bg-white cursor-pointer hover:bg-app-bg"
        >
          + ファイルを添付
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          aria-label="添付するファイルを選ぶ"
          onChange={(e) => upload(e.target.files)}
        />
      </div>

      <div className="rounded-lg border border-app-border divide-y divide-app-border">
        {loading && <div className="px-3 py-2 text-xs text-app-sub">読み込み中...</div>}
        {!loading && items.length === 0 && uploading.length === 0 && (
          <div className="px-3 py-2.5 text-xs text-app-sub">
            PDF・Word・Excel・テキストなどを添付できます（Google ドライブに保存されます）
          </div>
        )}
        {items.map((a) => {
          const Icon = KIND_ICON[attachmentKind(a.mimeType, a.name)];
          return (
            <div key={a.id} className="flex items-center gap-2 px-3 py-2">
              <Icon size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />
              <a
                href={a.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 truncate text-sm text-app-text underline-offset-2 hover:underline"
                title={`${a.name} を Google ドライブで開く`}
              >
                {a.name}
              </a>
              <span className="text-[11px] text-app-sub tabular-nums shrink-0">{formatBytes(a.size)}</span>
              <button
                type="button"
                onClick={() => remove(a)}
                aria-label={`「${a.name}」の添付を外す`}
                className="p-1 rounded text-app-sub hover:text-danger hover:bg-danger-light bg-transparent border-none cursor-pointer"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          );
        })}
        {uploading.map((u) => (
          <div key={u.key} className="px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-app-sub">
              <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
              <span className="flex-1 min-w-0 truncate">{u.name}</span>
              <span className="text-[11px] tabular-nums">{Math.round(u.progress * 100)}%</span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-app-bg overflow-hidden" aria-hidden>
              <div className="h-full bg-accent transition-[width]" style={{ width: `${u.progress * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {error && <div className="mt-1.5 text-xs text-danger bg-danger-light rounded p-2 whitespace-pre-wrap">{error}</div>}
    </div>
  );
}
