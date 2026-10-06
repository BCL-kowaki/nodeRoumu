// Google ドライブ API の呼び出し（サーバー専用）。タスクの添付資料の保存に使う
// - 権限は drive.file（このアプリが作ったファイル・フォルダだけ扱える。ほかのファイルは見えない）
// - ファイル本体はブラウザからドライブへ直接送る（Vercel を通すと約4.5MBまでしか送れないため）。
//   サーバーは「送り先（アップロード用URL）」を発行し、送り終わったファイルを確認して一覧に登録するだけ
import { prisma } from "@/lib/prisma";
import { GcalError, getConnection } from "@/lib/google-calendar";
import { TASK_PROPERTY, type AttachmentInit } from "@/lib/work/attachments";

// 手元での動作確認用に、テスト用の偽サーバーへ向けられる（本番では未設定＝本物の Google）
const DRIVE_BASE = process.env.GOOGLE_DRIVE_API_BASE || "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = process.env.GOOGLE_DRIVE_UPLOAD_BASE || "https://www.googleapis.com/upload/drive/v3";

export const ATTACHMENT_FOLDER_NAME = "node-portal 添付資料";
const FOLDER_MIME = "application/vnd.google-apps.folder";
export const DRIVE_FILE_FIELDS = "id,name,mimeType,size,webViewLink,parents,appProperties,trashed";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  trashed?: boolean;
};

// 画面に出してよいエラーメッセージ（Google の応答本文は返さない）
export function driveErrorMessage(e: unknown): string {
  if (!(e instanceof GcalError)) return "Google ドライブとの通信に失敗しました";
  if (e.status === 0) return e.message;
  if (e.status === 401 || e.status === 400) return "Google の接続が無効になりました。スケジュール画面から接続し直してください";
  if (e.status === 403) return "Google ドライブの権限が足りません（Drive API が有効か、接続し直して権限を許可したかを確認してください）";
  if (e.status === 404) return "Google ドライブでファイルが見つかりません";
  if (e.status === 429) return "Google ドライブの利用回数の上限に達しました。しばらく待ってからお試しください";
  return `Google ドライブとの通信に失敗しました（${e.status}）`;
}

async function drive(token: string, url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`Google Drive API エラー: ${init?.method ?? "GET"} ${new URL(url).pathname} → ${res.status}`);
    throw new GcalError(res.status);
  }
  return res;
}

// 添付資料を入れる専用フォルダ。無ければ作る（ドライブ側で消されていたら作り直す）
export async function ensureAttachmentFolder(ownerId: string, token: string): Promise<string> {
  const acc = await getConnection(ownerId);
  if (!acc) throw new GcalError(401);
  if (acc.driveFolderId) {
    try {
      const f = (await (await drive(token, `${DRIVE_BASE}/files/${encodeURIComponent(acc.driveFolderId)}?fields=id,trashed`)).json()) as DriveFile;
      if (!f.trashed) return acc.driveFolderId;
    } catch (e) {
      if (!(e instanceof GcalError && e.status === 404)) throw e;
    }
  }
  const res = await drive(token, `${DRIVE_BASE}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name: ATTACHMENT_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const { id } = (await res.json()) as { id: string };
  await prisma.integrationAccount.update({ where: { id: acc.id }, data: { driveFolderId: id } });
  return id;
}

// ブラウザから直接ファイルを送るための、アップロード用URLを発行する（再開可能アップロード）。
// origin を渡すと、そのサイトのブラウザから送れるようになる
export async function createUploadSession(
  token: string,
  folderId: string,
  taskId: string,
  file: AttachmentInit,
  origin: string
): Promise<string> {
  const res = await drive(token, `${UPLOAD_BASE}/files?uploadType=resumable&fields=${DRIVE_FILE_FIELDS}`, {
    method: "POST",
    headers: {
      "X-Upload-Content-Type": file.mimeType,
      "X-Upload-Content-Length": String(file.size),
      Origin: origin,
    },
    body: JSON.stringify({ name: file.name, parents: [folderId], appProperties: { [TASK_PROPERTY]: taskId } }),
  });
  const location = res.headers.get("location");
  if (!location) throw new GcalError(502);
  return location;
}

export async function getDriveFile(token: string, fileId: string): Promise<DriveFile> {
  const res = await drive(token, `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}?fields=${DRIVE_FILE_FIELDS}`);
  return (await res.json()) as DriveFile;
}

// ドライブのごみ箱へ移す（完全には消さない。ドライブ側で30日以内なら戻せる）。すでに無ければ何もしない
export async function trashDriveFile(token: string, fileId: string): Promise<void> {
  try {
    await drive(token, `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}`, {
      method: "PATCH",
      body: JSON.stringify({ trashed: true }),
    });
  } catch (e) {
    if (!(e instanceof GcalError && e.status === 404)) throw e;
  }
}
