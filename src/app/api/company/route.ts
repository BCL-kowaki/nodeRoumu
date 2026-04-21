import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteCompany } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 企業情報取得（単一レコード）
export async function GET() {
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: { name: "合同会社node" },
    });
  }
  return NextResponse.json(company);
}

// 企業情報更新（代表者のみ）
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWriteCompany(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  let company = await prisma.company.findFirst();
  if (company) {
    company = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: body.name || "",
        nameKana: body.nameKana || null,
        representativeName: body.representativeName || null,
        address: body.address || null,
        phone: body.phone || null,
        email: body.email || null,
        establishedDate: body.establishedDate ? new Date(body.establishedDate) : null,
        businessType: body.businessType || null,
        corporateNumber: body.corporateNumber || null,
        memo: body.memo || null,
      },
    });
  } else {
    company = await prisma.company.create({
      data: { name: body.name || "" },
    });
  }
  return NextResponse.json(company);
}
