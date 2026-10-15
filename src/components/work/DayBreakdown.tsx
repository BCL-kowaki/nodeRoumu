"use client";

import { useMemo } from "react";
import Card from "@/components/Card";
import { assignClientColors, clientIdFor } from "@/lib/work/client-colors";
import { breakdownByClient, compareByClient, type BreakdownGroup, type BreakdownRow, type ClientDiff } from "@/lib/work/day-breakdown";
import { formatMinutes } from "@/lib/work/labels";
import { entryMinutes } from "@/lib/work/time";
import { dayOfWeek } from "@/lib/attendance-status";
import { WEEKDAY_NAMES } from "@/lib/work/recurrence";
import { entryTitle, type Client, type DaySummary, type Plan, type Project, type Routine, type TimeEntry } from "./types";

const NO_CLIENT = "#9AA6A2";
const fmt = (m: number) => (m === 0 ? "0分" : formatMinutes(m));
const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
// 差（実績−計画）の表示。プラスは計画より多くかかった
const fmtDiff = (m: number) => (m === 0 ? "±0" : `${m > 0 ? "+" : "−"}${formatMinutes(Math.abs(m))}`);

// 1日・1週の計画・実績の一覧（何をどれだけ計画したか／実績として何に何時間使ったか）。クライアントごとにまとめる
export default function DayBreakdown({
  plans,
  entries,
  projects,
  clients,
  routines,
  now,
  days,
  onOpenDay,
}: {
  plans: Plan[];
  entries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  routines: Routine[];
  now: Date;
  // 週の一覧のときだけ渡す：日ごとの計画・実績
  days?: DaySummary[];
  onOpenDay?: (date: string) => void;
}) {
  const colors = useMemo(() => assignClientColors(clients), [clients]);
  const order = clients.map((c) => c.id);
  const projectId = (x: { projectId: string | null; task?: { projectId?: string | null } | null; plan?: { projectId?: string | null } | null }) =>
    x.projectId ?? x.task?.projectId ?? x.plan?.projectId ?? null;

  const planned = breakdownByClient(
    plans.map(
      (p): BreakdownRow => ({ title: p.title, minutes: p.plannedMinutes, clientId: clientIdFor(p, projects, routines), projectId: projectId(p) })
    ),
    order
  );
  const actual = breakdownByClient(
    entries.map(
      (e): BreakdownRow => ({ title: entryTitle(e), minutes: entryMinutes(e, now), clientId: clientIdFor(e, projects, routines), projectId: projectId(e) })
    ),
    order
  );

  const props = { clients, projects, colors };
  const diffs = compareByClient(planned.groups, actual.groups, order);
  return (
    <div className="flex flex-col gap-3">
      {diffs.length > 0 && (
        <Comparison
          rows={diffs}
          total={{ clientId: null, plannedMin: planned.totalMin, actualMin: actual.totalMin, diffMin: actual.totalMin - planned.totalMin }}
          clients={clients}
          colors={colors}
        />
      )}
      {days && days.length > 0 && <ByDay days={days} onOpenDay={onOpenDay} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Section kind="plan" title="計画" caption="何をどれだけ計画したか" data={planned} empty="この日の計画はまだありません" {...props} />
        <Section kind="actual" title="実績" caption="実際に何に何時間使ったか" data={actual} empty="この日の実績はまだありません" {...props} />
      </div>
    </div>
  );
}

// スマホは「名前」を1行目に出し、2行目に計画・実績・差を並べる
const COLS = "grid grid-cols-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_80px_80px_88px] items-center gap-x-3 gap-y-1";
const diffClass = (m: number) => (m > 0 ? "text-accent-dark" : m < 0 ? "text-app-text" : "text-app-sub");

// 週の日ごとの計画と実績（押すとその日の一覧へ）
function ByDay({ days, onOpenDay }: { days: DaySummary[]; onOpenDay?: (date: string) => void }) {
  const max = Math.max(...days.map((d) => Math.max(d.plannedMin, d.actualMin)), 1);
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border">
        <div className="text-sm font-bold text-app-text">日ごとの計画と実績</div>
        <div className="text-[11px] text-app-sub">日付を押すと、その日の一覧を開きます</div>
      </div>
      <div className={`${COLS} px-4 py-1.5 text-[10px] text-app-sub border-b border-app-border bg-app-bg`}>
        <span className="hidden sm:block">日付</span>
        <span className="hidden sm:block" aria-hidden />
        <span className="text-right">計画</span>
        <span className="text-right">実績</span>
        <span className="text-right">差</span>
      </div>
      <ul className="list-none m-0 p-0">
        {days.map((d) => {
          const dow = dayOfWeek(d.date);
          const diff = d.actualMin - d.plannedMin;
          const empty = d.plannedMin === 0 && d.actualMin === 0;
          return (
            <li key={d.date} className="border-b border-app-border last:border-b-0">
              <button
                type="button"
                onClick={() => onOpenDay?.(d.date)}
                disabled={!onOpenDay}
                className={`${COLS} w-full px-4 py-2.5 text-left bg-transparent border-none cursor-pointer hover:bg-app-bg disabled:cursor-default`}
              >
                <span className={`col-span-3 sm:col-span-1 text-xs font-bold ${dow === 0 ? "text-danger" : dow === 6 ? "text-[#2F6FDB]" : "text-app-text"}`}>
                  {Number(d.date.slice(5, 7))}/{Number(d.date.slice(8, 10))}（{WEEKDAY_NAMES[dow]}）
                </span>
                <span className="hidden sm:flex flex-col gap-1" aria-hidden>
                  <span className="h-1.5 rounded-full bg-[#C9C9C9]" style={{ width: `${percent(d.plannedMin, max)}%` }} />
                  <span className="h-1.5 rounded-full bg-primary" style={{ width: `${percent(d.actualMin, max)}%` }} />
                </span>
                <span className="text-right text-xs tabular-nums text-app-text">{empty ? "—" : fmt(d.plannedMin)}</span>
                <span className="text-right text-xs tabular-nums text-app-text">{empty ? "—" : fmt(d.actualMin)}</span>
                <span className={`text-right text-xs font-bold tabular-nums ${diffClass(diff)}`}>{empty ? "—" : fmtDiff(diff)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// クライアントごとの計画と実績の差（バーは上が計画・下が実績。長さはいちばん長いものに合わせる）
function Comparison({ rows, total, clients, colors }: { rows: ClientDiff[]; total: ClientDiff; clients: Client[]; colors: Map<string, string> }) {
  const max = Math.max(...rows.map((r) => Math.max(r.plannedMin, r.actualMin)), 1);
  const cols = COLS;
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-app-border">
        <div className="text-sm font-bold text-app-text">計画と実績の差</div>
        <div className="text-[11px] text-app-sub">クライアントごと。差は「実績 − 計画」で、＋は計画より多くかかった時間</div>
      </div>
      <div className={`${cols} px-4 py-1.5 text-[10px] text-app-sub border-b border-app-border bg-app-bg`}>
        <span className="hidden sm:block">クライアント</span>
        <span className="hidden sm:block" aria-hidden />
        <span className="text-right">計画</span>
        <span className="text-right">実績</span>
        <span className="text-right">差</span>
      </div>
      <ul className="list-none m-0 p-0">
        {rows.map((r) => {
          const color = r.clientId ? colors.get(r.clientId) ?? NO_CLIENT : NO_CLIENT;
          const name = r.clientId ? clients.find((c) => c.id === r.clientId)?.name ?? "（クライアント）" : "クライアントなし・その他";
          return (
            <li key={r.clientId ?? "__none__"} className={`${cols} px-4 py-2.5 border-b border-app-border last:border-b-0`}>
              <span className="col-span-3 sm:col-span-1 flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden />
                <span className="truncate text-xs font-bold text-app-text">{name}</span>
              </span>
              <span className="hidden sm:flex flex-col gap-1" aria-hidden>
                <span className="h-1.5 rounded-full" style={{ width: `${percent(r.plannedMin, max)}%`, background: `color-mix(in srgb, ${color} 45%, white)` }} />
                <span className="h-1.5 rounded-full" style={{ width: `${percent(r.actualMin, max)}%`, background: color }} />
              </span>
              <span className="text-right text-xs tabular-nums text-app-text">{fmt(r.plannedMin)}</span>
              <span className="text-right text-xs tabular-nums text-app-text">{fmt(r.actualMin)}</span>
              <span className={`text-right text-xs font-bold tabular-nums ${diffClass(r.diffMin)}`}>{fmtDiff(r.diffMin)}</span>
            </li>
          );
        })}
      </ul>
      <div className={`${cols} px-4 py-2.5 border-t border-app-border bg-app-bg`}>
        <span className="col-span-3 sm:col-span-1 text-xs font-bold text-app-text">合計</span>
        <span className="hidden sm:block" aria-hidden />
        <span className="text-right text-xs font-bold tabular-nums text-app-text">{fmt(total.plannedMin)}</span>
        <span className="text-right text-xs font-bold tabular-nums text-app-text">{fmt(total.actualMin)}</span>
        <span className={`text-right text-xs font-bold tabular-nums ${diffClass(total.diffMin)}`}>{fmtDiff(total.diffMin)}</span>
      </div>
    </Card>
  );
}

function Section({
  kind,
  title,
  caption,
  data,
  empty,
  clients,
  projects,
  colors,
}: {
  kind: "plan" | "actual";
  title: string;
  caption: string;
  data: { totalMin: number; groups: BreakdownGroup[] };
  empty: string;
  clients: Client[];
  projects: Project[];
  colors: Map<string, string>;
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-end justify-between gap-3 px-4 py-3 border-b border-app-border">
        <div>
          <div className="text-sm font-bold text-app-text">{title}</div>
          <div className="text-[11px] text-app-sub">{caption}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-app-sub">合計</div>
          <div className="text-lg font-bold text-app-text tabular-nums leading-tight">{fmt(data.totalMin)}</div>
        </div>
      </div>

      {data.groups.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-app-sub">{empty}</div>
      ) : (
        <ul className="list-none m-0 p-0">
          {data.groups.map((g) => {
            const color = g.clientId ? colors.get(g.clientId) ?? NO_CLIENT : NO_CLIENT;
            const name = g.clientId ? clients.find((c) => c.id === g.clientId)?.name ?? "（クライアント）" : "クライアントなし・その他";
            return (
              <li key={g.clientId ?? "__none__"} className="px-4 py-3 border-b border-app-border last:border-b-0">
                {/* クライアントの合計 */}
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden />
                  <span className="flex-1 min-w-0 truncate text-xs font-bold text-app-text">{name}</span>
                  <span className="text-[11px] text-app-sub tabular-nums">{percent(g.totalMin, data.totalMin)}%</span>
                  <span className="text-xs font-bold text-app-text tabular-nums w-[72px] text-right">{fmt(g.totalMin)}</span>
                </div>
                {/* 項目ごとの時間（バーの長さは、その日の合計に対する割合） */}
                <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-2 pl-[18px]">
                  {g.items.map((it) => {
                    const project = it.projectId ? projects.find((p) => p.id === it.projectId)?.name : undefined;
                    return (
                      <li key={`${it.projectId ?? ""}:${it.title}`}>
                        <div className="flex items-baseline gap-2">
                          <span className="flex-1 min-w-0 truncate text-[13px] text-app-text" title={it.title}>
                            {it.title}
                            {it.count > 1 && <span className="ml-1 text-[11px] text-app-sub">×{it.count}</span>}
                          </span>
                          <span className="text-[12px] text-app-text tabular-nums w-[72px] text-right shrink-0">{fmt(it.minutes)}</span>
                        </div>
                        {project && <div className="text-[10px] text-app-sub truncate">{project}</div>}
                        <div className="mt-1 h-1.5 rounded-full bg-app-bg overflow-hidden" aria-hidden>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(2, percent(it.minutes, data.totalMin))}%`,
                              // 計画は薄く、実績は濃く（タイムラインのカードと同じ見せ方）
                              background: kind === "plan" ? `color-mix(in srgb, ${color} 45%, white)` : color,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
