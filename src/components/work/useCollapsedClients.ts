"use client";

import { useCallback, useEffect, useState } from "react";

// たたんでいるクライアント（この端末のブラウザに覚えておく。プロジェクト・タスクと計画・実績の画面で共通）
const COLLAPSED_KEY = "node-portal:collapsed-clients";

export function useCollapsedClients() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((x): x is string => typeof x === "string")));
    } catch {
      // 保存できない環境（プライベートモードなど）では、毎回すべて開いた状態で始める
    }
  }, []);

  const toggle = useCallback((clientId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        // 保存できなくても、画面上の開閉はそのまま使える
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
