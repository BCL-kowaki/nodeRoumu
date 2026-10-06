import { describe, expect, it } from "vitest";
import {
  PLAN_CALENDAR_NAME,
  calendarRange,
  checkCalendarAccount,
  expandEventToDays,
  needsRefresh,
  planEventBody,
  planEventEnd,
  type GoogleCalendarEvent,
} from "./gcal";

describe("planEventEnd（計画の終了日時）", () => {
  it("開始時刻に予定時間を足す", () => {
    expect(planEventEnd("2026-10-06", "10:00", 90)).toEqual({ date: "2026-10-06", time: "11:30" });
  });
  it("日付をまたぐとき、翌日の時刻にする", () => {
    expect(planEventEnd("2026-10-06", "23:00", 120)).toEqual({ date: "2026-10-07", time: "01:00" });
  });
  it("月末をまたぐ", () => {
    expect(planEventEnd("2026-10-31", "23:30", 60)).toEqual({ date: "2026-11-01", time: "00:30" });
  });
  it("ちょうど24時に終わるとき、翌日の0時にする", () => {
    expect(planEventEnd("2026-10-06", "22:00", 120)).toEqual({ date: "2026-10-07", time: "00:00" });
  });
});

describe("planEventBody（計画を Google の予定に変換）", () => {
  const plan = { id: "plan-1", date: "2026-10-06", startTime: "10:00", plannedMinutes: 90, title: "見積作成" };

  it("開始・終了を日本時間で、計画IDを非公開の属性に入れる", () => {
    expect(planEventBody(plan)).toEqual({
      summary: "見積作成",
      start: { dateTime: "2026-10-06T10:00:00", timeZone: "Asia/Tokyo" },
      end: { dateTime: "2026-10-06T11:30:00", timeZone: "Asia/Tokyo" },
      extendedProperties: { private: { nodePortalPlanId: "plan-1" } },
      reminders: { useDefault: false },
    });
  });
  it("日付をまたぐ計画は、終了を翌日にする", () => {
    const body = planEventBody({ ...plan, startTime: "23:00", plannedMinutes: 120 });
    expect(body?.end.dateTime).toBe("2026-10-07T01:00:00");
  });
  it("開始時刻がない計画は、書き出さない（null）", () => {
    expect(planEventBody({ ...plan, startTime: null })).toBeNull();
  });
});

