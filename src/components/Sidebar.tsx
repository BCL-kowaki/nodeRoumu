"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserCog } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/roles";
import { isActive, sidebarGroups, type Domain } from "./nav";

// 帳簿ごとの色（労務＝ブランドの緑、業務＝深い青、設定＝グレー）。今いる場所を色で示す
const DOMAIN_STYLE: Record<Domain, { dot: string; bar: string; activeBg: string; activeText: string }> = {
  labor: { dot: "bg-primary", bar: "bg-primary", activeBg: "bg-primary-light", activeText: "text-primary-dark" },
  work: { dot: "bg-work", bar: "bg-work", activeBg: "bg-work-light", activeText: "text-work-dark" },
  settings: { dot: "bg-app-sub", bar: "bg-app-text", activeBg: "bg-app-bg", activeText: "text-app-text" },
};

// PC 用のサイドバー（幅の広い画面だけ表示。スマホは Header と TabBar を使う）
export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const groups = sidebarGroups(user?.role);
  const isAdminArea = user?.role === "admin" || user?.role === "manager";

  return (
    <aside
      data-no-print
      className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-white border-r border-app-border z-[100]"
    >
      <div className="h-16 flex items-center px-5 border-b border-app-border shrink-0">
        <Link href={isAdminArea ? "/admin" : "/"} className="no-underline" aria-label="ホームへ">
          <BrandLogo />
        </Link>
      </div>

      <nav aria-label="メインメニュー" className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        {groups.map((g) => {
          const st = DOMAIN_STYLE[g.domain];
          return (
            <div key={g.title}>
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} aria-hidden />
                <span className="text-[11px] font-bold tracking-[0.12em] text-app-sub">{g.title}</span>
              </div>
              <ul className="flex flex-col gap-0.5 list-none m-0 p-0">
                {g.items.map((item) => {
                  const active = isActive(item, pathname);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex items-center gap-3 h-9 px-3 rounded-lg text-sm no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                          active ? `${st.activeBg} ${st.activeText} font-bold` : "text-app-text hover:bg-app-bg"
                        }`}
                      >
                        {active && <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${st.bar}`} aria-hidden />}
                        <Icon size={17} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ログイン中の人とアカウント操作 */}
      <div className="border-t border-app-border p-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-primary-light text-primary-dark flex items-center justify-center text-sm font-bold shrink-0">
            {user?.name?.[0] ?? ""}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-app-text truncate">{user?.name}</div>
            <div className="text-[11px] text-app-sub">{roleLabel(user?.role)}</div>
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => router.push(isAdminArea ? "/admin/account" : "/account")}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-app-text bg-transparent border border-app-border cursor-pointer hover:bg-app-bg"
          >
            <UserCog size={14} aria-hidden /> アカウント
          </button>
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-danger bg-transparent border border-app-border cursor-pointer hover:bg-danger-light"
          >
            <LogOut size={14} aria-hidden /> ログアウト
          </button>
        </div>
      </div>
    </aside>
  );
}
