// 計画・実績に紐づける タスク / プロジェクト / ルーティン / 計画 が、ログイン中の代表者のものかを確認する
// （他人のIDを指定して紐づけ・情報を引き出されるのを防ぐ）
import { prisma } from "@/lib/prisma";
import { routineClientFor } from "./routine-link";

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

// 計画のクライアントを決める：プロジェクトがあればそのクライアントにそろえる。無ければ指定されたクライアント。
// 作るときに指定が無く、ルーティンから置いた計画なら、ルーティンのクライアント（無ければルーティンのプロジェクトのクライアント）。
// 変えるときに何も指定が無ければ undefined（そのまま）
export async function resolvePlanClient(
  ownerId: string,
  d: { projectId?: string | null; clientId?: string | null; routineId?: string | null },
  creating: boolean
): Promise<{ clientId: string | null | undefined } | { error: string }> {
  if (d.projectId) {
    const project = await prisma.workProject.findFirst({ where: { id: d.projectId, ownerId }, select: { clientId: true } });
    if (!project) return { error: "プロジェクトが見つかりません" };
    return { clientId: project.clientId };
  }
  if (d.clientId !== undefined) {
    if (d.clientId === null) return { clientId: null };
    if (!(await ownsClient(ownerId, d.clientId))) return { error: "クライアントが見つかりません" };
    return { clientId: d.clientId };
  }
  if (!creating) return { clientId: undefined };
  if (d.routineId) {
    const routine = await prisma.routine.findFirst({
      where: { id: d.routineId, ownerId },
      select: { clientId: true, project: { select: { clientId: true } } },
    });
    return { clientId: routine?.clientId ?? routine?.project?.clientId ?? null };
  }
  return { clientId: null };
}

// プロジェクトの所属先に指定されたクライアントが、ログイン中の代表者のものか
export async function ownsClient(ownerId: string, clientId: string): Promise<boolean> {
  return !!(await prisma.workClient.findFirst({ where: { id: clientId, ownerId }, select: { id: true } }));
}

// 一覧表示用に一緒に返す紐づけ先の項目
export const LINK_INCLUDE = {
  task: { select: { id: true, title: true, status: true, projectId: true } },
  project: { select: { id: true, name: true, color: true } },
} as const;

// 実績の一覧で一緒に返す項目
export const ENTRY_INCLUDE = {
  ...LINK_INCLUDE,
  routine: { select: { id: true, title: true, projectId: true, clientId: true } },
  plan: { select: { id: true, title: true, projectId: true, clientId: true } },
} as const;

// ルーティンのプロジェクト・クライアントの確認と、保存するクライアントの決定
// （プロジェクトがあればそのクライアントにそろえる。どちらも自分のものだけ指定できる）
export async function resolveRoutineLinks(
  ownerId: string,
  sent: { projectId?: string | null; clientId?: string | null },
  current: { projectId: string | null; clientId: string | null } | null
): Promise<{ ok: true; clientId: string | null } | { ok: false; error: string }> {
  const projectId = sent.projectId !== undefined ? sent.projectId : current?.projectId ?? null;
  let projectClientId: string | null = null;
  if (projectId) {
    const project = await prisma.workProject.findFirst({ where: { id: projectId, ownerId }, select: { clientId: true } });
    if (!project) return { ok: false, error: "プロジェクトが見つかりません" };
    projectClientId = project.clientId;
  }
  if (sent.clientId && !(await ownsClient(ownerId, sent.clientId))) return { ok: false, error: "クライアントが見つかりません" };
  return routineClientFor({ sentClientId: sent.clientId, projectClientId, currentClientId: current?.clientId ?? null });
}
