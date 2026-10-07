// プロジェクト専用の Obsidian フォルダ（ノート・議事録を置く）の扱い（決まった答えになる処理なのでテストで固定）
import { noteFileName } from "./obsidian-note";

const ROOT = "Projects";
const MAX_NAME = 80;

// プロジェクト専用フォルダ：紐づいたノート（Projects/X.md）があればその隣の Projects/X、無ければ Projects/プロジェクト名
export function projectFolderFor(notePath: string | null, projectName: string): string {
  if (notePath && notePath.endsWith(".md")) return notePath.slice(0, -3);
  return `${ROOT}/${noteFileName(projectName).slice(0, -3)}`;
}

export function isInFolder(path: string, folder: string): boolean {
  return path.startsWith(folder + "/");
}

// フォルダ名・ノート名。ファイル名に使えない文字を除き、. で始まる名前（隠しファイル）は認めない
export function parseEntryName(input: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const raw = typeof input === "string" ? input : "";
  const name = raw
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return { ok: false, error: "名前を入力してください" };
  if (name.startsWith(".")) return { ok: false, error: "名前を「.」で始めることはできません" };
  if (name.length > MAX_NAME) return { ok: false, error: `名前は${MAX_NAME}文字以内にしてください` };
  return { ok: true, name };
}

export type NoteTemplate = "blank" | "minutes";

// 新しいノートのパス。議事録は日付を先頭に付けて、並べたときに日付順になるようにする
export function newNotePath(folder: string, name: string, template: NoteTemplate, date: string): string {
  return `${folder}/${template === "minutes" ? `${date}_${name}` : name}.md`;
}

export type TreeNode =
  | { type: "folder"; name: string; path: string; children: TreeNode[] }
  | { type: "note"; name: string; path: string };

// リポジトリのファイル一覧から、フォルダの中を木の形にする。
// .md だけをノートとして出し、空のフォルダ（.gitkeep だけ）も出す。フォルダを先に、名前順
export function buildNoteTree(paths: string[], folder: string): TreeNode[] {
  const root: TreeNode[] = [];
  const folders = new Map<string, TreeNode[]>([[folder, root]]);
  const ensureFolder = (path: string): TreeNode[] => {
    const existing = folders.get(path);
    if (existing) return existing;
    const parent = ensureFolder(path.slice(0, path.lastIndexOf("/")));
    const children: TreeNode[] = [];
    parent.push({ type: "folder", name: path.slice(path.lastIndexOf("/") + 1), path, children });
    folders.set(path, children);
    return children;
  };
  for (const p of paths) {
    if (!isInFolder(p, folder)) continue;
    const dir = p.slice(0, p.lastIndexOf("/"));
    const file = p.slice(p.lastIndexOf("/") + 1);
    if (p.slice(folder.length + 1).split("/").slice(0, -1).some((s) => s.startsWith("."))) continue;
    const siblings = ensureFolder(dir);
    if (file.endsWith(".md") && !file.startsWith(".")) siblings.push({ type: "note", name: file.slice(0, -3), path: p });
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "ja") : a.type === "folder" ? -1 : 1));
    for (const n of nodes) if (n.type === "folder") sort(n.children);
  };
  sort(root);
  return root;
}

// 議事録のひな形（Obsidian でそのまま使える Markdown）
export function buildMinutesNote(p: { title: string; date: string; projectNotePath: string | null; projectName: string }): string {
  const lines = [`# ${p.title}`, "", `- 日付: ${p.date}`];
  if (p.projectNotePath) lines.push(`- プロジェクト: [[${p.projectNotePath.replace(/\.md$/, "")}|${p.projectName}]]`);
  lines.push("", "## 参加者", "- ", "", "## 議題", "- ", "", "## 内容", "", "", "## 決定事項", "- ", "", "## TODO", "- [ ] ", "");
  return lines.join("\n");
}

// Obsidian の [[パス|表示名]]・[[パス]] を、画面で押せるリンク [表示名](obsidian:パス.md) に置き換える（コードの中は除く）
export function linkWikiLinks(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|([^\]\n]+))?\]\]/g, (_m, target: string, label?: string) => {
            const path = target.trim().endsWith(".md") ? target.trim() : `${target.trim()}.md`;
            const text = (label ?? target.trim().split("/").pop() ?? target).trim();
            return `[${text.replace(/[[\]]/g, "")}](obsidian:${encodeURIComponent(path)})`;
          })
    )
    .join("");
}
