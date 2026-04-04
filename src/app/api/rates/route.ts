import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 料率取得（1レコードのみ）
export async function GET() {
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
export async function PUT(req: NextRequest) {
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
