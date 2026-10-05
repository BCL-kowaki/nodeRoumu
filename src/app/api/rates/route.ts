import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteHolidays, canWritePayroll } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 料率取得（1レコードのみ）
// 定休曜日の表示に従業員画面でも使うため、ログインしていれば閲覧可
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rate = await prisma.rate.findFirst();
  if (!rate) {
    // デフォルト値で作成
    rate = await prisma.rate.create({
      data: {
        healthInsurance: 10.34,
        pension: 18.3,
        employmentInsurance: 0.6,
        childcare: 0.36,
        label: "",
      },
    });
  }
  return NextResponse.json(rate);
}

// 料率更新
// 社会保険料率（給与）と定休曜日（休日設定）の両方を更新するため、両方の権限を要求する
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWritePayroll(session.role) || !canWriteHolidays(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();

  let rate = await prisma.rate.findFirst();
  if (rate) {
    rate = await prisma.rate.update({
      where: { id: rate.id },
      data: {
        healthInsurance: body.healthInsurance,
        pension: body.pension,
        employmentInsurance: body.employmentInsurance,
        childcare: body.childcare,
        label: body.label || null,
        closedSun: body.closedSun ?? true,
        closedMon: body.closedMon ?? false,
        closedTue: body.closedTue ?? false,
        closedWed: body.closedWed ?? false,
        closedThu: body.closedThu ?? false,
        closedFri: body.closedFri ?? false,
        closedSat: body.closedSat ?? true,
      },
    });
  } else {
    rate = await prisma.rate.create({
      data: {
        healthInsurance: body.healthInsurance,
        pension: body.pension,
        employmentInsurance: body.employmentInsurance,
        childcare: body.childcare,
        label: body.label || null,
        closedSun: body.closedSun ?? true,
        closedMon: body.closedMon ?? false,
        closedTue: body.closedTue ?? false,
        closedWed: body.closedWed ?? false,
        closedThu: body.closedThu ?? false,
        closedFri: body.closedFri ?? false,
        closedSat: body.closedSat ?? true,
      },
    });
  }
  return NextResponse.json(rate);
}
