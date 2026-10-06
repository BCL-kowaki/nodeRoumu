import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConnection, getAccessToken } from "@/lib/google-calendar";
import { createUploadSession, driveErrorMessage, ensureAttachmentFolder } from "@/lib/google-drive";
import { hasDriveScope, parseAttachmentInit } from "@/lib/work/attachments";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 添付するファイルの送り先（Google ドライブのアップロード用URL）を発行する
// POST /api/work/tasks/[id]/attachments/session  body: { name, mimeType, size }
// → { uploadUrl }。ブラウザはこの URL へファイル本体を直接送り、送り終わったら /attachments に登録する
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ownerId = auth.ctx.ownerId;

  const parsed = parseAttachmentInit(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);

  const task = await prisma.workTask.findFirst({ where: { id, ownerId }, select: { id: true } });
  if (!task) return notFound();

  const acc = await getConnection(ownerId);
  if (!acc || acc.status !== "active" || !hasDriveScope(acc.scopes)) {
    return NextResponse.json(
      { error: "Google ドライブの権限がありません。スケジュール画面で Google カレンダーを接続し直してください" },
      { status: 403 }
    );
  }

  try {
    const token = await getAccessToken(ownerId);
    const folderId = await ensureAttachmentFolder(ownerId, token);
    // 送り先を、このアプリの画面からだけ使えるようにする（自分自身のサイトのみ）
    const uploadUrl = await createUploadSession(token, folderId, task.id, parsed.data, req.nextUrl.origin);
    return NextResponse.json({ uploadUrl });
  } catch (e) {
    return NextResponse.json({ error: driveErrorMessage(e) }, { status: 502 });
  }
}
