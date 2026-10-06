"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import RoutineEditor from "@/components/work/RoutineEditor";
import { useRoutineChecks } from "@/components/work/useRoutineChecks";
import { Building2 } from "lucide-react";
import { api, type CheckStatus, type Client, type Project, type Routine } from "@/components/work/types";
import { dayOfWeek } from "@/lib/attendance-status";
import { addDays, todayJst } from "@/lib/date-jst";
import { formatMinutes } from "@/lib/work/labels";
import { WEEKDAY_NAMES, recurrenceLabel } from "@/lib/work/recurrence";
import PageTitle from "@/components/PageTitle";

// 未実施 → 実施 → スキップ → 未実施 の順に切り替える
const NEXT: Record<string, CheckStatus> = { null: "done", done: "skipped", skipped: null };
const CELL: Record<string, { text: string; className: string; label: string }> = {
  done: { text: "✓", className: "bg-primary text-white border-primary", label: "実施" },
  skipped: { text: "－", className: "bg-gray-100 text-app-sub border-app-border", label: "スキップ" },
  null: { text: "", className: "bg-white border-app-border", label: "未実施" },
};

// 月曜はじまりの週の初日
function mondayOf(date: string): string {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

// ルーティン：今週の実施チェック表と、ルーティンの一覧・編集
export default function WorkRoutinesPage() {
  const today = todayJst();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const weekEnd = addDays(weekStart, 6);
  const { routines, days, loading, error, reload, setStatus } = useRoutineChecks(weekStart, weekEnd);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [editing, setEditing] = useState<Routine | null | "new">(null);

  useEffect(() => {
    api<Project[]>("/api/work/projects").then(setProjects).catch(() => setProjects([]));
    api<Client[]>("/api/work/clients").then(setClients).catch(() => setClients([]));
  }, []);

  const active = routines.filter((r) => r.active);
  const stopped = routines.filter((r) => !r.active);
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <PageTitle>ルーティン</PageTitle>
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          + ルーティン
        </button>
      </div>

      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      {loading ? (
        <div className="text-center text-app-sub py-10">読み込み中...</div>
      ) : (
        <>
          {/* 週の実施チェック表 */}
          <Card className="!p-4">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className="px-2 py-1 text-xs text-primary bg-transparent border-none cursor-pointer"
                aria-label="前の週"
              >
                ← 前の週
              </button>
              <div className="text-xs font-bold text-app-text">
                {md(weekStart)}〜{md(weekEnd)}
              </div>
              <button
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="px-2 py-1 text-xs text-primary bg-transparent border-none cursor-pointer"
                aria-label="次の週"
              >
                次の週 →
              </button>
            </div>

            {active.length === 0 ? (
              <div className="text-xs text-app-sub py-4 text-center">有効なルーティンはありません</div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-7 gap-1 text-center">
                  {days.map((d) => (
                    <div
                      key={d.date}
                      className={`text-[10px] ${d.date === today ? "text-primary font-bold" : d.closed ? "text-app-sub" : "text-app-text"}`}
                    >
                      {WEEKDAY_NAMES[dayOfWeek(d.date)]}
                      <br />
                      {Number(d.date.slice(8, 10))}
                    </div>
                  ))}
                </div>
                {active.map((r) => (
                  <div key={r.id}>
                    <div className="text-xs font-semibold text-app-text mb-1 truncate">
                      {r.client && <span className="text-app-sub font-normal">{r.client.name} › </span>}
                      {r.title}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((d) => {
                        const item = d.items.find((i) => i.routineId === r.id);
                        if (!item) return <div key={d.date} className="h-8 rounded bg-app-bg" aria-hidden />;
                        const cell = CELL[String(item.status)];
                        const future = d.date > today;
                        return (
                          <button
                            key={d.date}
                            type="button"
                            disabled={future}
                            onClick={() => setStatus(r.id, d.date, NEXT[String(item.status)])}
                            aria-label={`${r.title} ${md(d.date)} ${cell.label}`}
                            className={`h-8 rounded border text-sm font-bold cursor-pointer disabled:cursor-default disabled:opacity-40 ${cell.className}`}
                          >
                            {cell.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-app-sub">
                  押すたびに「未実施 → ✓実施 → －スキップ」と切り替わります。灰色の欄は実施日ではない日です。
                </div>
              </div>
            )}
          </Card>

          {/* ルーティンの一覧 */}
          {[
            { title: "有効なルーティン", items: active },
            { title: "停止中", items: stopped },
          ]
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Card key={g.title} className="!p-4">
                <div className="text-xs font-bold text-app-sub mb-1">
                  {g.title}（{g.items.length}）
                </div>
                {g.items.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setEditing(r)}
                    className="w-full text-left py-2.5 border-b border-app-border last:border-b-0 bg-transparent border-x-0 border-t-0 cursor-pointer"
                  >
                    {r.client && (
                      <div className="flex items-center gap-1 text-[11px] text-app-sub mb-0.5">
                        <Building2 size={11} aria-hidden />
                        {r.client.name}
                      </div>
                    )}
                    <div className={`text-sm font-semibold ${r.active ? "text-app-text" : "text-app-sub"}`}>{r.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-app-sub">
                      <Badge type={r.active ? "success" : "default"}>
                        {recurrenceLabel({ ...r, startDate: r.startDate, endDate: r.endDate })}
                      </Badge>
                      {r.plannedMinutes !== null && <span>予定 {formatMinutes(r.plannedMinutes)}</span>}
                      {r.endDate && <span>〜{md(r.endDate.slice(0, 10))}まで</span>}
                      {r.project && <span>・{r.project.name}</span>}
                    </div>
                  </button>
                ))}
              </Card>
            ))}
        </>
      )}

      {editing && (
        <RoutineEditor
          routine={editing === "new" ? null : editing}
          projects={projects}
          clients={clients}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
