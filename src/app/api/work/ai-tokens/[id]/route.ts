import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound, requireWorkspace } from "@/lib/work/auth";
import { currentMcpContext } from "@/lib/work/mcp-context";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 鍵の取り消し（すぐに使えなくなる。記録は残す）
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (currentMcpContext()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { count } = await prisma.apiToken.updateMany({
    where: { id, ownerId: auth.ctx.ownerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
