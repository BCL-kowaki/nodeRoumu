import { describe, expect, it } from "vitest";
import {
  autoStatus,
  closedDayName,
  dayOfWeek,
  isClosedDay,
  isCountableDay,
  isWorkingStatus,
  workHoursLabel,
  workMinutes,
  type ClosedWeekdays,
} from "./attendance-status";

// 土日定休
const rates: ClosedWeekdays = {
  closedSun: true,
  closedMon: false,
  closedTue: false,
  closedWed: false,
  closedThu: false,
  closedFri: false,
  closedSat: true,
};
const closedDates = [{ date: "2026-11-03T00:00:00.000Z", name: "文化の日" }];

describe("dayOfWeek / isClosedDay", () => {
  it("曜日はタイムゾーンに関係なく日付どおり", () => {
    expect(dayOfWeek("2026-10-04")).toBe(0); // 日
    expect(dayOfWeek("2026-10-05")).toBe(1); // 月
    expect(dayOfWeek("2026-10-10T00:00:00.000Z")).toBe(6); // 土（ISO形式でも可）
  });
  it("定休曜日・登録休日・平日", () => {
    expect(isClosedDay("2026-10-04", rates, closedDates)).toBe(true);
    expect(isClosedDay("2026-11-03", rates, closedDates)).toBe(true);
    expect(isClosedDay("2026-10-05", rates, closedDates)).toBe(false);
  });
  it("料率（定休設定）が未取得なら休日扱いしない", () => {
    expect(isClosedDay("2026-10-04", null, closedDates)).toBe(false);
  });
  it("休日名", () => {
    expect(closedDayName("2026-11-03", closedDates)).toBe("文化の日");
    expect(closedDayName("2026-10-04", closedDates)).toBe("定休");
  });
});

describe("autoStatus（出勤簿の判定）", () => {
  it.each([
    ["手動の状態が最優先（休日でも）", { status: "late", startTime: null }, true, true, "late"],
    ["休日で手動設定なし", { status: null, startTime: "09:00" }, true, true, "closed"],
    ["出勤時刻あり", { status: null, startTime: "09:00" }, false, true, "normal"],
    ["出勤時刻のみ・退勤なしでも出勤", { status: null, startTime: "09:00", endTime: null }, false, true, "normal"],
    ["記録なしの過去日は欠勤", undefined, false, true, "absent"],
    ["記録なしの今日以降は出勤予定", undefined, false, false, "scheduled"],
  ] as const)("%s", (_name, rec, closed, isPast, expected) => {
    expect(autoStatus(rec, closed, isPast)).toBe(expected);
  });
});

describe("isWorkingStatus / isCountableDay（出勤日数）", () => {
  it("出勤・遅刻・早退だけが勤務扱い", () => {
    for (const s of ["normal", "late", "early_leave"]) expect(isWorkingStatus(s)).toBe(true);
    for (const s of ["absent", "public_holiday", "closed", "scheduled", null, undefined]) {
      expect(isWorkingStatus(s)).toBe(false);
    }
  });
  it("記録が無い日は数えない", () => {
    expect(isCountableDay(undefined, false)).toBe(false);
  });
  it("出勤時刻のみ（退勤なし）でも出勤日として数える ※賃金台帳の旧判定から変更", () => {
    expect(isCountableDay({ status: null, startTime: "09:00", endTime: null }, false)).toBe(true);
  });
  it("休日の打刻は手動で勤務状態にしない限り数えない", () => {
    expect(isCountableDay({ status: null, startTime: "09:00", endTime: "12:00" }, true)).toBe(false);
    expect(isCountableDay({ status: "normal", startTime: "09:00", endTime: "12:00" }, true)).toBe(true);
  });
  it("欠勤・公休にした日は時刻があっても数えない", () => {
    expect(isCountableDay({ status: "absent", startTime: "09:00", endTime: "12:00" }, false)).toBe(false);
    expect(isCountableDay({ status: "public_holiday", startTime: "09:00" }, false)).toBe(false);
  });
});

describe("workMinutes / workHoursLabel（実働時間）", () => {
  it("休憩を引いた分数", () => {
    expect(workMinutes("09:00", "18:00", 60)).toBe(480);
    expect(workMinutes("09:00", "11:00", null)).toBe(120);
  });
  it("出勤・退勤が欠けていれば null", () => {
    expect(workMinutes("09:00", null, 0)).toBeNull();
    expect(workMinutes(null, "18:00", 0)).toBeNull();
  });
  it("マイナスは 0", () => {
    expect(workMinutes("11:30", "11:00", 0)).toBe(0);
  });
  it("表示は小数1桁、0 は従来どおり \"0\"、計算不可は空", () => {
    expect(workHoursLabel({ status: null, startTime: "09:00", endTime: "10:20", breakMinutes: 0 })).toBe("1.3");
    expect(workHoursLabel({ status: null, startTime: "11:30", endTime: "11:00", breakMinutes: 0 })).toBe("0");
    expect(workHoursLabel({ status: null, startTime: "09:00", endTime: null })).toBe("");
    expect(workHoursLabel(undefined)).toBe("");
  });
});
