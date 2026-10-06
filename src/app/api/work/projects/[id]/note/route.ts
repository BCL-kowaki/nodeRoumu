import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obsidianErrorMessage, ObsidianError, readNote, updateNote, writeNote } from "@/lib/obsidian";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { appendToSection, buildProjectNote, noteFileName, parseNotePath } from "@/lib/work/obsidian-note";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const FOLDER = "Projects"; // 新規ノートの置き場所（リポジトリ直下のフォルダ）
const LOG_HEADING = "ログ";
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function findProject(id: string, ownerId: string) {
  return prisma.workProject.findFirst({ where: { id, ownerId } });
}

// プロジェクトに紐づいたノートの本文
// GET /api/work/projects/[id]/note → { path, content } | { path: null }
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const project = await findProject((await params).id, auth.ctx.ownerId);
  if (!project) return notFound();
  if (!project.obsidianPath) return NextResponse.json({ path: null });
  try {
    const note = await readNote(project.obsidianPath);
    return NextResponse.json({ path: note.path, content: note.content });
  } catch (e) {
    if (e instanceof ObsidianError && e.status === 404) {
      return NextResponse.json({ path: project.obsidianPath, missing: true });
    }
    return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: 502 });
  }
}

// ノートの紐づけ・新規作成・ログ追記
// PUT  { path }            既存ノートに紐づける（無ければ 404）
// POST { action: "create" } プロジェクト用ノートを新しく作って紐づける
// POST { action: "log", text } ノートの「ログ」の下に1行追記する
// DELETE                    紐づけを外す（ノートは消さない）
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const project = await findProject((await params).id, auth.ctx.ownerId);
  if (!project) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = parseNotePath(body?.path);
  if (!parsed.ok) return badRequest("ノートのパスが正しくありません");
  try {
    await readNote(parsed.path); // 存在確認（無ければ 404）
  } catch (e) {
    return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: e instanceof ObsidianError && e.status === 404 ? 400 : 502 });
  }
  const updated = await prisma.workProject.update({
    where: { id: project.id },
    data: { obsidianPath: parsed.path, obsidianSyncedAt: new Date() },
  });
  return NextResponse.json({ path: updated.obsidianPath });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const project = await findProject((await params).id, auth.ctx.ownerId);
  if (!project) return notFound();
  const body = await req.json().catch(() => null);

  if (body?.action === "create") {
    if (project.obsidianPath) return badRequest("すでにノートが紐づいています");
    const path = `${FOLDER}/${noteFileName(project.name)}`;
    const content = buildProjectNote({
      name: project.name,
      status: project.status,
      description: project.description,
      dueDate: project.dueDate ? ymd(project.dueDate) : null,
    });
    try {
      // sha なしの書き込みは新規作成だけ。同名のノートが既にあれば GitHub が拒否する（上書きしない）
      await writeNote(path, content, `プロジェクト「${project.name}」のノートを作成`);
    } catch (e) {
      if (e instanceof ObsidianError && e.status === 422) {
        return badRequest(`${path} はすでに存在します。既存のノートに紐づけてください`);
      }
      return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: 502 });
    }
    await prisma.workProject.update({ where: { id: project.id }, data: { obsidianPath: path, obsidianSyncedAt: new Date() } });
    return NextResponse.json({ path }, { status: 201 });
  }

  if (body?.action === "log") {
    if (!project.obsidianPath) return badRequest("ノートが紐づいていません");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("ログの内容を入力してください");
    if (text.length > 500) return badRequest("ログは500文字以内で入力してください");
    const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 16); // 日本時間 "YYYY-MM-DD HH:MM"
    try {
      const result = await updateNote(
        project.obsidianPath,
        (current) => appendToSection(current, LOG_HEADING, `- ${stamp} ${text}`),
        `ログを追記: ${project.name}`
      );
      await prisma.workProject.update({ where: { id: project.id }, data: { obsidianSyncedAt: new Date() } });
      return NextResponse.json({ path: project.obsidianPath, content: result.content });
    } catch (e) {
      return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: 502 });
    }
  }
  return badRequest("操作の指定が正しくありません");
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const { count } = await prisma.workProject.updateMany({
    where: { id: (await params).id, ownerId: auth.ctx.ownerId },
    data: { obsidianPath: null, obsidianSyncedAt: null },
  });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
