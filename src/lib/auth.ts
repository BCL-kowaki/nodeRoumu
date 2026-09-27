import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const COOKIE_NAME = "roumu-session";
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

// セッションCookieをセット（remember: trueなら30日保持）
export async function setSessionCookie(token: string, remember = false) {
  const maxAge = remember
    ? 60 * 60 * 24 * 30  // 30日
    : 60 * 60 * 24 * 7;  // 7日
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

// セッションCookieを削除
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

// Cookieからセッション取得（Server ComponentやAPI Routeで使用）
export async function getSession(): Promise<SessionPayload | null> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifyToken(cookie.value);
}

// NextRequestからセッション取得（Middlewareで使用）
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
