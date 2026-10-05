import { describe, expect, it } from "vitest";
import { addDays, jstDateToDb, todayJst, toJstDateStr } from "./date-jst";

describe("toJstDateStr / todayJst", () => {
  it("UTC 14:59 は日本時間の同日 23:59", () => {
    expect(toJstDateStr(new Date("2026-10-05T14:59:59Z"))).toBe("2026-10-05");
  });
  it("UTC 15:00 は日本時間の翌日 0:00（UTC基準だと前日になる問題の確認）", () => {
    const d = new Date("2026-10-05T15:00:00Z");
    expect(d.toISOString().slice(0, 10)).toBe("2026-10-05"); // 従来の todayStr はこうなる
    expect(toJstDateStr(d)).toBe("2026-10-06");
  });
  it("日本時間の早朝（UTC 前日 23:30）も当日になる", () => {
    expect(todayJst(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("jstDateToDb", () => {
  it("UTC 0 時の Date になる（@db.Date と同じ扱い）", () => {
    expect(jstDateToDb("2026-10-05").toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("形式違い・存在しない日付はエラー", () => {
    expect(() => jstDateToDb("2026/10/05")).toThrow();
    expect(() => jstDateToDb("2026-02-30")).toThrow();
    expect(() => jstDateToDb("2027-02-29")).toThrow(); // うるう年ではない
  });
  it("うるう日は有効", () => {
    expect(jstDateToDb("2028-02-29").toISOString().slice(0, 10)).toBe("2028-02-29");
  });
});

describe("addDays", () => {
  it("月末・年末・うるう年をまたぐ", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
