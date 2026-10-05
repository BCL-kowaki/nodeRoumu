import { NextResponse } from "next/server";
import { getViewer, githubConfigured, githubErrorMessage } from "@/lib/github";
import { requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

// GitHub 連携の状態（トークンが設定されているか、どのアカウントか）
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  if (!githubConfigured()) return NextResponse.json({ configured: false });
  try {
    const viewer = await getViewer();
    return NextResponse.json({ configured: true, login: viewer.login });
  } catch (e) {
    return NextResponse.json({ configured: true, error: githubErrorMessage(e) });
  }
}
