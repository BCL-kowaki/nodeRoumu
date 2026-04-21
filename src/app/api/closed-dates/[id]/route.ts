import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteHolidays } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 特定休日削除（代表者のみ）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWriteHolidays(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.closedDate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
