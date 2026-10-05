"use client";

import { useState } from "react";
import { PROJECT_STATUS_LABELS } from "@/lib/work/labels";
import { PROJECT_STATUSES } from "@/lib/work/validate";
import { api, inputClass, labelClass, type Project } from "./types";

const COLORS = ["#21977f", "#1e88e5", "#8e24aa", "#f4511e", "#fb8c00", "#6d4c41", "#546e7a"];

// プロジェクトの作成・編集ウィンドウ。project が null なら新規作成
export default function ProjectEditor({
  project,
  onClose,
  onSaved,
  onDeleted,
}: {
  project: Project | null;
  onClose: () => void;
  onSaved: (saved: Project) => void;
  onDeleted?: () => void;
}) {
  const [form, setForm] = useState({
    name: project?.name ?? "",
    description: project?.description ?? "",
    status: project?.status ?? "active",
    color: project?.color ?? COLORS[0],
    startDate: project?.startDate?.slice(0, 10) ?? "",
    dueDate: project?.dueDate?.slice(0, 10) ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const body = JSON.stringify({
        ...form,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
      });
      const saved = project
        ? await api<Project>(`/api/work/projects/${project.id}`, { method: "PUT", body })
        : await api<Project>("/api/work/projects", { method: "POST", body });
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!project) return;
    if (!window.confirm(`「${project.name}」を削除しますか？\n（このプロジェクトのタスクは残り、プロジェクト未設定になります）`)) return;
    setSaving(true);
    try {
      await api(`/api/work/projects/${project.id}`, { method: "DELETE" });
      onDeleted?.();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[200]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={project ? "プロジェクトの編集" : "プロジェクトの追加"}
        className="fixed inset-x-4 top-[8%] bottom-[8%] overflow-y-auto bg-white rounded z-[300] shadow-lg max-w-app mx-auto p-5"
      >
        <div className="text-sm font-bold text-app-text mb-3">
          {project ? "プロジェクトの編集" : "プロジェクトの追加"}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass} htmlFor="project-name">プロジェクト名</label>
            <input id="project-name" className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} htmlFor="project-status">状態</label>
              <select id="project-status" className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={labelClass}>色</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`色 ${c}`}
                    onClick={() => set("color", c)}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer ${form.color === c ? "border-app-text" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="project-start">開始日</label>
              <input id="project-start" type="date" className={inputClass} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="project-due">期限日</label>
              <input id="project-due" type="date" className={inputClass} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="project-desc">説明</label>
            <textarea
              id="project-desc"
              className={`${inputClass} min-h-[96px]`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {error && <div className="text-sm text-danger bg-danger-light rounded p-3 text-center">{error}</div>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer">
              閉じる
            </button>
          </div>
          {project && onDeleted && (
            <button onClick={remove} disabled={saving} className="text-xs text-danger bg-transparent border-none cursor-pointer self-start p-0">
              このプロジェクトを削除
            </button>
          )}
        </div>
      </div>
    </>
  );
}
