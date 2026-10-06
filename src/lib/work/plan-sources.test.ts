import { describe, expect, it } from "vitest";
import { eventToPlan, groupByClient, groupTasksByProject, importableEvents } from "./plan-sources";

describe("groupTasksByProject（左の一覧をプロジェクトごとに分ける）", () => {
  const clients = [{ id: "c2" }, { id: "c1" }];
  const projects = [
    { id: "p1", clientId: "c1" },
    { id: "p2", clientId: "c2" },
    { id: "p3", clientId: "c2" },
  ];
  it("クライアントの並び → プロジェクトの並びの順にまとめ、プロジェクトなしは最後", () => {
    const tasks = [
      { id: "t1", projectId: "p1" },
      { id: "t2", projectId: null },
      { id: "t3", projectId: "p3" },
      { id: "t4", projectId: "p2" },
      { id: "t5", projectId: "p3" },
    ];
    const g = groupTasksByProject(tasks, projects, clients);
    expect(g.map((x) => [x.projectId, x.tasks.map((t) => t.id)])).toEqual([
      ["p2", ["t4"]],
      ["p3", ["t3", "t5"]],
      ["p1", ["t1"]],
      [null, ["t2"]],
    ]);
  });
  it("タスクのないプロジェクトは出さない", () => {
    expect(groupTasksByProject([{ id: "t1", projectId: "p1" }], projects, clients).map((x) => x.projectId)).toEqual(["p1"]);
  });
  it("一覧に無いプロジェクト（完了済みなど）のタスクも、プロジェクトごとにまとめて最後の手前に出す", () => {
    const g = groupTasksByProject([{ id: "t1", projectId: "gone" }, { id: "t2", projectId: null }], projects, clients);
    expect(g.map((x) => x.projectId)).toEqual(["gone", null]);
  });
});

describe("eventToPlan（Google の予定 → 計画）", () => {
  it("開始・終了から開始時刻と分数を作る", () => {
    expect(eventToPlan({ id: "g1", title: "打ち合わせ", allDay: false, startTime: "14:00", endTime: "15:30" })).toEqual({
      title: "打ち合わせ",
      startTime: "14:00",
      plannedMinutes: 90,
      sourceEventId: "g1",
    });
  });
  it("24:00 終わり（00:00）は日の終わりまで、題名が無ければ「（予定）」", () => {
    expect(eventToPlan({ id: "g2", title: "", allDay: false, startTime: "23:00", endTime: "00:00" })).toMatchObject({
      title: "（予定）",
      plannedMinutes: 60,
    });
  });
  it("終日・時刻の無い予定は計画にしない", () => {
    expect(eventToPlan({ id: "g3", title: "休み", allDay: true, startTime: null, endTime: null })).toBeNull();
  });
});

describe("importableEvents（まだ取り込んでいない時刻つきの予定）", () => {
  it("取り込み済み・終日の予定を除く", () => {
    const events = [
      { id: "g1", title: "A", allDay: false, startTime: "09:00", endTime: "10:00" },
      { id: "g2", title: "B", allDay: false, startTime: "11:00", endTime: "12:00" },
      { id: "g3", title: "C", allDay: true, startTime: null, endTime: null },
    ];
    expect(importableEvents(events, [{ sourceEventId: "g1" }, { sourceEventId: null }]).map((e) => e.id)).toEqual(["g2"]);
  });
});

describe("groupByClient（プロジェクトごとのまとまりを、さらにクライアントごとに分ける）", () => {
  const clients = [{ id: "c2" }, { id: "c1" }];
  const projects = [
    { id: "p1", clientId: "c1" },
    { id: "p2", clientId: "c2" },
  ];
  it("クライアントの並び順でまとめ、プロジェクトなし・一覧に無いプロジェクトは最後（clientId: null）", () => {
    const groups = [
      { projectId: "p2", tasks: [] },
      { projectId: "p1", tasks: [] },
      { projectId: "gone", tasks: [] },
      { projectId: null, tasks: [] },
    ];
    expect(groupByClient(groups, projects, clients).map((c) => [c.clientId, c.groups.map((g) => g.projectId)])).toEqual([
      ["c2", ["p2"]],
      ["c1", ["p1"]],
      [null, ["gone", null]],
    ]);
  });
});
