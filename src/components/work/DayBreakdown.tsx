"use client";

import { useMemo } from "react";
import Card from "@/components/Card";
import { assignClientColors, clientIdFor } from "@/lib/work/client-colors";
import { breakdownByClient, type BreakdownGroup, type BreakdownRow } from "@/lib/work/day-breakdown";
import { formatMinutes } from "@/lib/work/labels";
import { entryMinutes } from "@/lib/work/time";
import { entryTitle, type Client, type Plan, type Project, type Routine, type TimeEntry } from "./types";

const NO_CLIENT = "#9AA6A2";
const fmt = (m: number) => (m === 0 ? "0分" : formatMinutes(m));
const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// 1日の計画・実績の一覧（何をどれだけ計画したか／実績として何に何時間使ったか）。クライアントごとにまとめる
export default function DayBreakdown({
  plans,
  entries,
  projects,
  clients,
  routines,
  now,
}: {
  plans: Plan[];
  entries: TimeEntry[];
  projects: Project[];
  clients: Client[];
  routines: Routine[];
  now: Date;
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
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      <Section kind="plan" title="計画" caption="何をどれだけ計画したか" data={planned} empty="この日の計画はまだありません" {...props} />
      <Section kind="actual" title="実績" caption="実際に何に何時間使ったか" data={actual} empty="この日の実績はまだありません" {...props} />
    </div>
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
