import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { obsidianErrorMessage, readNote } from "@/lib/obsidian";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { currentMcpContext } from "@/lib/work/mcp-context";
import { shareTitle } from "@/lib/work/note-share";
import { toShareView } from "@/lib/work/share-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 共有の更新・停止
// PUT { action: "refresh" }  元のノートの今の内容で、共有ページの内容を差し替える
// PUT { action: "revoke" }   共有を停止する（すぐ見られなくなる。記録は残す）
export async function PUT(req: NextRequest, { params }: Params) {
  if (currentMcpContext()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const share = await prisma.noteShare.findFirst({ where: { id: (await params).id, ownerId: auth.ctx.ownerId } });
  if (!share) return notFound();
  const body = (await req.json().catch(() => null)) as { action?: unknown } | null;

  if (body?.action === "revoke") {
    const updated = await prisma.noteShare.update({ where: { id: share.id }, data: { revokedAt: share.revokedAt ?? new Date() } });
    return NextResponse.json(toShareView(updated, req.nextUrl.origin, new Date()));
  }
  if (body?.action === "refresh") {
    if (share.revokedAt) return badRequest("停止した共有は更新できません。新しく発行してください");
    try {
      const { content } = await readNote(share.notePath);
      const updated = await prisma.noteShare.update({
        where: { id: share.id },
        data: { encryptedContent: encrypt(content), title: shareTitle(content, share.notePath).slice(0, 200) },
      });
      return NextResponse.json(toShareView(updated, req.nextUrl.origin, new Date()));
    } catch (e) {
      return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: 502 });
    }
  }
  return badRequest("操作の指定が正しくありません");
}
