// Obsidian ノート（GitHub の非公開リポジトリ）の読み書き（サーバー専用）
// 専用のトークン OBSIDIAN_GITHUB_TOKEN（ノート用リポジトリだけに権限を絞った Fine-grained PAT）を使う。
// Issue 連携用の GITHUB_TOKEN とは別にして、コード用リポジトリへの書き込み権限を持たせない。
import { encodeContentsPath } from "@/lib/work/obsidian-note";

// 手元での動作確認用に、テスト用の偽サーバーへ向けられる（本番では未設定＝本物の GitHub）
const API_BASE = process.env.GITHUB_API_BASE || "https://api.github.com";
const MAX_NOTE_BYTES = 1_000_000; // 読み込むノートの上限（1MB）

export class ObsidianError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function config(): { token: string; repo: string } {
  const token = process.env.OBSIDIAN_GITHUB_TOKEN;
  const repo = process.env.OBSIDIAN_REPO; // 例: BCL-kowaki/ObsidianWorkPortal
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new ObsidianError(0, "Obsidian 連携が設定されていません（OBSIDIAN_GITHUB_TOKEN と OBSIDIAN_REPO が必要です）");
  }
  return { token, repo };
}

export function obsidianConfigured(): boolean {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

// 画面に出してよいエラーメッセージ（GitHub の応答本文は返さない）
export function obsidianErrorMessage(e: unknown): string {
  if (!(e instanceof ObsidianError)) return "Obsidian のノートとの通信に失敗しました";
  if (e.status === 0) return e.message;
  if (e.status === 401) return "Obsidian 用のトークンが無効か期限切れです。再発行して Vercel の環境変数を更新してください";
  if (e.status === 403) return "Obsidian 用のトークンの権限が足りません（Contents の読み書き権限を確認してください）";
  if (e.status === 404) return "ノートが見つかりません";
  if (e.status === 409 || e.status === 422) return "ノートが他で更新されたため保存できませんでした。もう一度お試しください";
  return `Obsidian のノートとの通信に失敗しました（${e.status}）`;
}

async function gh(path: string, init?: RequestInit): Promise<Response> {
  const { token } = config();
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`Obsidian(GitHub) API エラー: ${init?.method ?? "GET"} ${path.split("?")[0]} → ${res.status}`);
    throw new ObsidianError(res.status, "");
  }
  return res;
}

// ノートの一覧（.md のみ。.で始まるフォルダ・ファイルは除く）
export async function listNotes(): Promise<{ path: string; size: number }[]> {
  const { repo } = config();
  const res = await gh(`/repos/${repo}/git/trees/HEAD?recursive=1`);
  const data = (await res.json()) as { tree: { path: string; type: string; size?: number }[]; truncated?: boolean };
  return data.tree
    .filter((t) => t.type === "blob" && t.path.endsWith(".md") && !t.path.split("/").some((p) => p.startsWith(".")))
    .map((t) => ({ path: t.path, size: t.size ?? 0 }))
    .sort((a, b) => a.path.localeCompare(b.path, "ja"));
}

export type Note = { path: string; content: string; sha: string };

// ノートの本文と、更新時の衝突検出に使う版（sha）を読む
export async function readNote(path: string): Promise<Note> {
  const { repo } = config();
  const res = await gh(`/repos/${repo}/contents/${encodeContentsPath(path)}`);
  const data = (await res.json()) as { type?: string; size?: number; content?: string; sha: string; encoding?: string };
  if (data.type !== "file" || data.encoding !== "base64" || typeof data.content !== "string") {
    throw new ObsidianError(404, "");
  }
  if ((data.size ?? 0) > MAX_NOTE_BYTES) throw new ObsidianError(413, "");
  return { path, content: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
}

// ノートを保存する。sha を渡すと、その版から変わっていた場合は GitHub が拒否する（上書きによる消失を防ぐ）。
// sha を渡さない場合は新規作成だけ（既存ファイルがあれば拒否される）
export async function writeNote(path: string, content: string, message: string, sha?: string): Promise<{ sha: string }> {
  const { repo } = config();
  const res = await gh(`/repos/${repo}/contents/${encodeContentsPath(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
  const data = (await res.json()) as { content: { sha: string } };
  return { sha: data.content.sha };
}

// 追記など「読んで・変えて・書く」更新。他で更新されていて拒否されたら、読み直して1回だけやり直す
export async function updateNote(
  path: string,
  change: (current: string) => string,
  message: string
): Promise<{ content: string; sha: string }> {
  for (let attempt = 1; ; attempt++) {
    const note = await readNote(path);
    const next = change(note.content);
    try {
      const { sha } = await writeNote(path, next, message, note.sha);
      return { content: next, sha };
    } catch (e) {
      const conflict = e instanceof ObsidianError && (e.status === 409 || e.status === 422);
      if (!conflict || attempt >= 2) throw e;
    }
  }
}

// フォルダの中のファイルのパス（.md 以外も含む。空のフォルダの目印 .gitkeep を拾うため）
export async function listPaths(folder: string): Promise<string[]> {
  const { repo } = config();
  const res = await gh(`/repos/${repo}/git/trees/HEAD?recursive=1`);
  const data = (await res.json()) as { tree: { path: string; type: string }[] };
  return data.tree.filter((t) => t.type === "blob" && t.path.startsWith(folder + "/")).map((t) => t.path);
}
