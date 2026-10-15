import { describe, expect, it } from "vitest";
import { defaultProjectFor, noteDraftFromTasks, sortClientTasks, tasksOfClient } from "./client-tasks";

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
