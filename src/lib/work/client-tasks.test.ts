import { describe, expect, it } from "vitest";
import { dayTaskGroups, defaultProjectFor, memoLines, noteDraftFromTasks, sortClientTasks, tasksOfClient } from "./client-tasks";

const projects = [
  { id: "p1", clientId: "c1" },
  { id: "p2", clientId: "c1" },
  { id: "p3", clientId: "c2" },
];
const t = (id: string, o: Partial<{ projectId: string | null; status: string; priority: number; dueDate: string | null; createdAt: string }> = {}) => ({
  id,
  title: id,
  projectId: "p1",
  status: "todo",
  priority: 2,
  dueDate: null,
  createdAt: "2026-10-01T00:00:00Z",
  ...o,
});

describe("tasksOfClient（クライアントのタスク）", () => {
  it("そのクライアントのプロジェクトのタスクだけ", () => {
    const r = tasksOfClient([t("a"), t("b", { projectId: "p3" }), t("c", { projectId: "p2" }), t("d", { projectId: null })], "c1", projects);
    expect(r.map((x) => x.id)).toEqual(["a", "c"]);
  });
});

describe("sortClientTasks（タスクの並び）", () => {
  it("今日作業したもの → 進行中 → 未着手。同じなら優先度・期限・作成順", () => {
    const tasks = [
      t("todo-low", { priority: 3 }),
      t("todo-high", { priority: 1 }),
      t("doing", { status: "doing" }),
      t("worked", { priority: 3 }),
      t("todo-due", { dueDate: "2026-10-20" }),
      t("todo-due-early", { dueDate: "2026-10-18" }),
      t("todo-old", { createdAt: "2026-09-01T00:00:00Z" }),
    ];
    expect(sortClientTasks(tasks, new Set(["worked"])).map((x) => x.id)).toEqual([
      "worked",
      "doing",
      "todo-high",
      "todo-due-early",
      "todo-due",
      "todo-old",
      "todo-low",
    ]);
  });
});

describe("defaultProjectFor（追加するタスクの初期プロジェクト）", () => {
  it("その日いちばん時間を使ったプロジェクト", () => {
    expect(defaultProjectFor("c1", projects, [{ projectId: "p1", minutes: 30 }, { projectId: "p2", minutes: 90 }])).toBe("p2");
  });
  it("時間の記録が無ければ、そのクライアントの最初のプロジェクト。プロジェクトが無ければ null", () => {
    expect(defaultProjectFor("c1", projects, [{ projectId: "p3", minutes: 60 }])).toBe("p1");
    expect(defaultProjectFor("c9", projects, [])).toBeNull();
  });
});

describe("noteDraftFromTasks（タスクからメモの下書き）", () => {
  it("今日完了したものと、次にやること（未完了の上から3件）を箇条書きにする", () => {
    expect(noteDraftFromTasks(["見積送付"], ["要件定義", "デモ準備", "請求", "資料整理"])).toBe(
      "完了\n- 見積送付\n\n次にやること\n- 要件定義\n- デモ準備\n- 請求"
    );
  });
  it("どちらか無ければ、その見出しは出さない", () => {
    expect(noteDraftFromTasks([], ["要件定義"])).toBe("次にやること\n- 要件定義");
    expect(noteDraftFromTasks(["見積送付"], [])).toBe("完了\n- 見積送付");
    expect(noteDraftFromTasks([], [])).toBe("");
  });
});

describe("dayTaskGroups（その日のタスクをクライアントごとに）", () => {
  const clients = [
    { id: "c1", name: "A社" },
    { id: "c2", name: "B社" },
    { id: "c3", name: "C社" },
  ];
  const ps = [...projects, { id: "p4", clientId: "c3" }];
  it("その日に作業・計画・完了したタスクがあるクライアントだけを、一覧の並び順で返す", () => {
    const r = dayTaskGroups({
      clients,
      projects: ps,
      open: [t("a"), t("b", { projectId: "p3" }), t("c", { projectId: "p4" })],
      done: [t("d", { projectId: "p3", status: "done" })],
      workedTaskIds: new Set(["a"]),
      plannedTaskIds: new Set<string>(),
    });
    expect(r.map((g) => [g.clientId, g.open.map((x) => x.id), g.done.map((x) => x.id)])).toEqual([
      ["c1", ["a"], []],
      ["c2", ["b"], ["d"]],
    ]);
  });
  it("未完了には今日作業・今日計画の印を付け、画面と同じ並びにする", () => {
    const r = dayTaskGroups({
      clients,
      projects: ps,
      open: [t("x", { priority: 1 }), t("y", { priority: 3 }), t("z")],
      done: [],
      workedTaskIds: new Set(["y"]),
      plannedTaskIds: new Set(["z"]),
    });
    expect(r[0].open.map((x) => [x.id, x.workedToday, x.plannedToday])).toEqual([
      ["y", true, false],
      ["x", false, false],
      ["z", false, true],
    ]);
  });
});

describe("memoLines（引き継ぎメモの行。タスクにできる行を見分ける）", () => {
  it("行頭の記号（- ・ * 番号 チェック）を取り、空行は飛ばす", () => {
    expect(memoLines("マニュアル作成予定\n\n- 検証チームのチェックリスト\n・広告の設定\n1. 返信を行う\n- [ ] 見積\n- [x] 済んだこと")).toEqual([
      { text: "マニュアル作成予定", kind: "item" },
      { text: "検証チームのチェックリスト", kind: "item" },
      { text: "広告の設定", kind: "item" },
      { text: "返信を行う", kind: "item" },
      { text: "見積", kind: "item" },
      { text: "済んだこと", kind: "done" },
    ]);
  });
  it("下書きの見出し「完了」「次にやること」は見出しにし、「完了」の下の行は済んだこととして扱う", () => {
    expect(memoLines("完了\n- 見積送付\n\n次にやること\n- 要件定義\n## メモ")).toEqual([
      { text: "完了", kind: "heading" },
      { text: "見積送付", kind: "done" },
      { text: "次にやること", kind: "heading" },
      { text: "要件定義", kind: "item" },
      { text: "メモ", kind: "heading" },
    ]);
  });
  it("長すぎる行はタスク名の上限（200文字）に切る", () => {
    expect(memoLines("あ".repeat(250))[0].text.length).toBe(200);
  });
});
