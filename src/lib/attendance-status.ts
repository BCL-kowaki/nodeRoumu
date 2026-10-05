// 出勤簿の状態判定・勤務時間の計算（出勤簿・賃金台帳・従業員画面・CSV出力で共通）
// 基準は管理者の出勤簿画面の判定（2026-10 に代表者の判断で統一）。
// 毎回同じ結果になるべき処理なので、画面ごとに書かず必ずここを使う。

export const DOW_KEYS = [
  "closedSun",
  "closedMon",
  "closedTue",
  "closedWed",
  "closedThu",
  "closedFri",
  "closedSat",
] as const;

// 画面によっては一部の曜日項目が省略可能な型で持っているため Partial にする
export type ClosedWeekdays = Partial<Record<(typeof DOW_KEYS)[number], boolean>>;
export type ClosedDateLike = { date: string; name?: string };

export type AttendanceLike = {
  status: string | null;
  startTime: string | null;
  endTime?: string | null;
  breakMinutes?: number | null;
};

export const STATUS_LABELS: Record<string, string> = {
  normal: "出勤",
  late: "遅刻",
  early_leave: "早退",
  absent: "欠勤",
  scheduled: "出勤予定",
  public_holiday: "公休",
  closed: "定休",
};

// "YYYY-MM-DD" の曜日（0=日）。UTC として解釈し、実行環境のタイムゾーンに左右されないようにする
export function dayOfWeek(date: string): number {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay();
}

// 指定日が休日か（定休曜日 または 会社休日・祝日の登録日）
// rates 未取得のときは休日扱いしない（従来どおり）
export function isClosedDay(
  date: string,
  rates: ClosedWeekdays | null,
  closedDates: ClosedDateLike[] = []
): boolean {
  if (!rates) return false;
  if (rates[DOW_KEYS[dayOfWeek(date)]]) return true;
  return closedDates.some((cd) => cd.date.startsWith(date.slice(0, 10)));
}

// 休日の表示名（登録された休日名、無ければ「定休」）
export function closedDayName(date: string, closedDates: ClosedDateLike[] = []): string {
  const cd = closedDates.find((c) => c.date.startsWith(date.slice(0, 10)));
  return cd?.name || "定休";
}

// その日の状態
// 1. 手動で設定した状態があればそれを優先
// 2. 休日なら「定休」
// 3. 出勤時刻があれば「出勤」（退勤時刻が無くても出勤扱い）
// 4. 過ぎた日なら「欠勤」、今日以降は「出勤予定」
export function autoStatus(
  rec: AttendanceLike | undefined,
  closed: boolean,
  isPast: boolean
): string {
  if (rec?.status) return rec.status;
  if (closed) return "closed";
  if (rec?.startTime) return "normal";
  if (isPast) return "absent";
  return "scheduled";
}

// 出勤日・勤務時間として計上する状態か（出勤・遅刻・早退）
export function isWorkingStatus(status: string | null | undefined): boolean {
  return status === "normal" || status === "late" || status === "early_leave";
}

// 出勤日として数えるか（記録が無い日は数えない）
export function isCountableDay(rec: AttendanceLike | undefined, closed: boolean): boolean {
  if (!rec) return false;
  return isWorkingStatus(autoStatus(rec, closed, true));
}

// 実働分数。出勤・退勤のどちらかが無ければ null、マイナスは 0
export function workMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  breakMinutes: number | null | undefined
): number | null {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const t = eh * 60 + em - (sh * 60 + sm) - (breakMinutes || 0);
  return t > 0 ? t : 0;
}

// 1日の実働時間の表示用文字列（小数1桁）。計算できなければ ""
export function workHoursLabel(rec: AttendanceLike | undefined): string {
  const m = workMinutes(rec?.startTime, rec?.endTime, rec?.breakMinutes);
  if (m === null) return "";
  return m > 0 ? (m / 60).toFixed(1) : "0"; // 従来表示に合わせ 0 は "0"
}
