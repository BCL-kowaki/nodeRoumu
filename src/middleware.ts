import { NextRequest, NextResponse } from "next/server";
import { homePathFor } from "@/lib/roles";
import { getSessionFromRequest } from "@/lib/session-token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/favicon.png", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/logo.png", "/manifest.json"];

// 本番のドメイン。古い Vercel の URL で開かれた画面は、こちらへ転送する
const CANONICAL_ORIGIN = "https://portal.node-llc.com";
const OLD_HOSTS = ["node-roumu.vercel.app"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 古い URL → 新しいドメイン（パス・クエリはそのまま）。
  // API は転送しない（AI 連携などは転送先へ認証情報が渡らず止まるため。古い URL のままでも動かす）
  if (OLD_HOSTS.includes(req.headers.get("host") ?? "") && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    return NextResponse.redirect(`${CANONICAL_ORIGIN}${pathname}${req.nextUrl.search}`, 308);
  }

  // 静的アセットはスキップ
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 公開パスはスキップ
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // ノートの共有ページ（社外の方が見る。ログイン不要。見せてよいかはページ側でリンクとパスワードを確かめる）
  if (pathname.startsWith("/share/")) {
    return NextResponse.next();
  }

  // API routeは認証チェック不要（個別APIで対応）
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(req);

  // 未認証 → ログインへ
  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // 管理者ルート → admin または manager ロールのみ
  if (pathname.startsWith("/admin")) {
    if (session.role !== "admin" && session.role !== "manager") {
      const homeUrl = req.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }
  }

  // 従業員ルート → admin/managerがアクセスしたら、それぞれの最初の画面へ（代表者は計画・実績）
  if (!pathname.startsWith("/admin") && (session.role === "admin" || session.role === "manager")) {
    const adminUrl = req.nextUrl.clone();
    adminUrl.pathname = homePathFor(session.role);
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
