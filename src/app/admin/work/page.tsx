"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import TaskRow from "@/components/work/TaskRow";
import TaskEditor from "@/components/work/TaskEditor";
import { useTasks } from "@/components/work/useTasks";
import { useRoutineChecks } from "@/components/work/useRoutineChecks";
import { useTimer } from "@/components/work/useTimer";
import TimerBar from "@/components/work/TimerBar";
import { formatMinutes } from "@/lib/work/labels";
import type { Task } from "@/components/work/types";
import { addDays, todayJst } from "@/lib/date-jst";
import PageTitle from "@/components/PageTitle";

// 業務管理の「今日」画面：未完了タスクを期限で振り分けて表示
export default function WorkTodayPage() {
  const { tasks, projects, loading, error, reload, toggle } = useTasks("status=todo,doing");
  const [editing, setEditing] = useState<Task | null | "new">(null);

  const today = todayJst();
  const routineChecks = useRoutineChecks(today, today);
  const timer = useTimer();
  const rowProps = {
    onToggle: toggle,
    onOpen: setEditing,
    onStart: (t: Task) => timer.start({ taskId: t.id }),
  };
  const todayRoutines = (routineChecks.days[0]?.items ?? [])
    .map((i) => ({ ...i, routine: routineChecks.routines.find((r) => r.id === i.routineId) }))
    .filter((i) => i.routine);
  const routinesDone = todayRoutines.filter((i) => i.status !== null).length;
  const weekEnd = addDays(today, 7);
  const due = (t: Task) => t.dueDate?.slice(0, 10) ?? null;
  const groups: { title: string; items: Task[]; tone?: string }[] = [
    { title: "期限切れ", items: tasks.filter((t) => due(t) !== null && due(t)! < today), tone: "text-danger" },
    { title: "今日まで", items: tasks.filter((t) => due(t) === today) },
    { title: "7日以内", items: tasks.filter((t) => due(t) !== null && due(t)! > today && due(t)! <= weekEnd) },
    { title: "進行中（期限なし・先の予定）", items: tasks.filter((t) => t.status === "doing" && (due(t) === null || due(t)! > weekEnd)) },
  ];
  const restCount = tasks.filter((t) => t.status === "todo" && (due(t) === null || due(t)! > weekEnd)).length;

  if (loading) return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <PageTitle>今日の業務</PageTitle>
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          + タスク
        </button>
      </div>

      <TimerBar running={timer.running} busy={timer.busy} onStop={timer.stop} />

      {(error || routineChecks.error || timer.error) && (
        <div className="text-sm text-danger bg-danger-light rounded p-3">{error || routineChecks.error || timer.error}</div>
      )}

      {/* 今日のルーティン（実施日のものだけ） */}
      {todayRoutines.length > 0 && (
        <Card className="!p-4">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs font-bold text-app-sub">
              今日のルーティン（{routinesDone}/{todayRoutines.length}）
            </div>
            <Link href="/admin/work/routines" className="text-[11px] text-primary">一覧へ</Link>
          </div>
          {todayRoutines.map(({ routineId, status, routine }) => (
            <label
              key={routineId}
              className="flex items-center gap-3 py-2 border-b border-app-border last:border-b-0 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={status === "done"}
                onChange={(e) => routineChecks.setStatus(routineId, today, e.target.checked ? "done" : null)}
                className="w-4 h-4 accent-primary"
              />
              <span className={`flex-1 text-sm ${status ? "line-through text-app-sub" : "text-app-text"}`}>
                {routine!.title}
              </span>
              {status === "skipped" && <span className="text-[11px] text-app-sub">スキップ</span>}
              {routine!.plannedMinutes !== null && !status && (
                <span className="text-[11px] text-app-sub">{formatMinutes(routine!.plannedMinutes)}</span>
              )}
            </label>
          ))}
        </Card>
      )}

      {tasks.length === 0 ? (
        <Card className="text-center !py-10 text-app-sub text-sm">未完了のタスクはありません</Card>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <Card key={g.title} className="!p-4">
              <div className={`text-xs font-bold mb-1 ${g.tone ?? "text-app-sub"}`}>
                {g.title}（{g.items.length}）
              </div>
              {g.items.map((t) => (
                <TaskRow key={t.id} task={t} {...rowProps} running={!!timer.runningFor({ taskId: t.id })} />
              ))}
            </Card>
          ))
      )}

      {restCount > 0 && (
        <Link href="/admin/work/projects" className="text-xs text-primary text-center">
          ほかに期限が先・期限なしの未着手タスクが {restCount} 件あります →
        </Link>
      )}

      {editing && (
        <TaskEditor
          task={editing === "new" ? null : editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
