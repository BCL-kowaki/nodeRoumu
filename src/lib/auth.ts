import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "roumu-default-secret"
);
const COOKIE_NAME = "roumu-session";

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
    .sign(SECRET);
}

// JWTトークン検証
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// セッションCookieをセット（remember: trueなら30日保持）
export function setSessionCookie(token: string, remember = false) {
  const maxAge = remember
    ? 60 * 60 * 24 * 30  // 30日
    : 60 * 60 * 24 * 7;  // 7日
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

// セッションCookieを削除
export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

// Cookieからセッション取得（Server ComponentやAPI Routeで使用）
export async function getSession(): Promise<SessionPayload | null> {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifyToken(cookie.value);
}

// NextRequestからセッション取得（Middlewareで使用）
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
