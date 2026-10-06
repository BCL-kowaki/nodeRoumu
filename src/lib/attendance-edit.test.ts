import { describe, expect, it } from "vitest";
import { diffAttendance, parseAttendancePatch } from "./attendance-edit";

describe("parseAttendancePatch（AI からの出勤簿の修正の入力チェック）", () => {
  it("送られた項目だけを返す。空文字・null は「消す」（自動に戻す）", () => {
    expect(parseAttendancePatch({ startTime: "09:00", endTime: "18:30", breakMinutes: 60 })).toEqual({
      ok: true,
      data: { startTime: "09:00", endTime: "18:30", breakMinutes: 60 },
    });
    expect(parseAttendancePatch({ status: null, memo: "" })).toEqual({ ok: true, data: { status: null, memo: null } });
    expect(parseAttendancePatch({ status: "late", memo: " 電車遅延 " })).toEqual({ ok: true, data: { status: "late", memo: "電車遅延" } });
  });
  it.each([
    ["何も無い", {}, "変更する内容がありません"],
    ["時刻の形が違う", { startTime: "9:00" }, "出勤時刻は HH:MM（00:00〜23:59）で指定してください"],
    ["時刻が範囲外", { endTime: "24:10" }, "退勤時刻は HH:MM（00:00〜23:59）で指定してください"],
    ["休憩がマイナス", { breakMinutes: -5 }, "休憩は0〜600分で指定してください"],
    ["休憩が大きすぎる", { breakMinutes: 601 }, "休憩は0〜600分で指定してください"],
    ["休憩が小数", { breakMinutes: 30.5 }, "休憩は0〜600分で指定してください"],
    ["状態が不正", { status: "vacation" }, "状態の値が正しくありません"],
    ["備考が長すぎる", { memo: "あ".repeat(501) }, "備考は500文字以内で指定してください"],
  ])("%s のとき、エラーを返す", (_n, body, message) => {
    expect(parseAttendancePatch(body)).toEqual({ ok: false, error: message });
  });
});

describe("diffAttendance（変更前と変更後の差分）", () => {
  it("変わった項目だけを [変更前, 変更後] で返す", () => {
    const before = { startTime: "09:00", endTime: null, breakMinutes: 60, status: null, memo: null };
    expect(diffAttendance(before, { startTime: "09:00", endTime: "18:00", breakMinutes: 45 })).toEqual({
      endTime: [null, "18:00"],
      breakMinutes: [60, 45],
    });
  });
  it("記録が無かった日は、すべて変更前 null として扱う", () => {
    expect(diffAttendance(null, { startTime: "10:00" })).toEqual({ startTime: [null, "10:00"] });
  });
  it("何も変わらないときは空", () => {
    expect(diffAttendance({ startTime: "09:00", endTime: null, breakMinutes: null, status: null, memo: null }, { startTime: "09:00" })).toEqual({});
  });
});
