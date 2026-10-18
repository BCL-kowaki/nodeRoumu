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

// その日のタスクをクライアントごとに（AI 連携で「今日のタスク」を渡すときに使う。画面の一覧と同じ考え方）。
// その日に作業・計画・完了したタスクがあるクライアントだけを、一覧の並び順で返す
export function dayTaskGroups<T extends TaskLike>(input: {
  clients: { id: string; name: string }[];
  projects: { id: string; clientId: string }[];
  open: T[];
  done: T[];
  workedTaskIds: Set<string>;
  plannedTaskIds: Set<string>;
}): { clientId: string; clientName: string; open: (T & { workedToday: boolean; plannedToday: boolean })[]; done: T[] }[] {
  const out = [];
  for (const c of input.clients) {
    const open = sortClientTasks(tasksOfClient(input.open, c.id, input.projects), input.workedTaskIds);
    const done = tasksOfClient(input.done, c.id, input.projects);
    const active = done.length > 0 || open.some((t) => input.workedTaskIds.has(t.id) || input.plannedTaskIds.has(t.id));
    if (!active) continue;
    out.push({
      clientId: c.id,
      clientName: c.name,
      open: open.map((t) => ({ ...t, workedToday: input.workedTaskIds.has(t.id), plannedToday: input.plannedTaskIds.has(t.id) })),
      done,
    });
  }
  return out;
}

export type MemoLine = { text: string; kind: "item" | "done" | "heading" };
const MAX_TASK_TITLE = 200;

// 引き継ぎメモを1行ずつに分け、タスクにできる行（item）・済んだこと（done）・見出し（heading）を見分ける。
// 行頭の記号（- ・ * 番号 チェックボックス）は取る。下書きの「完了」の下の行は済んだこととして扱う
export function memoLines(body: string): MemoLine[] {
  const out: MemoLine[] = [];
  let inDone = false;
  for (const raw of body.split("\n")) {
    let line = raw.trim();
    if (!line) continue;
    const heading = /^#+\s*/.test(line);
    line = line.replace(/^#+\s*/, "");
    const checked = /^[-*・]\s*\[[xX]\]\s*/.test(line);
    line = line
      .replace(/^[-*・]\s*\[[ xX]?\]\s*/, "")
      .replace(/^([-*・•]|\d+[.)．])\s*/, "")
      .trim();
    if (!line) continue;
    if (heading || /^(完了|次にやること)[:：]?$/.test(line)) {
      inDone = /^完了[:：]?$/.test(line);
      out.push({ text: line, kind: "heading" });
      continue;
    }
    out.push({ text: line.slice(0, MAX_TASK_TITLE), kind: checked || inDone ? "done" : "item" });
  }
  return out;
}
