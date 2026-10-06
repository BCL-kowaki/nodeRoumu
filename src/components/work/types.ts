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
  githubIssueNumber?: number | null;
  githubHtmlUrl?: string | null;
  githubRepo?: { fullName: string } | null;
  attachmentCount?: number;
};

export type Client = {
  id: string;
  name: string;
  projectCount?: number;
};

export type Project = {
  id: string;
  clientId: string;
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
  clientId: string | null;
  client: { id: string; name: string } | null;
};

export type CheckStatus = "done" | "skipped" | null;
export type RoutineDay = {
  date: string;
  closed: boolean;
  items: { routineId: string; status: CheckStatus }[];
};

export type Plan = {
  id: string;
  date: string;
  startTime: string | null;
  plannedMinutes: number;
  title: string;
  taskId: string | null;
  projectId: string | null;
  task: { id: string; title: string; status: string } | null;
  project: ProjectRef | null;
};

export type TimeEntry = {
  id: string;
  date: string;
  startedAt: string | null;
  endedAt: string | null;
  minutes: number | null;
  source: "timer" | "manual";
  note: string | null;
  taskId: string | null;
  projectId: string | null;
  routineId: string | null;
  planId: string | null;
  task: { id: string; title: string; status: string } | null;
  project: ProjectRef | null;
  routine: { id: string; title: string } | null;
  plan: { id: string; title: string } | null;
};

export type DaySummary = {
  date: string;
  plannedMin: number;
  actualMin: number;
  attendanceMin: number | null;
  unrecordedMin: number | null;
};

export type TimerLinks = { taskId?: string; projectId?: string; routineId?: string; planId?: string; note?: string };

// 実績の表示名（タスク → 計画 → ルーティン → メモ の順で使う）
export function entryTitle(e: TimeEntry): string {
  return e.task?.title || e.plan?.title || e.routine?.title || e.note || "（作業内容なし）";
}

export type GithubRepo = {
  id: string;
  fullName: string;
  description: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  htmlUrl: string;
  openIssuesCount: number;
  openPrCount: number;
  pushedAt: string | null;
  syncIssues: boolean;
  lastSyncedAt: string | null;
};

export type NoteInfo = { path: string | null; content?: string; missing?: boolean };
export type ObsidianStatus = { configured: boolean; noteCount?: number; error?: string };
