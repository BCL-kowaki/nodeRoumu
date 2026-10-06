// Obsidian ノートの扱い（決まった答えになる処理なのでテストで固定）
// - パスの検証: アプリが触れるのはリポジトリ内の .md だけ。範囲外を指す指定は拒否する
// - 書き込みは「新規作成」と「見出しの下への1行追記」に限り、本文の自由な書き換えはしない

const MAX_PATH = 255;
const MAX_FILE_STEM = 80;

export type NotePathResult = { ok: true; path: string } | { ok: false };

// リポジトリ内の相対パスとして安全な .md ファイルか確認する
export function parseNotePath(input: unknown): NotePathResult {
  if (typeof input !== "string") return { ok: false };
  const path = input.trim();
  if (!path || path.length > MAX_PATH) return { ok: false };
  if (!path.endsWith(".md")) return { ok: false };
  if (path.startsWith("/") || path.includes("\\")) return { ok: false };
  // 制御文字（改行・タブなど）
  if (/[\u0000-\u001f\u007f]/.test(path)) return { ok: false };
  const parts = path.split("/");
  // 空の区切り、"."、".."、"." で始まる名前（.git / .obsidian / 隠しファイル）は拒否
  if (parts.some((p) => p === "" || p === "." || p === ".." || p.startsWith("."))) return { ok: false };
  return { ok: true, path };
}

// プロジェクト名から、ファイル名として使える名前を作る
export function noteFileName(projectName: string): string {
  const stem = projectName
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, MAX_FILE_STEM)
    .trim();
  return `${stem || "プロジェクト"}.md`;
}

// GitHub の Contents API のパス用に、区切りごとに符号化する
export function encodeContentsPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

const PROJECT_STATUS_JP: Record<string, string> = {
  active: "進行中",
  on_hold: "保留",
  done: "完了",
  archived: "アーカイブ",
};

// プロジェクト用ノートの雛形
export function buildProjectNote(p: {
  name: string;
  status: string;
  description: string | null;
  dueDate: string | null;
}): string {
  const lines = [`# ${p.name}`, "", `状態: ${PROJECT_STATUS_JP[p.status] ?? p.status}`];
  if (p.dueDate) lines.push(`期限: ${p.dueDate}`);
  if (p.description) lines.push("", p.description.trim());
  lines.push("", "## ログ", "");
  return lines.join("\n");
}

// 見出し（## 見出し）の節の末尾に1行追記する。
// 見出しが無ければ、ファイルの末尾に見出しごと追加する。コードブロック内の見出しは無視する。
export function appendToSection(content: string, heading: string, line: string): string {
  const oneLine = line.replace(/\s*[\r\n]+\s*/g, " ").trim();
  const text = content.endsWith("\n") || content === "" ? content : content + "\n";
  const lines = text.split("\n");
  lines.pop(); // split で末尾に生じる空要素

  let inFence = false;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (!inFence && new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`).test(lines[i])) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    const sep = lines.length === 0 || lines[lines.length - 1] === "" ? "" : "\n";
    return text + sep + `## ${heading}\n${oneLine}\n`;
  }

  // 節の終わり = 次の同レベル以上の見出しの直前（無ければファイル末尾）
  let end = lines.length;
  inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) inFence = !inFence;
    if (!inFence && /^#{1,2}\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  // 節末尾の空行の手前に入れる（節の中身と続けて書く）
  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1] === "") insertAt--;
  lines.splice(insertAt, 0, oneLine);
  return lines.join("\n") + "\n";
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
