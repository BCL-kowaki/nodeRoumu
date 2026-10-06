import { NextRequest, NextResponse } from "next/server";
import { gcalConfig, GCAL_OAUTH_COOKIE, GcalError, exchangeCode, fetchUserInfo, saveConnection } from "@/lib/google-calendar";
import { requireWorkspace } from "@/lib/work/auth";
import { checkCalendarAccount } from "@/lib/work/gcal";

export const dynamic = "force-dynamic";

// Google からの戻り先。接続してよいアカウントか確認できたら、更新用トークンを暗号化して保存する
// GET /api/work/google/callback?code=...&state=...
export async function GET(req: NextRequest) {
  const done = (key: "gcal_connected" | "gcal_error", value: string) => {
    const res = NextResponse.redirect(new URL(`/admin/work/schedule?${key}=${value}`, req.url));
    res.cookies.delete({ name: GCAL_OAUTH_COOKIE, path: "/api/work/google" });
    return res;
  };

  // ログイン中の代表者本人でなければ受け付けない（他人の画面操作を装った接続を防ぐ）
  const auth = await requireWorkspace();
  if (!auth.ok) return auth.response;
  const cfg = gcalConfig();
  if (!cfg) return done("gcal_error", "not_configured");

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return done("gcal_error", "canceled");

  let saved: { state: string; codeVerifier: string } | null = null;
  try {
    const v = JSON.parse(req.cookies.get(GCAL_OAUTH_COOKIE)?.value ?? "");
    if (typeof v.state === "string" && typeof v.codeVerifier === "string") saved = v;
  } catch {
    // 壊れた Cookie は無いものとして扱う
  }
  const code = sp.get("code");
  const state = sp.get("state");
  if (!saved || !code || !state || state !== saved.state) return done("gcal_error", "failed");

  try {
    const tokens = await exchangeCode(code, `${req.nextUrl.origin}/api/work/google/callback`, saved.codeVerifier);
    const account = checkCalendarAccount(cfg, await fetchUserInfo(tokens.access_token));
    if (!account.ok) {
      console.warn("Google カレンダーの接続を拒否しました（許可されたアカウントではありません）");
      return done("gcal_error", "not_allowed");
    }
    if (!tokens.refresh_token) return done("gcal_error", "no_refresh_token");
    await saveConnection(auth.ctx.ownerId, { refresh_token: tokens.refresh_token, expires_in: tokens.expires_in, scope: tokens.scope }, account.email);
    return done("gcal_connected", "1");
  } catch (e) {
    if (e instanceof Error && e.message.includes("WORKSPACE_ENCRYPTION_KEY")) return done("gcal_error", "no_encryption_key");
    console.error("Google カレンダーの接続に失敗しました", e instanceof GcalError ? e.status : "");
    return done("gcal_error", "failed");
  }
}
