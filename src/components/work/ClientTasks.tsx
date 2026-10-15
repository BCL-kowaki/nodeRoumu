"use client";

import { useState } from "react";
import { Check, ListTodo, Plus } from "lucide-react";
import { api, type Project, type Task } from "./types";

const SHOW = 6; // これより多いときは「ほか○件」でたたむ

// 実績の一覧で、クライアントのタスクを整理する（完了・戻す・追加。タスク名を押すと編集）
export default function ClientTasks({
  open,
  doneToday,
  workedToday,
  projects,
  defaultProjectId,
  onOpenTask,
  onChanged,
}: {
  open: Task[]; // 未完了（並べ替え済み）
  doneToday: Task[]; // その日に完了したもの
  workedToday: Set<string>;
  projects: Project[]; // このクライアントのプロジェクト
  defaultProjectId: string | null;
  onOpenTask: (t: Task) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");

  const setStatus = async (t: Task, status: "done" | "todo") => {
    setBusy(t.id);
    setError(null);
    try {
      await api(`/api/work/tasks/${t.id}`, { method: "PUT", body: JSON.stringify({ status }) });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    const name = title.trim();
    if (!name || !projectId) return;
    setBusy("__add__");
    setError(null);
    try {
      await api("/api/work/tasks", { method: "POST", body: JSON.stringify({ title: name, projectId }) });
      setTitle("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const projectName = (id: string | null) => (projects.length > 1 ? projects.find((p) => p.id === id)?.name : undefined);
  const visible = showAll ? open : open.slice(0, SHOW);
  if (open.length === 0 && doneToday.length === 0 && projects.length === 0) return null;

  return (
    <div className="mt-2.5 rounded-lg border border-app-border bg-white">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-app-border">
        <ListTodo size={13} className="text-app-sub shrink-0" aria-hidden />
        <span className="text-[11px] font-bold text-app-text">タスク</span>
        <span className="text-[10px] text-app-sub">
          未完了 {open.length}
          {doneToday.length > 0 && `・今日完了 ${doneToday.length}`}
        </span>
        {projects.length > 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-app-text bg-transparent border-none cursor-pointer hover:bg-app-bg"
          >
            <Plus size={12} aria-hidden /> 追加
          </button>
        )}
      </div>

      <ul className="list-none m-0 p-0">
        {visible.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            done={false}
            worked={workedToday.has(t.id)}
            project={projectName(t.projectId)}
            busy={busy === t.id}
            onToggle={() => setStatus(t, "done")}
            onOpen={() => onOpenTask(t)}
          />
        ))}
        {open.length > SHOW && (
          <li>
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full px-3 py-1 text-left text-[11px] text-app-sub bg-transparent border-none cursor-pointer hover:text-app-text"
            >
              {showAll ? "たたむ" : `ほか ${open.length - SHOW} 件`}
            </button>
          </li>
        )}
        {doneToday.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            done
            worked={false}
            project={projectName(t.projectId)}
            busy={busy === t.id}
            onToggle={() => setStatus(t, "todo")}
            onOpen={() => onOpenTask(t)}
          />
        ))}
        {open.length === 0 && doneToday.length === 0 && !adding && (
          <li className="px-3 py-2 text-[11px] text-app-sub">未完了のタスクはありません</li>
        )}
      </ul>

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-app-border bg-app-bg/60"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAdding(false);
            }}
            placeholder="タスク名（Enter で追加）"
            aria-label="追加するタスク名"
            maxLength={200}
            className="flex-1 min-w-[140px] px-2 py-1 rounded border border-app-border text-[12px] bg-white outline-none focus:border-primary"
          />
          {projects.length > 1 && (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="プロジェクト"
              className="max-w-[160px] px-1.5 py-1 rounded border border-app-border text-[11px] bg-white"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={!title.trim() || busy === "__add__"}
            className="px-2.5 py-1 rounded bg-primary text-white text-[11px] font-bold border-none cursor-pointer disabled:opacity-40"
          >
            追加
          </button>
          <button type="button" onClick={() => setAdding(false)} className="px-2 py-1 rounded bg-white border border-app-border text-[11px] cursor-pointer">
            閉じる
          </button>
        </form>
      )}
      {error && <div className="px-3 pb-2 text-[11px] text-danger">{error}</div>}
    </div>
  );
}

function TaskRow({
  task,
  done,
  worked,
  project,
  busy,
  onToggle,
  onOpen,
}: {
  task: Task;
  done: boolean;
  worked: boolean;
  project: string | undefined;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 border-b border-app-border/60 last:border-b-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `「${task.title}」を未完了に戻す` : `「${task.title}」を完了にする`}
        title={done ? "未完了に戻す" : "完了にする"}
        onClick={onToggle}
        disabled={busy}
        className={`w-4 h-4 shrink-0 flex items-center justify-center rounded border cursor-pointer disabled:opacity-40 ${
          done ? "bg-primary border-primary text-white" : "bg-white border-app-sub hover:border-primary"
        }`}
      >
        {done && <Check size={11} strokeWidth={3} aria-hidden />}
      </button>
      <button
        type="button"
        onClick={onOpen}
        title="押すと編集"
        className={`flex-1 min-w-0 text-left text-[12.5px] truncate bg-transparent border-none p-0 cursor-pointer hover:underline ${
          done ? "line-through text-app-sub" : "text-app-text"
        }`}
      >
        {task.title}
      </button>
      {done ? (
        <span className="shrink-0 text-[10px] text-app-sub">今日完了</span>
      ) : (
        <>
          {worked && <span className="shrink-0 px-1.5 rounded-full bg-accent-light text-accent-dark text-[10px] font-bold">今日作業</span>}
          {task.status === "doing" && !worked && <span className="shrink-0 text-[10px] text-app-sub">進行中</span>}
          {task.dueDate && <span className="shrink-0 text-[10px] text-app-sub tabular-nums">〜{Number(task.dueDate.slice(5, 7))}/{Number(task.dueDate.slice(8, 10))}</span>}
        </>
      )}
      {project && <span className="hidden sm:inline shrink-0 max-w-[120px] truncate text-[10px] text-app-sub">{project}</span>}
    </li>
  );
}
