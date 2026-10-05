import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken, sessionCookie } from "@/lib/auth";
import {
  GOOGLE_OAUTH_COOKIE,
  exchangeCodeForIdToken,
  getGoogleLoginConfig,
  verifyGoogleIdentity,
} from "@/lib/google-login";

export const dynamic = "force-dynamic";

type OAuthCookie = { state: string; nonce: string; codeVerifier: string };

function readOAuthCookie(req: NextRequest): OAuthCookie | null {
  const raw = req.cookies.get(GOOGLE_OAUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v.state === "string" && typeof v.nonce === "string" && typeof v.codeVerifier === "string") {
      return v;
    }
  } catch {
    // 壊れた Cookie は無いものとして扱う
  }
  return null;
}

// Google からの戻り先。本人確認できたら通常と同じセッション Cookie を発行する
// GET /api/auth/google/callback?code=...&state=...
export async function GET(req: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
    res.cookies.delete({ name: GOOGLE_OAUTH_COOKIE, path: "/api/auth/google" });
    return res;
  };

  const config = getGoogleLoginConfig();
  if (!config) return fail("google_not_configured");

  const { searchParams } = req.nextUrl;
  // Google の画面でキャンセルされた場合など
  if (searchParams.get("error")) return fail("google_canceled");

  const saved = readOAuthCookie(req);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  // state の照合（他サイトから偽のログイン結果を送り込まれるのを防ぐ）
  if (!saved || !code || !state || state !== saved.state) return fail("google_failed");

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;
  const idToken = await exchangeCodeForIdToken(config, redirectUri, code, saved.codeVerifier);
  if (!idToken) return fail("google_failed");

  const identity = await verifyGoogleIdentity(config, idToken, saved.nonce);
  if (!identity.ok) {
    console.warn(`Google ログインを拒否しました（${identity.reason}）`);
    return fail(identity.reason === "invalid_token" || identity.reason === "nonce" ? "google_failed" : "google_not_allowed");
  }

  // 対応する代表者アカウント。Google ログインは代表者専用なので admin 以外は拒否する
  const employee = await prisma.employee.findUnique({ where: { loginId: config.loginId } });
  if (!employee?.loginId || employee.role !== "admin") {
    console.warn("Google ログインを拒否しました（対応する代表者アカウントがありません）");
    return fail("google_not_allowed");
  }

  const token = await createToken({
    employeeId: employee.id,
    loginId: employee.loginId,
    role: "admin",
    name: employee.name,
  });
  const res = NextResponse.redirect(new URL("/admin", req.url));
  res.cookies.set(sessionCookie(token));
  res.cookies.delete({ name: GOOGLE_OAUTH_COOKIE, path: "/api/auth/google" });
  return res;
}
