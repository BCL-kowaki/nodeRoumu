"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type CheckStatus, type Routine, type RoutineDay } from "./types";

// ルーティン一覧と、期間内の実施日・実施状況を読み込む
export function useRoutineChecks(from: string, to: string) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([
        api<Routine[]>("/api/work/routines"),
        api<{ days: RoutineDay[] }>(`/api/work/routines/checks?from=${from}&to=${to}`),
      ]);
      setRoutines(r);
      setDays(c.days);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  // 実施状況を変更（null なら記録を取り消す）。画面は先に切り替え、失敗したら読み直す
  const setStatus = useCallback(
    async (routineId: string, date: string, status: CheckStatus) => {
      setDays((ds) =>
        ds.map((d) =>
          d.date !== date
            ? d
            : { ...d, items: d.items.map((i) => (i.routineId === routineId ? { ...i, status } : i)) }
        )
      );
      try {
        if (status === null) {
          await api(`/api/work/routines/checks?routineId=${routineId}&date=${date}`, { method: "DELETE" });
        } else {
          await api("/api/work/routines/checks", {
            method: "PUT",
            body: JSON.stringify({ routineId, date, status }),
          });
        }
      } catch (e) {
        setError((e as Error).message);
        reload();
      }
    },
    [reload]
  );

  return { routines, days, loading, error, reload, setStatus };
}
