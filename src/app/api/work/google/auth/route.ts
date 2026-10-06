import { NextRequest, NextResponse } from "next/server";
import { randomToken } from "@/lib/google-login";
import { GCAL_OAUTH_COOKIE, GCAL_OAUTH_COOKIE_MAX_AGE, buildCalendarAuthUrl, gcalConfig } from "@/lib/google-calendar";
import { requireWorkspace } from "@/lib/work/auth";

export const dynamic = "force-dynamic";

// Google カレンダーへの接続を始める（Google の認証画面へ転送）
// GET /api/work/google/auth
export async function GET(req: NextRequest) {
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const back = (code: string) => NextResponse.redirect(new URL(`/admin/work/schedule?gcal_error=${code}`, req.url));

  if (!gcalConfig()) return back("not_configured");
  if (!process.env.WORKSPACE_ENCRYPTION_KEY) return back("no_encryption_key");

  const state = randomToken();
  const codeVerifier = randomToken();
  const redirectUri = `${req.nextUrl.origin}/api/work/google/callback`;
  const res = NextResponse.redirect(buildCalendarAuthUrl(redirectUri, { state, codeVerifier }));
  res.cookies.set(GCAL_OAUTH_COOKIE, JSON.stringify({ state, codeVerifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/work/google",
    maxAge: GCAL_OAUTH_COOKIE_MAX_AGE,
  });
  return res;
}
