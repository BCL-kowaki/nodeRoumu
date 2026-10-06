// 計画・実績に紐づける タスク / プロジェクト / ルーティン / 計画 が、ログイン中の代表者のものかを確認する
// （他人のIDを指定して紐づけ・情報を引き出されるのを防ぐ）
import { prisma } from "@/lib/prisma";

export type Links = {
  taskId?: string | null;
  projectId?: string | null;
  routineId?: string | null;
  planId?: string | null;
};

// 問題なければ null、見つからないものがあればエラーメッセージを返す
export async function checkLinks(ownerId: string, links: Links): Promise<string | null> {
  const checks: [string | null | undefined, () => Promise<unknown>, string][] = [
    [links.taskId, () => prisma.workTask.findFirst({ where: { id: links.taskId!, ownerId }, select: { id: true } }), "タスク"],
    [links.projectId, () => prisma.workProject.findFirst({ where: { id: links.projectId!, ownerId }, select: { id: true } }), "プロジェクト"],
    [links.routineId, () => prisma.routine.findFirst({ where: { id: links.routineId!, ownerId }, select: { id: true } }), "ルーティン"],
    [links.planId, () => prisma.workPlan.findFirst({ where: { id: links.planId!, ownerId }, select: { id: true } }), "計画"],
  ];
  for (const [id, find, label] of checks) {
    if (id && !(await find())) return `${label}が見つかりません`;
  }
  return null;
}

// プロジェクトの所属先に指定されたクライアントが、ログイン中の代表者のものか
export async function ownsClient(ownerId: string, clientId: string): Promise<boolean> {
  return !!(await prisma.workClient.findFirst({ where: { id: clientId, ownerId }, select: { id: true } }));
}

// 一覧表示用に一緒に返す紐づけ先の項目
export const LINK_INCLUDE = {
  task: { select: { id: true, title: true, status: true } },
  project: { select: { id: true, name: true, color: true } },
} as const;

// 実績の一覧で一緒に返す項目
export const ENTRY_INCLUDE = {
  ...LINK_INCLUDE,
  routine: { select: { id: true, title: true } },
  plan: { select: { id: true, title: true } },
} as const;
