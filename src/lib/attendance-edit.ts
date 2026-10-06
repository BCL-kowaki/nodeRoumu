// 出勤簿の修正（AI 連携から）の入力チェックと差分（決まった答えになる処理なのでテストで固定）
// 画面の入口より厳しく確認する：時刻は HH:MM、休憩は 0〜600分、状態は決まった値だけ

export const ATTENDANCE_STATUSES = ["scheduled", "normal", "late", "early_leave", "absent", "public_holiday", "closed"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceFields = {
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  status: string | null;
  memo: string | null;
};
export type AttendancePatch = Partial<AttendanceFields>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_BREAK = 600;
const MAX_MEMO = 500;
const has = (b: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(b, k);

export function parseAttendancePatch(body: unknown): { ok: true; data: AttendancePatch } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "入力内容が正しくありません" };
  const b = body as Record<string, unknown>;
  const out: AttendancePatch = {};
  for (const [key, label] of [
    ["startTime", "出勤時刻"],
    ["endTime", "退勤時刻"],
  ] as const) {
    if (!has(b, key)) continue;
    const v = b[key];
    if (v === null || v === "") out[key] = null;
    else if (typeof v === "string" && TIME.test(v)) out[key] = v;
    else return { ok: false, error: `${label}は HH:MM（00:00〜23:59）で指定してください` };
  }
  if (has(b, "breakMinutes")) {
    const v = b.breakMinutes;
    if (v === null || v === "") out.breakMinutes = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_BREAK) out.breakMinutes = v;
    else return { ok: false, error: `休憩は0〜${MAX_BREAK}分で指定してください` };
  }
  if (has(b, "status")) {
    const v = b.status;
    if (v === null || v === "") out.status = null;
    else if (typeof v === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(v)) out.status = v;
    else return { ok: false, error: "状態の値が正しくありません" };
  }
  if (has(b, "memo")) {
    const v = b.memo;
    if (v === null) out.memo = null;
    else if (typeof v !== "string") return { ok: false, error: "備考の値が正しくありません" };
    else if (v.trim().length > MAX_MEMO) return { ok: false, error: `備考は${MAX_MEMO}文字以内で指定してください` };
    else out.memo = v.trim() || null;
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "変更する内容がありません" };
  return { ok: true, data: out };
}

// 変わった項目だけを { 項目: [変更前, 変更後] } で返す（変更履歴に残す内容）
export function diffAttendance(
  before: AttendanceFields | null,
  patch: AttendancePatch
): Record<string, [string | number | null, string | number | null]> {
  const out: Record<string, [string | number | null, string | number | null]> = {};
  for (const key of Object.keys(patch) as (keyof AttendanceFields)[]) {
    const prev = before ? before[key] : null;
    const next = patch[key] ?? null;
    if (prev !== next) out[key] = [prev ?? null, next];
  }
  return out;
}
