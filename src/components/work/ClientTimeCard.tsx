"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { todayJst } from "@/lib/date-jst";
import type { ClientSummary, Totals } from "@/lib/work/client-summary";
import { formatMinutes } from "@/lib/work/labels";
import { api, type Client, type Project } from "./types";

type Summary = { clients: ClientSummary[]; unassigned: Totals };
type Row = Totals & { key: string; label: string; color?: string | null; select?: string };

const fmt = (m: number) => (m === 0 ? "—" : formatMinutes(m));

// "YYYY-MM" の月初・月末
function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// 月ごとの作業時間（計画・実績）。
// すべて → クライアント別、クライアント選択中 → プロジェクト別、プロジェクト選択中 → そのプロジェクトだけ
export default function ClientTimeCard({
  clients,
  projects,
  clientId,
  projectId,
  onSelect,
}: {
  clients: Client[];
  projects: Project[];
  clientId: string | null;
  projectId: string | null;
  onSelect: (selection: string) => void;
}) {
  const [month, setMonth] = useState(() => todayJst().slice(0, 7));
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(month);
    api<Summary>(`/api/work/summary/clients?from=${from}&to=${to}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "（削除済み）";

  let rows: Row[] = [];
  if (data) {
    if (projectId) {
      const p = data.clients.flatMap((c) => c.projects).find((x) => x.projectId === projectId);
      rows = [{ key: projectId, label: projectById.get(projectId)?.name ?? "", color: projectById.get(projectId)?.color, plannedMin: p?.plannedMin ?? 0, actualMin: p?.actualMin ?? 0 }];
    } else if (clientId) {
      rows = (data.clients.find((c) => c.clientId === clientId)?.projects ?? []).map((p) => ({
        key: p.projectId,
        label: projectById.get(p.projectId)?.name ?? "（削除済み）",
        color: projectById.get(p.projectId)?.color,
        plannedMin: p.plannedMin,
        actualMin: p.actualMin,
        select: p.projectId,
      }));
    } else {
      rows = data.clients.map((c) => ({
        key: c.clientId,
        label: clientName(c.clientId),
        plannedMin: c.plannedMin,
        actualMin: c.actualMin,
        select: `client:${c.clientId}`,
      }));
      if (data.unassigned.plannedMin + data.unassigned.actualMin > 0) {
        rows.push({ key: "unassigned", label: "プロジェクトなし（ルーティンなど）", ...data.unassigned });
      }
    }
  }
  const total = rows.reduce((t, r) => ({ plannedMin: t.plannedMin + r.plannedMin, actualMin: t.actualMin + r.actualMin }), { plannedMin: 0, actualMin: 0 });
  const max = Math.max(1, ...rows.map((r) => Math.max(r.plannedMin, r.actualMin)));
  const heading = projectId ? "このプロジェクトの作業時間" : clientId ? "プロジェクト別の作業時間" : "クライアント別の作業時間";

  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-sm font-bold text-app-text mr-auto">{heading}</div>
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="前の月" className="px-2 py-0.5 text-sm text-primary bg-transparent border-none cursor-pointer">←</button>
        <div className="text-xs font-bold tabular-nums min-w-[72px] text-center">
          {Number(month.slice(0, 4))}年{Number(month.slice(5, 7))}月
        </div>
        <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="次の月" className="px-2 py-0.5 text-sm text-primary bg-transparent border-none cursor-pointer">→</button>
      </div>

      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}
      {!data && !error && <div className="text-xs text-app-sub py-2">読み込み中...</div>}
      {data && rows.every((r) => r.plannedMin + r.actualMin === 0) && (
        <div className="text-xs text-app-sub py-2">この月の計画・実績はまだありません</div>
      )}
      {data && rows.some((r) => r.plannedMin + r.actualMin > 0) && (
        <>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-[10px] text-app-sub border-b border-app-border pb-1">
            <span />
            <span className="w-20 text-right whitespace-nowrap">計画</span>
            <span className="w-20 text-right whitespace-nowrap">実績</span>
          </div>
          {rows.map((r) => {
            const label = (
              <span className="flex items-center gap-1.5 min-w-0">
                {r.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} aria-hidden />}
                <span className="truncate">{r.label}</span>
              </span>
            );
            return (
              <div key={r.key} className="py-1.5 border-b border-app-border last:border-b-0">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center text-sm">
                  {r.select ? (
                    <button
                      onClick={() => onSelect(r.select!)}
                      className="text-left text-app-text bg-transparent border-none cursor-pointer p-0 min-w-0 hover:text-work-dark"
                    >
                      {label}
                    </button>
                  ) : (
                    <span className="text-app-sub min-w-0">{label}</span>
                  )}
                  <span className="w-20 text-right whitespace-nowrap tabular-nums text-app-sub">{fmt(r.plannedMin)}</span>
                  <span className="w-20 text-right whitespace-nowrap tabular-nums font-bold text-app-text">{fmt(r.actualMin)}</span>
                </div>
                {/* 上：計画、下：実績 の横棒（一番長い行を全幅とする） */}
                <div className="mt-1 flex flex-col gap-0.5" aria-hidden>
                  <div className="h-1 rounded-full bg-work-light" style={{ width: `${(r.plannedMin / max) * 100}%` }} />
                  <div className="h-1 rounded-full bg-work" style={{ width: `${(r.actualMin / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
          {rows.length > 1 && (
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm pt-2 font-bold">
              <span>合計</span>
              <span className="w-20 text-right whitespace-nowrap tabular-nums text-app-sub">{fmt(total.plannedMin)}</span>
              <span className="w-20 text-right whitespace-nowrap tabular-nums">{fmt(total.actualMin)}</span>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
