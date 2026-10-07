// プロジェクトのノート・専用フォルダの扱い（サーバー専用）。ノートの API と共有リンクの API で共通に使う
import { prisma } from "@/lib/prisma";
import { parseNotePath } from "./obsidian-note";
import { isInFolder, projectFolderFor } from "./obsidian-tree";

export async function loadProjectNotes(id: string, ownerId: string) {
  const project = await prisma.workProject.findFirst({ where: { id, ownerId }, select: { id: true, name: true, obsidianPath: true } });
  if (!project) return null;
  return { project, folder: projectFolderFor(project.obsidianPath, project.name) };
}

// 扱ってよいノートか：プロジェクトのノートそのもの、または専用フォルダの中の .md
export function allowedNote(path: unknown, folder: string, projectNote: string | null): string | null {
  const parsed = parseNotePath(path);
  if (!parsed.ok) return null;
  return parsed.path === projectNote || isInFolder(parsed.path, folder) ? parsed.path : null;
}
