// Google カレンダー連携の変換ルール（決まった答えになる処理なのでテストで固定）
import { addDays } from "@/lib/date-jst";

export const PLAN_CALENDAR_NAME = "業務計画";
const TZ = "Asia/Tokyo";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;

// "YYYY-MM-DD" の d 日後（月末・年末をまたいでも正しい）
const pad = (n: number) => String(n).padStart(2, "0");

// 計画の終了日時（開始 + 予定時間）。日付をまたぐ場合は翌日以降の日付と時刻になる
export function planEventEnd(date: string, startTime: string, plannedMinutes: number): { date: string; time: string } {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + plannedMinutes;
  const dayOffset = Math.floor(total / (24 * 60));
  const rest = total % (24 * 60);
  return { date: addDays(date, dayOffset), time: `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` };
}

export type PlanForCalendar = {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string | null; // "HH:MM"
  plannedMinutes: number;
  title: string;
};

export type EventBody = {
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties: { private: { nodePortalPlanId: string } };
  reminders: { useDefault: false };
};

// 計画を Google の予定に変換する。開始時刻のない計画は書き出さない（null）
export function planEventBody(plan: PlanForCalendar): EventBody | null {
  if (!plan.startTime) return null;
  const end = planEventEnd(plan.date, plan.startTime, plan.plannedMinutes);
  return {
    summary: plan.title,
    start: { dateTime: `${plan.date}T${plan.startTime}:00`, timeZone: TZ },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: TZ },
    extendedProperties: { private: { nodePortalPlanId: plan.id } },
    reminders: { useDefault: false },
  };
}

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
};

export type DayEvent = {
  id: string;
  title: string;
  date: string; // 日本時間の日付
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  htmlLink?: string;
};

// 時刻つきの日時文字列を、日本時間の { date, time } にする（UTC・他のタイムゾーンで返っても揃える）
function toJst(dateTime: string): { date: string; time: string } {
  const jst = new Date(Date.parse(dateTime) + JST_OFFSET_MS).toISOString();
  return { date: jst.slice(0, 10), time: jst.slice(11, 16) };
}

// Google の予定を、表示期間 [from, to]（日本時間の日付）の日ごとの表示用に展開する
// - 時刻つき: 開始日に入れる（日をまたぐ予定も開始日のみ）
// - 終日: 開始日〜終了日の前日まで日ごとに展開する（Google の終了日は「含まない」日付）
export function expandEventToDays(ev: GoogleCalendarEvent, from: string, to: string): DayEvent[] {
  if (ev.status === "cancelled") return [];
  const title = ev.summary?.trim() || "（タイトルなし）";

  if (ev.start.dateTime && ev.end.dateTime) {
    const s = toJst(ev.start.dateTime);
    const e = toJst(ev.end.dateTime);
    if (s.date < from || s.date > to) return [];
    return [{ id: ev.id, title, date: s.date, allDay: false, startTime: s.time, endTime: e.time, htmlLink: ev.htmlLink }];
  }

  if (ev.start.date) {
    const endExclusive = ev.end.date ?? addDays(ev.start.date, 1);
    const days: DayEvent[] = [];
    for (let d = ev.start.date; d < endExclusive; d = addDays(d, 1)) {
      if (d >= from && d <= to) days.push({ id: ev.id, title, date: d, allDay: true, startTime: null, endTime: null, htmlLink: ev.htmlLink });
    }
    return days;
  }
  return [];
}

// カレンダー API に渡す期間（日本時間の開始日 0:00 〜 終了日の翌日 0:00）
export function calendarRange(from: string, to: string): { timeMin: string; timeMax: string } {
  return { timeMin: `${from}T00:00:00+09:00`, timeMax: `${addDays(to, 1)}T00:00:00+09:00` };
}

export type UserInfo = { email?: string; email_verified?: boolean; hd?: string };

// 接続してよい Google アカウントか（Workspace の許可ドメイン・許可メールアドレスと一致）。
// ユーザー情報は Google から直接（サーバー間・TLS）受け取った値を渡す
export function checkCalendarAccount(
  cfg: { allowedDomain: string; allowedEmail: string },
  info: UserInfo
): { ok: true; email: string } | { ok: false } {
  if (info.email_verified !== true) return { ok: false };
  // hd は Workspace アカウントにだけ付く。個人の Gmail は hd が無いので弾かれる
  if (typeof info.hd !== "string" || info.hd.toLowerCase() !== cfg.allowedDomain.toLowerCase()) return { ok: false };
  const email = (info.email ?? "").toLowerCase();
  if (email !== cfg.allowedEmail.toLowerCase()) return { ok: false };
  return { ok: true, email };
}

// アクセストークン（約1時間有効）を更新する必要があるか。期限が不明・60秒以内なら更新する
export function needsRefresh(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - now.getTime() < REFRESH_MARGIN_MS;
}
