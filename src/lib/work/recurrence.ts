// ルーティン（繰り返し業務）の実施日の判定
// 実施日は保存せず毎回この関数で計算する（チェックした記録だけを保存する）。
import { dayOfWeek } from "@/lib/attendance-status";

export type Frequency = "daily" | "weekly" | "monthly";

export type RecurrenceRule = {
  frequency: Frequency;
  weekdays: number; // 毎週: 曜日のビット（日=1, 月=2, 火=4, 水=8, 木=16, 金=32, 土=64）
  monthDay: number | null; // 毎月: 1〜31、-1 は月末
  skipClosedDays: boolean; // 休日（定休・会社休日）は実施日にしない
  active: boolean;
  startDate: string; // "YYYY-MM-DD"（ISO 文字列も可）
  endDate: string | null;
};

// 曜日番号（0=日〜6=土）→ ビット
export const WEEKDAY_BITS = [1, 2, 4, 8, 16, 32, 64] as const;
export const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"] as const;
export const ALL_WEEKDAYS = 127;
// 月曜はじまりの表示順
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

// "YYYY-MM-DD" の月の日数
export function lastDayOfMonth(date: string): number {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// その日がルーティンの実施日か。closed はその日が休日か（isClosedDay の結果）
export function isRoutineDue(rule: RecurrenceRule, date: string, closed: boolean): boolean {
  const d = date.slice(0, 10);
  if (!rule.active) return false;
  if (d < rule.startDate.slice(0, 10)) return false;
  if (rule.endDate && d > rule.endDate.slice(0, 10)) return false;
  if (rule.skipClosedDays && closed) return false;

  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekly":
      return (rule.weekdays & WEEKDAY_BITS[dayOfWeek(d)]) !== 0;
    case "monthly": {
      if (rule.monthDay === null) return false;
      const last = lastDayOfMonth(d);
      // -1（月末）や、その月に無い日付（31日指定の11月など）は最終日に寄せる
      const target = rule.monthDay === -1 ? last : Math.min(rule.monthDay, last);
      return Number(d.slice(8, 10)) === target;
    }
    default:
      return false;
  }
}

// 「毎週 月・水・金」のような表示
export function recurrenceLabel(rule: RecurrenceRule): string {
  let text: string;
  if (rule.frequency === "daily") text = "毎日";
  else if (rule.frequency === "weekly") {
    const days = WEEKDAY_ORDER.filter((i) => rule.weekdays & WEEKDAY_BITS[i]).map((i) => WEEKDAY_NAMES[i]);
    text = `毎週 ${days.join("・")}`;
  } else text = rule.monthDay === -1 ? "毎月末" : `毎月${rule.monthDay}日`;
  return rule.skipClosedDays ? `${text}（休日を除く）` : text;
}
