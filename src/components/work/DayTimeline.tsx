"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { entryMinutes, formatElapsed } from "@/lib/work/time";
import {
  DAY_END,
  entryInterval,
  layoutColumns,
  minutesToTime,
  moveStart,
  resizeDuration,
  timeToMinutes,
  yToStart,
} from "@/lib/work/timeline";
import Link from "next/link";
import { Building2, CalendarPlus, Check, ChevronDown, Play, Repeat, Square } from "lucide-react";
import { formatMinutes } from "@/lib/work/labels";
import { eventToPlan, groupByClient, groupTasksByProject, importableEvents } from "@/lib/work/plan-sources";
import { useCollapsedClients } from "./useCollapsedClients";
import { entryTitle, type CheckStatus, type Client, type Plan, type Project, type Routine, type Task, type TimeEntry } from "./types";

export type DayGoogleEvent = { id: string; title: string; allDay: boolean; startTime: string | null; endTime: string | null };

// その日に実施するルーティン（実施状況つき）
export type DayRoutine = { routine: Routine; status: CheckStatus };

// 計画を新しく作るときの中身（タスク・ルーティン・Google の予定から）
export type NewPlan = {
  title: string;
  startTime: string;
  plannedMinutes: number;
  taskId?: string | null;
  projectId?: string | null;
  routineId?: string | null;
  sourceEventId?: string | null;
};

const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;
const DEFAULT_TASK_MINUTES = 60;

type DragData =
  | { kind: "task"; task: Task; duration: number }
  | { kind: "routine"; routine: Routine; duration: number }
  | { kind: "unscheduled"; plan: Plan; duration: number }
  | { kind: "plan"; plan: Plan; start: number; duration: number }
  | { kind: "resize"; plan: Plan; start: number; duration: number };

// ===== タイマー（左の一覧のカードに付ける ▶ / ■） =====
export type TimerControls = {
  runningFor: (t: { taskId?: string; routineId?: string; planId?: string }) => TimeEntry | undefined;
  start: (links: { taskId?: string; routineId?: string; planId?: string }) => void;
  stop: (entryId: string) => void;
  busy: boolean;
};

function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{formatElapsed((now - Date.parse(startedAt)) / 1000)}</span>;
}

