// 業務管理APIの共通の入口。全ルートの先頭で必ず呼ぶ。
// /api は middleware の対象外なので、ここを通さないAPIは誰でも呼べてしまう点に注意。
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canUseWorkspace } from "@/lib/permissions";

export type WorkspaceContext = { ownerId: string };

// 代表者であれば { ownerId } を、そうでなければ返すべきエラー応答を返す
export async function requireWorkspace(): Promise<
  { ok: true; ctx: WorkspaceContext } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!canUseWorkspace(session.role)) {
    return { ok: false, response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { ok: true, ctx: { ownerId: session.employeeId } };
}

export function notFound() {
  return NextResponse.json({ error: "見つかりません" }, { status: 404 });
}

export function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
