import { describe, expect, it } from "vitest";
import { groupProjectsByClient, groupTasksForSelect } from "./client-groups";

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

describe("groupTasksForSelect（タスクの選択欄を「クライアント ／ プロジェクト」の見出しに分ける）", () => {
  const clients = [
    { id: "c2", name: "B社" },
    { id: "c1", name: "A社" },
  ];
  const projects = [
    { id: "p1", name: "案件1", clientId: "c1" },
    { id: "p2", name: "案件2", clientId: "c2" },
  ];
  it("クライアント → プロジェクトの順に見出しを作り、プロジェクトなしは最後", () => {
    const tasks = [
      { id: "t1", projectId: "p1" },
      { id: "t2", projectId: null },
      { id: "t3", projectId: "p2" },
    ];
    expect(groupTasksForSelect(tasks, projects, clients).map((g) => [g.label, g.tasks.map((t) => t.id)])).toEqual([
      ["B社 ／ 案件2", ["t3"]],
      ["A社 ／ 案件1", ["t1"]],
      ["プロジェクトなし", ["t2"]],
    ]);
  });
  it("一覧に無いプロジェクトのタスクは「その他」に入れる", () => {
    expect(groupTasksForSelect([{ id: "t9", projectId: "gone" }], projects, clients).map((g) => g.label)).toEqual(["その他"]);
  });
});
