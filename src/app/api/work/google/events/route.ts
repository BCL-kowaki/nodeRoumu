import { NextRequest, NextResponse } from "next/server";
import { gcalErrorMessage, getConnection, listDayEvents } from "@/lib/google-calendar";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { parseRange } from "@/lib/work/range";

export const dynamic = "force-dynamic";

// 期間内の Google カレンダーの予定（表示専用。保存しない）
// GET /api/work/google/events?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const range = parseRange(req.nextUrl.searchParams);
  if ("error" in range) return badRequest(range.error);
  const acc = await getConnection(auth.ctx.ownerId);
  if (!acc || acc.status !== "active") return badRequest("Google カレンダーに接続されていません");
  try {
    return NextResponse.json(await listDayEvents(auth.ctx.ownerId, range.from, range.to));
  } catch (e) {
    return NextResponse.json({ error: gcalErrorMessage(e) }, { status: 502 });
  }
}
