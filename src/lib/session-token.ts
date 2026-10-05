// セッショントークン（JWT）の作成・検証。
// Middleware（Edge Runtime）からも読み込むため、Prisma や next/headers など
// サーバー専用の処理はここに置かない（それらは auth.ts 側に置く）。
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

export const COOKIE_NAME = "roumu-session";
const MIN_SECRET_LENGTH = 32;

// JWT署名鍵を環境変数から取得する。
// 未設定・短すぎる場合は固定値で代用せずエラーにする（固定値だと誰でもログイン状態を偽造できるため）。
// ビルド時に環境変数が無くても落ちないよう、モジュール読み込み時ではなく使用時に検証する。
function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `環境変数 AUTH_SECRET が未設定か短すぎます（${MIN_SECRET_LENGTH}文字以上のランダムな文字列を設定してください）`
    );
  }
  return new TextEncoder().encode(secret);
}

// セッション情報の型
export type SessionPayload = {
  employeeId: string;
  loginId: string;
  role: "admin" | "manager" | "employee";
  name: string;
};

// JWTトークン作成（remember: trueなら30日、falseなら7日）
export async function createToken(payload: SessionPayload, remember = false): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(remember ? "30d" : "7d")
    .setIssuedAt()
    .sign(getSecret());
}

// JWTトークン検証
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  // 鍵の設定漏れは「未ログイン扱い」で握りつぶさず、エラーとして表に出す
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// NextRequestからセッション取得（Middlewareで使用）
// ※ Edge Runtime ではDBを引けないため、権限はトークン内の値。画面の振り分け用途に限る。
//    データの読み書きの可否は各APIの getSession()（DBの最新権限）で判定する。
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
