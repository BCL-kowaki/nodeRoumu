import { describe, expect, it } from "vitest";
import { breakdownByClient, compareByClient, sumDaySummaries, weekRange } from "./day-breakdown";

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

describe("weekRange（その日を含む週。月曜はじまり）", () => {
  it("月曜〜日曜を返す", () => {
    expect(weekRange("2026-10-15")).toEqual({ from: "2026-10-12", to: "2026-10-18" }); // 木曜
    expect(weekRange("2026-10-12")).toEqual({ from: "2026-10-12", to: "2026-10-18" }); // 月曜
    expect(weekRange("2026-10-18")).toEqual({ from: "2026-10-12", to: "2026-10-18" }); // 日曜
  });
  it("月・年をまたぐ週", () => {
    expect(weekRange("2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });
});

describe("sumDaySummaries（期間の合計）", () => {
  const d = (plannedMin: number, actualMin: number, attendanceMin: number | null, unrecordedMin: number | null) => ({
    date: "",
    plannedMin,
    actualMin,
    attendanceMin,
    unrecordedMin,
  });
  it("計画・実績は足し、出勤簿・未記録は記録のある日だけ足す", () => {
    expect(sumDaySummaries([d(60, 30, 480, 450), d(120, 90, null, null), d(0, 15, 240, 225)])).toEqual({
      plannedMin: 180,
      actualMin: 135,
      attendanceMin: 720,
      unrecordedMin: 675,
    });
  });
  it("出勤簿の記録が1日も無ければ null", () => {
    expect(sumDaySummaries([d(60, 30, null, null)])).toEqual({ plannedMin: 60, actualMin: 30, attendanceMin: null, unrecordedMin: null });
  });
});
