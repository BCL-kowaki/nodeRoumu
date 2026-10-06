"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import Card from "@/components/Card";
import { STATUS_LABELS } from "@/lib/attendance-status";

type Change = {
  id: string;
  date: string;
  changes: Record<string, [string | number | null, string | number | null]>;
  source: string;
  tokenName: string | null;
  createdAt: string;
};

const FIELD_LABELS: Record<string, string> = {
  startTime: "出勤",
  endTime: "退勤",
  breakMinutes: "休憩",
  status: "状態",
  memo: "備考",
};

const show = (field: string, v: string | number | null) => {
  if (v === null || v === "") return "（なし）";
  if (field === "status") return STATUS_LABELS[String(v)] ?? String(v);
  if (field === "breakMinutes") return `${v}分`;
  return String(v);
};

// 出勤簿の変更履歴（AI 連携からの修正）。その月に記録があるときだけ表示する
export default function AttendanceChanges({ employeeId, month, reloadKey }: { employeeId: string; month: string; reloadKey?: number }) {
  const [items, setItems] = useState<Change[]>([]);

  useEffect(() => {
    if (!employeeId) return;
    let alive = true;
    fetch(`/api/attendance/changes?employeeId=${employeeId}&month=${month}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => alive && setItems(Array.isArray(d) ? d : []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [employeeId, month, reloadKey]);

  if (items.length === 0) return null;
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-1.5 text-sm font-bold text-app-text mb-2">
        <Bot size={16} className="text-accent" aria-hidden />
        AI による変更履歴（{items.length}件）
      </div>
      <div className="flex flex-col">
        {items.map((c) => (
          <div key={c.id} className="py-2 border-b border-app-border last:border-b-0 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 text-app-sub">
              <span className="font-bold text-app-text">{c.date.slice(5, 10).replace("-", "/")} の出勤簿</span>
              <span>
                {new Date(c.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              {c.tokenName && <span>鍵「{c.tokenName}」</span>}
            </div>
            <div className="mt-0.5 text-app-text">
              {Object.entries(c.changes).map(([field, [before, after]]) => (
                <span key={field} className="mr-3 inline-block">
                  {FIELD_LABELS[field] ?? field}: {show(field, before)} → <b>{show(field, after)}</b>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
