import { redirect } from "next/navigation";

// 旧：プロジェクト詳細。プロジェクト・タスクの統合画面で、そのプロジェクトを選んだ状態に移す
export default async function OldProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/work/projects?project=${encodeURIComponent(id)}`);
}