// カードの右側に置く再生・停止ボタン（ドラッグ・詳細を開く操作とは分けて押せる）
function TimerButton({
  title,
  running,
  timer,
  links,
}: {
  title: string;
  running: TimeEntry | undefined;
  timer: TimerControls;
  links: { taskId?: string; routineId?: string; planId?: string };
}) {
  return (
    <button
      type="button"
      disabled={timer.busy}
      onClick={() => (running ? timer.stop(running.id) : timer.start(links))}
      aria-label={running ? `「${title}」のタイマーを停止` : `「${title}」のタイマーを開始`}
      title={running ? "タイマーを停止" : "タイマーを開始"}
      className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center border cursor-pointer disabled:opacity-50 ${
        running ? "bg-danger text-white border-danger" : "bg-white text-app-text border-app-border hover:bg-app-bg"
      }`}
    >
      {running ? <Square size={12} fill="currentColor" aria-hidden /> : <Play size={13} fill="currentColor" className="ml-0.5" aria-hidden />}
    </button>
  );
}

// ===== 左側：置けるタスク（ドラッグ元） =====
function DraggableTask({ task, projects, onOpen, timer }: { task: Task; projects: Project[]; onOpen: (t: Task) => void; timer: TimerControls }) {
  const running = timer.runningFor({ taskId: task.id });
  const duration = task.plannedMinutes ?? DEFAULT_TASK_MINUTES;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: "task", task, duration } satisfies DragData,
  });
  const color = projects.find((p) => p.id === task.projectId)?.color ?? "#9AA6A2";
  return (
    <div className="relative">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => onOpen(task)}
        aria-label={`「${task.title}」。押すと詳細、ドラッグでタイムラインに置く`}
        className={`flex items-stretch rounded-lg border bg-white cursor-grab active:cursor-grabbing select-none touch-manipulation hover:border-app-sub ${
          running ? "border-danger" : "border-app-border"
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <span className="w-1 rounded-l-lg shrink-0" style={{ background: color }} aria-hidden />
        <div className="flex-1 min-w-0 pl-3 pr-11 py-2">
          <div className="text-sm font-semibold text-app-text truncate">{task.title}</div>
          <div className="text-[11px] text-app-sub">
            {running?.startedAt ? (
              <span className="text-danger font-semibold">
                ● 計測中 <Elapsed startedAt={running.startedAt} />
              </span>
            ) : (
              <>
                {formatMinutes(duration)}
                {task.plannedMinutes == null ? "（仮）" : ""}
              </>
            )}
          </div>
        </div>
      </div>
      <TimerButton title={task.title} running={running} timer={timer} links={{ taskId: task.id }} />
    </div>
  );
}

function DraggableRoutine({ item, planned, timer }: { item: DayRoutine; planned: boolean; timer: TimerControls }) {
  const { routine, status } = item;
  const running = timer.runningFor({ routineId: routine.id });
  const duration = routine.plannedMinutes ?? DEFAULT_TASK_MINUTES;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `routine:${routine.id}`,
    data: { kind: "routine", routine, duration } satisfies DragData,
  });
  return (
    <div className="relative">
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`ルーティン「${routine.title}」をタイムラインにドラッグして置く`}
      className={`flex items-center gap-2 rounded-lg border bg-white pl-3 pr-11 py-2 cursor-grab active:cursor-grabbing select-none touch-manipulation hover:border-app-sub ${
        running ? "border-danger" : "border-app-border"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <Repeat size={14} className="shrink-0 text-accent" aria-hidden />
      <div className="flex-1 min-w-0">
        {routine.client && <div className="text-[10px] text-app-sub truncate">{routine.client.name}</div>}
        <div className="text-sm font-semibold text-app-text truncate">{routine.title}</div>
        <div className="text-[11px] text-app-sub">
          {running?.startedAt ? (
            <span className="text-danger font-semibold">
              ● 計測中 <Elapsed startedAt={running.startedAt} />
            </span>
          ) : (
            <>
              {formatMinutes(duration)}
              {routine.plannedMinutes == null ? "（仮）" : ""}
              {planned && "・計画済み"}
              {status === "done" && "・実施済み"}
              {status === "skipped" && "・スキップ"}
            </>
          )}
        </div>
      </div>
      {(planned || status === "done") && !running && <Check size={14} className="shrink-0 text-app-sub" aria-hidden />}
    </div>
    <TimerButton title={routine.title} running={running} timer={timer} links={{ routineId: routine.id }} />
    </div>
  );
}

// 計画のカードで計測中か：計画そのもの、または同じタスク・ルーティンのタイマー
function runningForPlan(plan: Plan, timer: TimerControls): TimeEntry | undefined {
  return (
    timer.runningFor({ planId: plan.id }) ??
    (plan.taskId ? timer.runningFor({ taskId: plan.taskId }) : undefined) ??
    (plan.routineId ? timer.runningFor({ routineId: plan.routineId }) : undefined)
  );
}

function PlanCardBody({ plan, running, color }: { plan: Plan; running: TimeEntry | undefined; color: string }) {
  return (
    <>
      <span className="w-1 rounded-l-lg shrink-0" style={{ background: color }} aria-hidden />
      <div className="flex-1 min-w-0 pl-3 pr-11 py-2">
        <div className="text-sm font-semibold text-app-text truncate">{plan.title}</div>
        <div className="text-[11px] text-app-sub tabular-nums">
          {running?.startedAt ? (
            <span className="text-danger font-semibold">
              ● 計測中 <Elapsed startedAt={running.startedAt} />
            </span>
          ) : plan.startTime ? (
            `${plan.startTime}〜${minutesToTime(Math.min(DAY_END, timeToMinutes(plan.startTime) + plan.plannedMinutes))}`
          ) : (
            `時刻未定・${formatMinutes(plan.plannedMinutes)}（ドラッグで時刻を決める）`
          )}
        </div>
      </div>
    </>
  );
}

// 今日の計画タスク：時刻つきの計画（押すと編集）
function PlanCard({ plan, color, onOpen, timer, showTimer }: { plan: Plan; color: string; onOpen: (p: Plan) => void; timer: TimerControls; showTimer: boolean }) {
  const running = runningForPlan(plan, timer);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpen(plan)}
        aria-label={`計画「${plan.title}」${plan.startTime ?? ""}。押すと編集`}
        className={`w-full flex items-stretch rounded-lg border bg-white text-left p-0 cursor-pointer hover:border-app-sub ${
          running ? "border-danger" : "border-app-border"
        }`}
      >
        <PlanCardBody plan={plan} running={running} color={color} />
      </button>
      {showTimer && <TimerButton title={plan.title} running={running} timer={timer} links={{ planId: plan.id }} />}
    </div>
  );
}

function DraggableUnscheduled({ plan, color, timer, showTimer }: { plan: Plan; color: string; timer: TimerControls; showTimer: boolean }) {
  const running = runningForPlan(plan, timer);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unscheduled:${plan.id}`,
    data: { kind: "unscheduled", plan, duration: plan.plannedMinutes } satisfies DragData,
  });
  return (
    <div className="relative">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`「${plan.title}」をタイムラインにドラッグして時刻を決める`}
        className={`flex items-stretch rounded-lg border border-dashed bg-white cursor-grab active:cursor-grabbing select-none touch-manipulation ${
          running ? "border-danger" : "border-app-sub"
        } ${isDragging ? "opacity-40" : ""}`}
      >
        <PlanCardBody plan={plan} running={running} color={color} />
      </div>
      {showTimer && <TimerButton title={plan.title} running={running} timer={timer} links={{ planId: plan.id }} />}
    </div>
  );
}

