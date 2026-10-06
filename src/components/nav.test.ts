import { describe, expect, it } from "vitest";
import { sidebarGroups } from "./nav";

describe("sidebarGroups（サイドバーの並び）", () => {
  it("代表者のとき、業務管理 → 労務管理 → 設定 の順で、業務管理の先頭は「計画・実績」", () => {
    const groups = sidebarGroups("admin");
    expect(groups.map((g) => g.title)).toEqual(["業務管理", "労務管理", "設定"]);
    expect(groups[0].items[0].href).toBe("/admin/work/plan");
  });
  it("社労士のとき、業務管理は出さない", () => {
    expect(sidebarGroups("manager").map((g) => g.title)).toEqual(["労務管理", "設定"]);
  });
});
