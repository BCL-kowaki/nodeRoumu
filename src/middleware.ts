import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
const STATIC_PREFIXES = ["/_next", "/favicon.ico", "/fav.png", "/logo.png", "/manifest.json"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 静的アセットはスキップ
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 公開パスはスキップ
  if (PUBLIC_PATHS.includes(pathname)) {
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

  // 従業員ルート → admin/managerがアクセスしたら管理画面へ
  if (!pathname.startsWith("/admin") && (session.role === "admin" || session.role === "manager")) {
    const adminUrl = req.nextUrl.clone();
    adminUrl.pathname = "/admin";
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
