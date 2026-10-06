import { NextResponse } from "next/server";
import { gcalConfig, getConnection } from "@/lib/google-calendar";
import { hasDriveScope } from "@/lib/work/attachments";
import { requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

// Google カレンダー連携の状態
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const acc = await getConnection(auth.ctx.ownerId);
  return NextResponse.json({
    configured: !!gcalConfig(), // Google の設定（クライアントID等）があるか
    encryptionConfigured: !!process.env.WORKSPACE_ENCRYPTION_KEY, // トークン暗号化の鍵があるか
    connected: !!acc,
    status: acc?.status ?? null, // "active" | "needs_reconnect"
    email: acc?.accountEmail ?? null,
    calendarCreated: !!acc?.calendarId,
    driveGranted: hasDriveScope(acc?.scopes), // 添付資料用のドライブの権限があるか（無ければ接続し直しが必要）
    lastSyncedAt: acc?.lastSyncedAt ?? null,
  });
}
