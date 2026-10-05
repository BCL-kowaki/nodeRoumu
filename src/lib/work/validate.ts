// 業務管理（プロジェクト・タスク）の入力チェック
// 既存APIと同じく検証ライブラリは使わず手書き。決まった答えになる処理なのでテストで固定している。
import { jstDateToDb } from "@/lib/date-jst";

export type Mode = "create" | "update";
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const TASK_STATUSES = ["todo", "doing", "done", "canceled"] as const;
export const PROJECT_STATUSES = ["active", "on_hold", "done", "archived"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type TaskInput = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  dueDate?: string | null;
  plannedMinutes?: number | null;
  projectId?: string | null;
};

export type ProjectInput = {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  color?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
};

const MAX_TITLE = 200;
const MAX_PROJECT_NAME = 100;
const MAX_DESCRIPTION = 10000;
const MAX_PLANNED_MINUTES = 24 * 60;

class InputError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;
}

function requiredText(v: unknown, max: number, emptyMsg: string, longMsg: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new InputError(emptyMsg);
  if (s.length > max) throw new InputError(longMsg);
  return s;
}

// 空文字・null は「未設定」（null）として扱う
function optionalText(v: unknown, max: number, label: string): string | null {
  if (v === null) return null;
  if (typeof v !== "string") throw new InputError(`${label}の値が正しくありません`);
  const s = v.trim();
  if (!s) return null;
  if (s.length > max) throw new InputError(`${label}は${max}文字以内で入力してください`);
  return s;
}

function optionalDate(v: unknown, label: string): string | null {
  if (v === null || v === "") return null;
  if (typeof v !== "string") throw new InputError(`${label}の形式が正しくありません`);
  try {
    jstDateToDb(v);
  } catch {
    throw new InputError(`${label}の形式が正しくありません`);
  }
  return v;
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T {
  if (typeof v !== "string" || !values.includes(v as T)) {
    throw new InputError("状態の値が正しくありません");
  }
  return v as T;
}

function run<T>(body: unknown, mode: Mode, build: (b: Record<string, unknown>) => T): ParseResult<T> {
  if (!isRecord(body)) return { ok: false, error: "入力内容が正しくありません" };
  try {
    const data = build(body);
    if (mode === "update" && Object.keys(data as object).length === 0) {
      return { ok: false, error: "変更する内容がありません" };
    }
    return { ok: true, data };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, error: e.message };
    throw e;
  }
}

// タスクの入力チェック。create では未指定の状態・優先度に既定値を補い、update では送られた項目だけを返す
export function parseTaskInput(body: unknown, mode: Mode): ParseResult<TaskInput> {
  return run(body, mode, (b) => {
    const out: TaskInput = {};
    if (mode === "create" || has(b, "title")) {
      out.title = requiredText(
        b.title,
        MAX_TITLE,
        "タイトルを入力してください",
        `タイトルは${MAX_TITLE}文字以内で入力してください`
      );
    }
    if (has(b, "description")) out.description = optionalText(b.description, MAX_DESCRIPTION, "メモ");
    if (has(b, "status")) out.status = oneOf(b.status, TASK_STATUSES);
    else if (mode === "create") out.status = "todo";
    if (has(b, "priority")) {
      if (b.priority !== 1 && b.priority !== 2 && b.priority !== 3) {
        throw new InputError("優先度の値が正しくありません");
      }
      out.priority = b.priority;
    } else if (mode === "create") out.priority = 2;
    if (has(b, "dueDate")) out.dueDate = optionalDate(b.dueDate, "期限日");
    if (has(b, "plannedMinutes")) {
      const m = b.plannedMinutes;
      if (m === null || m === "") out.plannedMinutes = null;
      else if (typeof m === "number" && Number.isInteger(m) && m >= 0 && m <= MAX_PLANNED_MINUTES) {
        out.plannedMinutes = m;
      } else throw new InputError("予定時間の値が正しくありません");
    }
    if (has(b, "projectId")) {
      const p = b.projectId;
      if (p === null || p === "") out.projectId = null;
      else if (typeof p === "string") out.projectId = p;
      else throw new InputError("プロジェクトの指定が正しくありません");
    }
    return out;
  });
}

// 完了日時の扱い：完了にした瞬間に記録、完了から戻したら消す。それ以外は変更しない（undefined）
export function completedAtFor(
  prevStatus: string,
  nextStatus: string | undefined,
  now: Date
): Date | null | undefined {
  if (nextStatus === undefined || nextStatus === prevStatus) return undefined;
  if (nextStatus === "done") return now;
  if (prevStatus === "done") return null;
  return undefined;
}

// プロジェクトの入力チェック
export function parseProjectInput(body: unknown, mode: Mode): ParseResult<ProjectInput> {
  return run(body, mode, (b) => {
    const out: ProjectInput = {};
    if (mode === "create" || has(b, "name")) {
      out.name = requiredText(
        b.name,
        MAX_PROJECT_NAME,
        "プロジェクト名を入力してください",
        `プロジェクト名は${MAX_PROJECT_NAME}文字以内で入力してください`
      );
    }
    if (has(b, "description")) out.description = optionalText(b.description, MAX_DESCRIPTION, "説明");
    if (has(b, "status")) out.status = oneOf(b.status, PROJECT_STATUSES);
    else if (mode === "create") out.status = "active";
    if (has(b, "color")) {
      const c = b.color;
      if (c === null || c === "") out.color = null;
      else if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) out.color = c.toLowerCase();
      else throw new InputError("色は #RRGGBB の形式で指定してください");
    }
    if (has(b, "startDate")) out.startDate = optionalDate(b.startDate, "開始日");
    if (has(b, "dueDate")) out.dueDate = optionalDate(b.dueDate, "期限日");
    // "YYYY-MM-DD" 同士は文字列比較で前後関係を判定できる
    if (out.startDate && out.dueDate && out.dueDate < out.startDate) {
      throw new InputError("期限日は開始日以降にしてください");
    }
    return out;
  });
}

// "YYYY-MM-DD" / null / undefined を Prisma に渡す値に変換（undefined は「変更しない」）
export function toDbDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return jstDateToDb(v);
}
