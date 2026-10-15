// クライアントごとの日々のメモ（日報・引き継ぎ）の入力と扱い（決まった答えになる処理なのでテストで固定）
import { addDays } from "@/lib/date-jst";

export const MAX_DAILY_NOTE = 5000;
// 引き継ぎとして出すのは、この日数より新しいメモだけ（古いメモが毎日出続けないように）
export const HANDOVER_DAYS = 30;

export type DailyNoteInput = { clientId: string; date: string; body: string | null };

function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// 本文が空なら null（そのメモを消す）
export function parseDailyNote(body: unknown): { ok: true; data: DailyNoteInput } | { ok: false; error: string } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof b.clientId !== "string" || !b.clientId) return { ok: false, error: "クライアントを指定してください" };
  if (!isDate(b.date)) return { ok: false, error: "日付の形式が正しくありません" };
  if (b.body !== null && b.body !== undefined && typeof b.body !== "string") return { ok: false, error: "メモの内容が正しくありません" };
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (text.length > MAX_DAILY_NOTE) return { ok: false, error: `メモは${MAX_DAILY_NOTE}文字以内で入力してください` };
  return { ok: true, data: { clientId: b.clientId, date: b.date, body: text || null } };
}

// 引き継ぎとして出す期間の始まり（その日の HANDOVER_DAYS 日前）
export function handoverFrom(date: string): string {
  return addDays(date, -HANDOVER_DAYS);
}
