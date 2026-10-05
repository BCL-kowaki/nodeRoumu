"use client";

import Badge from "@/components/Badge";
import { todayJst } from "@/lib/date-jst";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, dueLabel, formatMinutes } from "@/lib/work/labels";
import type { Task } from "./types";

// タスク一覧の1行。チェックで完了／未完了を切り替え、行を押すと編集
export default function TaskRow({
  task,
  onToggle,
  onOpen,
  showProject = true,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  showProject?: boolean;
}) {
  const done = task.status === "done";
  const canceled = task.status === "canceled";
  const due = dueLabel(task.dueDate, todayJst(), done || canceled);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-app-border last:border-b-0">
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(task)}
        aria-label={done ? "未完了に戻す" : "完了にする"}
        className="mt-1 w-4 h-4 accent-primary cursor-pointer shrink-0"
      />
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer"
      >
        <div
          className={`text-sm font-semibold break-words ${
            done || canceled ? "line-through text-app-sub" : "text-app-text"
          }`}
        >
          {task.title}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {task.priority === 1 && !done && <Badge type="danger">優先度 {PRIORITY_LABELS[1]}</Badge>}
          {task.status === "doing" && <Badge type="success">{TASK_STATUS_LABELS.doing}</Badge>}
          {canceled && <Badge type="default">{TASK_STATUS_LABELS.canceled}</Badge>}
          {due && <Badge type={due.tone}>{due.text}</Badge>}
          {task.plannedMinutes !== null && (
            <span className="text-[11px] text-app-sub">予定 {formatMinutes(task.plannedMinutes)}</span>
          )}
          {showProject && task.project && (
            <span className="inline-flex items-center gap-1 text-[11px] text-app-sub">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: task.project.color || "#888888" }}
              />
              {task.project.name}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
