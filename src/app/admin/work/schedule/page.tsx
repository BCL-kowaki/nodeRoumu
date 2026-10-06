"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { api, type Plan } from "@/components/work/types";
import { dayOfWeek } from "@/lib/attendance-status";
import { addDays, todayJst } from "@/lib/date-jst";
import { formatMinutes } from "@/lib/work/labels";
import { WEEKDAY_NAMES } from "@/lib/work/recurrence";
import { planEventEnd } from "@/lib/work/gcal";

type GStatus = {
  configured: boolean;
  encryptionConfigured: boolean;
  connected: boolean;
  status: "active" | "needs_reconnect" | null;
  email: string | null;
  calendarCreated: boolean;
  lastSyncedAt: string | null;
};
type DayEvent = { id: string; title: string; date: string; allDay: boolean; startTime: string | null; endTime: string | null; htmlLink?: string };

const ERRORS: Record<string, string> = {
  not_configured: "Google の設定（クライアントID など）が見つかりません",
  no_encryption_key: "トークンを暗号化する鍵（WORKSPACE_ENCRYPTION_KEY）が Vercel に設定されていません",
  canceled: "Google での接続がキャンセルされました",
  not_allowed: "このアカウントは接続できません（代表者の Workspace アカウントのみ）",
  no_refresh_token: "Google から更新用の許可が返りませんでした。もう一度「接続する」を押してください",
  failed: "Google との接続に失敗しました。もう一度お試しください",
};

const mondayOf = (d: string) => addDays(d, -((dayOfWeek(d) + 6) % 7));
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

