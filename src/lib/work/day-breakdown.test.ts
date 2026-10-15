import { describe, expect, it } from "vitest";
import { breakdownByClient, compareByClient } from "./day-breakdown";

describe("breakdownByClient（1日の計画・実績の内訳）", () => {
  it("クライアントごとに合計し、時間の長い順に並べる。クライアントなしは最後", () => {
    const r = breakdownByClient(
      [
        { title: "会議", minutes: 60, clientId: null, projectId: null },
        { title: "設計", minutes: 30, clientId: "a", projectId: "pa" },
        { title: "実装", minutes: 120, clientId: "b", projectId: "pb" },
        { title: "レビュー", minutes: 45, clientId: "a", projectId: "pa" },
      ],
      ["a", "b"]
    );
    expect(r.totalMin).toBe(255);
    expect(r.groups.map((g) => [g.clientId, g.totalMin])).toEqual([
      ["b", 120],
      ["a", 75],
      [null, 60],
    ]);
  });

  it("同じクライアント・プロジェクト・題名はまとめて、回数を数える", () => {
    const r = breakdownByClient(
      [
        { title: "実装", minutes: 50, clientId: "a", projectId: "p1" },
        { title: "実装", minutes: 40, clientId: "a", projectId: "p1" },
        { title: "実装", minutes: 30, clientId: "a", projectId: "p2" },
      ],
      ["a"]
    );
    expect(r.groups[0].items).toEqual([
      { title: "実装", projectId: "p1", minutes: 90, count: 2 },
      { title: "実装", projectId: "p2", minutes: 30, count: 1 },
    ]);
  });

  it("一覧に無いクライアントは「クライアントなし」に入れ、0分のものは出さない", () => {
    const r = breakdownByClient(
      [
        { title: "x", minutes: 10, clientId: "gone", projectId: null },
        { title: "計測を始めたばかり", minutes: 0, clientId: "a", projectId: null },
      ],
      ["a"]
    );
    expect(r.groups).toEqual([{ clientId: null, totalMin: 10, items: [{ title: "x", projectId: null, minutes: 10, count: 1 }] }]);
  });

  it("同じ時間のクライアントは一覧の並び順", () => {
    const r = breakdownByClient(
      [
        { title: "x", minutes: 30, clientId: "b", projectId: null },
        { title: "y", minutes: 30, clientId: "a", projectId: null },
      ],
      ["a", "b"]
    );
    expect(r.groups.map((g) => g.clientId)).toEqual(["a", "b"]);
  });

  it("何も無ければ空", () => {
    expect(breakdownByClient([], [])).toEqual({ totalMin: 0, groups: [] });
  });
});

describe("compareByClient（クライアントごとの計画と実績の差）", () => {
  const g = (clientId: string | null, totalMin: number) => ({ clientId, totalMin, items: [] });
  it("計画・実績のどちらかがあるクライアントを並べ、差（実績−計画）を出す。クライアントなしは最後", () => {
    const r = compareByClient([g("a", 180), g("b", 60), g(null, 30)], [g("b", 90), g("c", 45), g(null, 20)], ["a", "b", "c"]);
    expect(r).toEqual([
      { clientId: "a", plannedMin: 180, actualMin: 0, diffMin: -180 },
      { clientId: "b", plannedMin: 60, actualMin: 90, diffMin: 30 },
      { clientId: "c", plannedMin: 0, actualMin: 45, diffMin: 45 },
      { clientId: null, plannedMin: 30, actualMin: 20, diffMin: -10 },
    ]);
  });
  it("並びは計画・実績の多いほうの時間が長い順。同じなら一覧の並び順", () => {
    const r = compareByClient([g("a", 30), g("b", 30)], [g("c", 120)], ["a", "b", "c"]);
    expect(r.map((x) => x.clientId)).toEqual(["c", "a", "b"]);
  });
  it("何も無ければ空", () => {
    expect(compareByClient([], [], [])).toEqual([]);
  });
});
