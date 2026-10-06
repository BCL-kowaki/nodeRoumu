// 計画・実績の画面で「計画に置けるもの」を並べる・作るための処理（決まった答えになる処理なのでテストで固定）
import { DAY_END, minutesToTime, timeToMinutes } from "./timeline";

type TaskLike = { id: string; projectId: string | null };

export type TaskGroup<T> = { projectId: string | null; tasks: T[] };

// 未完了のタスクをプロジェクトごとにまとめる。
// 並びは「クライアントの並び → その中のプロジェクトの並び」。一覧に無いプロジェクトはその後、プロジェクトなしは最後
export function groupTasksByProject<T extends TaskLike>(
  tasks: T[],
  projects: { id: string; clientId: string }[],
  clients: { id: string }[]
): TaskGroup<T>[] {
  const order: string[] = [];
  for (const c of clients) for (const p of projects) if (p.clientId === c.id) order.push(p.id);
  for (const p of projects) if (!order.includes(p.id)) order.push(p.id);

  const byProject = new Map<string | null, T[]>();
  for (const t of tasks) byProject.set(t.projectId, [...(byProject.get(t.projectId) ?? []), t]);

  const groups: TaskGroup<T>[] = [];
  for (const id of order) if (byProject.has(id)) groups.push({ projectId: id, tasks: byProject.get(id)! });
  for (const [id, ts] of byProject) if (id !== null && !order.includes(id)) groups.push({ projectId: id, tasks: ts });
  if (byProject.has(null)) groups.push({ projectId: null, tasks: byProject.get(null)! });
  return groups;
}

export type GoogleEventLike = { id: string; title: string; allDay: boolean; startTime: string | null; endTime: string | null };

// Google の予定を、同じ時間の計画にする。終日・時刻の無い予定は null
export function eventToPlan(e: GoogleEventLike): { title: string; startTime: string; plannedMinutes: number; sourceEventId: string } | null {
  if (e.allDay || !e.startTime || !e.endTime) return null;
  const start = timeToMinutes(e.startTime);
  const end = timeToMinutes(e.endTime) || DAY_END; // 24:00 終わりは 00:00 で届く
  const minutes = Math.max(1, Math.min(end, DAY_END) - start);
  return { title: e.title.trim() || "（予定）", startTime: minutesToTime(start), plannedMinutes: minutes, sourceEventId: e.id };
}

// まだ計画に取り込んでいない、時刻つきの予定
export function importableEvents<E extends GoogleEventLike>(events: E[], plans: { sourceEventId: string | null }[]): E[] {
  const imported = new Set(plans.map((p) => p.sourceEventId).filter(Boolean));
  return events.filter((e) => eventToPlan(e) !== null && !imported.has(e.id));
}

// プロジェクトごとのまとまりを、さらにクライアントごとに分ける（開閉の単位）。
// クライアントの並び順。プロジェクトなし・一覧に無いプロジェクトは最後にまとめる（clientId: null）
export function groupByClient<G extends { projectId: string | null }>(
  groups: G[],
  projects: { id: string; clientId: string }[],
  clients: { id: string }[]
): { clientId: string | null; groups: G[] }[] {
  const clientOf = new Map(projects.map((p) => [p.id, p.clientId]));
  const out: { clientId: string | null; groups: G[] }[] = [];
  for (const c of clients) {
    const gs = groups.filter((g) => g.projectId && clientOf.get(g.projectId) === c.id);
    if (gs.length) out.push({ clientId: c.id, groups: gs });
  }
  const known = new Set(clients.map((c) => c.id));
  const rest = groups.filter((g) => !g.projectId || !known.has(clientOf.get(g.projectId) ?? ""));
  if (rest.length) out.push({ clientId: null, groups: rest });
  return out;
}