// ===== 計画のブロック（動かす・下端で伸ばす・押して編集） =====
function PlanBlock({
  plan,
  start,
  duration,
  col,
  cols,
  color,
  onOpen,
  preview,
}: {
  plan: Plan;
  start: number;
  duration: number;
  col: number;
  cols: number;
  color: string;
  onOpen: (p: Plan) => void;
  preview: { start: number; duration: number } | null;
}) {
  const move = useDraggable({ id: `plan:${plan.id}`, data: { kind: "plan", plan, start, duration } satisfies DragData });
  const resize = useDraggable({ id: `resize:${plan.id}`, data: { kind: "resize", plan, start, duration } satisfies DragData });
  // ドラッグ中は、15分単位に寄せた位置・長さで表示する
  const s = preview?.start ?? start;
  const d = preview?.duration ?? duration;
  const top = s * PX_PER_MIN;
  const height = Math.max(d * PX_PER_MIN, 18);
  return (
    <div
      ref={move.setNodeRef}
      className={`absolute rounded-lg border bg-work-light border-work/30 overflow-hidden select-none touch-manipulation ${
        preview ? "shadow-lg z-20 ring-2 ring-work" : "z-10"
      }`}
      style={{ top, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} aria-hidden />
      <button
        type="button"
        {...move.listeners}
        {...move.attributes}
        onClick={() => onOpen(plan)}
        aria-label={`計画「${plan.title}」${minutesToTime(s)}〜${minutesToTime(s + d)}。ドラッグで時刻を変更、押すと編集`}
        className="block w-full h-full text-left pl-2.5 pr-1.5 pt-1 bg-transparent border-none cursor-grab active:cursor-grabbing"
      >
        <div className="text-[12px] font-bold text-work-dark leading-tight truncate">{plan.title}</div>
        {height >= 34 && (
          <div className="text-[10px] text-app-sub tabular-nums">
            {minutesToTime(s)}〜{minutesToTime(s + d)}
          </div>
        )}
      </button>
      <div
        ref={resize.setNodeRef}
        {...resize.listeners}
        {...resize.attributes}
        aria-label={`計画「${plan.title}」の長さを変える`}
        className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize flex justify-center items-end pb-0.5"
      >
        <span className="w-6 h-[3px] rounded-full bg-work/40" aria-hidden />
      </div>
    </div>
  );
}

// ===== 計画の列（ドロップ先） =====
function PlanLane({ children, laneRef }: { children: React.ReactNode; laneRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const { setNodeRef, isOver } = useDroppable({ id: "plan-lane" });
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        laneRef.current = el;
      }}
      className={`relative border-x border-app-border ${isOver ? "bg-work-light/40" : ""}`}
      style={{ height: DAY_END * PX_PER_MIN }}
    >
      {children}
    </div>
  );
}

