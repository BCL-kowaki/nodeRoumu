import { NextRequest, NextResponse } from "next/server";
import { jstDateToDb } from "@/lib/date-jst";
import { gcalErrorMessage, getConnection } from "@/lib/google-calendar";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { exportPlans } from "@/lib/work/plan-calendar";
import { parseRange } from "@/lib/work/range";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 期間内の計画を、専用カレンダー「業務計画」に書き出す（開始時刻のない計画は対象外）
// POST /api/work/google/export  body: { from, to }
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const sp = new URLSearchParams({ from: String(body?.from ?? ""), to: String(body?.to ?? body?.from ?? "") });
  const range = parseRange(sp);
  if ("error" in range) return badRequest(range.error);
  const acc = await getConnection(auth.ctx.ownerId);
  if (!acc || acc.status !== "active") return badRequest("Google カレンダーに接続されていません");
  try {
    return NextResponse.json(await exportPlans(auth.ctx.ownerId, jstDateToDb(range.from), jstDateToDb(range.to)));
  } catch (e) {
    return NextResponse.json({ error: gcalErrorMessage(e) }, { status: 502 });
  }
}
