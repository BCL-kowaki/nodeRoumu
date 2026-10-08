import { describe, expect, it } from "vitest";
import { CLIENT_PALETTE, assignClientColors, clientIdFor } from "./client-colors";

describe("assignClientColors（クライアントの色）", () => {
  const ids = (xs: string[]) => xs.map((id) => ({ id }));
  it("登録順に色を配り、一覧を並べ替えても色は変わらない", () => {
    const a = assignClientColors([
      { id: "z", createdAt: "2026-10-03T00:00:00Z" },
      { id: "c1", createdAt: "2026-10-01T00:00:00Z" },
      { id: "a", createdAt: "2026-10-02T00:00:00Z" },
    ]);
    expect([...a]).toEqual([
      ["c1", CLIENT_PALETTE[0]],
      ["a", CLIENT_PALETTE[1]],
      ["z", CLIENT_PALETTE[2]],
    ]);
  });
  it("作成日時が同じ（または無い）ときは ID の順", () => {
    const a = assignClientColors(ids(["c3", "c1", "c2"]));
    const b = assignClientColors(ids(["c1", "c2", "c3"]));
    expect(a.get("c1")).toBe(CLIENT_PALETTE[0]);
    expect(a.get("c2")).toBe(CLIENT_PALETTE[1]);
    expect(a.get("c3")).toBe(CLIENT_PALETTE[2]);
    expect([...a]).toEqual([...b]);
  });
  it("色の数までは同じ色にならない", () => {
    const list = CLIENT_PALETTE.map((_, i) => `c${String(i).padStart(2, "0")}`);
    expect(new Set(assignClientColors(ids(list)).values()).size).toBe(CLIENT_PALETTE.length);
  });
  it("色の数を超えたら最初の色から繰り返す", () => {
    const list = [...CLIENT_PALETTE, "x"].map((_, i) => `c${String(i).padStart(2, "0")}`);
    expect(assignClientColors(ids(list)).get(list[CLIENT_PALETTE.length])).toBe(CLIENT_PALETTE[0]);
  });
});

describe("clientIdFor（計画・実績のクライアント）", () => {
  const projects = [
    { id: "p1", clientId: "c1" },
    { id: "p2", clientId: "c2" },
  ];
  const routines = [
    { id: "r1", clientId: "c3", projectId: null },
    { id: "r2", clientId: null, projectId: "p2" },
    { id: "r3", clientId: null, projectId: null },
  ];
  it("プロジェクトのクライアントを優先する", () => {
    expect(clientIdFor({ projectId: "p1", routineId: "r1" }, projects, routines)).toBe("c1");
  });
  it("プロジェクトが無ければルーティンのクライアント、その次にルーティンのプロジェクトのクライアント", () => {
    expect(clientIdFor({ projectId: null, routineId: "r1" }, projects, routines)).toBe("c3");
    expect(clientIdFor({ projectId: null, routineId: "r2" }, projects, routines)).toBe("c2");
  });
  it("どれにも当たらなければ null", () => {
    expect(clientIdFor({ projectId: null, routineId: "r3" }, projects, routines)).toBeNull();
    expect(clientIdFor({ projectId: null }, projects, routines)).toBeNull();
    expect(clientIdFor({ projectId: "unknown" }, projects, routines)).toBeNull();
  });
});
