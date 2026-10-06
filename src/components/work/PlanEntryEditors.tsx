"use client";

import { useState } from "react";
import ProjectOptions, { TaskOptions } from "./ProjectOptions";
import { api, entryTitle, inputClass, labelClass, type Plan, type Project, type Task, type TimeEntry } from "./types";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[200]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        className="fixed inset-x-4 top-[10%] max-h-[80%] overflow-y-auto bg-white rounded z-[300] shadow-lg max-w-app mx-auto p-5"
      >
        <div className="text-sm font-bold text-app-text mb-3">{title}</div>
        {children}
      </div>
    </>
  );
}

function Buttons({ saving, onSave, onClose, onDelete, deleteLabel }: {
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
  deleteLabel: string;
}) {
  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
        >
          {saving ? "保存中…" : "保存する"}
        </button>
        <button onClick={onClose} className="px-5 py-2.5 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer">
          閉じる
        </button>
      </div>
      {onDelete && (
        <button onClick={onDelete} disabled={saving} className="text-xs text-danger bg-transparent border-none cursor-pointer self-start p-0">
          {deleteLabel}
        </button>
      )}
    </>
  );
}

// 分数の入力欄の値を数値に（空や数字以外は null）
const toMinutes = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

// 業務計画の作成・編集
export function PlanEditor({
  plan,
  date,
  tasks,
  projects,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  date: string;
  tasks: Task[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: plan?.title ?? "",
    startTime: plan?.startTime ?? "",
    plannedMinutes: plan ? String(plan.plannedMinutes) : "60",
    taskId: plan?.taskId ?? "",
    projectId: plan?.projectId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // タスクを選んだら、タイトルが空ならタスク名を入れる
  const pickTask = (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    setForm((f) => ({
      ...f,
      taskId,
      title: f.title || t?.title || "",
      projectId: f.projectId || t?.projectId || "",
    }));
  };

  const save = async () => {
    const minutes = toMinutes(form.plannedMinutes);
    if (minutes === null) return setError("予定時間は分単位の数字で入力してください");
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        date,
        title: form.title,
        startTime: form.startTime || null,
        plannedMinutes: minutes,
        taskId: form.taskId || null,
        projectId: form.projectId || null,
      });
      if (plan) await api(`/api/work/plans/${plan.id}`, { method: "PUT", body });
      else await api("/api/work/plans", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!plan || !window.confirm(`計画「${plan.title}」を削除しますか？`)) return;
    setSaving(true);
    try {
      await api(`/api/work/plans/${plan.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog title={plan ? "計画の編集" : "計画の追加"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelClass} htmlFor="plan-task">タスク（任意）</label>
          <select id="plan-task" className={inputClass} value={form.taskId} onChange={(e) => pickTask(e.target.value)}>
            <option value="">（なし）</option>
            <TaskOptions tasks={tasks} projects={projects} />
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="plan-title">タイトル</label>
          <input id="plan-title" className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass} htmlFor="plan-start">開始時刻（任意）</label>
            <input id="plan-start" type="time" className={inputClass} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </div>
          <div>
            <label className={labelClass} htmlFor="plan-minutes">予定時間（分）</label>
            <input id="plan-minutes" inputMode="numeric" className={inputClass} value={form.plannedMinutes} onChange={(e) => set("plannedMinutes", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="plan-project">プロジェクト（任意）</label>
          <select id="plan-project" className={inputClass} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">（なし）</option>
            <ProjectOptions projects={projects.filter((p) => p.status === "active" || p.status === "on_hold" || p.id === form.projectId)} />
          </select>
        </div>
        {error && <div className="text-sm text-danger bg-danger-light rounded p-3 text-center">{error}</div>}
        <Buttons saving={saving} onSave={save} onClose={onClose} onDelete={plan ? remove : undefined} deleteLabel="この計画を削除" />
      </div>
    </Dialog>
  );
}

// 実績の手入力・編集（タイマーで記録した分の時間の修正もここで行う）
export function EntryEditor({
  entry,
  date,
  tasks,
  projects,
  onClose,
  onSaved,
}: {
  entry: TimeEntry | null;
  date: string;
  tasks: Task[];
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const running = !!entry?.startedAt && !entry.endedAt;
  const [form, setForm] = useState({
    minutes: entry?.minutes != null ? String(entry.minutes) : "30",
    note: entry?.note ?? "",
    taskId: entry?.taskId ?? "",
    projectId: entry?.projectId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const minutes = toMinutes(form.minutes);
    if (!running && minutes === null) return setError("時間は分単位の数字で入力してください");
    setSaving(true);
    setError(null);
    try {
      const links = { note: form.note, taskId: form.taskId || null, projectId: form.projectId || null };
      if (entry) {
        await api(`/api/work/time-entries/${entry.id}`, {
          method: "PUT",
          body: JSON.stringify(running ? links : { ...links, minutes }),
        });
      } else {
        await api("/api/work/time-entries", { method: "POST", body: JSON.stringify({ ...links, date, minutes }) });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry || !window.confirm(`実績「${entryTitle(entry)}」を削除しますか？`)) return;
    setSaving(true);
    try {
      await api(`/api/work/time-entries/${entry.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <Dialog title={entry ? "実績の編集" : "実績の手入力"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelClass} htmlFor="entry-minutes">かかった時間（分）</label>
          {running ? (
            <div className="text-xs text-app-sub">計測中のため、時間は停止後に確定します</div>
          ) : (
            <input id="entry-minutes" inputMode="numeric" className={inputClass} value={form.minutes} onChange={(e) => set("minutes", e.target.value)} />
          )}
          {entry?.source === "timer" && !running && (
            <div className="text-[11px] text-app-sub mt-1">タイマーで記録した時間です。止め忘れた場合はここで直せます</div>
          )}
        </div>
        <div>
          <label className={labelClass} htmlFor="entry-task">タスク（任意）</label>
          <select id="entry-task" className={inputClass} value={form.taskId} onChange={(e) => set("taskId", e.target.value)}>
            <option value="">（なし）</option>
            <TaskOptions tasks={tasks} projects={projects} />
            {entry?.task && !tasks.some((t) => t.id === entry.task!.id) && (
              <option value={entry.task.id}>{entry.task.title}</option>
            )}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="entry-project">プロジェクト（任意）</label>
          <select id="entry-project" className={inputClass} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">（なし）</option>
            <ProjectOptions projects={projects.filter((p) => p.status === "active" || p.status === "on_hold" || p.id === form.projectId)} />
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="entry-note">メモ</label>
          <input id="entry-note" className={inputClass} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="例: 電話対応" />
        </div>
        {error && <div className="text-sm text-danger bg-danger-light rounded p-3 text-center">{error}</div>}
        <Buttons saving={saving} onSave={save} onClose={onClose} onDelete={entry ? remove : undefined} deleteLabel="この実績を削除" />
      </div>
    </Dialog>
  );
}
