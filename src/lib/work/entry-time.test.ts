import { describe, expect, it } from "vitest";
import { entryRangeFromTimes, toJstTime } from "./entry-time";

describe("entryRangeFromTimes（実績の開始・終了時刻 → 記録する日時と分数）", () => {
  it("日本時間の時刻を、開始・終了の日時と分数にする", () => {
    expect(entryRangeFromTimes("2026-10-07", "09:15", "10:45")).toEqual({
      ok: true,
      startedAt: new Date("2026-10-07T00:15:00Z"),
      endedAt: new Date("2026-10-07T01:45:00Z"),
      minutes: 90,
    });
  });
  it("日付の境目（0:00）も日本時間で扱う", () => {
    expect(entryRangeFromTimes("2026-10-07", "00:00", "00:30")).toMatchObject({
      startedAt: new Date("2026-10-06T15:00:00Z"),
      minutes: 30,
    });
  });
  it("終了が開始と同じか前のとき、エラーを返す", () => {
    expect(entryRangeFromTimes("2026-10-07", "10:00", "10:00")).toEqual({ ok: false, error: "終了時刻は開始時刻より後にしてください" });
    expect(entryRangeFromTimes("2026-10-07", "10:00", "09:00")).toEqual({ ok: false, error: "終了時刻は開始時刻より後にしてください" });
  });
});

describe("toJstTime（記録された日時 → 日本時間の HH:MM）", () => {
  it("UTC の日時を日本時間の時刻にする", () => {
    expect(toJstTime("2026-10-07T00:15:00Z")).toBe("09:15");
    expect(toJstTime("2026-10-06T15:00:00Z")).toBe("00:00");
  });
});
