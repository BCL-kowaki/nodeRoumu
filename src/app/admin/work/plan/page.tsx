"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import TimerBar from "@/components/work/TimerBar";
import DayTimeline, { type DayGoogleEvent, type DayRoutine, type NewPlan } from "@/components/work/DayTimeline";
import { EntryEditor, PlanEditor } from "@/components/work/PlanEntryEditors";
import TaskEditor from "@/components/work/TaskEditor";
import { useTimer } from "@/components/work/useTimer";
import {
  api,
  type Client,
  type DaySummary,
  type Plan,
  type Project,
  type Routine,
  type RoutineDay,
  type Task,
  type TimeEntry,
} from "@/components/work/types";
import { dayOfWeek } from "@/lib/attendance-status";
import { addDays, todayJst } from "@/lib/date-jst";
import { formatMinutes } from "@/lib/work/labels";
import { WEEKDAY_NAMES } from "@/lib/work/recurrence";
import PageTitle from "@/components/PageTitle";

// 「1時間30分」表示。null は「—」
const fmt = (m: number | null) => (m === null ? "—" : m === 0 ? "0分" : formatMinutes(m));

// 業務の計画・実績（1日のタイムライン。タスクをドラッグして時間に置く）
export default function WorkPlanPage() {
  const [date, setDate] = useState(() => todayJst());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [routines, setRoutines] = useState<DayRoutine[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [googleEvents, setGoogleEvents] = useState<DayGoogleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null | "new">(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null | "new">(null);

  const load = useCallback(async () => {
    try {
      const q = `from=${date}&to=${date}`;
      const [p, e, s, t, pr, g, cl, rs, rc] = await Promise.all([
        api<Plan[]>(`/api/work/plans?${q}`),
        api<TimeEntry[]>(`/api/work/time-entries?${q}`),
        api<{ days: DaySummary[] }>(`/api/work/summary?${q}`),
        api<Task[]>("/api/work/tasks?status=todo,doing"),
        api<Project[]>("/api/work/projects"),
        api<{ connected: boolean; status: string | null }>("/api/work/google/status"),
        api<Client[]>("/api/work/clients"),
        api<Routine[]>("/api/work/routines"),
        api<{ days: RoutineDay[] }>(`/api/work/routines/checks?${q}`),
      ]);
      setPlans(p);
      setEntries(e);
      setSummary(s.days[0] ?? null);
      setTasks(t);
      setProjects(pr);
      setClients(cl);
      // その日に実施するルーティンだけ（停止中は実施日に出てこない）
      const items = rc.days[0]?.items ?? [];
      setRoutines(
        items
          .map((i) => ({ routine: rs.find((r) => r.id === i.routineId), status: i.status }))
          .filter((x): x is DayRoutine => !!x.routine)
      );
      // Google カレンダーは接続している場合だけ表示（失敗しても画面は使えるようにする）
      if (g.connected && g.status === "active") {
        setGoogleEvents(await api<DayGoogleEvent[]>(`/api/work/google/events?${q}`).catch(() => []));
      } else setGoogleEvents([]);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const timer = useTimer(load);
  const today = todayJst();
  const isToday = date === today;
  const label = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${WEEKDAY_NAMES[dayOfWeek(date)]}）`;

  // タスク・ルーティン・Google の予定を時間に置く → その時間の計画を作る
  const createPlan = async (plan: NewPlan) => {
    setError(null);
    try {
      await api("/api/work/plans", { method: "POST", body: JSON.stringify({ date, ...plan }) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Google の予定をまとめて計画に取り込む（1件ずつ登録し、失敗したものは知らせる）
  const importEvents = async (items: NewPlan[]) => {
    setError(null);
    const failed: string[] = [];
    for (const plan of items) {
      try {
        await api("/api/work/plans", { method: "POST", body: JSON.stringify({ date, ...plan }) });
      } catch (e) {
        failed.push(`${plan.title}: ${(e as Error).message}`);
      }
    }
    if (failed.length) setError(failed.join("\n"));
    await load();
  };

  // 計画を動かす・伸ばす（画面は先に変え、失敗したら読み直す）
  const updatePlan = async (plan: Plan, patch: { startTime?: string; plannedMinutes?: number }) => {
    setError(null);
    setPlans((ps) => ps.map((p) => (p.id === plan.id ? { ...p, ...patch } : p)));
    try {
      await api(`/api/work/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PageTitle className="mr-auto">計画・実績</PageTitle>
        <div className="flex items-center gap-1">
          <button onClick={() => setDate(addDays(date, -1))} aria-label="前の日" className="px-2 py-1 text-sm text-primary bg-transparent border-none cursor-pointer">←</button>
          <div className="text-sm font-bold min-w-[96px] text-center">{label}</div>
          <button onClick={() => setDate(addDays(date, 1))} aria-label="次の日" className="px-2 py-1 text-sm text-primary bg-transparent border-none cursor-pointer">→</button>
          {!isToday && (
            <button onClick={() => setDate(today)} className="ml-1 px-2 py-1 rounded border border-primary text-primary text-xs bg-white cursor-pointer">今日</button>
          )}
        </div>
      </div>

      <TimerBar running={timer.running} busy={timer.busy} onStop={timer.stop} />
      {(error || timer.error) && <div className="text-sm text-danger bg-danger-light rounded p-3 whitespace-pre-wrap">{error || timer.error}</div>}

      {loading ? (
        <div className="text-center text-app-sub py-10">読み込み中...</div>
      ) : (
        <>
          {/* 1日の集計と操作 */}
          {summary && (
            <Card className="!p-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="grid grid-cols-4 gap-4 text-center flex-1 min-w-[280px]">
                  {[
                    { label: "計画", value: fmt(summary.plannedMin) },
                    { label: "実績", value: fmt(summary.actualMin) },
                    { label: "出勤簿", value: summary.attendanceMin === null ? "記録なし" : fmt(summary.attendanceMin) },
                    { label: "未記録", value: fmt(summary.unrecordedMin) },
                  ].map((x) => (
                    <div key={x.label}>
                      <div className="text-[10px] text-app-sub">{x.label}</div>
                      <div className="text-xs sm:text-sm font-bold text-app-text whitespace-nowrap">{x.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingPlan("new")} className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold border-none cursor-pointer">
                    + 計画
                  </button>
                  <button onClick={() => setEditingEntry("new")} className="px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-bold bg-white cursor-pointer">
                    + 実績を手入力
                  </button>
                  <Link href="/admin/work/schedule" className="px-3 py-1.5 rounded-lg border border-app-border text-app-text text-xs no-underline bg-white">
                    週の予定
                  </Link>
                </div>
              </div>
            </Card>
          )}

          <DayTimeline
            date={date}
            isToday={isToday}
            tasks={tasks}
            projects={projects}
            clients={clients}
            routines={routines}
            plans={plans}
            entries={entries}
            googleEvents={googleEvents}
            onCreatePlan={createPlan}
            onImportEvents={importEvents}
            onOpenTask={setEditingTask}
            timer={{ runningFor: timer.runningFor, start: timer.start, stop: timer.stop, busy: timer.busy }}
            onUpdatePlan={updatePlan}
            onOpenPlan={setEditingPlan}
            onOpenEntry={setEditingEntry}
          />
        </>
      )}

      {editingPlan && (
        <PlanEditor
          plan={editingPlan === "new" ? null : editingPlan}
          date={date}
          tasks={tasks}
          projects={projects}
          onClose={() => setEditingPlan(null)}
          onSaved={() => {
            setEditingPlan(null);
            load();
          }}
        />
      )}
      {editingTask && (
        <TaskEditor
          task={editingTask}
          projects={projects}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            load();
          }}
        />
      )}
      {editingEntry && (
        <EntryEditor
          entry={editingEntry === "new" ? null : editingEntry}
          date={date}
          tasks={tasks}
          projects={projects}
          onClose={() => setEditingEntry(null)}
          onSaved={() => {
            setEditingEntry(null);
            load();
            timer.reload();
          }}
        />
      )}
    </div>
  );
}
