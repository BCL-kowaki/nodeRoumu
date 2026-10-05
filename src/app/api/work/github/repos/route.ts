import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { githubErrorMessage, listRepos } from "@/lib/github";
import { requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

// 保存済みのリポジトリ一覧（同期中のものを先頭に）
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const repos = await prisma.githubRepo.findMany({
    where: { ownerId: auth.ctx.ownerId },
    orderBy: [{ syncIssues: "desc" }, { pushedAt: { sort: "desc", nulls: "last" } }],
  });
  return NextResponse.json(repos);
}

// GitHub からリポジトリ一覧を取り直して保存する（同期の ON/OFF は保つ）
export async function POST() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ownerId = auth.ctx.ownerId;
  try {
    const repos = await listRepos();
    for (const r of repos) {
      const data = {
        fullName: r.full_name,
        description: r.description,
        isPrivate: r.private,
        isArchived: r.archived,
        htmlUrl: r.html_url,
        defaultBranch: r.default_branch,
        pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
      };
      await prisma.githubRepo.upsert({
        where: { ownerId_githubId: { ownerId, githubId: String(r.id) } },
        update: data,
        create: { ownerId, githubId: String(r.id), ...data },
      });
    }
    const saved = await prisma.githubRepo.findMany({
      where: { ownerId },
      orderBy: [{ syncIssues: "desc" }, { pushedAt: { sort: "desc", nulls: "last" } }],
    });
    return NextResponse.json(saved);
  } catch (e) {
    return NextResponse.json({ error: githubErrorMessage(e) }, { status: 502 });
  }
}
