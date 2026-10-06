import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessToken, getConnection } from "@/lib/google-calendar";
import { driveErrorMessage, getDriveFile } from "@/lib/google-drive";
import { isAttachmentFileFor } from "@/lib/work/attachments";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const SELECT = { id: true, name: true, mimeType: true, size: true, webViewLink: true, createdAt: true } as const;

// タスクの添付資料の一覧
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const task = await prisma.workTask.findFirst({ where: { id, ownerId: auth.ctx.ownerId }, select: { id: true } });
  if (!task) return notFound();
  const items = await prisma.taskAttachment.findMany({
    where: { taskId: task.id, ownerId: auth.ctx.ownerId },
    orderBy: { createdAt: "asc" },
    select: SELECT,
  });
  return NextResponse.json(items);
}

// ドライブへ送り終わったファイルを、タスクの添付として登録する
// POST /api/work/tasks/[id]/attachments  body: { fileId }
// ドライブ上で「専用フォルダにあり、このタスクの印がついている」ことを確かめてから登録する
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ownerId = auth.ctx.ownerId;

  const body = (await req.json().catch(() => null)) as { fileId?: unknown } | null;
  const fileId = typeof body?.fileId === "string" ? body.fileId.trim() : "";
  if (!fileId || fileId.length > 200) return badRequest("ファイルの指定が正しくありません");

  const task = await prisma.workTask.findFirst({ where: { id, ownerId }, select: { id: true } });
  if (!task) return notFound();
  const acc = await getConnection(ownerId);
  if (!acc?.driveFolderId) return badRequest("添付資料のフォルダがありません。もう一度添付してください");

  try {
    const token = await getAccessToken(ownerId);
    const file = await getDriveFile(token, fileId);
    if (!isAttachmentFileFor(file, { taskId: task.id, folderId: acc.driveFolderId }) || !file.webViewLink) {
      return badRequest("このタスクに添付したファイルではありません");
    }
    const created = await prisma.taskAttachment.create({
      data: {
        ownerId,
        taskId: task.id,
        driveFileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: Number(file.size ?? 0),
        webViewLink: file.webViewLink,
      },
      select: SELECT,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return badRequest("このファイルはすでに添付されています");
    }
    return NextResponse.json({ error: driveErrorMessage(e) }, { status: 502 });
  }
}
