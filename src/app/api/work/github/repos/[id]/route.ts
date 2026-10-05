import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Issue 同期の ON/OFF
// PATCH /api/work/github/repos/[id]  body: { syncIssues: boolean }
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.syncIssues !== "boolean") return badRequest("同期の ON/OFF の指定が正しくありません");

  const { count } = await prisma.githubRepo.updateMany({
    where: { id, ownerId: auth.ctx.ownerId },
    data: { syncIssues: body.syncIssues },
  });
  if (count === 0) return notFound();
  return NextResponse.json(await prisma.githubRepo.findUnique({ where: { id } }));
}
