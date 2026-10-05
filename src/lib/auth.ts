// サーバー専用の認証処理（Cookie の読み書き・DBの最新権限での判定）。
// トークンの作成・検証は Edge でも動く session-token.ts にあり、ここから再公開する。
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, verifyToken, type SessionPayload } from "@/lib/session-token";

export {
  createToken,
  verifyToken,
  getSessionFromRequest,
  type SessionPayload,
} from "@/lib/session-token";

// セッションCookieの名前と属性（remember: trueなら30日保持）
// 転送レスポンス（redirect）に直接付ける場合も同じ属性を使う
export function sessionCookie(token: string, remember = false) {
  const maxAge = remember
    ? 60 * 60 * 24 * 30  // 30日
    : 60 * 60 * 24 * 7;  // 7日
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

// セッションCookieをセット（remember: trueなら30日保持）
export async function setSessionCookie(token: string, remember = false) {
  (await cookies()).set(sessionCookie(token, remember));
}

// セッションCookieを削除
export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

// Cookieからセッション取得（Server ComponentやAPI Routeで使用）
// 権限はトークン内の値ではなくDBの最新値を使う。
// （トークンは最長30日有効なため、降格・権限変更をログインし直すまで反映できない問題を防ぐ）
export async function getSession(): Promise<SessionPayload | null> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const session = await verifyToken(cookie.value);
  if (!session) return null;

  const current = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    select: { role: true, name: true, loginId: true },
  });
  // アカウントが削除された／ログイン不可になった場合は未ログイン扱い
  if (!current?.loginId) return null;
  return {
    ...session,
    role: current.role as SessionPayload["role"],
    name: current.name,
    loginId: current.loginId,
  };
}
