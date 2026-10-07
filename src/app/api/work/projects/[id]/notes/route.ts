import { NextRequest, NextResponse } from "next/server";
import { ObsidianError, listPaths, obsidianErrorMessage, readNote, updateNote, writeNote } from "@/lib/obsidian";
import { badRequest, notFound, requireWorkspace } from "@/lib/work/auth";
import { appendToSection, parseNotePath } from "@/lib/work/obsidian-note";
import {
  buildMinutesNote,
  buildNoteTree,
  isInFolder,
  newNotePath,
  parseEntryName,
  type NoteTemplate,
} from "@/lib/work/obsidian-tree";
import { todayJst } from "@/lib/date-jst";
import { allowedNote, loadProjectNotes } from "@/lib/work/project-notes";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const MAX_CONTENT = 500_000; // アプリから保存できるノートの大きさ（文字数）
const NOTES_HEADING = "ノート";

const load = loadProjectNotes;

// 作る場所（専用フォルダ、またはその中のフォルダ）
function allowedParent(parent: unknown, folder: string): string | null {
  if (parent === undefined || parent === null || parent === "" || parent === folder) return folder;
  if (typeof parent !== "string" || !isInFolder(parent, folder)) return null;
  // フォルダとして安全か（パスの検証は .md 前提なので、ダミーの名前を付けて確かめる）
  return parseNotePath(`${parent}/x.md`).ok ? parent : null;
}

const fail = (e: unknown) => {
  if (e instanceof ObsidianError && (e.status === 409 || e.status === 422)) {
    return NextResponse.json({ error: "Obsidian 側で先に更新されていたため保存できませんでした。読み直してから、もう一度お試しください" }, { status: 409 });
  }
  return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: e instanceof ObsidianError && e.status === 404 ? 404 : 502 });
};

// GET                 → { folder, projectNote, tree }（専用フォルダの中のフォルダ・ノート）
// GET ?path=xxx.md    → { path, content, sha }（ノートの本文）
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ctx = await load((await params).id, auth.ctx.ownerId);
  if (!ctx) return notFound();
  const { project, folder } = ctx;

  const pathParam = req.nextUrl.searchParams.get("path");
  try {
    if (pathParam !== null) {
      const path = allowedNote(pathParam, folder, project.obsidianPath);
      if (!path) return badRequest("このプロジェクトのノートではありません");
      return NextResponse.json(await readNote(path));
    }
    const paths = await listPaths(folder);
    return NextResponse.json({ folder, projectNote: project.obsidianPath, tree: buildNoteTree(paths, folder) });
  } catch (e) {
    return fail(e);
  }
}

// POST { action: "folder", parent?, name }                     フォルダを作る（空のフォルダの目印 .gitkeep を置く）
// POST { action: "note", parent?, name, template: "blank"|"minutes" } ノートを作る（同名があれば作らない）
//   作ったノートは、プロジェクトのノートの「ノート」見出しの下にリンクを追記する
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ctx = await load((await params).id, auth.ctx.ownerId);
  if (!ctx) return notFound();
  const { project, folder } = ctx;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const parent = allowedParent(body?.parent, folder);
  if (!parent) return badRequest("作る場所が正しくありません");
  const name = parseEntryName(body?.name);
  if (!name.ok) return badRequest(name.error);

  try {
    if (body?.action === "folder") {
      const path = `${parent}/${name.name}`;
      await writeNote(`${path}/.gitkeep`, "", `フォルダを作成: ${path}`);
      return NextResponse.json({ path }, { status: 201 });
    }
    if (body?.action === "note") {
      const template: NoteTemplate = body.template === "minutes" ? "minutes" : "blank";
      const date = todayJst();
      const path = newNotePath(parent, name.name, template, date);
      if (!parseNotePath(path).ok) return badRequest("ノートの名前が正しくありません");
      const content =
        template === "minutes"
          ? buildMinutesNote({ title: name.name, date, projectNotePath: project.obsidianPath, projectName: project.name })
          : `# ${name.name}\n\n`;
      await writeNote(path, content, `ノートを作成: ${path}`);
      // プロジェクトのノートにリンクを残す（失敗してもノート作成は成功として返す）
      if (project.obsidianPath) {
        const label = path.slice(path.lastIndexOf("/") + 1, -3);
        await updateNote(
          project.obsidianPath,
          (current) => appendToSection(current, NOTES_HEADING, `- [[${path.slice(0, -3)}|${label}]]`),
          `ノートへのリンクを追記: ${project.name}`
        ).catch((e) => console.error("[notes] リンクの追記に失敗", e instanceof ObsidianError ? e.status : ""));
      }
      return NextResponse.json({ path }, { status: 201 });
    }
  } catch (e) {
    if (e instanceof ObsidianError && e.status === 422) return badRequest("同じ名前のノート・フォルダがすでにあります");
    return fail(e);
  }
  return badRequest("操作の指定が正しくありません");
}

// PUT { path, content, sha }  ノートの本文を保存する。読み込んだときの版（sha）から変わっていたら保存しない
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const ctx = await load((await params).id, auth.ctx.ownerId);
  if (!ctx) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const path = allowedNote(body?.path, ctx.folder, ctx.project.obsidianPath);
  if (!path) return badRequest("このプロジェクトのノートではありません");
  if (typeof body?.content !== "string" || body.content.length > MAX_CONTENT) return badRequest("ノートの内容が正しくありません");
  if (typeof body?.sha !== "string" || !/^[0-9a-f]{40}$/.test(body.sha)) return badRequest("ノートを読み直してから保存してください");
  try {
    const { sha } = await writeNote(path, body.content, `ノートを編集: ${path}`, body.sha);
    return NextResponse.json({ path, sha });
  } catch (e) {
    return fail(e);
  }
}