function SchedulePage() {
  const sp = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayJst()));
  const weekEnd = addDays(weekStart, 6);
  const [gs, setGs] = useState<GStatus | null>(null);
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(sp.get("gcal_error") ? ERRORS[sp.get("gcal_error")!] ?? ERRORS.failed : null);
  const [message, setMessage] = useState<string | null>(sp.get("gcal_connected") ? "Google カレンダーに接続しました" : null);

  const load = useCallback(async () => {
    try {
      const status = await api<GStatus>("/api/work/google/status");
      setGs(status);
      const q = `from=${weekStart}&to=${weekEnd}`;
      setPlans(await api<Plan[]>(`/api/work/plans?${q}`));
      if (status.connected && status.status === "active") {
        try {
          setEvents(await api<DayEvent[]>(`/api/work/google/events?${q}`));
        } catch (e) {
          setEvents([]);
          setError((e as Error).message);
        }
      } else setEvents([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    load();
  }, [load]);

  const exportPlans = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await api<{ exported: number; skippedNoTime: number; failed: number }>("/api/work/google/export", {
        method: "POST",
        body: JSON.stringify({ from: weekStart, to: weekEnd }),
      });
      setMessage(
        `カレンダーに書き出しました：${r.exported} 件` +
          (r.skippedNoTime ? `（開始時刻のない計画 ${r.skippedNoTime} 件は対象外）` : "") +
          (r.failed ? `／失敗 ${r.failed} 件` : "")
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Google カレンダーとの接続を解除しますか？\n（書き出した予定はカレンダーに残ります）")) return;
    setBusy(true);
    try {
      await api("/api/work/google", { method: "DELETE" });
      setMessage("接続を解除しました");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayJst();
  const active = gs?.connected && gs.status === "active";

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg lg:text-2xl font-bold tracking-tight">スケジュール</div>

      {/* 接続状態 */}
      <Card className="!p-4">
        {!gs?.configured ? (
          <div className="text-xs text-app-sub">Google の設定が見つかりません。</div>
        ) : !gs.connected ? (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-app-text">Google カレンダーに接続すると、予定の表示と、計画の書き出しができます。</div>
            <div className="text-[11px] text-app-sub leading-relaxed">
              求める権限は「アプリが作る専用カレンダーの管理」と「既存の予定の読み取り（書き換えは不可）」だけです。
            </div>
            {!gs.encryptionConfigured && (
              <div className="text-xs text-danger">暗号化の鍵（WORKSPACE_ENCRYPTION_KEY）が未設定のため、まだ接続できません。</div>
            )}
            <a
              href="/api/work/google/auth"
              className={`block text-center py-2.5 rounded bg-primary text-white text-sm font-bold no-underline ${gs.encryptionConfigured ? "" : "opacity-50 pointer-events-none"}`}
            >
              Google カレンダーに接続する
            </a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {gs.status === "active" ? <Badge type="success">接続中</Badge> : <Badge type="danger">要再接続</Badge>}
            <span className="text-sm text-app-text break-all">{gs.email}</span>
            {gs.status === "needs_reconnect" && (
              <a href="/api/work/google/auth" className="text-xs text-primary">再接続する</a>
            )}
            <button onClick={disconnect} disabled={busy} className="ml-auto text-[11px] text-app-sub bg-transparent border-none cursor-pointer p-0">
              接続を解除
            </button>
          </div>
        )}
      </Card>

      {message && <div className="text-sm text-primary-dark bg-primary-light rounded p-3">{message}</div>}
      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      {/* 週の切り替えと書き出し */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="px-2 py-1 text-xs text-primary bg-transparent border-none cursor-pointer" aria-label="前の週">← 前の週</button>
        <div className="text-xs font-bold">{md(weekStart)}〜{md(weekEnd)}</div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="px-2 py-1 text-xs text-primary bg-transparent border-none cursor-pointer" aria-label="次の週">次の週 →</button>
      </div>
      {active && (
        <button
          onClick={exportPlans}
          disabled={busy}
          className="py-2.5 rounded border border-primary text-primary text-sm font-bold bg-white cursor-pointer disabled:opacity-50"
        >
          {busy ? "書き出し中…" : "この週の計画をカレンダーに書き出す"}
        </button>
      )}

      {/* 日ごとの一覧（Google の予定と、アプリの計画） */}
      {days.map((d) => {
        // Google の予定と計画を1つの一覧にして、時刻順に並べる（終日・時刻なしは先頭）
        const items = [
          ...events
            .filter((e) => e.date === d)
            .map((e, i) => ({ key: `g-${e.id}-${i}`, kind: "google" as const, sort: e.allDay ? "" : e.startTime ?? "", time: e.allDay ? "終日" : `${e.startTime}〜${e.endTime}`, title: e.title })),
          ...plans
            .filter((p) => p.date.slice(0, 10) === d)
            .map((p) => ({
              key: `p-${p.id}`,
              kind: "plan" as const,
              sort: p.startTime ?? "",
              time: p.startTime ? `${p.startTime}〜${planEventEnd(d, p.startTime, p.plannedMinutes).time}` : formatMinutes(p.plannedMinutes),
              title: p.title,
            })),
        ].sort((x, y) => x.sort.localeCompare(y.sort));
        return (
          <Card key={d} className={`!p-3 ${d === today ? "!border-primary" : ""}`}>
            <div className={`text-sm font-bold mb-1 ${d === today ? "text-primary" : "text-app-text"}`}>
              {md(d)}（{WEEKDAY_NAMES[dayOfWeek(d)]}）
            </div>
            {items.length === 0 ? (
              <div className="text-[11px] text-app-sub">予定なし</div>
            ) : (
              items.map((it) => (
                <div key={it.key} className="flex items-center gap-2 py-1.5 border-b border-app-border last:border-b-0">
                  <div className="text-[11px] text-app-sub w-[84px] shrink-0 tabular-nums">{it.time}</div>
                  <div className="flex-1 min-w-0 text-sm text-app-text truncate">{it.title}</div>
                  {it.kind === "google" ? <Badge type="default">Google</Badge> : <Badge type="success">計画</Badge>}
                </div>
              ))
            )}
          </Card>
        );
      })}
      {active && <div className="text-[10px] text-app-sub">書き出した計画は、専用カレンダー「業務計画」に入ります。開始時刻のない計画は書き出されません。</div>}
    </div>
  );
}

// useSearchParams を使うため Suspense で包む（Next.js の要件）
export default function Page() {
  return (
    <Suspense fallback={<div className="text-center text-app-sub py-10">読み込み中...</div>}>
      <SchedulePage />
    </Suspense>
  );
}
