// ノートの共有リンク（社外の方が見られる読み取り専用ページ）の判定（決まった答えになる処理なのでテストで固定）

export const SHARE_EXPIRY_DAYS = [7, 30, 90] as const;
const MAX_FAILED = 5; // この回数パスワードを間違えたら、しばらく入力できなくする
const LOCK_MINUTES = 15;

export type ShareCreate = { path: string; expiresInDays: number | null; password: string | null };

export function parseShareCreate(body: unknown): { ok: true; data: ShareCreate } | { ok: false; error: string } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof b.path !== "string" || !b.path) return { ok: false, error: "共有するノートを選んでください" };
  const days = b.expiresInDays;
  if (!(days === null || (typeof days === "number" && (SHARE_EXPIRY_DAYS as readonly number[]).includes(days)))) {
    return { ok: false, error: "有効期限は7日・30日・90日・無期限から選んでください" };
  }
  let password: string | null = null;
  if (b.password !== undefined && b.password !== null && b.password !== "") {
    if (typeof b.password !== "string") return { ok: false, error: "パスワードは4〜100文字で入力してください" };
    const p = b.password.trim();
    if (p.length < 4 || p.length > 100) return { ok: false, error: "パスワードは4〜100文字で入力してください" };
    password = p;
  }
  return { ok: true, data: { path: b.path, expiresInDays: days as number | null, password } };
}

export function shareExpiresAt(days: number | null, now: Date): Date | null {
  return days === null ? null : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isShareOpen(s: { revokedAt: Date | null; expiresAt: Date | null }, now: Date): boolean {
  return !s.revokedAt && (!s.expiresAt || s.expiresAt.getTime() > now.getTime());
}

export function afterFailedAttempt(failedAttempts: number, now: Date): { failedAttempts: number; lockedUntil: Date | null } {
  const next = failedAttempts + 1;
  if (next >= MAX_FAILED) return { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60 * 1000) };
  return { failedAttempts: next, lockedUntil: null };
}

// 共有ページの題名：最初の「# 見出し」、無ければファイル名
export function shareTitle(content: string, path: string): string {
  const h1 = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return h1 || path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
}
