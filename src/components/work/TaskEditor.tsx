"use client";

import { useState } from "react";
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/work/labels";
import { TASK_STATUSES } from "@/lib/work/validate";
import ProjectOptions from "./ProjectOptions";
import TaskAttachments from "./TaskAttachments";
import { api, inputClass, labelClass, type Project, type Task } from "./types";
import RichTextEditor from "@/components/RichTextEditor";

type Form = {
  title: string;
  description: string;
  status: string;
  priority: number;
  dueDate: string;
  plannedMinutes: string;
  projectId: string;
};

function toForm(task: Task | null, defaultProjectId?: string): Form {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? "todo",
    priority: task?.priority ?? 2,
    dueDate: task?.dueDate?.slice(0, 10) ?? "",
    plannedMinutes: task?.plannedMinutes != null ? String(task.plannedMinutes) : "",
    projectId: task?.projectId ?? defaultProjectId ?? "",
  };
}

// タスクの作成・編集ウィンドウ。task が null なら新規作成
export default function TaskEditor({
  task,
  projects,
  defaultProjectId,
  onClose,
  onSaved,
}: {
  task: Task | null;
  projects: Project[];
  defaultProjectId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(task, defaultProjectId));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError(null);
    const minutes = form.plannedMinutes.trim();
    if (minutes !== "" && !/^\d+$/.test(minutes)) {
      setError("予定時間は分単位の数字で入力してください");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        plannedMinutes: minutes === "" ? null : Number(minutes),
        projectId: form.projectId || null,
      });
      if (task) await api(`/api/work/tasks/${task.id}`, { method: "PUT", body });
      else await api("/api/work/tasks", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!task || !window.confirm(`「${task.title}」を削除しますか？`)) return;
    setSaving(true);
    try {
      await api(`/api/work/tasks/${task.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  // 選べるプロジェクト：完了・アーカイブ済みは、すでに紐づいている場合だけ表示
  const selectable = projects.filter(
    (p) => p.status === "active" || p.status === "on_hold" || p.id === form.projectId
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[200]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={task ? "タスクの編集" : "タスクの追加"}
        className="fixed inset-x-4 top-[8%] bottom-[8%] overflow-y-auto bg-white rounded z-[300] shadow-lg max-w-app mx-auto p-5"
      >
        <div className="text-sm font-bold text-app-text mb-3">{task ? "タスクの編集" : "タスクの追加"}</div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass} htmlFor="task-title">タイトル</label>
            <input
              id="task-title"
              className={inputClass}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} htmlFor="task-status">状態</label>
              <select id="task-status" className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="task-priority">優先度</label>
              <select
                id="task-priority"
                className={inputClass}
                value={form.priority}
                onChange={(e) => set("priority", Number(e.target.value))}
              >
                {[1, 2, 3].map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="task-due">期限日</label>
              <input
                id="task-due"
                type="date"
                className={inputClass}
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="task-minutes">予定時間（分）</label>
              <input
                id="task-minutes"
                inputMode="numeric"
                className={inputClass}
                value={form.plannedMinutes}
                onChange={(e) => set("plannedMinutes", e.target.value)}
                placeholder="例: 90"
              />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="task-project">プロジェクト</label>
            <select id="task-project" className={inputClass} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
              <option value="">（なし）</option>
              <ProjectOptions projects={selectable} />
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="task-desc">メモ</label>
            {/* 「プレビュー」でリンクを押して開ける */}
            <RichTextEditor id="task-desc" value={form.description} onChange={(v) => set("description", v)} minHeight={110} />
          </div>

          {/* 添付資料は、保存済みのタスクにだけ付けられる（新規作成では先に保存する） */}
          {task ? (
            <TaskAttachments taskId={task.id} />
          ) : (
            <div className="text-[11px] text-app-sub">添付資料は、タスクを保存したあとに付けられます</div>
          )}

          {error && <div className="text-sm text-danger bg-danger-light rounded p-3 text-center">{error}</div>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer"
            >
              閉じる
            </button>
          </div>
          {task && (
            <button
              onClick={remove}
              disabled={saving}
              className="text-xs text-danger bg-transparent border-none cursor-pointer self-start p-0"
            >
              このタスクを削除
            </button>
          )}
        </div>
      </div>
    </>
  );
}
