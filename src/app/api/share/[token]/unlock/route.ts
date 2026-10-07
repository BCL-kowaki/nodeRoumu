import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createShareAccess } from "@/lib/session-token";
import { afterFailedAttempt } from "@/lib/work/note-share";
import { findOpenShare } from "@/lib/work/share-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

// 共有ページのパスワード確認（ログイン不要の公開 API）。
// 間違いが続いたら、その共有はしばらく入力できなくする。合っていれば、その共有だけを見られるクッキーを渡す
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const share = await findOpenShare(token);
  // 無い・停止・期限切れは区別せずに同じ応答にする
  if (!share || !share.passwordHash) return NextResponse.json({ error: "このリンクは無効です" }, { status: 404 });
  const now = new Date();
  if (share.lockedUntil && share.lockedUntil > now) {
    return NextResponse.json({ error: "パスワードを何度も間違えたため、15分ほど待ってからお試しください" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password.trim().slice(0, 100) : "";
  if (!password || !(await bcrypt.compare(password, share.passwordHash))) {
    await prisma.noteShare.update({ where: { id: share.id }, data: afterFailedAttempt(share.failedAttempts, now) });
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }
  await prisma.noteShare.update({ where: { id: share.id }, data: { failedAttempts: 0, lockedUntil: null } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(`share_${share.id}`, await createShareAccess(share.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/share/${token}`,
    maxAge: 12 * 60 * 60,
  });
  return res;
}
