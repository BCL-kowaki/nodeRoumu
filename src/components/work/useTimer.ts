"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type TimeEntry, type TimerLinks } from "./types";

// 計測中のタイマー（複数可）の取得・開始・停止
export function useTimer(onChange?: () => void) {
  const [running, setRunning] = useState<TimeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRunning(await api<TimeEntry[]>("/api/work/timer"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const call = async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      await api<TimeEntry>("/api/work/timer", { method: "POST", body: JSON.stringify(body) });
      await reload();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const start = (links: TimerLinks) => call({ action: "start", ...links });
  // entryId を渡すとその1件、渡さなければ計測中をすべて止める
  const stop = (entryId?: string) => call({ action: "stop", ...(entryId ? { entryId } : {}) });
  // そのタスク・ルーティン・計画で計測中のタイマー（無ければ undefined）
  const runningFor = (t: { taskId?: string; routineId?: string; planId?: string }) =>
    running.find((r) =>
      t.taskId ? r.taskId === t.taskId : t.routineId ? r.routineId === t.routineId : t.planId ? r.planId === t.planId : false
    );

  return { running, error, busy, start, stop, reload, runningFor };
}
