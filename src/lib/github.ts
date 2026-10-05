// GitHub REST API の呼び出し（サーバー専用）
// トークンは環境変数 GITHUB_TOKEN（Fine-grained Personal Access Token）からのみ読み、
// 画面・ログ・DBには出さない。
import { parseLastPage, type GhIssue } from "@/lib/work/github-sync";

// 手元での動作確認用に、テスト用の偽サーバーへ向けられるようにしている（本番では未設定＝本物の GitHub）
const API_BASE = process.env.GITHUB_API_BASE || "https://api.github.com";
const MAX_PAGES = 5; // 1回の同期で読む最大ページ数（100件 × 5）
const MIN_RATE_REMAINING = 50; // 残り回数がこれを下回ったら止める

export class GithubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function githubConfigured(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

// 画面に出してよいエラーメッセージ（GitHub の応答本文は返さない）
export function githubErrorMessage(e: unknown): string {
  if (!(e instanceof GithubError)) return "GitHub との通信に失敗しました";
  if (e.status === 401) return "GitHub のトークンが無効か期限切れです。再発行して Vercel の環境変数を更新してください";
  if (e.status === 403) return e.message || "GitHub への権限が足りません（トークンの権限を確認してください）";
  if (e.status === 404) return "GitHub 上で見つかりません（トークンの対象リポジトリを確認してください）";
  if (e.status === 0) return e.message;
  return `GitHub との通信に失敗しました（${e.status}）`;
}

async function ghFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new GithubError(0, "GitHub のトークン（GITHUB_TOKEN）が設定されていません");
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  if (!url.startsWith(`${API_BASE}/`)) throw new GithubError(0, "GitHub 以外の宛先には接続しません");
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
  const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "1000");
  if (!res.ok) {
    if (res.status === 403 && remaining === 0) {
      throw new GithubError(403, "GitHub の利用回数の上限に達しました。しばらく待ってから再度お試しください");
    }
    // 応答本文にはトークン等は含まれないが、画面には出さずステータスだけ記録する
    console.error(`GitHub API エラー: ${init?.method ?? "GET"} ${path.split("?")[0]} → ${res.status}`);
    throw new GithubError(res.status, "");
  }
  if (remaining < MIN_RATE_REMAINING) {
    throw new GithubError(403, "GitHub の利用回数の残りが少ないため、処理を止めました。しばらく待ってから再度お試しください");
  }
  return res;
}

// 次のページの URL（Link ヘッダーの rel="next"）。
// トークン付きで呼ぶため、同じ API の URL 以外は辿らない
function nextPage(res: Response): string | null {
  const m = res.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/);
  if (!m || !m[1].startsWith(`${API_BASE}/`)) return null;
  return m[1];
}

async function getAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = path;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await ghFetch(url);
    items.push(...((await res.json()) as T[]));
    url = nextPage(res);
  }
  return items;
}

export async function getViewer(): Promise<{ login: string }> {
  return (await ghFetch("/user")).json();
}

export type GhRepo = {
  id: number;
  full_name: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  html_url: string;
  default_branch: string;
  open_issues_count: number; // GitHub の仕様でプルリクエストも含む
  pushed_at: string | null;
};

// トークンで見えるリポジトリ（最近 push された順）
export async function listRepos(): Promise<GhRepo[]> {
  return getAll<GhRepo>("/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member");
}

// Issue の一覧（プルリクエストも混ざって返る）。since 以降に更新されたものだけ
export async function listIssues(fullName: string, since: Date | null): Promise<GhIssue[]> {
  const q = new URLSearchParams({ state: "all", per_page: "100", sort: "updated", direction: "asc" });
  if (since) q.set("since", since.toISOString());
  return getAll<GhIssue>(`/repos/${fullName}/issues?${q}`);
}

// open のプルリクエスト数（1件ずつのページ数で数える）
export async function countOpenPulls(fullName: string): Promise<number> {
  const res = await ghFetch(`/repos/${fullName}/pulls?state=open&per_page=1`);
  const last = parseLastPage(res.headers.get("link"));
  if (last !== null) return last;
  return ((await res.json()) as unknown[]).length;
}

export async function updateIssueState(
  fullName: string,
  number: number,
  body: { state: "open" | "closed"; state_reason?: string }
): Promise<GhIssue> {
  const res = await ghFetch(`/repos/${fullName}/issues/${number}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getRepo(fullName: string): Promise<GhRepo> {
  return (await ghFetch(`/repos/${fullName}`)).json();
}
