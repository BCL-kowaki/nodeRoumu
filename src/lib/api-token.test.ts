import { describe, expect, it } from "vitest";
import { TOKEN_PREFIX, generateToken, hashToken, isTokenUsable, parseBearer, parseTokenCreateInput } from "./api-token";

describe("generateToken / hashToken（AI 連携用の鍵）", () => {
  it("決まった接頭辞つきの十分に長い鍵を、毎回ちがう値で作る", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(TOKEN_PREFIX.length + 40);
    expect(a).not.toBe(b);
  });
  it("保存用の値は、同じ鍵なら同じ・元の鍵は含まない", () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t.slice(TOKEN_PREFIX.length));
  });
});

describe("parseBearer（Authorization ヘッダーから鍵を取り出す）", () => {
  it("Bearer の後ろの鍵を返す", () => {
    expect(parseBearer("Bearer npk_abc")).toBe("npk_abc");
    expect(parseBearer("bearer  npk_abc ")).toBe("npk_abc");
  });
  it("形式が違う・接頭辞が違うときは null", () => {
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Basic xxx")).toBeNull();
    expect(parseBearer("Bearer other_abc")).toBeNull();
  });
});

describe("isTokenUsable（鍵が使える状態か）", () => {
  const now = new Date("2026-10-06T00:00:00Z");
  it("取り消されておらず、期限内なら使える", () => {
    expect(isTokenUsable({ revokedAt: null, expiresAt: new Date("2026-11-01T00:00:00Z") }, now)).toBe(true);
  });
  it("取り消し済み・期限切れは使えない", () => {
    expect(isTokenUsable({ revokedAt: new Date("2026-10-01T00:00:00Z"), expiresAt: new Date("2026-11-01T00:00:00Z") }, now)).toBe(false);
    expect(isTokenUsable({ revokedAt: null, expiresAt: new Date("2026-10-05T23:59:59Z") }, now)).toBe(false);
  });
});

describe("parseTokenCreateInput（鍵の発行の入力）", () => {
  it("名前・範囲・有効日数を受け付ける。出勤簿は指定がなければ扱わない", () => {
    expect(parseTokenCreateInput({ name: " Claude Code（MacBook） ", scope: "write", expiresInDays: 90 })).toEqual({
      ok: true,
      data: { name: "Claude Code（MacBook）", scope: "write", expiresInDays: 90, attendance: false },
    });
  });
  it("出勤簿も扱う指定を受け付ける", () => {
    expect(parseTokenCreateInput({ name: "a", scope: "read", expiresInDays: 30, attendance: true })).toMatchObject({
      ok: true,
      data: { attendance: true },
    });
  });
  it.each([
    ["名前が無い", { name: " ", scope: "read", expiresInDays: 30 }, "鍵の名前を入力してください"],
    ["名前が長すぎる", { name: "a".repeat(51), scope: "read", expiresInDays: 30 }, "鍵の名前は50文字以内で入力してください"],
    ["範囲が不正", { name: "a", scope: "admin", expiresInDays: 30 }, "操作の範囲の指定が正しくありません"],
    ["有効日数が選択肢にない", { name: "a", scope: "read", expiresInDays: 9999 }, "有効期限は30日・90日・365日から選んでください"],
    ["出勤簿の指定が真偽でない", { name: "a", scope: "read", expiresInDays: 30, attendance: "yes" }, "出勤簿を扱うかの指定が正しくありません"],
  ])("%s のとき、エラーを返す", (_n, body, message) => {
    expect(parseTokenCreateInput(body)).toEqual({ ok: false, error: message });
  });
});
