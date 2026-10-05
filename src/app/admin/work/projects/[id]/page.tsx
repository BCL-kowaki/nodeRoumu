"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import ProjectEditor from "@/components/work/ProjectEditor";
import TaskEditor from "@/components/work/TaskEditor";
import TaskRow from "@/components/work/TaskRow";
import { api, type Project, type Task } from "@/components/work/types";
import { PROJECT_STATUS_LABELS } from "@/lib/work/labels";

type ProjectDetail = Project & { tasks: Omit<Task, "project">[] };

// プロジェクト詳細：概要と配下のタスク
export default function WorkProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null | "new">(null);

  const load = useCallback(async () => {
    try {
      const [p, list] = await Promise.all([
        api<ProjectDetail>(`/api/work/projects/${id}`),
        api<Project[]>("/api/work/projects"),
      ]);
      setProject(p);
      setAllProjects(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="text-center text-app-sub py-10">読み込み中...</div>;
  if (!project) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-sm text-danger bg-danger-light rounded p-3">{error || "見つかりません"}</div>
        <Link href="/admin/work/projects" className="text-xs text-primary">← プロジェクト一覧へ</Link>
      </div>
    );
  }

  const ref = { id: project.id, name: project.name, color: project.color };
  const tasks: Task[] = project.tasks.map((t) => ({ ...t, project: ref }));
  const open = tasks.filter((t) => t.status === "todo" || t.status === "doing");
  const closed = tasks.filter((t) => t.status === "done" || t.status === "canceled");

  const toggle = async (task: Task) => {
    try {
      await api(`/api/work/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: task.status === "done" ? "todo" : "done" }),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Link href="/admin/work/projects" className="text-xs text-primary">← プロジェクト一覧</Link>

      <Card className="!p-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: project.color || "#888888" }} />
          <div className="flex-1 min-w-0 text-base font-bold text-app-text break-words">{project.name}</div>
          <Badge type={project.status === "active" ? "success" : "default"}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
        </div>
        {(project.startDate || project.dueDate) && (
          <div className="text-xs text-app-sub mt-1.5">
            期間: {project.startDate?.slice(0, 10) ?? "—"} 〜 {project.dueDate?.slice(0, 10) ?? "—"}
          </div>
        )}
        {project.description && (
          <div className="text-sm text-app-text mt-2 whitespace-pre-wrap break-words">{project.description}</div>
        )}
        <button
          onClick={() => setEditingProject(true)}
          className="mt-3 px-3.5 py-1.5 rounded border border-primary text-primary text-xs font-semibold bg-transparent cursor-pointer"
        >
          編集
        </button>
      </Card>

      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      <Card className="!p-4">
        <div className="flex justify-between items-center mb-1">
          <div className="text-xs font-bold text-app-sub">未完了のタスク（{open.length}）</div>
          <button
            onClick={() => setEditingTask("new")}
            className="px-3 py-1.5 rounded bg-primary text-white text-xs font-bold border-none cursor-pointer"
          >
            + タスク
          </button>
        </div>
        {open.length === 0 ? (
          <div className="text-xs text-app-sub py-3">未完了のタスクはありません</div>
        ) : (
          open.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} onOpen={setEditingTask} showProject={false} />)
        )}
      </Card>

      {closed.length > 0 && (
        <Card className="!p-4">
          <div className="text-xs font-bold text-app-sub mb-1">完了・中止（{closed.length}）</div>
          {closed.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={toggle} onOpen={setEditingTask} showProject={false} />
          ))}
        </Card>
      )}

      {editingProject && (
        <ProjectEditor
          project={project}
          onClose={() => setEditingProject(false)}
          onSaved={() => {
            setEditingProject(false);
            load();
          }}
          onDeleted={() => router.push("/admin/work/projects")}
        />
      )}
      {editingTask && (
        <TaskEditor
          task={editingTask === "new" ? null : editingTask}
          projects={allProjects}
          defaultProjectId={project.id}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}
