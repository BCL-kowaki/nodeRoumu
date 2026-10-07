"use client";

import { useState } from "react";
import { todayJst } from "@/lib/date-jst";
import { WEEKDAY_BITS, WEEKDAY_NAMES, WEEKDAY_ORDER } from "@/lib/work/recurrence";
import ProjectOptions from "./ProjectOptions";
import { api, inputClass, labelClass, type Client, type Project, type Routine } from "./types";
import RichTextEditor from "@/components/RichTextEditor";

const FREQUENCIES = [
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
] as const;

// ルーティンの作成・編集ウィンドウ。routine が null なら新規作成
export default function RoutineEditor({
  routine,
  projects,
  clients,
  onClose,
  onSaved,
}: {
  routine: Routine | null;
  projects: Project[];
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: routine?.title ?? "",
    description: routine?.description ?? "",
    frequency: routine?.frequency ?? "daily",
    // 平日（月〜金）を初期値にする
    weekdays: routine?.weekdays || WEEKDAY_BITS[1] | WEEKDAY_BITS[2] | WEEKDAY_BITS[3] | WEEKDAY_BITS[4] | WEEKDAY_BITS[5],
    monthDay: routine?.monthDay ?? 1,
    skipClosedDays: routine?.skipClosedDays ?? false,
    plannedMinutes: routine?.plannedMinutes != null ? String(routine.plannedMinutes) : "",
    active: routine?.active ?? true,
    startDate: routine?.startDate?.slice(0, 10) ?? todayJst(),
    endDate: routine?.endDate?.slice(0, 10) ?? "",
    projectId: routine?.projectId ?? "",
    clientId: routine?.clientId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

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
        frequency: form.frequency,
        weekdays: form.weekdays,
        monthDay: form.monthDay,
        skipClosedDays: form.skipClosedDays,
        plannedMinutes: minutes === "" ? null : Number(minutes),
        active: form.active,
        startDate: form.startDate,
        endDate: form.endDate || null,
        projectId: form.projectId || null,
        clientId: form.clientId || null,
      });
      if (routine) await api(`/api/work/routines/${routine.id}`, { method: "PUT", body });
      else await api("/api/work/routines", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!routine || !window.confirm(`「${routine.title}」を削除しますか？\n（これまでの実施記録も消えます。残したい場合は「停止」にしてください）`)) return;
    setSaving(true);
    try {
      await api(`/api/work/routines/${routine.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  // プロジェクトは選んだクライアントのものだけ候補に出す（クライアント未選択なら全部）
  const selectable = projects.filter(
    (p) =>
      (p.status === "active" || p.status === "on_hold" || p.id === form.projectId) &&
      (!form.clientId || p.clientId === form.clientId)
  );
  // クライアントを変えたら、合わなくなったプロジェクトは外す
  const changeClient = (clientId: string) =>
    setForm((f) => {
      const project = projects.find((p) => p.id === f.projectId);
      return { ...f, clientId, projectId: project && clientId && project.clientId !== clientId ? "" : f.projectId };
    });
  // プロジェクトを選んだら、クライアントもそのプロジェクトのものにそろえる
  const changeProject = (projectId: string) =>
    setForm((f) => ({ ...f, projectId, clientId: projects.find((p) => p.id === projectId)?.clientId ?? f.clientId }));

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[200]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={routine ? "ルーティンの編集" : "ルーティンの追加"}
        className="fixed inset-x-4 top-[6%] bottom-[6%] overflow-y-auto bg-white rounded z-[300] shadow-lg max-w-app mx-auto p-5"
      >
        <div className="text-sm font-bold text-app-text mb-3">{routine ? "ルーティンの編集" : "ルーティンの追加"}</div>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass} htmlFor="routine-title">ルーティン名</label>
            <input id="routine-title" className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
          </div>

          <div>
            <span className={labelClass}>繰り返し</span>
            <div className="flex gap-2" role="radiogroup" aria-label="繰り返し">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={form.frequency === f.value}
                  onClick={() => set("frequency", f.value)}
                  className={`flex-1 py-2 rounded text-sm font-semibold border cursor-pointer ${
                    form.frequency === f.value ? "bg-primary text-white border-primary" : "bg-white text-app-text border-app-border"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {form.frequency === "weekly" && (
            <div>
              <span className={labelClass}>曜日</span>
              <div className="flex gap-1">
                {WEEKDAY_ORDER.map((i) => {
                  const on = (form.weekdays & WEEKDAY_BITS[i]) !== 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("weekdays", form.weekdays ^ WEEKDAY_BITS[i])}
                      className={`flex-1 py-2 rounded text-sm font-semibold border cursor-pointer ${
                        on ? "bg-primary text-white border-primary" : "bg-white text-app-sub border-app-border"
                      }`}
                    >
                      {WEEKDAY_NAMES[i]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.frequency === "monthly" && (
            <div>
              <label className={labelClass} htmlFor="routine-monthday">日付</label>
              <select
                id="routine-monthday"
                className={inputClass}
                value={form.monthDay}
                onChange={(e) => set("monthDay", Number(e.target.value))}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}日{d >= 29 ? "（無い月は月末）" : ""}</option>
                ))}
                <option value={-1}>月末</option>
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.skipClosedDays}
              onChange={(e) => set("skipClosedDays", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-app-text">休日（定休日・会社休日）は除く</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} htmlFor="routine-start">開始日</label>
              <input id="routine-start" type="date" className={inputClass} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="routine-end">終了日（任意）</label>
              <input id="routine-end" type="date" className={inputClass} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="routine-minutes">予定時間（分）</label>
              <input
                id="routine-minutes"
                inputMode="numeric"
                className={inputClass}
                value={form.plannedMinutes}
                onChange={(e) => set("plannedMinutes", e.target.value)}
                placeholder="例: 15"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="routine-client">クライアント</label>
              <select id="routine-client" className={inputClass} value={form.clientId} onChange={(e) => changeClient(e.target.value)}>
                <option value="">（なし）</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="routine-project">プロジェクト</label>
              <select id="routine-project" className={inputClass} value={form.projectId} onChange={(e) => changeProject(e.target.value)}>
                <option value="">（なし）</option>
                <ProjectOptions projects={selectable} clients={clients} />
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="routine-desc">メモ</label>
            <RichTextEditor id="routine-desc" value={form.description} onChange={(v) => set("description", v)} minHeight={90} />
          </div>

          {routine && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!form.active}
                onChange={(e) => set("active", !e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-app-text">停止する（記録は残したまま、実施日に出さない）</span>
            </label>
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
            <button onClick={onClose} className="px-5 py-2.5 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer">
              閉じる
            </button>
          </div>
          {routine && (
            <button onClick={remove} disabled={saving} className="text-xs text-danger bg-transparent border-none cursor-pointer self-start p-0">
              このルーティンを削除
            </button>
          )}
        </div>
      </div>
    </>
  );
}
