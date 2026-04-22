import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteFaqDocuments } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// 10MB 上限（Base64エンコード後のサイズではなく、元ファイル（バイト数）で判定）
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// FAQ書類一覧取得（全ロール）
// 一覧は dataBase64 を含めない（軽量化 + 不要な転送量削減）
// ?category=xxx でフィルタ可
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const records = await prisma.faqDocument.findMany({
    where: category ? { category } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      uploadedBy: true,
      createdAt: true,
      updatedAt: true,
      // dataBase64 は返さない
    },
  });
  return NextResponse.json(records);
}

// FAQ書類追加（代表者のみ）
// body: { title, category?, description?, fileName, fileSize, mimeType, dataBase64 }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!canWriteFaqDocuments(session.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() || null : null;
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";

  // バリデーション
  if (!title) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  }
  if (!fileName || !dataBase64) {
    return NextResponse.json({ error: "ファイルが指定されていません" }, { status: 400 });
  }
  if (mimeType !== "application/pdf") {
    return NextResponse.json({ error: "PDFファイルのみアップロード可能です" }, { status: 400 });
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "ファイルサイズは10MB以下にしてください" },
      { status: 400 }
    );
  }

  const created = await prisma.faqDocument.create({
    data: {
      title,
      category,
      description,
      fileName,
      fileSize,
      mimeType,
      dataBase64,
      uploadedBy: session.employeeId,
    },
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      uploadedBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(created, { status: 201 });
}
