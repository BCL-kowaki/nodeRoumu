"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, NotebookPen, Plus } from "lucide-react";
import Card from "@/components/Card";
import ClientTasks from "./ClientTasks";
import NoteMarkdown from "./NoteMarkdown";
import { defaultProjectFor, memoLines, sortClientTasks, tasksOfClient } from "@/lib/work/client-tasks";
import { entryMinutes } from "@/lib/work/time";
import { api, type Client, type DailyNote, type Project, type Task, type TimeEntry } from "./types";

const COLLAPSED_KEY = "node-portal:handover-collapsed";
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

// タイムラインの上に出す「引き継ぎ・タスク」。小さなタスクはここで管理する
// （前回のメモの行からタスクを作る・その日のうちに足す・完了にする）。開閉はこの端末に覚える
export default function HandoverBoard({
  previous,
  clients,
  projects,
  tasks,
  doneTasks,
  entries,
  colors,
  onOpenTask,
  onTasksChanged,
}: {
  previous: DailyNote[];
  clients: Client[];
  projects: Project[];
  tasks: Task[]; // 未完了
  doneTasks: Task[]; // その日に完了
  entries: TimeEntry[];
  colors: Map<string, string>;
  onOpenTask: (t: Task) => void;
  onTasksChanged: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true);
    } catch {
      // 保存できない環境では開いた状態で始める
    }
  }, []);
  const toggle = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1");
    } catch {
      // 覚えられなくても開閉はできる
    }
  };

  const workedToday = new Set(entries.map((e) => e.taskId).filter((id): id is string => !!id));
  const usage = entries.map((e) => ({ projectId: e.projectId ?? e.task?.projectId ?? e.plan?.projectId ?? null, minutes: entryMinutes(e, new Date()) }));
  // 前回のメモがある、または未完了・今日完了のタスクがあるクライアント（一覧の並び順）
  const shown = clients.filter(
    (c) => previous.some((n) => n.clientId === c.id) || tasksOfClient(tasks, c.id, projects).length > 0 || tasksOfClient(doneTasks, c.id, projects).length > 0
  );
  if (shown.length === 0) return null;
  const noteCount = previous.length;

  return (
    <Card className="!p-0 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-transparent border-none cursor-pointer hover:bg-app-bg"
      >
        <NotebookPen size={14} className="text-accent-dark shrink-0" aria-hidden />
        <span className="text-sm font-bold text-app-text">引き継ぎ・タスク</span>
        <span className="text-[11px] text-app-sub">
          {shown.length}社{noteCount > 0 && `・前回のメモ ${noteCount}件`}
        </span>
        <ChevronDown size={14} className={`ml-auto text-app-sub transition-transform ${collapsed ? "-rotate-90" : ""}`} aria-hidden />
      </button>
      {!collapsed && (
        <ul className="list-none m-0 p-0 border-t border-app-border grid grid-cols-1 md:grid-cols-2">
          {shown.map((c) => {
            const addable = projects.filter((p) => p.clientId === c.id && (p.status === "active" || p.status === "on_hold"));
            const open = sortClientTasks(tasksOfClient(tasks, c.id, projects), workedToday);
            const done = tasksOfClient(doneTasks, c.id, projects);
            const note = previous.find((n) => n.clientId === c.id);
            return (
              <li key={c.id} className="px-4 py-3 border-b border-app-border md:odd:border-r min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colors.get(c.id) ?? "#9AA6A2" }} aria-hidden />
                  <span className="flex-1 min-w-0 truncate text-xs font-bold text-app-text">{c.name}</span>
                  {note && <span className="text-[10px] text-app-sub tabular-nums">{md(note.date)} のメモ</span>}
                </div>
                {note && (
                  <MemoToTasks
                    note={note}
                    existing={[...open, ...done].map((t) => t.title)}
                    projects={addable}
                    defaultProjectId={defaultProjectFor(c.id, addable, usage)}
                    onCreated={onTasksChanged}
                  />
                )}
                <ClientTasks
                  key={`${c.id}:${addable.length}`}
                  open={open}
                  doneToday={done}
                  workedToday={workedToday}
                  projects={addable}
                  defaultProjectId={defaultProjectFor(c.id, addable, usage)}
                  onOpenTask={onOpenTask}
                  onChanged={onTasksChanged}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// 前回のメモを1行ずつ出し、行の「＋」でその行をタスクにする（すでに同じ名前のタスクがあれば「タスク済」）
function MemoToTasks({
  note,
  existing,
  projects,
  defaultProjectId,
  onCreated,
}: {
  note: DailyNote;
  existing: string[];
  projects: Project[];
  defaultProjectId: string | null;
  onCreated: () => void;
}) {
  const [choosing, setChoosing] = useState<number | null>(null); // プロジェクトを選んでいる行
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lines = memoLines(note.body);
  const has = new Set(existing);

  const create = async (i: number, title: string, pid: string) => {
    setBusy(i);
    setError(null);
    try {
      await api("/api/work/tasks", { method: "POST", body: JSON.stringify({ title, projectId: pid }) });
      setChoosing(null);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  // プロジェクトが1つならすぐ作る。複数あればその場で選んでから作る
  const onPlus = (i: number, title: string) => {
    if (projects.length === 1) create(i, title, projects[0].id);
    else {
      setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
      setChoosing(i);
    }
  };

  return (
    <div className="mt-2 rounded-lg bg-accent-light/60 border border-accent/30 px-3 py-2">
      <div className="text-[10px] font-bold text-accent-dark mb-1">前回からの引き継ぎ（行の ＋ でタスクにできます）</div>
      <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
        {lines.map((l, i) => (
          <li key={i}>
            {l.kind === "heading" ? (
              <div className="text-[11px] font-bold text-app-sub mt-1">{l.text}</div>
            ) : (
              <div className="flex items-start gap-1.5 min-w-0">
                <div className={`flex-1 min-w-0 text-[12.5px] leading-snug ${l.kind === "done" ? "text-app-sub line-through" : "text-app-text"}`}>
                  <NoteMarkdown content={l.text} />
                </div>
                {l.kind === "item" &&
                  (has.has(l.text) ? (
                    <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-app-sub mt-0.5" title="同じ名前のタスクがあります">
                      <Check size={11} aria-hidden /> タスク済
                    </span>
                  ) : projects.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => onPlus(i, l.text)}
                      disabled={busy !== null}
                      aria-label={`「${l.text}」をタスクにする`}
                      title="この行をタスクにする"
                      className="shrink-0 w-5 h-5 mt-px flex items-center justify-center rounded border border-accent/50 bg-white text-accent-dark cursor-pointer hover:bg-accent hover:text-white disabled:opacity-40"
                    >
                      <Plus size={12} aria-hidden />
                    </button>
                  ) : null)}
              </div>
            )}
            {choosing === i && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-1 pl-2">
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  aria-label="タスクを入れるプロジェクト"
                  className="max-w-[180px] px-1.5 py-1 rounded border border-app-border text-[11px] bg-white"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => create(i, l.text, projectId)}
                  disabled={!projectId || busy !== null}
                  className="px-2.5 py-1 rounded bg-primary text-white text-[11px] font-bold border-none cursor-pointer disabled:opacity-40"
                >
                  タスクにする
                </button>
                <button type="button" onClick={() => setChoosing(null)} className="px-2 py-1 rounded bg-white border border-app-border text-[11px] cursor-pointer">
                  やめる
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <div className="text-[11px] text-danger mt-1">{error}</div>}
    </div>
  );
}
