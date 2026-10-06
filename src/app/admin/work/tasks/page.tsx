import { redirect } from "next/navigation";

// 旧：タスク一覧。プロジェクト・タスクの統合画面に移す（ブックマーク等のため残す）
export default function OldTasks() {
  redirect("/admin/work/projects");
}
