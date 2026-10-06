// 外部サービスのトークンをデータベースに保存するときの暗号化（AES-256-GCM）。サーバー専用。
// 保存形式: "v1:<iv>:<認証タグ>:<暗号文>"（各 base64）。先頭の版番号で、将来の鍵の交換・方式の変更に備える。
// 鍵は環境変数 WORKSPACE_ENCRYPTION_KEY（32バイトを base64 にしたもの。`openssl rand -base64 32` で作る）。
// 未設定・長さ違いは、固定値で代用せずエラーにする（使う時点で検証するので、ビルドは通る）。
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.WORKSPACE_ENCRYPTION_KEY;
  if (!raw) throw new Error("環境変数 WORKSPACE_ENCRYPTION_KEY が設定されていません");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("WORKSPACE_ENCRYPTION_KEY は32バイト（base64）で設定してください（openssl rand -base64 32）");
  }
  return key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12); // GCM の推奨長。毎回ランダムにするので、同じ文字列でも暗号文は変わる
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), body.toString("base64")].join(":");
}

// 改ざん・別の鍵・知らない版・形式違いは、例外にする
export function decrypt(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("暗号化された値の形式が正しくありません");
  const [, iv, tag, body] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}
