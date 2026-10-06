// タイマーの並行計測の判定（決まった答えになる処理なのでテストで固定）
// 複数のタイマーを同時に動かせる。ただし同じタスク・ルーティン・計画を二重には計測しない

type Target = { taskId?: string | null; routineId?: string | null; planId?: string | null; projectId?: string | null };
type Running = Target & { id: string };

// 同じ対象（タスク → ルーティン → 計画 の順に見る）で計測中のタイマー。無ければ null
export function findSameTarget<T extends Running>(running: T[], target: Target): T | null {
  if (target.taskId) return running.find((r) => r.taskId === target.taskId) ?? null;
  if (target.routineId) return running.find((r) => r.routineId === target.routineId) ?? null;
  if (target.planId) return running.find((r) => r.planId === target.planId) ?? null;
  return null;
}
