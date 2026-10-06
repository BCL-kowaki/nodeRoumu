import { describe, expect, it } from "vitest";
import { homePathFor } from "./roles";

describe("homePathFor（ログイン後・ロゴから開く最初の画面）", () => {
  it("代表者のとき、業務管理の「計画・実績」を返す", () => {
    expect(homePathFor("admin")).toBe("/admin/work/plan");
  });
  it("社労士のとき、労務管理のホームを返す（業務管理は使えないため）", () => {
    expect(homePathFor("manager")).toBe("/admin");
  });
  it("従業員・不明なとき、従業員のホームを返す", () => {
    expect(homePathFor("employee")).toBe("/");
    expect(homePathFor(undefined)).toBe("/");
  });
});
