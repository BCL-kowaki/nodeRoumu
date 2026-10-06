import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken, parseTokenCreateInput, tokenHint } from "@/lib/api-token";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { currentMcpContext } from "@/lib/work/mcp-context";

export const dynamic = "force-dynamic";

const SELECT = { id: true, name: true, hint: true, scope: true, attendance: true, expiresAt: true, lastUsedAt: true, revokedAt: true, createdAt: true } as const;

// 鍵の管理はアプリの画面（ログイン）からだけ。AI 連携の中からは扱えない
function forbidFromMcp() {
  return currentMcpContext() ? NextResponse.json({ error: "forbidden" }, { status: 403 }) : null;
}

// AI 連携用の鍵の一覧（鍵そのものは返さない）
export async function GET() {
  const blocked = forbidFromMcp();
  if (blocked) return blocked;
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const tokens = await prisma.apiToken.findMany({
    where: { ownerId: auth.ctx.ownerId },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  return NextResponse.json(tokens);
}

// 鍵の発行。鍵そのものは、この応答で1回だけ返す（保存するのは元に戻せない値だけ）
// POST /api/work/ai-tokens  body: { name, scope: "read" | "write", expiresInDays: 30 | 90 | 365, attendance?: boolean }
export async function POST(req: NextRequest) {
  const blocked = forbidFromMcp();
  if (blocked) return blocked;
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const parsed = parseTokenCreateInput(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;

  const token = generateToken();
  const created = await prisma.apiToken.create({
    data: {
      ownerId: auth.ctx.ownerId,
      name: d.name,
      tokenHash: hashToken(token),
      hint: tokenHint(token),
      scope: d.scope,
      attendance: d.attendance,
      expiresAt: new Date(Date.now() + d.expiresInDays * 24 * 60 * 60 * 1000),
    },
    select: SELECT,
  });
  return NextResponse.json({ ...created, token }, { status: 201 });
}
