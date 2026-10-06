import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { parseIdOrder } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

// クライアントの並び順を保存する（ドラッグで入れ替えた結果）
// PUT /api/work/clients/order  body: { ids: [先頭から順のクライアントID] }
// 自分のクライアントを過不足なくすべて指定したときだけ受け付ける
export async function PUT(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const parsed = parseIdOrder(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  const ids = parsed.data;

  const owned = await prisma.workClient.findMany({ where: { ownerId: auth.ctx.ownerId }, select: { id: true } });
  const ownedIds = new Set(owned.map((c) => c.id));
  if (owned.length !== ids.length || !ids.every((id) => ownedIds.has(id))) {
    return badRequest("クライアントの一覧が最新ではありません。画面を読み込み直してください");
  }

  await prisma.$transaction(
    ids.map((id, i) => prisma.workClient.update({ where: { id }, data: { sortOrder: i } }))
  );
  return NextResponse.json({ ok: true });
}
