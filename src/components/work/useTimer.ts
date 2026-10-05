"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type TimeEntry, type TimerLinks } from "./types";

// 計測中のタイマーの取得・開始・停止
export function useTimer(onChange?: () => void) {
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setRunning(await api<TimeEntry | null>("/api/work/timer"));
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
      const entry = await api<TimeEntry>("/api/work/timer", { method: "POST", body: JSON.stringify(body) });
      setRunning("action" in body && body.action === "start" ? entry : null);
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const start = (links: TimerLinks) => call({ action: "start", ...links });
  const stop = () => call({ action: "stop" });

  return { running, error, busy, start, stop, reload };
}
