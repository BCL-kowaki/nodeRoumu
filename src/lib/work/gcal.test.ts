import { describe, expect, it } from "vitest";
import {
  mergeCalendarEvents,
  parseImportCalendar,
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

describe("parseImportCalendar（取り込むカレンダーの登録）", () => {
  it("カレンダー ID と表示名を受け取る。表示名が無ければ ID を使う", () => {
    expect(parseImportCalendar({ calendarId: " kowaki@gmail.com ", label: " 個人 " })).toEqual({
      ok: true,
      data: { calendarId: "kowaki@gmail.com", label: "個人" },
    });
    expect(parseImportCalendar({ calendarId: "abc123@group.calendar.google.com" })).toEqual({
      ok: true,
      data: { calendarId: "abc123@group.calendar.google.com", label: "abc123@group.calendar.google.com" },
    });
  });
  it.each([
    ["空", { calendarId: "" }, "カレンダー ID を入力してください"],
    ["@ が無い", { calendarId: "primary" }, "カレンダー ID の形式が正しくありません（例: name@gmail.com）"],
    ["空白を含む", { calendarId: "a b@gmail.com" }, "カレンダー ID の形式が正しくありません（例: name@gmail.com）"],
    ["表示名が長い", { calendarId: "a@gmail.com", label: "あ".repeat(41) }, "表示名は40文字以内で入力してください"],
  ])("%s ときはエラー", (_l, body, error) => {
    expect(parseImportCalendar(body)).toEqual({ ok: false, error });
  });
});

describe("expandEventToDays（取り込んだカレンダーの予定）", () => {
  it("予定名が見えない予定（空き時間だけの共有）は、指定した名前にする", () => {
    const r = expandEventToDays(
      { id: "e1", start: { dateTime: "2026-10-29T10:00:00+09:00" }, end: { dateTime: "2026-10-29T11:00:00+09:00" } },
      "2026-10-29",
      "2026-10-29",
      { untitled: "予定あり" }
    );
    expect(r[0].title).toBe("予定あり");
  });
});

describe("mergeCalendarEvents（複数のカレンダーの予定をまとめる）", () => {
  const ev = (id: string, o: Partial<{ uid: string; date: string; startTime: string | null; title: string }> = {}) => ({
    id,
    title: o.title ?? id,
    date: o.date ?? "2026-10-29",
    allDay: false,
    startTime: o.startTime === undefined ? "10:00" : o.startTime,
    endTime: "11:00",
    uid: o.uid,
  });
  it("取り込んだカレンダーの予定に表示名を付け、日付・時刻順に並べる", () => {
    const r = mergeCalendarEvents([
      { label: null, events: [ev("a", { startTime: "13:00" })] },
      { label: "個人", events: [ev("b", { startTime: "09:00" })] },
    ]);
    expect(r.map((e) => [e.id, e.calendar])).toEqual([
      ["b", "個人"],
      ["a", undefined],
    ]);
  });
  it("同じ予定（uid と日時が同じ）が複数のカレンダーにあれば、先のカレンダー（会社）のものだけ残す", () => {
    const r = mergeCalendarEvents([
      { label: null, events: [ev("a", { uid: "x@google.com" })] },
      { label: "取引先", events: [ev("b", { uid: "x@google.com" }), ev("c", { uid: "x@google.com", date: "2026-10-30" })] },
    ]);
    expect(r.map((e) => e.id)).toEqual(["a", "c"]);
  });
});