describe("expandEventToDays（Google の予定を日ごとの表示用に展開）", () => {
  const base = { id: "e1", htmlLink: "https://calendar.google.com/e1" };

  it("時刻つきの予定は、開始日に「HH:MM〜HH:MM」で入る（日本時間に直す）", () => {
    const ev: GoogleCalendarEvent = { ...base, summary: "打ち合わせ", start: { dateTime: "2026-10-06T10:00:00+09:00" }, end: { dateTime: "2026-10-06T11:00:00+09:00" } };
    expect(expandEventToDays(ev, "2026-10-01", "2026-10-31")).toEqual([
      { id: "e1", title: "打ち合わせ", date: "2026-10-06", allDay: false, startTime: "10:00", endTime: "11:00", htmlLink: base.htmlLink },
    ]);
  });
  it("別のタイムゾーン（UTC）で返ってきても、日本時間の日付・時刻にする", () => {
    const ev: GoogleCalendarEvent = { ...base, summary: "朝会", start: { dateTime: "2026-10-05T23:30:00Z" }, end: { dateTime: "2026-10-06T00:00:00Z" } };
    const [d] = expandEventToDays(ev, "2026-10-01", "2026-10-31");
    expect(d).toMatchObject({ date: "2026-10-06", startTime: "08:30", endTime: "09:00" });
  });
  it("終日の予定は allDay で、時刻なし", () => {
    const ev: GoogleCalendarEvent = { ...base, summary: "祝日", start: { date: "2026-11-03" }, end: { date: "2026-11-04" } };
    expect(expandEventToDays(ev, "2026-11-01", "2026-11-30")).toEqual([
      { id: "e1", title: "祝日", date: "2026-11-03", allDay: true, startTime: null, endTime: null, htmlLink: base.htmlLink },
    ]);
  });
  it("複数日の終日予定は、日ごとに展開する（終了日は含まない）", () => {
    const ev: GoogleCalendarEvent = { ...base, summary: "出張", start: { date: "2026-10-06" }, end: { date: "2026-10-09" } };
    expect(expandEventToDays(ev, "2026-10-01", "2026-10-31").map((d) => d.date)).toEqual(["2026-10-06", "2026-10-07", "2026-10-08"]);
  });
  it("表示期間の外の日は、展開しない", () => {
    const ev: GoogleCalendarEvent = { ...base, summary: "出張", start: { date: "2026-10-06" }, end: { date: "2026-10-09" } };
    expect(expandEventToDays(ev, "2026-10-07", "2026-10-07").map((d) => d.date)).toEqual(["2026-10-07"]);
  });
  it("タイトルがないとき、「（タイトルなし）」にする", () => {
    const ev: GoogleCalendarEvent = { ...base, start: { dateTime: "2026-10-06T10:00:00+09:00" }, end: { dateTime: "2026-10-06T11:00:00+09:00" } };
    expect(expandEventToDays(ev, "2026-10-06", "2026-10-06")[0].title).toBe("（タイトルなし）");
  });
  it("キャンセル済みの予定は、表示しない", () => {
    const ev: GoogleCalendarEvent = { ...base, status: "cancelled", start: { date: "2026-10-06" }, end: { date: "2026-10-07" } };
    expect(expandEventToDays(ev, "2026-10-01", "2026-10-31")).toEqual([]);
  });
});

describe("calendarRange（API に渡す期間）", () => {
  it("日本時間の開始日 0:00〜終了日の翌日 0:00 を指定する", () => {
    expect(calendarRange("2026-10-05", "2026-10-11")).toEqual({
      timeMin: "2026-10-05T00:00:00+09:00",
      timeMax: "2026-10-12T00:00:00+09:00",
    });
  });
});

describe("checkCalendarAccount（接続してよい Google アカウントか）", () => {
  const cfg = { allowedDomain: "node-llc.com", allowedEmail: "boss@node-llc.com" };
  it("許可されたアカウントのとき、ok", () => {
    expect(checkCalendarAccount(cfg, { email: "Boss@node-llc.com", email_verified: true, hd: "node-llc.com" })).toEqual({ ok: true, email: "boss@node-llc.com" });
  });
  it.each([
    ["メール未確認", { email: "boss@node-llc.com", email_verified: false, hd: "node-llc.com" }],
    ["個人の Gmail（hd なし）", { email: "boss@gmail.com", email_verified: true }],
    ["別ドメイン", { email: "boss@evil.com", email_verified: true, hd: "evil.com" }],
    ["同じドメインの別人", { email: "staff@node-llc.com", email_verified: true, hd: "node-llc.com" }],
  ])("%s のとき、拒否", (_n, info) => {
    expect(checkCalendarAccount(cfg, info as never).ok).toBe(false);
  });
});

describe("needsRefresh（アクセストークンの期限）", () => {
  const now = new Date("2026-10-06T03:00:00Z");
  it("期限まで60秒以上あるとき、更新しない", () => {
    expect(needsRefresh(new Date("2026-10-06T03:02:00Z"), now)).toBe(false);
  });
  it("期限まで60秒未満・切れているとき、更新する", () => {
    expect(needsRefresh(new Date("2026-10-06T03:00:30Z"), now)).toBe(true);
    expect(needsRefresh(new Date("2026-10-06T02:00:00Z"), now)).toBe(true);
  });
  it("期限が不明なとき、更新する", () => {
    expect(needsRefresh(null, now)).toBe(true);
  });
});

describe("定数", () => {
  it("専用カレンダーの名前", () => {
    expect(PLAN_CALENDAR_NAME).toBe("業務計画");
  });
});
