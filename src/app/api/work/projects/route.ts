import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { ownsClient } from "@/lib/work/links";
import { PROJECT_STATUSES, parseProjectInput, toDbDate } from "@/lib/work/validate";

export const dynamic = "force-dynamic";

// プロジェクト一覧（未完了タスク数つき）
// GET /api/work/projects?status=active,on_hold
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const statusParam = req.nextUrl.searchParams.get("status");
  const statuses = statusParam
    ? statusParam.split(",").filter((s) => (PROJECT_STATUSES as readonly string[]).includes(s))
    : undefined;

  const projects = await prisma.workProject.findMany({
    where: { ownerId: auth.ctx.ownerId, ...(statuses ? { status: { in: statuses } } : {}) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { tasks: { where: { status: { in: ["todo", "doing"] } } } } },
      githubRepos: { select: { id: true, fullName: true, htmlUrl: true }, orderBy: { fullName: "asc" } },
    },
  });
  return NextResponse.json(
    projects.map(({ _count, ...p }) => ({ ...p, openTaskCount: _count.tasks }))
  );
}

// プロジェクト作成
// POST /api/work/projects  body: { name, clientId, description?, status?, color?, startDate?, dueDate? }
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const parsed = parseProjectInput(await req.json().catch(() => null), "create");
  if (!parsed.ok) return badRequest(parsed.error);
  const d = parsed.data;
  if (!(await ownsClient(auth.ctx.ownerId, d.clientId!))) return badRequest("クライアントが見つかりません");

  const created = await prisma.workProject.create({
    data: {
      ownerId: auth.ctx.ownerId,
      clientId: d.clientId!,
      name: d.name!,
      description: d.description,
      status: d.status,
      color: d.color,
      startDate: toDbDate(d.startDate),
      dueDate: toDbDate(d.dueDate),
    },
  });
  return NextResponse.json(created, { status: 201 });
}
