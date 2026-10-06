"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import TimerBar from "@/components/work/TimerBar";
import { EntryEditor, PlanEditor } from "@/components/work/PlanEntryEditors";
import { useTimer } from "@/components/work/useTimer";
import {
  api,
  entryTitle,
  type DaySummary,
  type Plan,
  type Project,
  type Task,
  type TimeEntry,
} from "@/components/work/types";
import { dayOfWeek } from "@/lib/attendance-status";
import { addDays, todayJst } from "@/lib/date-jst";
import { formatMinutes } from "@/lib/work/labels";
import { WEEKDAY_NAMES } from "@/lib/work/recurrence";
import { entryMinutes } from "@/lib/work/time";

// 「1時間30分」表示。null は「—」
const fmt = (m: number | null) => (m === null ? "—" : m === 0 ? "0分" : formatMinutes(m));
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

// 業務の計画・実績（1日単位）
export default function WorkPlanPage() {
  const [date, setDate] = useState(() => todayJst());
  const [plans, setPlans] = useState<Plan[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null | "new">(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null | "new">(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const q = `from=${date}&to=${date}`;
      const [p, e, s, t, pr] = await Promise.all([
        api<Plan[]>(`/api/work/plans?${q}`),
        api<TimeEntry[]>(`/api/work/time-entries?${q}`),
        api<{ days: DaySummary[] }>(`/api/work/summary?${q}`),
        api<Task[]>("/api/work/tasks?status=todo,doing"),
        api<Project[]>("/api/work/projects"),
      ]);
      setPlans(p);
      setEntries(e);
      setSummary(s.days[0] ?? null);
      setTasks(t);
      setProjects(pr);
      setNow(new Date());
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

  // 計画ごとの実績（その計画から開始・紐づけた分）
  const actualOf = (planId: string) =>
    entries.filter((e) => e.planId === planId).reduce((s, e) => s + entryMinutes(e, now), 0);

  const label = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}（${WEEKDAY_NAMES[dayOfWeek(date)]}）`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-lg lg:text-2xl font-bold tracking-tight">計画・実績</div>
        <Link href="/admin/work/schedule" className="ml-auto mr-2 text-xs text-primary">スケジュール</Link>
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
      {(error || timer.error) && <div className="text-sm text-danger bg-danger-light rounded p-3">{error || timer.error}</div>}

      {loading ? (
        <div className="text-center text-app-sub py-10">読み込み中...</div>
      ) : (
        <>
          {/* 1日の集計 */}
          {summary && (
            <Card className="!p-4">
              <div className="grid grid-cols-4 gap-2 text-center">
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
              <div className="text-[10px] text-app-sub mt-2">
                未記録 = 出勤簿の勤務時間のうち、実績として記録していない時間（出勤簿に退勤まで記録がある日のみ）
              </div>
            </Card>
          )}

          {/* 計画 */}
          <Card className="!p-4">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs font-bold text-app-sub">計画（{plans.length}）</div>
              <button onClick={() => setEditingPlan("new")} className="px-3 py-1.5 rounded bg-primary text-white text-xs font-bold border-none cursor-pointer">
                + 計画
              </button>
            </div>
            {plans.length === 0 ? (
              <div className="text-xs text-app-sub py-3">この日の計画はありません</div>
            ) : (
              plans.map((p) => {
                const actual = actualOf(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 py-2.5 border-b border-app-border last:border-b-0">
                    <div className="text-xs text-app-sub w-11 shrink-0 tabular-nums">{p.startTime ?? "—"}</div>
                    <button type="button" onClick={() => setEditingPlan(p)} className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer">
                      <div className="text-sm font-semibold text-app-text truncate">{p.title}</div>
                      <div className="text-[11px] text-app-sub">
                        予定 {formatMinutes(p.plannedMinutes)}
                        {actual > 0 && <> ・ 実績 {formatMinutes(actual)}</>}
                        {p.project && <> ・ {p.project.name}</>}
                      </div>
                    </button>
                    {isToday && (
                      <button
                        onClick={() => timer.start({ planId: p.id })}
                        disabled={timer.busy || timer.running?.planId === p.id}
                        aria-label={`「${p.title}」のタイマーを開始`}
                        className="w-9 h-9 rounded-full bg-primary text-white text-sm border-none cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </Card>

          {/* 実績 */}
          <Card className="!p-4">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs font-bold text-app-sub">実績（{entries.length}）</div>
              <button onClick={() => setEditingEntry("new")} className="px-3 py-1.5 rounded border border-primary text-primary text-xs font-bold bg-white cursor-pointer">
                + 手入力
              </button>
            </div>
            {entries.length === 0 ? (
              <div className="text-xs text-app-sub py-3">この日の実績はありません</div>
            ) : (
              entries.map((e) => {
                const running = !!e.startedAt && !e.endedAt;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEditingEntry(e)}
                    className="w-full flex items-center gap-2 py-2.5 border-b border-app-border last:border-b-0 text-left bg-transparent border-x-0 border-t-0 cursor-pointer"
                  >
                    <div className="text-[11px] text-app-sub w-[88px] shrink-0 tabular-nums">
                      {e.startedAt ? `${hhmm(e.startedAt)}〜${e.endedAt ? hhmm(e.endedAt) : ""}` : "手入力"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-app-text truncate">{entryTitle(e)}</div>
                      {e.project && <div className="text-[11px] text-app-sub truncate">{e.project.name}</div>}
                    </div>
                    {running ? <Badge type="danger">計測中</Badge> : <span className="text-sm font-semibold text-app-text">{formatMinutes(e.minutes ?? 0)}</span>}
                  </button>
                );
              })
            )}
          </Card>
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
