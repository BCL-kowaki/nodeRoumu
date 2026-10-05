import { describe, expect, it } from "vitest";
import { dueLabel, formatMinutes } from "./labels";

describe("dueLabel（期限の表示）", () => {
  const today = "2026-10-05";

  it("期限が無いとき、null を返す", () => {
    expect(dueLabel(null, today, false)).toBeNull();
  });
  it("期限を過ぎているとき、「◯日超過」を危険色で返す", () => {
    expect(dueLabel("2026-10-03T00:00:00.000Z", today, false)).toEqual({ text: "2日超過", tone: "danger" });
  });
  it("期限が今日のとき、「今日まで」を注意色で返す", () => {
    expect(dueLabel("2026-10-05", today, false)).toEqual({ text: "今日まで", tone: "accent" });
  });
  it("期限が明日のとき、「明日まで」を注意色で返す", () => {
    expect(dueLabel("2026-10-06", today, false)).toEqual({ text: "明日まで", tone: "accent" });
  });
  it("期限が先のとき、月/日を通常色で返す", () => {
    expect(dueLabel("2026-11-20", today, false)).toEqual({ text: "11/20まで", tone: "default" });
  });
  it("完了済みのとき、期限を過ぎていても超過表示にしない", () => {
    expect(dueLabel("2026-10-01", today, true)).toEqual({ text: "10/1まで", tone: "default" });
  });
  it("月をまたいだ超過日数も正しく数える", () => {
    expect(dueLabel("2026-09-30", "2026-10-02", false)).toEqual({ text: "2日超過", tone: "danger" });
  });
});

describe("formatMinutes（予定時間の表示）", () => {
  it.each([
    [null, ""],
    [0, "0分"],
    [45, "45分"],
    [60, "1時間"],
    [90, "1時間30分"],
  ] as const)("%s 分のとき、「%s」を返す", (m, text) => {
    expect(formatMinutes(m)).toBe(text);
  });
});
