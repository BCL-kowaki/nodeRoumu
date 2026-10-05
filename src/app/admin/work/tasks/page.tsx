"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import TaskRow from "@/components/work/TaskRow";
import TaskEditor from "@/components/work/TaskEditor";
import { useTasks } from "@/components/work/useTasks";
import type { Task } from "@/components/work/types";

const FILTERS = [
  { key: "open", label: "未完了", query: "status=todo,doing" },
  { key: "done", label: "完了・中止", query: "status=done,canceled" },
  { key: "all", label: "すべて", query: "" },
] as const;

// タスク一覧（状態・プロジェクトで絞り込み）
export default function WorkTasksPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [projectId, setProjectId] = useState("");
  const base = FILTERS.find((f) => f.key === filter)!.query;
  const query = [base, projectId ? `projectId=${projectId}` : ""].filter(Boolean).join("&");
  const { tasks, projects, loading, error, reload, toggle } = useTasks(query);
  const [editing, setEditing] = useState<Task | null | "new">(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold">タスク</div>
        <Link href="/admin/work/github" className="ml-auto mr-2 text-xs text-primary">GitHub 連携</Link>
        <button
          onClick={() => setEditing("new")}
          className="px-4 py-2 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          + タスク
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer ${
              filter === f.key ? "bg-primary text-white border-primary" : "bg-white text-app-text border-app-border"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          aria-label="プロジェクトで絞り込み"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="ml-auto p-1.5 rounded border border-app-border text-xs bg-white"
        >
          <option value="">すべてのプロジェクト</option>
          <option value="none">プロジェクトなし</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      {loading ? (
        <div className="text-center text-app-sub py-10">読み込み中...</div>
      ) : tasks.length === 0 ? (
        <Card className="text-center !py-10 text-app-sub text-sm">該当するタスクはありません</Card>
      ) : (
        <Card className="!p-4">
          <div className="text-xs text-app-sub mb-1">{tasks.length} 件</div>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={toggle} onOpen={setEditing} />
          ))}
        </Card>
      )}

      {editing && (
        <TaskEditor
          task={editing === "new" ? null : editing}
          projects={projects}
          defaultProjectId={projectId && projectId !== "none" ? projectId : undefined}
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
