import { describe, expect, it } from "vitest";
import { groupProjectsByClient } from "./client-groups";

describe("groupProjectsByClient（プロジェクトの選択欄をクライアントごとに分ける）", () => {
  const clients = [
    { id: "c2", name: "B社" },
    { id: "c1", name: "A社" },
  ];
  it("クライアントの並び順で分け、中のプロジェクトは元の順のまま。プロジェクトの無いクライアントは出さない", () => {
    const projects = [
      { id: "p1", clientId: "c1" },
      { id: "p2", clientId: "c2" },
      { id: "p3", clientId: "c1" },
    ];
    expect(groupProjectsByClient(projects, [...clients, { id: "c3", name: "C社" }]).map((g) => [g.label, g.projects.map((p) => p.id)])).toEqual([
      ["B社", ["p2"]],
      ["A社", ["p1", "p3"]],
    ]);
  });
  it("一覧に無いクライアントのプロジェクトは「その他」にまとめて最後に出す", () => {
    expect(groupProjectsByClient([{ id: "p9", clientId: "gone" }], clients)).toEqual([{ clientId: null, label: "その他", projects: [{ id: "p9", clientId: "gone" }] }]);
  });
});
