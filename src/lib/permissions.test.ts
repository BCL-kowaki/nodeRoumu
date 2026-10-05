import { describe, expect, it } from "vitest";
import { canUseWorkspace } from "./permissions";

describe("canUseWorkspace（業務管理を使えるか）", () => {
  it("代表者のとき、使える", () => {
    expect(canUseWorkspace("admin")).toBe(true);
  });
  it.each(["manager", "employee", undefined, ""])("代表者以外（%s）のとき、使えない", (role) => {
    expect(canUseWorkspace(role)).toBe(false);
  });
});
