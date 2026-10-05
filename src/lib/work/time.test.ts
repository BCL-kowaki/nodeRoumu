import { describe, expect, it } from "vitest";
import {
  attendanceMinutesFor,
  elapsedMinutes,
  entryMinutes,
  formatElapsed,
  isLongRunning,
  summarizeDay,
} from "./time";

const now = new Date("2026-10-06T03:00:00Z"); // 日本時間 12:00

describe("elapsedMinutes（経過分数）", () => {
  it("開始から終了までを分単位（切り捨て）で返す", () => {
    expect(elapsedMinutes("2026-10-06T01:00:00Z", "2026-10-06T01:30:59Z", now)).toBe(30);
  });
  it("終了が無い（計測中）のとき、現在時刻までを返す", () => {
    expect(elapsedMinutes("2026-10-06T02:15:00Z", null, now)).toBe(45);
  });
  it("終了が開始より前のとき、0 を返す", () => {
    expect(elapsedMinutes("2026-10-06T02:00:00Z", "2026-10-06T01:00:00Z", now)).toBe(0);
  });
});

describe("entryMinutes（実績1件の分数）", () => {
  it("手入力のとき、入力した分数を返す", () => {
    expect(entryMinutes({ minutes: 50, startedAt: null, endedAt: null }, now)).toBe(50);
  });
  it("停止済みのタイマーのとき、保存した分数を返す", () => {
    expect(entryMinutes({ minutes: 20, startedAt: "2026-10-06T01:00:00Z", endedAt: "2026-10-06T01:20:00Z" }, now)).toBe(20);
  });
  it("計測中のタイマーのとき、現在時刻までの分数を返す", () => {
    expect(entryMinutes({ minutes: null, startedAt: "2026-10-06T02:30:00Z", endedAt: null }, now)).toBe(30);
  });
});

describe("attendanceMinutesFor（出勤簿の勤務分数）", () => {
  it("出勤日で退勤まで記録があるとき、休憩を引いた分数を返す", () => {
    expect(attendanceMinutesFor({ status: null, startTime: "09:00", endTime: "18:00", breakMinutes: 60 }, false)).toBe(480);
  });
  it("記録が無いとき、null（出勤簿なし）を返す", () => {
    expect(attendanceMinutesFor(undefined, false)).toBeNull();
  });
  it("退勤が無いとき、null を返す（勤務中・押し忘れ）", () => {
    expect(attendanceMinutesFor({ status: null, startTime: "09:00", endTime: null, breakMinutes: 0 }, false)).toBeNull();
  });
  it("欠勤・休日扱いの日は、時刻が残っていても null を返す", () => {
    expect(attendanceMinutesFor({ status: "absent", startTime: "09:00", endTime: "18:00", breakMinutes: 0 }, false)).toBeNull();
    expect(attendanceMinutesFor({ status: null, startTime: "09:00", endTime: "12:00", breakMinutes: 0 }, true)).toBeNull();
  });
});

describe("summarizeDay（1日の集計）", () => {
  it("計画・実績・出勤簿・未記録を返す", () => {
    const r = summarizeDay({
      plans: [{ plannedMinutes: 120 }, { plannedMinutes: 90 }],
      entries: [
        { minutes: 60, startedAt: null, endedAt: null },
        { minutes: null, startedAt: "2026-10-06T02:30:00Z", endedAt: null }, // 計測中 30分
      ],
      attendanceMinutes: 480,
      now,
    });
    expect(r).toEqual({ plannedMin: 210, actualMin: 90, attendanceMin: 480, unrecordedMin: 390 });
  });
  it("出勤簿が無いとき、出勤簿と未記録は null", () => {
    const r = summarizeDay({ plans: [], entries: [{ minutes: 30, startedAt: null, endedAt: null }], attendanceMinutes: null, now });
    expect(r).toEqual({ plannedMin: 0, actualMin: 30, attendanceMin: null, unrecordedMin: null });
  });
  it("実績が勤務時間を超えるとき、未記録は 0（マイナスにしない）", () => {
    const r = summarizeDay({ plans: [], entries: [{ minutes: 600, startedAt: null, endedAt: null }], attendanceMinutes: 480, now });
    expect(r.unrecordedMin).toBe(0);
  });
});

describe("isLongRunning / formatElapsed（タイマー表示）", () => {
  it("12時間を超えて計測中のとき、止め忘れとして true", () => {
    expect(isLongRunning("2026-10-05T15:00:00Z", now)).toBe(false); // ちょうど12時間
    expect(isLongRunning("2026-10-05T14:59:00Z", now)).toBe(true);
  });
  it.each([
    [0, "0:00:00"],
    [59, "0:00:59"],
    [3661, "1:01:01"],
    [36000, "10:00:00"],
  ])("%s 秒のとき「%s」", (sec, text) => {
    expect(formatElapsed(sec)).toBe(text);
  });
});
