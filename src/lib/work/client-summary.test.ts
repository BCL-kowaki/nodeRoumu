import { describe, expect, it } from "vitest";
import { summarizeByClient } from "./client-summary";

const now = new Date("2026-10-06T05:00:00Z");
const projects = [
  { id: "p1", clientId: "c1" },
  { id: "p2", clientId: "c1" },
  { id: "p3", clientId: "c2" },
];
const entry = (minutes: number, links: { projectId?: string | null; taskProjectId?: string | null; planProjectId?: string | null }) => ({
  minutes,
  startedAt: null,
  endedAt: null,
  projectId: links.projectId ?? null,
  task: links.taskProjectId !== undefined ? { projectId: links.taskProjectId } : null,
  plan: links.planProjectId !== undefined ? { projectId: links.planProjectId } : null,
});

describe("summarizeByClient（クライアント別の計画・実績）", () => {
  it("計画と実績を、プロジェクト経由でクライアントごとに合計する", () => {
    // Arrange
    const plans = [
      { plannedMinutes: 60, projectId: "p1", task: null },
      { plannedMinutes: 30, projectId: "p2", task: null },
      { plannedMinutes: 45, projectId: "p3", task: null },
    ];
    const entries = [entry(50, { projectId: "p1" }), entry(20, { projectId: "p3" })];
    // Act
    const r = summarizeByClient({ plans, entries, projects, clients: ["c1", "c2"], now });
    // Assert
    expect(r.clients).toEqual([
      {
        clientId: "c1",
        plannedMin: 90,
        actualMin: 50,
        projects: [
          { projectId: "p1", plannedMin: 60, actualMin: 50 },
          { projectId: "p2", plannedMin: 30, actualMin: 0 },
        ],
      },
      { clientId: "c2", plannedMin: 45, actualMin: 20, projects: [{ projectId: "p3", plannedMin: 45, actualMin: 20 }] },
    ]);
    expect(r.unassigned).toEqual({ plannedMin: 0, actualMin: 0 });
  });

  it("プロジェクトが直接ついていないとき、タスク → 計画 の順でプロジェクトをたどる", () => {
    const plans = [{ plannedMinutes: 30, projectId: null, task: { projectId: "p3" } }];
    const entries = [entry(10, { taskProjectId: "p3" }), entry(15, { taskProjectId: null, planProjectId: "p3" })];
    const r = summarizeByClient({ plans, entries, projects, clients: ["c1", "c2"], now });
    expect(r.clients).toEqual([
      { clientId: "c2", plannedMin: 30, actualMin: 25, projects: [{ projectId: "p3", plannedMin: 30, actualMin: 25 }] },
    ]);
  });

  it("プロジェクトにたどり着かないもの（ルーティンなど）は、未分類として別に合計する", () => {
    const plans = [{ plannedMinutes: 20, projectId: null, task: null }];
    const entries = [entry(40, {}), entry(5, { projectId: "deleted" })];
    const r = summarizeByClient({ plans, entries, projects, clients: ["c1", "c2"], now });
    expect(r.clients).toEqual([]);
    expect(r.unassigned).toEqual({ plannedMin: 20, actualMin: 45 });
  });

  it("ルーティンの実績は、ルーティンのプロジェクト、なければルーティンのクライアントに数える", () => {
    const entries = [
      { ...entry(30, {}), routine: { projectId: "p1", clientId: "c1" } },
      { ...entry(20, {}), routine: { projectId: null, clientId: "c2" } },
      { ...entry(10, {}), routine: { projectId: null, clientId: null } },
    ];
    const r = summarizeByClient({ plans: [], entries, projects, clients: ["c1", "c2"], now });
    expect(r.clients).toEqual([
      { clientId: "c1", plannedMin: 0, actualMin: 30, projects: [{ projectId: "p1", plannedMin: 0, actualMin: 30 }] },
      { clientId: "c2", plannedMin: 0, actualMin: 20, projects: [{ projectId: null, plannedMin: 0, actualMin: 20 }] },
    ]);
    expect(r.unassigned).toEqual({ plannedMin: 0, actualMin: 10 });
  });

  it("計測中のタイマーは、現在時刻までの分数で数える", () => {
    const entries = [
      { minutes: null, startedAt: "2026-10-06T04:30:00Z", endedAt: null, projectId: "p1", task: null, plan: null },
    ];
    const r = summarizeByClient({ plans: [], entries, projects, clients: ["c1", "c2"], now });
    expect(r.clients[0]).toMatchObject({ clientId: "c1", actualMin: 30 });
  });

  it("時間の多いクライアントから順に並べる（計画＋実績が同じなら元の順）", () => {
    const plans = [
      { plannedMinutes: 10, projectId: "p1", task: null },
      { plannedMinutes: 100, projectId: "p3", task: null },
    ];
    const r = summarizeByClient({ plans, entries: [], projects, clients: ["c1", "c2"], now });
    expect(r.clients.map((c) => c.clientId)).toEqual(["c2", "c1"]);
  });
});
