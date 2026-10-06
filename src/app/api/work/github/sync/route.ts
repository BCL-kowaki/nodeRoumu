import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countOpenPulls, getRepo, githubErrorMessage, listIssues } from "@/lib/github";
import { requireWorkspace } from "@/lib/work/auth";
import { planIssueSync } from "@/lib/work/github-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_INTERVAL_MS = 30 * 1000; // 連打防止（前回の同期から30秒）
const SINCE_MARGIN_MS = 5 * 60 * 1000; // 取りこぼし防止に、前回同期の5分前から取り直す

// 同期を ON にしたリポジトリの Issue をタスクに反映する
// POST /api/work/github/sync → { repos: [{ fullName, created, updated, error? }] }
export async function POST() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ownerId = auth.ctx.ownerId;

  const repos = await prisma.githubRepo.findMany({ where: { ownerId, syncIssues: true } });
  if (repos.length === 0) {
    return NextResponse.json({ error: "Issue を同期するリポジトリがありません。一覧で「同期する」をオンにしてください" }, { status: 400 });
  }
  const latest = Math.max(...repos.map((r) => r.lastSyncedAt?.getTime() ?? 0));
  if (Date.now() - latest < MIN_INTERVAL_MS) {
    return NextResponse.json({ error: "続けて同期できません。30秒ほど待ってからお試しください" }, { status: 429 });
  }

  const results = [];
  for (const repo of repos) {
    const startedAt = new Date();
    try {
      const since = repo.lastSyncedAt ? new Date(repo.lastSyncedAt.getTime() - SINCE_MARGIN_MS) : null;
      const [issues, info, prCount] = await Promise.all([
        listIssues(repo.fullName, since),
        getRepo(repo.fullName),
        countOpenPulls(repo.fullName),
      ]);
      const existing = await prisma.workTask.findMany({
        where: { ownerId, githubRepoId: repo.id },
        select: { id: true, githubIssueNumber: true, githubUpdatedAt: true, status: true },
      });
      const plan = planIssueSync(existing, issues, startedAt);

      await prisma.$transaction([
        ...plan.creates.map((c) =>
          // 新しく取り込む Issue は、リポジトリに紐づけたプロジェクトに入れる
          prisma.workTask.create({ data: { ownerId, githubRepoId: repo.id, projectId: repo.projectId, ...c } })
        ),
        ...plan.updates.map((u) =>
          prisma.workTask.updateMany({ where: { id: u.id, ownerId }, data: u.data })
        ),
        prisma.githubRepo.update({
          where: { id: repo.id },
          data: {
            lastSyncedAt: startedAt,
            openPrCount: prCount,
            // GitHub の open_issues_count はプルリクエストを含むので差し引く
            openIssuesCount: Math.max(0, info.open_issues_count - prCount),
            pushedAt: info.pushed_at ? new Date(info.pushed_at) : null,
          },
        }),
      ]);
      results.push({ fullName: repo.fullName, created: plan.creates.length, updated: plan.updates.length });
    } catch (e) {
      results.push({ fullName: repo.fullName, created: 0, updated: 0, error: githubErrorMessage(e) });
    }
  }
  return NextResponse.json({ repos: results });
}
