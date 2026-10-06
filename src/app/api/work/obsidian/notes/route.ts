import { NextRequest, NextResponse } from "next/server";
import { listNotes, obsidianErrorMessage, readNote } from "@/lib/obsidian";
import { badRequest, requireWorkspace } from "@/lib/work/auth";
import { parseNotePath } from "@/lib/work/obsidian-note";

export const dynamic = "force-dynamic";

// ノートの一覧、または1件の本文
// GET /api/work/obsidian/notes            → [{ path, size }]
// GET /api/work/obsidian/notes?path=...   → { path, content }（sha は返さない）
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;

  const pathParam = req.nextUrl.searchParams.get("path");
  try {
    if (pathParam === null) return NextResponse.json(await listNotes());
    const parsed = parseNotePath(pathParam);
    if (!parsed.ok) return badRequest("ノートのパスが正しくありません");
    const note = await readNote(parsed.path);
    return NextResponse.json({ path: note.path, content: note.content });
  } catch (e) {
    return NextResponse.json({ error: obsidianErrorMessage(e) }, { status: 502 });
  }
}
