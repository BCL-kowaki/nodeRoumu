import { describe, expect, it } from "vitest";
import { isShareLocked, isShareOpen, parseShareCreate, shareExpiresAt, shareLockUntil, shareTitle } from "./note-share";

const now = new Date("2026-10-07T00:00:00Z");

describe("parseShareCreate（共有リンクの発行の入力）", () => {
  it("有効日数（7・30・90・無期限）とパスワード（任意）を受け付ける", () => {
    expect(parseShareCreate({ path: "Projects/A/議事録/x.md", expiresInDays: 30 })).toEqual({
      ok: true,
      data: { path: "Projects/A/議事録/x.md", expiresInDays: 30, password: null },
    });
    expect(parseShareCreate({ path: "a.md", expiresInDays: null, password: " abcd1234 " })).toEqual({
      ok: true,
      data: { path: "a.md", expiresInDays: null, password: "abcd1234" },
    });
  });
  it.each([
    ["日数が選択肢にない", { path: "a.md", expiresInDays: 10 }, "有効期限は7日・30日・90日・無期限から選んでください"],
    ["パスワードが短い", { path: "a.md", expiresInDays: 7, password: "abcdefg" }, "パスワードは8〜100文字で入力してください"],
    ["パスワードが長い", { path: "a.md", expiresInDays: 7, password: "a".repeat(101) }, "パスワードは8〜100文字で入力してください"],
    ["ノートの指定が無い", { expiresInDays: 7 }, "共有するノートを選んでください"],
  ])("%s のとき、エラーを返す", (_n, body, message) => {
    expect(parseShareCreate(body)).toEqual({ ok: false, error: message });
  });
});

describe("shareExpiresAt（期限の日時）", () => {
  it("日数ぶん先。無期限は null", () => {
    expect(shareExpiresAt(7, now)).toEqual(new Date("2026-10-14T00:00:00Z"));
    expect(shareExpiresAt(null, now)).toBeNull();
  });
});

describe("isShareOpen（共有ページを見せてよいか）", () => {
  it("停止しておらず、期限内（または無期限）なら見せる", () => {
    expect(isShareOpen({ revokedAt: null, expiresAt: null }, now)).toBe(true);
    expect(isShareOpen({ revokedAt: null, expiresAt: new Date("2026-10-08T00:00:00Z") }, now)).toBe(true);
  });
  it("停止済み・期限切れは見せない", () => {
    expect(isShareOpen({ revokedAt: new Date("2026-10-01T00:00:00Z"), expiresAt: null }, now)).toBe(false);
    expect(isShareOpen({ revokedAt: null, expiresAt: new Date("2026-10-06T23:59:59Z") }, now)).toBe(false);
  });
});

describe("パスワードを続けて間違えたときのロック", () => {
  it("15分入力できなくする", () => {
    expect(shareLockUntil(now)).toEqual(new Date("2026-10-07T00:15:00Z"));
  });
  it("ロック中かどうか（時刻を過ぎたら解ける）", () => {
    expect(isShareLocked(null, now)).toBe(false);
    expect(isShareLocked(new Date("2026-10-07T00:00:01Z"), now)).toBe(true);
    expect(isShareLocked(now, now)).toBe(false);
  });
});

describe("shareTitle（共有ページの題名）", () => {
  it("最初の # 見出し。無ければファイル名", () => {
    expect(shareTitle("# キックオフ議事録\n\n本文", "Projects/A/x.md")).toBe("キックオフ議事録");
    expect(shareTitle("本文だけ", "Projects/A/2026-10-07_定例.md")).toBe("2026-10-07_定例");
  });
});
