// タスクの添付資料（Google ドライブに保存）の判定（決まった答えになる処理なのでテストで固定）

// 求めるドライブの権限：アプリが作ったファイルだけを扱える（ほかのファイルは見えない）
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const MAX_NAME = 255;
const MAX_MIME = 255;

// アップロードしたファイルに付ける印（どのタスク用か）。保存前の確認に使う
export const TASK_PROPERTY = "nodePortalTaskId";

export type AttachmentInit = { name: string; mimeType: string; size: number };

export function parseAttachmentInit(body: unknown): { ok: true; data: AttachmentInit } | { ok: false; error: string } {
  const invalid = { ok: false as const, error: "添付するファイルの情報が正しくありません" };
  if (typeof body !== "object" || body === null || Array.isArray(body)) return invalid;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || typeof b.size !== "number" || !Number.isInteger(b.size)) return invalid;
  if (b.mimeType !== undefined && typeof b.mimeType !== "string") return invalid;

  const name = b.name.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!name) return { ok: false, error: "ファイル名がありません" };
  if (name.length > MAX_NAME) return { ok: false, error: "ファイル名は255文字以内にしてください" };
  if (b.size <= 0) return { ok: false, error: "空のファイルは添付できません" };
  if (b.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "添付できるのは1ファイル100MBまでです" };
  const mime = typeof b.mimeType === "string" ? b.mimeType.trim().slice(0, MAX_MIME) : "";
  return { ok: true, data: { name, mimeType: mime || "application/octet-stream", size: b.size } };
}

export function hasDriveScope(scopes: string | null | undefined): boolean {
  return !!scopes && scopes.split(/\s+/).includes(DRIVE_FILE_SCOPE);
}

// 保存してよいファイルか：専用フォルダにあり、そのタスクの印がついていて、ごみ箱に入っていない
export function isAttachmentFileFor(
  file: { parents?: string[]; appProperties?: Record<string, string>; trashed?: boolean },
  expected: { taskId: string; folderId: string }
): boolean {
  return (
    !file.trashed &&
    (file.parents ?? []).includes(expected.folderId) &&
    file.appProperties?.[TASK_PROPERTY] === expected.taskId
  );
}

export type AttachmentKind = "pdf" | "word" | "excel" | "slide" | "image" | "text" | "other";

// 種類の判定。ブラウザが種類を渡さない（octet-stream）ことがあるので、拡張子も見る
export function attachmentKind(mimeType: string, name: string): AttachmentKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const m = mimeType.toLowerCase();
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.includes("wordprocessing") || m === "application/msword" || ["doc", "docx"].includes(ext)) return "word";
  if (m.includes("spreadsheet") || m === "application/vnd.ms-excel" || m === "text/csv" || ["xls", "xlsx", "csv"].includes(ext)) {
    return "excel";
  }
  if (m.includes("presentation") || m === "application/vnd.ms-powerpoint" || ["ppt", "pptx"].includes(ext)) return "slide";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("text/") || ["txt", "md"].includes(ext)) return "text";
  return "other";
}

// 「1.5KB」「2.3MB」のような表示（小数は1桁、整数になるときは小数なし）
export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const rounded = Math.round(v * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${units[i]}`;
}
