// 実績の一覧で、クライアントごとにタスクを整理するときの並び・初期値・メモの下書き（決まった答えになる処理なのでテストで固定）

type TaskLike = { id: string; projectId: string | null; status: string; priority: number; dueDate: string | null; createdAt?: string };

// そのクライアントのプロジェクトのタスク
export function tasksOfClient<T extends { projectId: string | null }>(tasks: T[], clientId: string, projects: { id: string; clientId: string }[]): T[] {
  const ids = new Set(projects.filter((p) => p.clientId === clientId).map((p) => p.id));
  return tasks.filter((t) => t.projectId !== null && ids.has(t.projectId));
}

// 今日作業したもの → 進行中 → 未着手。同じなら優先度（高い順）→ 期限（早い順、無しは後）→ 作成順
export function sortClientTasks<T extends TaskLike>(tasks: T[], workedToday: Set<string>): T[] {
  const rank = (t: T) => (workedToday.has(t.id) ? 0 : t.status === "doing" ? 1 : 2);
  return [...tasks].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.priority - b.priority ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
  );
}

// タスクを足すときの初期のプロジェクト：その日いちばん時間を使ったそのクライアントのプロジェクト。無ければ最初のプロジェクト
export function defaultProjectFor(
  clientId: string,
  projects: { id: string; clientId: string }[],
  usage: { projectId: string | null; minutes: number }[]
): string | null {
  const own = projects.filter((p) => p.clientId === clientId).map((p) => p.id);
  const total = new Map<string, number>();
  for (const u of usage) if (u.projectId && own.includes(u.projectId)) total.set(u.projectId, (total.get(u.projectId) ?? 0) + u.minutes);
  const best = [...total].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? own[0] ?? null;
}

// メモの下書き：今日完了したタスクと、次にやること（未完了の上から3件）
export function noteDraftFromTasks(done: string[], open: string[]): string {
  const parts: string[] = [];
  if (done.length) parts.push(["完了", ...done.map((x) => `- ${x}`)].join("\n"));
  if (open.length) parts.push(["次にやること", ...open.slice(0, 3).map((x) => `- ${x}`)].join("\n"));
  return parts.join("\n\n");
}
