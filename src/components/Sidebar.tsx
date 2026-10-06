"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserCog } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { homePathFor, roleLabel } from "@/lib/roles";
import { isActive, sidebarGroups, type Domain } from "./nav";

// 緑で塗ったサイドバーの上で、帳簿ごとの区別をつける色（見出しの点と、選択中の文字色）
const DOMAIN_STYLE: Record<Domain, { dot: string; activeText: string }> = {
  labor: { dot: "bg-white", activeText: "text-primary-dark" },
  work: { dot: "bg-accent", activeText: "text-work-dark" },
  settings: { dot: "bg-white/50", activeText: "text-app-text" },
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
      className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col bg-primary-dark z-[100]"
    >
      {/* ロゴ（緑の地では見えにくいので白い札に載せる）と、差し色の斜めの帯 */}
      <div className="relative overflow-hidden h-20 flex items-center px-4 border-b border-white/10 shrink-0">
        <span className="absolute -right-8 top-0 bottom-0 w-14 -skew-x-[18deg] bg-accent" aria-hidden />
        <Link
          href={homePathFor(user?.role)}
          className="relative no-underline bg-white rounded-xl px-3 py-1.5 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          aria-label="ホームへ"
        >
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
                <span className="text-[11px] font-bold tracking-[0.12em] text-white/60">{g.title}</span>
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
                        className={`relative flex items-center gap-3 h-9 px-3 rounded-lg text-sm no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                          active ? `bg-white shadow-sm ${st.activeText} font-bold` : "text-white/85 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[4px] rounded-r bg-accent" aria-hidden />}
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
      <div className="border-t border-white/10 p-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-white text-primary-dark flex items-center justify-center text-sm font-bold shrink-0">
            {user?.name?.[0] ?? ""}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{user?.name}</div>
            <div className="text-[11px] text-white/65">{roleLabel(user?.role)}</div>
          </div>
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => router.push(isAdminArea ? "/admin/account" : "/account")}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-white bg-transparent border border-white/25 cursor-pointer hover:bg-white/10"
          >
            <UserCog size={14} aria-hidden /> アカウント
          </button>
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-white bg-transparent border border-white/25 cursor-pointer hover:bg-white/10"
          >
            <LogOut size={14} aria-hidden /> ログアウト
          </button>
        </div>
      </div>
    </aside>
  );
}
