"use client";

import { useEffect, useState } from "react";
import { formatElapsed, isLongRunning } from "@/lib/work/time";
import { entryTitle, type TimeEntry } from "./types";

// 計測中のタイマーの表示（経過時間は開始時刻から画面側で毎秒計算するので、再読み込みや別の端末でも続く）
export default function TimerBar({
  running,
  busy,
  onStop,
}: {
  running: TimeEntry | null;
  busy: boolean;
  onStop: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!running?.startedAt) return null;
  const startedMs = Date.parse(running.startedAt);
  const long = isLongRunning(running.startedAt, new Date(now));

  return (
    <div
      role="status"
      className={`rounded-2xl p-4 border flex items-center gap-3 ${
        long ? "bg-danger-light border-danger" : "bg-primary-light border-primary"
      }`}
    >
      <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-app-sub">計測中</div>
        <div className="text-sm font-bold text-app-text truncate">{entryTitle(running)}</div>
        {long && <div className="text-[11px] text-danger mt-0.5">12時間を超えています。止め忘れの場合は停止して時間を修正してください</div>}
      </div>
      <div className="text-lg font-bold tabular-nums text-app-text">{formatElapsed((now - startedMs) / 1000)}</div>
      <button
        onClick={onStop}
        disabled={busy}
        className="px-4 py-2 rounded bg-danger text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
      >
        停止
      </button>
    </div>
  );
}
