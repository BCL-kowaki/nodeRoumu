import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_COOKIE_MAX_AGE,
  buildAuthUrl,
  getGoogleLoginConfig,
  randomToken,
} from "@/lib/google-login";

export const dynamic = "force-dynamic";

// 代表者用 Google ログインの開始。Google の認証画面へ転送する
// GET /api/auth/google/start
export async function GET(req: NextRequest) {
  const config = getGoogleLoginConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", req.url));
  }

  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken();
  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

  const res = NextResponse.redirect(
    buildAuthUrl(config, redirectUri, { state, nonce, codeVerifier })
  );
  // コールバックで照合する値を、短命・httpOnly の Cookie に保存する
  res.cookies.set(GOOGLE_OAUTH_COOKIE, JSON.stringify({ state, nonce, codeVerifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
  });
  return res;
}
