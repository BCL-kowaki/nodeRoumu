import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 特定休日一覧取得（クエリ: year）
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();

  const start = new Date(`${year}-01-01`);
  const end = new Date(`${Number(year) + 1}-01-01`);

  const records = await prisma.closedDate.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(records);
}

// 特定休日追加
export async function POST(req: NextRequest) {
  const body = await req.json();

  // 一括登録対応（配列が来た場合）
  if (Array.isArray(body)) {
    const results = [];
    for (const item of body) {
      try {
        const record = await prisma.closedDate.upsert({
          where: { date: new Date(item.date) },
          update: { name: item.name, type: item.type || "national" },
          create: {
            date: new Date(item.date),
            name: item.name,
            type: item.type || "national",
          },
        });
        results.push(record);
      } catch {
        // 重複はスキップ
      }
    }
    return NextResponse.json(results, { status: 201 });
  }

  // 単体登録
  const record = await prisma.closedDate.create({
    data: {
      date: new Date(body.date),
      name: body.name,
      type: body.type || "company",
    },
  });
  return NextResponse.json(record, { status: 201 });
}
