"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import ProjectEditor from "@/components/work/ProjectEditor";
import ProjectNote from "@/components/work/ProjectNote";
import TaskEditor from "@/components/work/TaskEditor";
import TaskRow from "@/components/work/TaskRow";
import { api, type Project, type Task } from "@/components/work/types";
import { todayJst } from "@/lib/date-jst";
import { PROJECT_STATUS_LABELS, dueLabel } from "@/lib/work/labels";

// 選択中のプロジェクト。"all"=すべて、"none"=未分類（プロジェクトなし）、それ以外はプロジェクトID
type Selection = "all" | "none" | string;

const TASK_FILTERS = [
  { key: "open", label: "未完了", statuses: ["todo", "doing"] },
  { key: "closed", label: "完了・中止", statuses: ["done", "canceled"] },
  { key: "all", label: "すべて", statuses: ["todo", "doing", "done", "canceled"] },
] as const;

// プロジェクトとタスクを1画面で管理する（PC：左にプロジェクト、右にタスク／スマホ：上で選ぶ）
function ProjectsAndTasks() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const selected: Selection = sp.get("project") || "all";

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof TASK_FILTERS)[number]["key"]>("open");
  const [showClosedProjects, setShowClosedProjects] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null | "new">(null);
  const [editingProject, setEditingProject] = useState<Project | null | "new">(null);

  const load = useCallback(async () => {
    try {
      // 件数の集計と絞り込みは画面側で行う（1人で使う量なので、まとめて読み込む）
      const [p, t] = await Promise.all([api<Project[]>("/api/work/projects"), api<Task[]>("/api/work/tasks")]);
      setProjects(p);
      setTasks(t);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const select = (s: Selection) => {
    const q = new URLSearchParams(sp.toString());
    if (s === "all") q.delete("project");
    else q.set("project", s);
    router.replace(`${pathname}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };

  const isOpen = (t: Task) => t.status === "todo" || t.status === "doing";
  const inSelection = (t: Task, s: Selection) => (s === "all" ? true : s === "none" ? !t.projectId : t.projectId === s);
  const openCount = (s: Selection) => tasks.filter((t) => isOpen(t) && inSelection(t, s)).length;

  const visibleProjects = projects.filter(
    (p) => showClosedProjects || p.status === "active" || p.status === "on_hold" || p.id === selected
  );
  const project = projects.find((p) => p.id === selected) ?? null;
  const statuses: readonly string[] = TASK_FILTERS.find((f) => f.key === filter)!.statuses;
  const shown = useMemo(
    () => tasks.filter((t) => statuses.includes(t.status) && inSelection(t, selected)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, statuses, selected]
  );

  const toggle = async (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await api(`/api/work/tasks/${task.id}`, { method: "PUT", body: JSON.stringify({ status: next }) });
      await load();
    } catch (e) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
      setError((e as Error).message);
    }
  };

  if (loading) return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const title = selected === "all" ? "すべてのタスク" : selected === "none" ? "未分類のタスク" : project?.name ?? "プロジェクト";
  const projectDue = project
    ? dueLabel(project.dueDate, todayJst(), project.status === "done" || project.status === "archived")
    : null;

  const navItem = (s: Selection, label: string, color?: string | null) => {
    const active = selected === s;
    return (
      <button
        key={s}
        type="button"
        onClick={() => select(s)}
        aria-current={active ? "true" : undefined}
        className={`w-full flex items-center gap-2 h-9 px-3 rounded-lg text-sm text-left border-none cursor-pointer ${
          active ? "bg-work-light text-work-dark font-bold" : "bg-transparent text-app-text hover:bg-app-bg"
        }`}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={color ? { background: color } : { border: "1px solid #66726E" }}
          aria-hidden
        />
        <span className="flex-1 min-w-0 truncate">{label}</span>
        <span className="text-[11px] text-app-sub tabular-nums">{openCount(s) || ""}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-lg lg:text-2xl font-bold tracking-tight">プロジェクト・タスク</div>
        <button
          onClick={() => setEditingTask("new")}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          + タスク
        </button>
      </div>

      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      {/* スマホ：プロジェクトの選択 */}
      <div className="lg:hidden flex gap-2">
        <select
          aria-label="プロジェクトを選ぶ"
          value={selected}
          onChange={(e) => select(e.target.value)}
          className="flex-1 p-2.5 rounded-lg border border-app-border text-sm bg-white"
        >
          <option value="all">すべて（{openCount("all")}）</option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{openCount(p.id)}）
            </option>
          ))}
          <option value="none">未分類（{openCount("none")}）</option>
        </select>
        <button
          onClick={() => setEditingProject("new")}
          className="px-3 rounded-lg border border-app-border bg-white text-sm cursor-pointer"
        >
          + プロジェクト
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:items-start">
        {/* PC：プロジェクトの一覧 */}
        <Card className="hidden lg:block !p-3 lg:sticky lg:top-6">
          <div className="text-[11px] font-bold tracking-[0.12em] text-app-sub px-2 mb-1">プロジェクト</div>
          <div className="flex flex-col gap-0.5">
            {navItem("all", "すべて")}
            {visibleProjects.map((p) => navItem(p.id, p.name, p.color || "#888888"))}
            {navItem("none", "未分類")}
          </div>
          <div className="border-t border-app-border mt-2 pt-2 flex flex-col gap-1">
            <button
              onClick={() => setEditingProject("new")}
              className="w-full text-left px-3 h-8 rounded-lg text-sm text-primary bg-transparent border-none cursor-pointer hover:bg-app-bg"
            >
              + プロジェクトを追加
            </button>
            <label className="flex items-center gap-2 px-3 text-[11px] text-app-sub cursor-pointer">
              <input
                type="checkbox"
                checked={showClosedProjects}
                onChange={(e) => setShowClosedProjects(e.target.checked)}
                className="accent-primary"
              />
              完了・アーカイブも表示
            </label>
          </div>
        </Card>

        {/* タスク */}
        <div className="flex flex-col gap-3 min-w-0">
          <Card className="!p-4">
            <div className="flex items-center gap-2">
              {project && (
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: project.color || "#888888" }} aria-hidden />
              )}
              <div className="flex-1 min-w-0 text-base font-bold text-app-text break-words">{title}</div>
              {project && project.status !== "active" && <Badge type="default">{PROJECT_STATUS_LABELS[project.status]}</Badge>}
              {project && (
                <button
                  onClick={() => setEditingProject(project)}
                  className="px-3 py-1.5 rounded-lg border border-app-border text-xs bg-white cursor-pointer"
                >
                  プロジェクトを編集
                </button>
              )}
            </div>
            {project && (project.startDate || project.dueDate || project.description) && (
              <div className="mt-2 flex flex-col gap-1">
                {(project.startDate || project.dueDate) && (
                  <div className="flex items-center gap-2 text-xs text-app-sub">
                    期間: {project.startDate?.slice(0, 10) ?? "—"} 〜 {project.dueDate?.slice(0, 10) ?? "—"}
                    {projectDue && <Badge type={projectDue.tone}>{projectDue.text}</Badge>}
                  </div>
                )}
                {project.description && (
                  <div className="text-sm text-app-text whitespace-pre-wrap break-words">{project.description}</div>
                )}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              {TASK_FILTERS.map((f) => (
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
            </div>
          </Card>

          <Card className="!p-4">
            {shown.length === 0 ? (
              <div className="text-center text-app-sub text-sm py-6">
                該当するタスクはありません
                <div className="mt-3">
                  <button
                    onClick={() => setEditingTask("new")}
                    className="px-4 py-2 rounded-lg border border-primary text-primary text-sm bg-white cursor-pointer"
                  >
                    + タスクを追加
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs text-app-sub mb-1">{shown.length} 件</div>
                {shown.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggle} onOpen={setEditingTask} showProject={selected === "all"} />
                ))}
              </>
            )}
          </Card>

          {project && <ProjectNote projectId={project.id} />}
        </div>
      </div>

      {editingTask && (
        <TaskEditor
          task={editingTask === "new" ? null : editingTask}
          projects={projects}
          defaultProjectId={project ? project.id : undefined}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            load();
          }}
        />
      )}
      {editingProject && (
        <ProjectEditor
          project={editingProject === "new" ? null : editingProject}
          onClose={() => setEditingProject(null)}
          onSaved={(saved) => {
            const wasNew = editingProject === "new";
            setEditingProject(null);
            load();
            if (wasNew) select(saved.id);
          }}
          onDeleted={() => {
            setEditingProject(null);
            select("all");
            load();
          }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="text-center text-app-sub py-10">読み込み中...</div>}>
      <ProjectsAndTasks />
    </Suspense>
  );
}
