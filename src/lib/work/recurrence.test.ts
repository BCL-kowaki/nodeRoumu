import { describe, expect, it } from "vitest";
import { WEEKDAY_BITS, isRoutineDue, lastDayOfMonth, recurrenceLabel, type RecurrenceRule } from "./recurrence";

// 2026-10: 1日=木, 5日=月, 31日=土
const base: RecurrenceRule = {
  frequency: "daily",
  weekdays: 0,
  monthDay: null,
  skipClosedDays: false,
  active: true,
  startDate: "2026-10-01",
  endDate: null,
};

describe("lastDayOfMonth", () => {
  it.each([
    ["2026-10-15", 31],
    ["2026-11-01", 30],
    ["2026-02-10", 28],
    ["2028-02-10", 29], // うるう年
  ])("%s の月末は %s 日", (date, last) => {
    expect(lastDayOfMonth(date)).toBe(last);
  });
});

describe("isRoutineDue（その日が実施日か）", () => {
  it("毎日のとき、開始日以降はすべて実施日", () => {
    expect(isRoutineDue(base, "2026-10-01", false)).toBe(true);
    expect(isRoutineDue(base, "2026-10-31", false)).toBe(true);
  });

  it("開始日より前・終了日より後のとき、実施日ではない", () => {
    const r = { ...base, endDate: "2026-10-10" };
    expect(isRoutineDue(r, "2026-09-30", false)).toBe(false);
    expect(isRoutineDue(r, "2026-10-10", false)).toBe(true);
    expect(isRoutineDue(r, "2026-10-11", false)).toBe(false);
  });

  it("停止中のとき、実施日ではない", () => {
    expect(isRoutineDue({ ...base, active: false }, "2026-10-05", false)).toBe(false);
  });

  it("毎週（月・木）のとき、その曜日だけ実施日", () => {
    const r = { ...base, frequency: "weekly" as const, weekdays: WEEKDAY_BITS[1] | WEEKDAY_BITS[4] };
    expect(isRoutineDue(r, "2026-10-01", false)).toBe(true); // 木
    expect(isRoutineDue(r, "2026-10-02", false)).toBe(false); // 金
    expect(isRoutineDue(r, "2026-10-05", false)).toBe(true); // 月
    expect(isRoutineDue(r, "2026-10-04", false)).toBe(false); // 日
  });

  it("毎月15日のとき、15日だけ実施日", () => {
    const r = { ...base, frequency: "monthly" as const, monthDay: 15 };
    expect(isRoutineDue(r, "2026-10-15", false)).toBe(true);
    expect(isRoutineDue(r, "2026-10-14", false)).toBe(false);
    expect(isRoutineDue(r, "2026-11-15", false)).toBe(true);
  });

  it("毎月31日のとき、30日までの月はその月の最終日に寄せる", () => {
    const r = { ...base, frequency: "monthly" as const, monthDay: 31 };
    expect(isRoutineDue(r, "2026-10-31", false)).toBe(true);
    expect(isRoutineDue(r, "2026-11-30", false)).toBe(true);
    expect(isRoutineDue(r, "2026-11-29", false)).toBe(false);
    expect(isRoutineDue({ ...r, startDate: "2026-01-01" }, "2026-02-28", false)).toBe(true);
  });

  it("毎月「月末」（-1）のとき、うるう年の2月は29日", () => {
    const r = { ...base, frequency: "monthly" as const, monthDay: -1, startDate: "2028-01-01" };
    expect(isRoutineDue(r, "2028-02-29", false)).toBe(true);
    expect(isRoutineDue(r, "2028-02-28", false)).toBe(false);
  });

  it("休日を除く設定のとき、休日は実施日にしない", () => {
    const r = { ...base, skipClosedDays: true };
    expect(isRoutineDue(r, "2026-10-03", true)).toBe(false);
    expect(isRoutineDue(r, "2026-10-05", false)).toBe(true);
  });

  it("休日を除かない設定のとき、休日も実施日", () => {
    expect(isRoutineDue(base, "2026-10-03", true)).toBe(true);
  });

  it("日時つきの文字列（ISO形式）でも日付として判定する", () => {
    expect(isRoutineDue({ ...base, startDate: "2026-10-05T00:00:00.000Z" }, "2026-10-05", false)).toBe(true);
  });
});

describe("recurrenceLabel（繰り返しの表示）", () => {
  it.each([
    [{ ...base }, "毎日"],
    [{ ...base, skipClosedDays: true }, "毎日（休日を除く）"],
    [{ ...base, frequency: "weekly" as const, weekdays: WEEKDAY_BITS[1] | WEEKDAY_BITS[3] | WEEKDAY_BITS[5] }, "毎週 月・水・金"],
    [{ ...base, frequency: "monthly" as const, monthDay: 25 }, "毎月25日"],
    [{ ...base, frequency: "monthly" as const, monthDay: -1 }, "毎月末"],
  ])("%o のとき「%s」", (rule, label) => {
    expect(recurrenceLabel(rule)).toBe(label);
  });
});
