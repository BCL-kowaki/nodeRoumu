import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteFaqDocuments } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// FAQ書類の詳細取得（全ロール）
// dataBase64 を含めて返す（モーダルでのPDF表示用）
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const record = await prisma.faqDocument.findUnique({
    where: { id: params.id },
  });
  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

// FAQ書類の削除（代表者のみ）
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWriteFaqDocuments(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.faqDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
