// 業務管理の画面で使う型（APIの返却値に対応）
export type ProjectRef = { id: string; name: string; color: string | null };

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  plannedMinutes: number | null;
  completedAt: string | null;
  projectId: string | null;
  project: ProjectRef | null;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  startDate: string | null;
  dueDate: string | null;
  openTaskCount?: number;
};

export const inputClass =
  "w-full p-2.5 px-3 rounded border border-app-border text-sm text-app-text bg-white outline-none";
export const labelClass = "block text-xs font-semibold text-app-sub mb-1";

// API呼び出し。失敗時はサーバーのエラーメッセージを投げる
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `通信に失敗しました（${res.status}）`);
  return data as T;
}

export type Routine = {
  id: string;
  title: string;
  description: string | null;
  frequency: "daily" | "weekly" | "monthly";
  weekdays: number;
  monthDay: number | null;
  skipClosedDays: boolean;
  plannedMinutes: number | null;
  active: boolean;
  startDate: string;
  endDate: string | null;
  projectId: string | null;
  project: ProjectRef | null;
};

export type CheckStatus = "done" | "skipped" | null;
export type RoutineDay = {
  date: string;
  closed: boolean;
  items: { routineId: string; status: CheckStatus }[];
};
