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
import { monthGrid, monthRange, shiftMonth } from "@/lib/work/day-breakdown";
import PageTitle from "@/components/PageTitle";
import ImportCalendars from "@/components/work/ImportCalendars";

type GStatus = {
  configured: boolean;
  encryptionConfigured: boolean;
  connected: boolean;
  status: "active" | "needs_reconnect" | null;
  email: string | null;
  calendarCreated: boolean;
  driveGranted: boolean;
  lastSyncedAt: string | null;
};
type DayEvent = { id: string; title: string; date: string; allDay: boolean; startTime: string | null; endTime: string | null; htmlLink?: string; calendar?: string };

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

// 表示の切り替え（週／月）は、この端末に覚えておく
const SPAN_KEY = "node-portal:schedule-span";
type Span = "week" | "month";

type Item = { key: string; kind: "google" | "plan"; sort: string; time: string; title: string; calendar?: string };

function SchedulePage() {
  const sp = useSearchParams();
  // 表示の基準日（週はその日を含む月曜〜日曜、月はその日を含む月）
  const [cursor, setCursor] = useState(() => todayJst());
  const [span, setSpan] = useState<Span>("week");
  useEffect(() => {
    try {
      if (localStorage.getItem(SPAN_KEY) === "month") setSpan("month");
    } catch {
      // 保存できない環境では週で始める
    }
  }, []);
  const changeSpan = (v: Span) => {
    setSpan(v);
    try {
      localStorage.setItem(SPAN_KEY, v);
    } catch {
      // 覚えられなくても切り替え自体はできる
    }
  };
  const isMonth = span === "month";
  const weekStart = isMonth ? monthRange(cursor).from : mondayOf(cursor);
  const weekEnd = isMonth ? monthRange(cursor).to : addDays(weekStart, 6);
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
  // その日の Google の予定と計画を1つにして、時刻順に並べる（終日・時刻なしは先頭）
  const itemsFor = (d: string): Item[] =>
    [
      ...events
        .filter((e) => e.date === d)
        .map((e, i) => ({
          key: `g-${e.id}-${i}`,
          kind: "google" as const,
          sort: e.allDay ? "" : e.startTime ?? "",
          time: e.allDay ? "終日" : `${e.startTime}〜${e.endTime}`,
          title: e.title,
          calendar: e.calendar,
        })),
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
  const today = todayJst();
  const active = gs?.connected && gs.status === "active";

  return (
    <div className="flex flex-col gap-3">
      <PageTitle>スケジュール</PageTitle>

      {/* 接続状態 */}
      <Card className="!p-4">
        {!gs?.configured ? (
          <div className="text-xs text-app-sub">Google の設定が見つかりません。</div>
        ) : !gs.connected ? (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-app-text">Google カレンダーに接続すると、予定の表示と、計画の書き出しができます。</div>
            <div className="text-[11px] text-app-sub leading-relaxed">
              求める権限は「アプリが作る専用カレンダーの管理」「既存の予定の読み取り（書き換えは不可）」と、
              タスクの添付資料用の「アプリが作ったドライブのファイルの管理（ほかのファイルは見えません）」だけです。
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
            {gs.status === "active" && <ImportCalendars connectedEmail={gs.email ?? null} onChanged={load} />}
            {gs.status === "active" && !gs.driveGranted && (
              <div className="w-full mt-1 text-xs text-app-text bg-accent-light rounded p-2.5 leading-relaxed">
                タスクに資料を添付するには、Google ドライブの権限を追加するため一度接続し直してください（カレンダーの設定はそのまま残ります）。
                <a href="/api/work/google/auth" className="ml-1 font-bold text-accent-dark">接続し直す</a>
              </div>
            )}
          </div>
        )}
      </Card>

      {message && <div className="text-sm text-primary-dark bg-primary-light rounded p-3">{message}</div>}
      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      {/* 期間（週・月）の切り替えと書き出し */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setCursor(isMonth ? shiftMonth(cursor, -1) : addDays(weekStart, -7))}
          className="px-2 py-1 text-xs text-primary bg-transparent border-none cursor-pointer"
          aria-label={isMonth ? "前の月" : "前の週"}
        >
          ← {isMonth ? "前の月" : "前の週"}
        </button>
        <div className="flex items-center gap-2">
          <div className="text-xs font-bold">{isMonth ? `${cursor.slice(0, 4)}年${Number(cursor.slice(5, 7))}月` : `${md(weekStart)}〜${md(weekEnd)}`}</div>
          <div className="flex rounded-lg bg-app-bg p-0.5" role="group" aria-label="表示の期間">
            {(
              [
                { v: "week", label: "週" },
                { v: "month", label: "月" },
              ] as const
            ).map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => changeSpan(t.v)}
                aria-pressed={span === t.v}
                className={`px-2.5 py-0.5 rounded-md text-xs border-none cursor-pointer ${span === t.v ? "bg-white font-bold text-app-text shadow-sm" : "bg-transparent text-app-sub"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setCursor(isMonth ? shiftMonth(cursor, 1) : addDays(weekStart, 7))}
          className="px-2 py-1 text-xs text-primary bg-transparent border-none cursor-pointer"
          aria-label={isMonth ? "次の月" : "次の週"}
        >
          {isMonth ? "次の月" : "次の週"} →
        </button>
      </div>
      {active && (
        <button
          onClick={exportPlans}
          disabled={busy}
          className="py-2.5 rounded border border-primary text-primary text-sm font-bold bg-white cursor-pointer disabled:opacity-50"
        >
          {busy ? "書き出し中…" : isMonth ? "この月の計画をカレンダーに書き出す" : "この週の計画をカレンダーに書き出す"}
        </button>
      )}

      {isMonth ? (
        <MonthSchedule
          month={cursor}
          today={today}
          itemsFor={itemsFor}
          onOpenDay={(d) => {
            setCursor(d);
            changeSpan("week");
          }}
        />
      ) : (
        /* 日ごとの一覧（Google の予定と、アプリの計画） */
        days.map((d) => {
          const items = itemsFor(d);
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
                    {it.kind === "google" ? <Badge type="default">{it.calendar ?? "Google"}</Badge> : <Badge type="success">計画</Badge>}
                  </div>
                ))
              )}
            </Card>
          );
        })
      )}
      {active && <div className="text-[10px] text-app-sub">書き出した計画は、専用カレンダー「業務計画」に入ります。開始時刻のない計画は書き出されません。</div>}
    </div>
  );
}

// 月のカレンダー（月曜はじまり）。各日に Google の予定と計画を時刻順に出す（パソコンは3件まで、スマホは件数だけ）。押すとその週の表示へ
function MonthSchedule({
  month,
  today,
  itemsFor,
  onOpenDay,
}: {
  month: string;
  today: string;
  itemsFor: (d: string) => Item[];
  onOpenDay: (d: string) => void;
}) {
  const SHOW = 3;
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="grid grid-cols-7 text-center text-[10px] text-app-sub bg-app-bg border-b border-app-border">
        {["月", "火", "水", "木", "金", "土", "日"].map((w, i) => (
          <div key={w} className={`py-1 ${i === 5 ? "text-[#2F6FDB]" : i === 6 ? "text-danger" : ""}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(month)
          .flat()
          .map((d, i) => {
            if (!d) return <div key={`e${i}`} className="min-h-[64px] sm:min-h-[110px] border-b border-r border-app-border bg-app-bg/40" />;
            const items = itemsFor(d);
            const google = items.filter((x) => x.kind === "google").length;
            const planCount = items.length - google;
            const dow = dayOfWeek(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onOpenDay(d)}
                aria-label={`${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日 予定${google}件 計画${planCount}件。押すとこの週を表示`}
                className={`min-h-[64px] sm:min-h-[110px] p-1 sm:p-1.5 flex flex-col gap-0.5 text-left border-0 border-b border-r border-app-border bg-white cursor-pointer hover:bg-app-bg min-w-0 ${
                  d === today ? "ring-2 ring-inset ring-primary" : ""
                }`}
              >
                <span className={`text-[11px] font-bold tabular-nums ${dow === 0 ? "text-danger" : dow === 6 ? "text-[#2F6FDB]" : "text-app-text"}`}>
                  {Number(d.slice(8, 10))}
                </span>
                {/* スマホ：件数だけ */}
                <span className="sm:hidden flex flex-col text-[9px] leading-tight text-app-sub">
                  {google > 0 && <span>予定{google}</span>}
                  {planCount > 0 && <span className="text-accent-dark">計画{planCount}</span>}
                </span>
                {/* パソコン：時刻と名前を3件まで */}
                <span className="hidden sm:flex flex-col gap-0.5 w-full min-w-0">
                  {items.slice(0, SHOW).map((it) => (
                    <span
                      key={it.key}
                      title={`${it.time} ${it.title}${it.calendar ? `［${it.calendar}］` : ""}`}
                      className={`block truncate rounded px-1 text-[10px] leading-snug ${it.kind === "plan" ? "bg-accent-light text-accent-dark" : "bg-app-bg text-app-text"}`}
                    >
                      {it.time === "終日" ? "" : `${it.time.slice(0, 5)} `}
                      {it.title}
                    </span>
                  ))}
                  {items.length > SHOW && <span className="text-[10px] text-app-sub">ほか{items.length - SHOW}件</span>}
                </span>
              </button>
            );
          })}
      </div>
      <div className="px-3 py-2 border-t border-app-border flex flex-wrap items-center gap-3 text-[10px] text-app-sub">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-app-bg border border-app-border" aria-hidden /> Google の予定
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-accent-light border border-accent/40" aria-hidden /> 計画
        </span>
        <span>日付を押すと、その週の詳しい表示を開きます</span>
      </div>
    </Card>
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
