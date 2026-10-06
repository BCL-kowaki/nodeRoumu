import { NextResponse } from "next/server";
import { disconnect } from "@/lib/google-calendar";
import { requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

// 接続を解除する（Google 側でトークンを取り消し、保存した情報を削除。書き出した予定は残る）
export async function DELETE() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  await disconnect(auth.ctx.ownerId);
  return NextResponse.json({ ok: true });
}
