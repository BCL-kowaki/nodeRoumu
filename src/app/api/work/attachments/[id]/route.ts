import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessToken } from "@/lib/google-calendar";
import { driveErrorMessage, trashDriveFile } from "@/lib/google-drive";
import { notFound, requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 添付の削除。ドライブのファイルはごみ箱へ移す（30日以内ならドライブ側で戻せる）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const att = await prisma.taskAttachment.findFirst({ where: { id, ownerId: auth.ctx.ownerId } });
  if (!att) return notFound();
  try {
    const token = await getAccessToken(auth.ctx.ownerId);
    await trashDriveFile(token, att.driveFileId);
  } catch (e) {
    return NextResponse.json({ error: driveErrorMessage(e) }, { status: 502 });
  }
  await prisma.taskAttachment.delete({ where: { id: att.id } });
  return NextResponse.json({ ok: true });
}
