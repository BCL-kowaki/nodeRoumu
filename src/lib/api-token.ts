// AI 連携（MCP）用の鍵の作成・確認（決まった答えになる処理なのでテストで固定）
// - 鍵は画面に1回だけ表示し、DB には元に戻せない値（SHA-256）だけを保存する
// - 鍵は十分に長いランダム値なので、パスワードのような遅いハッシュは不要
import { createHash, randomBytes } from "crypto";

export const TOKEN_PREFIX = "npk_";
export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];
export const TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;
const MAX_NAME = 50;

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 一覧で見分けるための先頭部分（鍵そのものは保存しない）
export function tokenHint(token: string): string {
  return token.slice(0, TOKEN_PREFIX.length + 4);
}

export function parseBearer(header: string | null | undefined): string | null {
  const m = header?.trim().match(/^bearer\s+(\S+)$/i);
  if (!m || !m[1].startsWith(TOKEN_PREFIX)) return null;
  return m[1];
}

export function isTokenUsable(t: { revokedAt: Date | null; expiresAt: Date }, now: Date): boolean {
  return !t.revokedAt && t.expiresAt.getTime() > now.getTime();
}

export function parseTokenCreateInput(
  body: unknown
): { ok: true; data: { name: string; scope: TokenScope; expiresInDays: number; attendance: boolean } } | { ok: false; error: string } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "鍵の名前を入力してください" };
  if (name.length > MAX_NAME) return { ok: false, error: `鍵の名前は${MAX_NAME}文字以内で入力してください` };
  if (typeof b.scope !== "string" || !(TOKEN_SCOPES as readonly string[]).includes(b.scope)) {
    return { ok: false, error: "操作の範囲の指定が正しくありません" };
  }
  if (typeof b.expiresInDays !== "number" || !(TOKEN_EXPIRY_DAYS as readonly number[]).includes(b.expiresInDays)) {
    return { ok: false, error: "有効期限は30日・90日・365日から選んでください" };
  }
  if (b.attendance !== undefined && typeof b.attendance !== "boolean") {
    return { ok: false, error: "出勤簿を扱うかの指定が正しくありません" };
  }
  return { ok: true, data: { name, scope: b.scope as TokenScope, expiresInDays: b.expiresInDays, attendance: b.attendance === true } };
}
