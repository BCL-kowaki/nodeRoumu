"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import ProjectEditor from "@/components/work/ProjectEditor";
import { api, type Project } from "@/components/work/types";
import { todayJst } from "@/lib/date-jst";
import { PROJECT_STATUS_LABELS, dueLabel } from "@/lib/work/labels";

// プロジェクト一覧（進行中・保留／完了・アーカイブを切り替え）
export default function WorkProjectsPage() {
  const [showClosed, setShowClosed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const status = showClosed ? "done,archived" : "active,on_hold";
      setProjects(await api<Project[]>(`/api/work/projects?status=${status}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [showClosed]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayJst();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold">プロジェクト</div>
        <button
          onClick={() => setAdding(true)}
          className="px-4 py-2 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          + プロジェクト
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { closed: false, label: "進行中・保留" },
          { closed: true, label: "完了・アーカイブ" },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => setShowClosed(f.closed)}
            aria-pressed={showClosed === f.closed}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
              showClosed === f.closed ? "bg-primary text-white border-primary" : "bg-white text-app-text border-app-border"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      {loading ? (
        <div className="text-center text-app-sub py-10">読み込み中...</div>
      ) : projects.length === 0 ? (
        <Card className="text-center !py-10 text-app-sub text-sm">プロジェクトはありません</Card>
      ) : (
        projects.map((p) => {
          const due = dueLabel(p.dueDate, today, p.status === "done" || p.status === "archived");
          return (
            <Link key={p.id} href={`/admin/work/projects/${p.id}`} className="no-underline">
              <Card className="!p-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: p.color || "#888888" }} />
                  <div className="flex-1 min-w-0 text-sm font-bold text-app-text truncate">{p.name}</div>
                  {p.status !== "active" && <Badge type="default">{PROJECT_STATUS_LABELS[p.status]}</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-app-sub">
                  <span>未完了タスク {p.openTaskCount ?? 0} 件</span>
                  {due && <Badge type={due.tone}>{due.text}</Badge>}
                </div>
              </Card>
            </Link>
          );
        })
      )}

      {adding && (
        <ProjectEditor
          project={null}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}
