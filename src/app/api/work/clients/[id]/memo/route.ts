import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { currentMcpContext } from "@/lib/work/mcp-context";
import { parseClientMemo } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// クライアントのメモはアカウント情報などを含むので、アプリの画面（ログイン）からだけ読み書きできる。AI 連携からは扱えない
function forbidFromMcp() {
  return currentMcpContext() ? NextResponse.json({ error: "forbidden" }, { status: 403 }) : null;
}

// メモを読む（保存時の暗号を解いて返す）
export async function GET(_req: NextRequest, { params }: Params) {
  const blocked = forbidFromMcp();
  if (blocked) return blocked;
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const client = await prisma.workClient.findFirst({ where: { id, ownerId: auth.ctx.ownerId }, select: { encryptedMemo: true } });
  if (!client) return notFound();
  if (!client.encryptedMemo) return NextResponse.json({ memo: null });
  try {
    return NextResponse.json({ memo: decrypt(client.encryptedMemo) });
  } catch {
    // 鍵が変わった・壊れたなど。中身は出さずに知らせる
    console.error("[client-memo] メモを復号できませんでした");
    return NextResponse.json({ error: "メモを読み出せませんでした（暗号化の鍵を確認してください）" }, { status: 500 });
  }
}

// メモを保存する（暗号化して保存。空にすると消える）
// PUT /api/work/clients/[id]/memo  body: { memo: string | null }
export async function PUT(req: NextRequest, { params }: Params) {
  const blocked = forbidFromMcp();
  if (blocked) return blocked;
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const parsed = parseClientMemo(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  if (!process.env.WORKSPACE_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "暗号化の鍵（WORKSPACE_ENCRYPTION_KEY）が未設定のため、メモを保存できません" }, { status: 500 });
  }
  const { count } = await prisma.workClient.updateMany({
    where: { id, ownerId: auth.ctx.ownerId },
    data: { encryptedMemo: parsed.data === null ? null : encrypt(parsed.data) },
  });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true, hasMemo: parsed.data !== null });
}
