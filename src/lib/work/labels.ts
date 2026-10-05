// 業務管理の表示用ラベル（決まった答えになる処理なのでテストで固定）

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
  canceled: "中止",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "進行中",
  on_hold: "保留",
  done: "完了",
  archived: "アーカイブ",
};

export const PRIORITY_LABELS: Record<number, string> = { 1: "高", 2: "中", 3: "低" };

export type Tone = "danger" | "accent" | "default";

const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD"（または ISO 文字列）同士の日数差。b - a
function diffDays(a: string, b: string): number {
  const da = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  return Math.round((db - da) / DAY_MS);
}

// 期限の表示。today は日本時間の今日（todayJst()）を渡す
export function dueLabel(
  dueDate: string | null,
  today: string,
  done: boolean
): { text: string; tone: Tone } | null {
  if (!dueDate) return null;
  const d = dueDate.slice(0, 10);
  const plain = { text: `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}まで`, tone: "default" as const };
  if (done) return plain;
  const left = diffDays(today, d);
  if (left < 0) return { text: `${-left}日超過`, tone: "danger" };
  if (left === 0) return { text: "今日まで", tone: "accent" };
  if (left === 1) return { text: "明日まで", tone: "accent" };
  return plain;
}

// 分数を「1時間30分」の形に
export function formatMinutes(m: number | null): string {
  if (m === null) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}分`;
  return r === 0 ? `${h}時間` : `${h}時間${r}分`;
}
