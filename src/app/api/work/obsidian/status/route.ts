import { NextResponse } from "next/server";
import { listNotes, obsidianConfigured, obsidianErrorMessage } from "@/lib/obsidian";
import { requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

// Obsidian 連携の状態（設定されているか、ノートの数）
export async function GET() {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  if (!obsidianConfigured()) return NextResponse.json({ configured: false });
  try {
    const notes = await listNotes();
    return NextResponse.json({ configured: true, noteCount: notes.length });
  } catch (e) {
    return NextResponse.json({ configured: true, error: obsidianErrorMessage(e) });
  }
}