// ===== 本体 =====
export default function DayTimeline({
  date,
  isToday,
  tasks,
  projects,
  clients,
  routines,
  plans,
  entries,
  googleEvents,
  onCreatePlan,
  onImportEvents,
  onOpenTask,
  timer,
  onUpdatePlan,
  onOpenPlan,
  onOpenEntry,
}: {
  date: string;
  isToday: boolean;
  tasks: Task[];
  projects: Project[];
  clients: Client[];
  routines: DayRoutine[];
  plans: Plan[];
  entries: TimeEntry[];
  googleEvents: DayGoogleEvent[];
  onCreatePlan: (plan: NewPlan) => void;
  onImportEvents: (plans: NewPlan[]) => void;
  onOpenTask: (task: Task) => void;
  timer: TimerControls;
  onUpdatePlan: (plan: Plan, patch: { startTime?: string; plannedMinutes?: number }) => void;
  onOpenPlan: (plan: Plan) => void;
  onOpenEntry: (entry: TimeEntry) => void;
}) {
  const sensors = useSensors(
    // マウス：4px 動かしたらドラッグ開始（それ未満はクリック＝編集）
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // スマホ：長押し（0.25秒）でドラッグ開始。画面のスクロールとぶつからないようにする
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<DragData | null>(null);
  const [preview, setPreview] = useState<{ id: string; start: number; duration: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { collapsed, toggle: toggleClient } = useCollapsedClients();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // 最初の表示位置：今日は現在時刻の1時間前、それ以外は 8:00
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const jst = new Date(now.getTime() + 9 * 3600_000);
    const nowMin = jst.getUTCHours() * 60 + jst.getUTCMinutes();
    el.scrollTop = Math.max(0, ((isToday ? nowMin - 60 : 8 * 60) * PX_PER_MIN));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const timed = plans.filter((p) => p.startTime);
  const unscheduled = plans.filter((p) => !p.startTime);
  const projectColor = (id: string | null) => projects.find((p) => p.id === id)?.color ?? "#9AA6A2";

  const planLayout = useMemo(
    () =>
      layoutColumns(
        timed.map((p) => {
          const s = timeToMinutes(p.startTime!);
          return { id: p.id, start: s, end: Math.min(DAY_END, s + p.plannedMinutes) };
        })
      ),
    [timed]
  );
  const googleTimed = googleEvents.filter((e) => !e.allDay && e.startTime && e.endTime);
  const googleLayout = useMemo(
    () =>
      layoutColumns(
        googleTimed.map((e) => {
          const s = timeToMinutes(e.startTime!);
          const end = timeToMinutes(e.endTime!) || DAY_END; // 24:00 終わりは 00:00 で返る
          return { id: e.id, start: s, end: Math.max(end, s + 15) };
        })
      ),
    [googleTimed]
  );
  const actuals = entries
    .map((e) => ({ e, iv: entryInterval(date, e.startedAt, e.endedAt, now) }))
    .filter((x): x is { e: TimeEntry; iv: { start: number; end: number } } => x.iv !== null);
  const untimedEntries = entries.filter((e) => !e.startedAt);
  // 並行して計測した実績は、計画と同じく横に並べる
  const actualLayout = layoutColumns(actuals.map(({ e, iv }) => ({ id: e.id, start: iv.start, end: iv.end })));

  // ドロップ位置（ドラッグ中のカードの上端）→ 計画の列の上端からの距離（px）
  const dropY = (ev: { active: DragEndEvent["active"] }) => {
    const rect = ev.active.rect.current.translated;
    const lane = laneRef.current?.getBoundingClientRect();
    if (!rect || !lane) return null;
    return rect.top - lane.top;
  };

  const onDragStart = (ev: DragStartEvent) => setActive(ev.active.data.current as DragData);

  const onDragMove = (ev: { active: DragEndEvent["active"]; delta: { y: number } }) => {
    const d = ev.active.data.current as DragData;
    if (d.kind === "plan") setPreview({ id: d.plan.id, start: moveStart(d.start, ev.delta.y, PX_PER_MIN, d.duration), duration: d.duration });
    else if (d.kind === "resize") setPreview({ id: d.plan.id, start: d.start, duration: resizeDuration(d.start, d.duration, ev.delta.y, PX_PER_MIN) });
  };

  const onDragEnd = (ev: DragEndEvent) => {
    const d = ev.active.data.current as DragData;
    setActive(null);
    setPreview(null);
    if (d.kind === "plan") {
      const start = moveStart(d.start, ev.delta.y, PX_PER_MIN, d.duration);
      if (start !== d.start) onUpdatePlan(d.plan, { startTime: minutesToTime(start) });
      return;
    }
    if (d.kind === "resize") {
      const minutes = resizeDuration(d.start, d.duration, ev.delta.y, PX_PER_MIN);
      if (minutes !== d.duration) onUpdatePlan(d.plan, { plannedMinutes: minutes });
      return;
    }
    // タスク・時刻未定の計画は、計画の列の上に落としたときだけ置く
    if (ev.over?.id !== "plan-lane") return;
    const y = dropY(ev);
    if (y === null) return;
    const start = yToStart(y, PX_PER_MIN, d.duration);
    if (d.kind === "task") {
      onCreatePlan({ title: d.task.title, startTime: minutesToTime(start), plannedMinutes: d.duration, taskId: d.task.id, projectId: d.task.projectId });
    } else if (d.kind === "routine") {
      onCreatePlan({
        title: d.routine.title,
        startTime: minutesToTime(start),
        plannedMinutes: d.duration,
        routineId: d.routine.id,
        projectId: d.routine.projectId,
      });
    } else onUpdatePlan(d.plan, { startTime: minutesToTime(start) });
  };

  const jstNow = new Date(now.getTime() + 9 * 3600_000);
  const nowMin = jstNow.getUTCHours() * 60 + jstNow.getUTCMinutes();
  const allDay = googleEvents.filter((e) => e.allDay);
  const importable = importableEvents(googleEvents, plans.map((p) => ({ sourceEventId: p.sourceEventId ?? null })));
  const importedIds = new Set(plans.map((p) => p.sourceEventId).filter(Boolean));
  const plannedRoutineIds = new Set(plans.map((p) => p.routineId).filter(Boolean));
  const taskGroups = groupTasksByProject(tasks, projects, clients);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const clientName = (id: string | undefined) => clients.find((c) => c.id === id)?.name;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null);
        setPreview(null);
      }}
    >
      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6 lg:items-start">
        {/* ドラッグ元：今日のルーティン・今日の計画タスク・未完了のタスク（クライアント → プロジェクトごと） */}
        <div className="bg-white rounded-2xl border border-app-border p-3 mb-3 lg:mb-0 lg:sticky lg:top-6">
          <div className="text-[10px] text-app-sub mb-2">右の「計画」にドラッグして置きます</div>
          <div className="flex flex-col gap-3 max-h-[45vh] lg:max-h-[68vh] overflow-y-auto pr-0.5 pb-1">
            {routines.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <div className="text-[11px] font-bold tracking-[0.08em] text-app-sub">今日のルーティン</div>
                {routines.map((r) => (
                  <DraggableRoutine key={r.routine.id} item={r} planned={plannedRoutineIds.has(r.routine.id)} timer={timer} />
                ))}
              </section>
            )}
            {plans.length > 0 && (
              <section className="flex flex-col gap-1.5">
                <div className="text-[11px] font-bold tracking-[0.08em] text-app-sub">{isToday ? "今日の計画タスク" : "この日の計画タスク"}</div>
                {[...timed]
                  .sort((a, b) => a.startTime!.localeCompare(b.startTime!))
                  .map((p) => (
                    <PlanCard key={p.id} plan={p} color={projectColor(p.projectId)} onOpen={onOpenPlan} timer={timer} showTimer={isToday} />
                  ))}
                {unscheduled.map((p) => (
                  <DraggableUnscheduled key={p.id} plan={p} color={projectColor(p.projectId)} timer={timer} showTimer={isToday} />
                ))}
              </section>
            )}
            <section className="flex flex-col gap-1.5">
              <div className="text-[11px] font-bold tracking-[0.08em] text-app-sub">未完了のタスク</div>
              {tasks.length === 0 && <div className="text-xs text-app-sub py-1">未完了のタスクはありません</div>}
              {groupByClient(taskGroups, projects, clients).map((cg) => {
                const key = cg.clientId ?? "__none__";
                const isCollapsed = collapsed.has(key);
                const count = cg.groups.reduce((n, g) => n + g.tasks.length, 0);
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    {/* クライアントの見出し（押すと開閉） */}
                    <button
                      type="button"
                      onClick={() => toggleClient(key)}
                      aria-expanded={!isCollapsed}
                      className="flex items-center gap-1.5 mt-1 px-1 py-1 rounded-lg text-left text-xs font-bold text-app-text bg-transparent border-none cursor-pointer hover:bg-app-bg"
                    >
                      <ChevronDown size={13} className={`shrink-0 text-app-sub transition-transform ${isCollapsed ? "-rotate-90" : ""}`} aria-hidden />
                      {cg.clientId ? <Building2 size={12} className="shrink-0 text-app-sub" aria-hidden /> : null}
                      <span className="flex-1 min-w-0 truncate">{cg.clientId ? clientName(cg.clientId) : "クライアントなし・その他"}</span>
                      <span className="text-[11px] font-normal text-app-sub tabular-nums">{count}</span>
                    </button>
                    {!isCollapsed &&
                      cg.groups.map((g) => {
                        const project = g.projectId ? projectById.get(g.projectId) : undefined;
                        return (
                          <div key={g.projectId ?? "none"} className="flex flex-col gap-1.5 pl-2">
                            {g.projectId ? (
                              <Link
                                href={`/admin/work/projects?project=${g.projectId}`}
                                className="flex items-center gap-1.5 text-xs font-semibold text-app-text no-underline hover:underline min-w-0"
                                title="プロジェクト・タスクの画面で開く"
                              >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project?.color || "#9AA6A2" }} aria-hidden />
                                <span className="truncate">{project?.name ?? "（プロジェクト）"}</span>
                              </Link>
                            ) : (
                              <div className="text-xs font-semibold text-app-sub">プロジェクトなし</div>
                            )}
                            {g.tasks.map((t) => (
                              <DraggableTask key={t.id} task={t} projects={projects} onOpen={onOpenTask} timer={timer} />
                            ))}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </section>
          </div>
          <div className="text-[10px] text-app-sub mt-2 hidden lg:block">タスクを押すと詳細、▶ でタイマー開始（複数同時に計測できます）。予定時間が未設定のものは60分で置き、下端を引いて調整できます。</div>
          <div className="text-[10px] text-app-sub mt-1 lg:hidden">スマホは長押ししてからドラッグします。</div>
        </div>

        {/* タイムライン */}
        <div className="bg-white rounded-2xl border border-app-border overflow-hidden min-w-0">
          {allDay.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-app-border">
              <span className="text-[10px] text-app-sub self-center">終日</span>
              {allDay.map((e, i) => (
                <span key={`${e.id}-${i}`} className="text-[11px] px-2 py-0.5 rounded bg-app-bg text-app-text">
                  {e.title}
                </span>
              ))}
            </div>
          )}
          {importable.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-app-border bg-accent-light">
              <span className="text-xs text-app-text">
                Google の予定が {importable.length} 件、まだ計画に入っていません（予定を押すと1件ずつ取り込めます）
              </span>
              <button
                type="button"
                onClick={() => onImportEvents(importable.map((e) => eventToPlan(e)!))}
                className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-white text-xs font-bold border-none cursor-pointer"
              >
                <CalendarPlus size={13} aria-hidden />
                すべて計画に取り込む
              </button>
            </div>
          )}
          <div className="grid grid-cols-[44px_minmax(0,22%)_1fr_minmax(0,18%)] text-[10px] font-bold text-app-sub border-b border-app-border">
            <div />
            <div className="px-2 py-1.5">予定（Google）</div>
            <div className="px-2 py-1.5 border-x border-app-border text-work-dark">計画</div>
            <div className="px-2 py-1.5">実績</div>
          </div>
          <div ref={scrollRef} className="relative overflow-y-auto" style={{ height: "min(70vh, 720px)" }}>
            <div className="grid grid-cols-[44px_minmax(0,22%)_1fr_minmax(0,18%)] relative">
              {/* 時刻の目盛り */}
              <div className="relative" style={{ height: DAY_END * PX_PER_MIN }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute right-1.5 text-[10px] text-app-sub tabular-nums -translate-y-1/2" style={{ top: h * HOUR_PX }}>
                    {h === 0 ? "" : `${h}:00`}
                  </div>
                ))}
              </div>

              {/* Google の予定（読み取り専用） */}
              <div className="relative" style={{ height: DAY_END * PX_PER_MIN }}>
                {googleTimed.map((e) => {
                  const s = timeToMinutes(e.startTime!);
                  const end = timeToMinutes(e.endTime!) || DAY_END;
                  const lay = googleLayout[e.id] ?? { col: 0, cols: 1 };
                  const imported = importedIds.has(e.id);
                  const asPlan = eventToPlan(e);
                  return (
                    <button
                      type="button"
                      key={e.id}
                      disabled={imported || !asPlan}
                      onClick={() => asPlan && onImportEvents([asPlan])}
                      className={`absolute rounded-md border px-1.5 py-0.5 overflow-hidden text-left ${
                        imported ? "bg-white border-dashed border-app-border cursor-default" : "bg-app-bg border-app-border cursor-pointer hover:border-app-sub"
                      }`}
                      style={{
                        top: s * PX_PER_MIN,
                        height: Math.max((Math.max(end, s + 15) - s) * PX_PER_MIN, 16),
                        left: `calc(${(lay.col / lay.cols) * 100}% + 2px)`,
                        width: `calc(${100 / lay.cols}% - 4px)`,
                      }}
                      title={`${e.title}（${e.startTime}〜${e.endTime}）${imported ? "・計画に取り込み済み" : "・押すと計画に取り込む"}`}
                      aria-label={`Google の予定「${e.title}」${e.startTime}〜${e.endTime}${imported ? "（計画に取り込み済み）" : "。押すと計画に取り込む"}`}
                    >
                      <div className={`flex items-center gap-0.5 text-[11px] truncate ${imported ? "text-app-sub" : "text-app-text"}`}>
                        {imported && <Check size={10} className="shrink-0" aria-hidden />}
                        {e.title}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 計画（ドロップ先） */}
              <PlanLane laneRef={laneRef}>
                {timed.map((p) => {
                  const lay = planLayout[p.id] ?? { col: 0, cols: 1 };
                  return (
                    <PlanBlock
                      key={p.id}
                      plan={p}
                      start={timeToMinutes(p.startTime!)}
                      duration={p.plannedMinutes}
                      col={lay.col}
                      cols={lay.cols}
                      color={projectColor(p.projectId)}
                      onOpen={onOpenPlan}
                      preview={preview?.id === p.id ? preview : null}
                    />
                  );
                })}
              </PlanLane>

              {/* 実績（タイマー） */}
              <div className="relative" style={{ height: DAY_END * PX_PER_MIN }}>
                {actuals.map(({ e, iv }) => {
                  const lay = actualLayout[e.id] ?? { col: 0, cols: 1 };
                  return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onOpenEntry(e)}
                    title={`${entryTitle(e)}（${minutesToTime(iv.start)}〜${minutesToTime(iv.end)}）`}
                    className={`absolute rounded-md border-none px-1.5 py-0.5 text-left overflow-hidden cursor-pointer ${
                      e.endedAt ? "bg-primary/80" : "bg-danger/80"
                    }`}
                    style={{
                      top: iv.start * PX_PER_MIN,
                      height: Math.max((iv.end - iv.start) * PX_PER_MIN, 6),
                      left: `calc(${(lay.col / lay.cols) * 100}% + 2px)`,
                      width: `calc(${100 / lay.cols}% - 4px)`,
                    }}
                  >
                    <span className="text-[10px] text-white font-semibold truncate block">{entryTitle(e)}</span>
                  </button>
                  );
                })}
              </div>

              {/* 時刻の横線 */}
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute left-[44px] right-0 border-t border-app-border/70" style={{ top: h * HOUR_PX }} />
                ))}
                {isToday && (
                  <div className="absolute left-[44px] right-0 z-30" style={{ top: nowMin * PX_PER_MIN }}>
                    <div className="relative border-t-2 border-danger">
                      <span className="absolute -left-1.5 -top-[5px] w-2 h-2 rounded-full bg-danger" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {untimedEntries.length > 0 && (
            <div className="border-t border-app-border px-3 py-2">
              <div className="text-[10px] font-bold text-app-sub mb-1">時刻なしの実績（手入力）</div>
              {untimedEntries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onOpenEntry(e)}
                  className="w-full flex justify-between py-1 text-sm text-app-text bg-transparent border-none cursor-pointer text-left"
                >
                  <span className="truncate">{entryTitle(e)}</span>
                  <span className="text-app-sub tabular-nums">{formatMinutes(entryMinutes(e, now))}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ドラッグ中に指の下に表示する見た目 */}
      <DragOverlay dropAnimation={null}>
        {active && (active.kind === "task" || active.kind === "unscheduled" || active.kind === "routine") ? (
          <div
            className="rounded-lg bg-work-light border-2 border-work px-3 py-1.5 shadow-xl w-48"
            style={{ height: Math.max(active.duration * PX_PER_MIN, 28) }}
          >
            <div className="text-[12px] font-bold text-work-dark truncate">
              {active.kind === "task" ? active.task.title : active.kind === "routine" ? active.routine.title : active.plan.title}
            </div>
            <div className="text-[10px] text-app-sub">{formatMinutes(active.duration)}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
