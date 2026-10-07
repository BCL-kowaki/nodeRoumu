// 実績の時間帯（日本時間の HH:MM）と、記録する日時の変換（決まった答えになる処理なのでテストで固定）
import { timeToMinutes } from "./timeline";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// その日（日本時間）の HH:MM → 日時
function jstDateTime(date: string, hhmm: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - JST_OFFSET_MS + timeToMinutes(hhmm) * 60_000);
}

export function entryRangeFromTimes(
  date: string,
  startTime: string,
  endTime: string
): { ok: true; startedAt: Date; endedAt: Date; minutes: number } | { ok: false; error: string } {
  const minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (minutes <= 0) return { ok: false, error: "終了時刻は開始時刻より後にしてください" };
  return { ok: true, startedAt: jstDateTime(date, startTime), endedAt: jstDateTime(date, endTime), minutes };
}

// 記録された日時 → 日本時間の HH:MM
export function toJstTime(iso: string | Date): string {
  const d = new Date((typeof iso === "string" ? Date.parse(iso) : iso.getTime()) + JST_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
