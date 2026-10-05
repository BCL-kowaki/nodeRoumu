"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Project, type Task } from "./types";

// タスク一覧とプロジェクト一覧（編集ウィンドウの選択肢用）を読み込む
export function useTasks(query: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([
        api<Task[]>(`/api/work/tasks${query ? `?${query}` : ""}`),
        api<Project[]>("/api/work/projects"),
      ]);
      setTasks(t);
      setProjects(p);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    reload();
  }, [reload]);

  // 完了／未完了の切り替え（画面は先に切り替え、失敗したら元に戻す）
  const toggle = useCallback(
    async (task: Task) => {
      const next = task.status === "done" ? "todo" : "done";
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
      try {
        await api(`/api/work/tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ status: next }) });
        await reload();
      } catch (e) {
        setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
        setError((e as Error).message);
      }
    },
    [reload]
  );

  return { tasks, projects, loading, error, reload, toggle };
}
