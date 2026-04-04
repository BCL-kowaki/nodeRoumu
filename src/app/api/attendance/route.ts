import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 出勤簿取得（クエリ: employeeId, month）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const month = searchParams.get("month"); // YYYY-MM

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (month) {
    const start = new Date(month + "-01");
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    where.date = { gte: start, lt: end };
  }

  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: "asc" },
  });
  return NextResponse.json(records);
}

// 出勤簿のupsert（打刻から自動同期 or 手動入力）
export async function POST(req: NextRequest) {
  const body = await req.json();
  const date = new Date(body.date);

  const record = await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: body.employeeId,
        date,
      },
    },
    update: {
      startTime: body.startTime ?? undefined,
      endTime: body.endTime ?? undefined,
      breakMinutes: body.breakMinutes != null ? Number(body.breakMinutes) : undefined,
      memo: body.memo ?? undefined,
    },
    create: {
      employeeId: body.employeeId,
      date,
      startTime: body.startTime || null,
      endTime: body.endTime || null,
      breakMinutes: body.breakMinutes ? Number(body.breakMinutes) : null,
      memo: body.memo || null,
    },
  });
  return NextResponse.json(record);
}
