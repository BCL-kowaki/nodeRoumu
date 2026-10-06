// クライアント別の計画・実績の集計（決まった答えになる処理なのでテストで固定）
// 計画・実績はプロジェクトを通してクライアントに振り分ける。
// プロジェクトは「直接の指定 → タスクのプロジェクト → （実績なら）計画のプロジェクト」の順にたどる。
import { entryMinutes, type EntryLike } from "./time";

type PlanLike = { plannedMinutes: number; projectId: string | null; task: { projectId: string | null } | null };
type ClientEntryLike = EntryLike & {
  projectId: string | null;
  task: { projectId: string | null } | null;
  plan: { projectId: string | null } | null;
};

export type Totals = { plannedMin: number; actualMin: number };
export type ClientSummary = Totals & { clientId: string; projects: (Totals & { projectId: string })[] };

export function summarizeByClient(input: {
  plans: PlanLike[];
  entries: ClientEntryLike[];
  projects: { id: string; clientId: string }[];
  now: Date;
}): { clients: ClientSummary[]; unassigned: Totals } {
  const clientOf = new Map(input.projects.map((p) => [p.id, p.clientId]));
  const byProject = new Map<string, Totals>();
  const unassigned: Totals = { plannedMin: 0, actualMin: 0 };

  const add = (projectId: string | null, key: keyof Totals, minutes: number) => {
    if (!projectId || !clientOf.has(projectId)) {
      unassigned[key] += minutes;
      return;
    }
    const t = byProject.get(projectId) ?? { plannedMin: 0, actualMin: 0 };
    t[key] += minutes;
    byProject.set(projectId, t);
  };

  for (const p of input.plans) add(p.projectId ?? p.task?.projectId ?? null, "plannedMin", p.plannedMinutes);
  for (const e of input.entries) {
    add(e.projectId ?? e.task?.projectId ?? e.plan?.projectId ?? null, "actualMin", entryMinutes(e, input.now));
  }

  // プロジェクトの並び順（＝渡された順）を保ったままクライアントごとにまとめる
  const clients = new Map<string, ClientSummary>();
  for (const p of input.projects) {
    const t = byProject.get(p.id);
    if (!t) continue;
    const c = clients.get(p.clientId) ?? { clientId: p.clientId, plannedMin: 0, actualMin: 0, projects: [] };
    c.plannedMin += t.plannedMin;
    c.actualMin += t.actualMin;
    c.projects.push({ projectId: p.id, ...t });
    clients.set(p.clientId, c);
  }

  const total = (t: Totals) => t.plannedMin + t.actualMin;
  // sort は安定ソートなので、同じ時間なら元の順のまま
  const sorted = [...clients.values()].sort((a, b) => total(b) - total(a));
  for (const c of sorted) c.projects.sort((a, b) => total(b) - total(a));
  return { clients: sorted, unassigned };
}
