// 業務の計画・実績時間の計算（決まった答えになる処理なのでテストで固定）
import { isCountableDay, workMinutes, type AttendanceLike } from "@/lib/attendance-status";

type DateLike = Date | string;
const ms = (d: DateLike) => (d instanceof Date ? d.getTime() : Date.parse(d));

// タイマーの止め忘れとみなす時間
export const LONG_RUNNING_HOURS = 12;

// 開始〜終了（終了が無ければ現在時刻）の分数。切り捨て、マイナスは 0
export function elapsedMinutes(startedAt: DateLike, endedAt: DateLike | null, now: Date): number {
  const end = endedAt ? ms(endedAt) : now.getTime();
  return Math.max(0, Math.floor((end - ms(startedAt)) / 60000));
}

export type EntryLike = {
  minutes: number | null;
  startedAt: DateLike | null;
  endedAt: DateLike | null;
};

// 実績1件の分数。計測中のタイマーは現在時刻まで、それ以外は保存した分数
export function entryMinutes(e: EntryLike, now: Date): number {
  if (e.startedAt && !e.endedAt) return elapsedMinutes(e.startedAt, null, now);
  return e.minutes ?? 0;
}

// 出勤簿の勤務分数。出勤日として数える日で、退勤まで記録がある場合だけ。それ以外は null（比較しない）
export function attendanceMinutesFor(rec: AttendanceLike | undefined, closed: boolean): number | null {
  if (!rec || !isCountableDay(rec, closed)) return null;
  return workMinutes(rec.startTime, rec.endTime, rec.breakMinutes);
}

export type DaySummary = {
  plannedMin: number;
  actualMin: number;
  attendanceMin: number | null;
  unrecordedMin: number | null; // 出勤簿の勤務時間のうち、業務の実績として記録していない時間
};

export function summarizeDay(input: {
  plans: { plannedMinutes: number }[];
  entries: EntryLike[];
  attendanceMinutes: number | null;
  now: Date;
}): DaySummary {
  const plannedMin = input.plans.reduce((s, p) => s + p.plannedMinutes, 0);
  const actualMin = input.entries.reduce((s, e) => s + entryMinutes(e, input.now), 0);
  const attendanceMin = input.attendanceMinutes;
  return {
    plannedMin,
    actualMin,
    attendanceMin,
    unrecordedMin: attendanceMin === null ? null : Math.max(0, attendanceMin - actualMin),
  };
}

// 止め忘れの判定（12時間を超えて計測中）
export function isLongRunning(startedAt: DateLike, now: Date): boolean {
  return now.getTime() - ms(startedAt) > LONG_RUNNING_HOURS * 60 * 60 * 1000;
}

// 経過秒数を「1:02:03」の形に
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
