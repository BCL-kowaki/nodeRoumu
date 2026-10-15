import { describe, expect, it } from "vitest";
import { MAX_DAILY_NOTE, handoverFrom, parseDailyNote } from "./daily-note";

describe("parseDailyNote（日報メモの入力）", () => {
  it("クライアント・日付・本文を受け取る。前後の空白は落とす", () => {
    expect(parseDailyNote({ clientId: "c1", date: "2026-10-15", body: "  見積を送付済み。返事待ち\n" })).toEqual({
      ok: true,
      data: { clientId: "c1", date: "2026-10-15", body: "見積を送付済み。返事待ち" },
    });
  });
  it("本文が空ならメモを消す（null）", () => {
    expect(parseDailyNote({ clientId: "c1", date: "2026-10-15", body: "  " })).toEqual({
      ok: true,
      data: { clientId: "c1", date: "2026-10-15", body: null },
    });
    expect(parseDailyNote({ clientId: "c1", date: "2026-10-15", body: null })).toMatchObject({ ok: true, data: { body: null } });
  });
  it.each([
    ["クライアントが無い", { date: "2026-10-15", body: "x" }, "クライアントを指定してください"],
    ["日付の形が違う", { clientId: "c1", date: "2026/10/15", body: "x" }, "日付の形式が正しくありません"],
    ["無い日付", { clientId: "c1", date: "2026-02-30", body: "x" }, "日付の形式が正しくありません"],
    ["本文が文字列でない", { clientId: "c1", date: "2026-10-15", body: 1 }, "メモの内容が正しくありません"],
    ["本文が長すぎる", { clientId: "c1", date: "2026-10-15", body: "a".repeat(MAX_DAILY_NOTE + 1) }, `メモは${MAX_DAILY_NOTE}文字以内で入力してください`],
  ])("%s ときはエラー", (_l, body, error) => {
    expect(parseDailyNote(body)).toEqual({ ok: false, error });
  });
});

describe("handoverFrom（引き継ぎとして出す期間の始まり）", () => {
  it("その日の30日前から（それより古いメモは出さない）", () => {
    expect(handoverFrom("2026-10-15")).toBe("2026-09-15");
  });
});
