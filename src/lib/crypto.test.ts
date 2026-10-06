import { randomBytes } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./crypto";

const KEY = randomBytes(32).toString("base64");
let saved: string | undefined;
beforeEach(() => {
  saved = process.env.WORKSPACE_ENCRYPTION_KEY;
  process.env.WORKSPACE_ENCRYPTION_KEY = KEY;
});
afterEach(() => {
  if (saved === undefined) delete process.env.WORKSPACE_ENCRYPTION_KEY;
  else process.env.WORKSPACE_ENCRYPTION_KEY = saved;
});

describe("encrypt / decrypt（トークンの暗号化）", () => {
  it("暗号化したものを復号すると、元の文字列に戻る", () => {
    expect(decrypt(encrypt("1//0g-refresh-token"))).toBe("1//0g-refresh-token");
  });

  it("日本語や記号を含む文字列も元に戻る", () => {
    const text = "日本語🙂 !@#$%^&*()_+ \n 改行";
    expect(decrypt(encrypt(text))).toBe(text);
  });

  it("保存形式は v1:iv:tag:暗号文 で、平文は含まれない", () => {
    const stored = encrypt("secret-value-12345");
    expect(stored.split(":")).toHaveLength(4);
    expect(stored.startsWith("v1:")).toBe(true);
    expect(stored).not.toContain("secret-value-12345");
  });

  it("同じ文字列でも、毎回違う暗号文になる", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("暗号文が1文字でも改ざんされたとき、復号に失敗する", () => {
    const [v, iv, tag, body] = encrypt("tamper-me").split(":");
    const flipped = (body[0] === "A" ? "B" : "A") + body.slice(1);
    expect(() => decrypt([v, iv, tag, flipped].join(":"))).toThrow();
  });

  it("認証タグが書き換えられたとき、復号に失敗する", () => {
    const [v, iv, tag, body] = encrypt("tamper-me").split(":");
    const other = (tag[0] === "A" ? "B" : "A") + tag.slice(1);
    expect(() => decrypt([v, iv, other, body].join(":"))).toThrow();
  });

  it("別の鍵では復号できない", () => {
    const stored = encrypt("for-key-1");
    process.env.WORKSPACE_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    expect(() => decrypt(stored)).toThrow();
  });

  it("知らない版（v2 など）や形式の違うものは拒否する", () => {
    expect(() => decrypt("v2:a:b:c")).toThrow();
    expect(() => decrypt("not-encrypted")).toThrow();
  });
});

describe("暗号化キーの検証", () => {
  it("キーが未設定のとき、エラーにする", () => {
    delete process.env.WORKSPACE_ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/WORKSPACE_ENCRYPTION_KEY/);
  });

  it("キーが32バイトでないとき、エラーにする", () => {
    process.env.WORKSPACE_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    expect(() => encrypt("x")).toThrow(/32/);
  });
});
