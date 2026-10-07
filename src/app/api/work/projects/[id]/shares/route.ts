import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { hashToken } from "@/lib/api-token";
import { obsidianErrorMessage, readNote } from "@/lib/obsidian";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { currentMcpContext } from "@/lib/work/mcp-context";
import { parseShareCreate, shareExpiresAt, shareTitle } from "@/lib/work/note-share";
import { allowedNote, loadProjectNotes } from "@/lib/work/project-notes";
import { newShareToken, toShareView } from "@/lib/work/share-server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// 共有の発行・管理はアプリの画面（ログイン）からだけ。AI 連携からは扱えない
const blocked = () => (currentMcpContext() ? NextResponse.json({ error: "forbidden" }, { status: 403 }) : null);

// ノートの共有リンクの一覧  GET ?path=xxx.md
export async function GET(req: NextRequest, { params }: Params) {
  const b = blocked();
  if (b) return b;
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ctx = await loadProjectNotes((await params).id, auth.ctx.ownerId);
  if (!ctx) return notFound();
  const path = allowedNote(req.nextUrl.searchParams.get("path"), ctx.folder, ctx.project.obsidianPath);
  if (!path) return badRequest("このプロジェクトのノートではありません");
  const shares = await prisma.noteShare.findMany({
    where: { ownerId: auth.ctx.ownerId, notePath: path },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();
  return NextResponse.json(shares.map((s) => toShareView(s, req.nextUrl.origin, now)));
}

// 共有リンクを発行する（その時点の内容を暗号化して保存）
// POST { path, expiresInDays: 7|30|90|null, password? }
export async function POST(req: NextRequest, { params }: Params) {
  const b = blocked();
  if (b) return b;
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ctx = await loadProjectNotes((await params).id, auth.ctx.ownerId);
  if (!ctx) return notFound();
  const parsed = parseShareCreate(await req.json().catch(() => null));
  if (!parsed.ok) return badRequest(parsed.error);
  const path = allowedNote(parsed.data.path, ctx.folder, ctx.project.obsidianPath);
  if (!path) return badRequest("このプロジェクトのノートではありません");
  if (!process.env.WORKSPACE_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "暗号化の鍵（WORKSPACE_ENCRYPTION_KEY）が未設定のため、共有できません" }, { status: 500 });
  }

  let content: string;
  try {
    content = (await readNote(path)).content;
  } catch (e) {
    return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: 502 });
  }
  const token = newShareToken();
  const share = await prisma.noteShare.create({
    data: {
      ownerId: auth.ctx.ownerId,
      projectId: ctx.project.id,
      notePath: path,
      encryptedTitle: encrypt(shareTitle(content, path).slice(0, 200)),
      encryptedContent: encrypt(content),
      tokenHash: hashToken(token),
      encryptedToken: encrypt(token),
      passwordHash: parsed.data.password ? await bcrypt.hash(parsed.data.password, 10) : null,
      expiresAt: shareExpiresAt(parsed.data.expiresInDays, new Date()),
    },
  });
  return NextResponse.json(toShareView(share, req.nextUrl.origin, new Date()), { status: 201 });
}
