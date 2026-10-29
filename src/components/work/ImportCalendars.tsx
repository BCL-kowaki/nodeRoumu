"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { api, inputClass } from "./types";

type ImportCalendar = { id: string; calendarId: string; label: string; readable?: boolean; upcoming?: number | null; message?: string | null };

// 予定を取り込むカレンダー（会社のメイン以外）の登録。
// 個人の Gmail や取引先のカレンダーを、接続中のアカウントに共有してもらってから登録する
export default function ImportCalendars({ connectedEmail, onChanged }: { connectedEmail: string | null; onChanged: () => void }) {
  const [list, setList] = useState<ImportCalendar[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setList(await api<ImportCalendar[]>("/api/work/google/calendars?check=1").catch(() => []));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/work/google/calendars", { method: "POST", body: JSON.stringify({ calendarId, label }) });
      setCalendarId("");
      setLabel("");
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (c: ImportCalendar) => {
    if (!window.confirm(`「${c.label}」の取り込みをやめますか？\n（Google 側のカレンダーや予定はそのまま残ります）`)) return;
    setBusy(true);
    try {
      await api(`/api/work/google/calendars?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full mt-2 pt-3 border-t border-app-border flex flex-col gap-2">
      <div className="text-xs font-bold text-app-text flex items-center gap-1.5">
        <CalendarPlus size={13} aria-hidden /> ほかのカレンダーの予定も取り込む
      </div>
      <div className="text-[11px] text-app-sub leading-relaxed">
        個人の Gmail や取引先のカレンダーを、{connectedEmail ?? "接続中のアカウント"} に共有（「予定の表示（すべての予定の詳細）」）してから、
        カレンダー ID（多くは Gmail のアドレス）を登録します。予定は表示と計画への取り込みだけに使い、書き換えません。
        「空き時間だけ」の共有だと、予定名は「予定あり」と出ます。
      </div>
      {list.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-1">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded border border-app-border px-2.5 py-1.5">
              <span className="text-xs font-bold text-app-text shrink-0">{c.label}</span>
              {c.label !== c.calendarId && <span className="min-w-0 truncate text-[11px] text-app-sub">{c.calendarId}</span>}
              {/* 取り込めているか（読めるか・今日から2週間の予定の件数） */}
              {c.readable === true && (
                <span className="shrink-0 text-[10px] text-primary-dark bg-primary-light rounded px-1.5">読めています・2週間で{c.upcoming ?? 0}件</span>
              )}
              {c.readable === false && <span className="min-w-0 text-[10px] text-danger bg-danger-light rounded px-1.5">{c.message}</span>}
              <button
                type="button"
                onClick={() => remove(c)}
                disabled={busy}
                aria-label={`「${c.label}」の取り込みをやめる`}
                className="ml-auto shrink-0 w-6 h-6 flex items-center justify-center rounded text-app-sub bg-transparent border-none cursor-pointer hover:bg-app-bg hover:text-danger"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex flex-wrap gap-1.5"
      >
        <input
          value={calendarId}
          onChange={(e) => setCalendarId(e.target.value)}
          placeholder="カレンダー ID（例: name@gmail.com）"
          aria-label="カレンダー ID"
          className={`${inputClass} flex-[2_1_220px] !py-1.5 text-xs`}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="表示名（例: 個人・〇〇社）"
          aria-label="表示名"
          maxLength={40}
          className={`${inputClass} flex-[1_1_140px] !py-1.5 text-xs`}
        />
        <button
          type="submit"
          disabled={busy || !calendarId.trim()}
          className="px-3 py-1.5 rounded bg-primary text-white text-xs font-bold border-none cursor-pointer disabled:opacity-40"
        >
          {busy ? "確認中…" : "追加"}
        </button>
      </form>
      {error && <div className="text-[11px] text-danger">{error}</div>}
    </div>
  );
}
