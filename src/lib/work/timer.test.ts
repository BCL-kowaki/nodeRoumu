import { describe, expect, it } from "vitest";
import { findSameTarget } from "./timer";

const e = (id: string, l: { taskId?: string; routineId?: string; planId?: string; projectId?: string }) => ({
  id,
  taskId: l.taskId ?? null,
  routineId: l.routineId ?? null,
  planId: l.planId ?? null,
  projectId: l.projectId ?? null,
});

describe("findSameTarget（同じ対象のタイマーがすでに計測中か）", () => {
  const running = [e("a", { taskId: "t1", projectId: "p1" }), e("b", { routineId: "r1" }), e("c", { planId: "pl1", taskId: "t9" })];
  it("同じタスク・ルーティン・計画なら、その計測中のタイマーを返す", () => {
    expect(findSameTarget(running, { taskId: "t1" })?.id).toBe("a");
    expect(findSameTarget(running, { routineId: "r1" })?.id).toBe("b");
    expect(findSameTarget(running, { planId: "pl1" })?.id).toBe("c");
  });
  it("違う対象なら null（並行して計測できる）", () => {
    expect(findSameTarget(running, { taskId: "t2" })).toBeNull();
    expect(findSameTarget(running, { routineId: "r2" })).toBeNull();
  });
  it("プロジェクトだけ・何も指定なしのときは、重複とみなさない", () => {
    expect(findSameTarget(running, { projectId: "p1" })).toBeNull();
    expect(findSameTarget(running, {})).toBeNull();
  });
});
