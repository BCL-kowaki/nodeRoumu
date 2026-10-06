"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { bottomTabs, isActive } from "./nav";

// スマホ・タブレット用の下部タブ（PC ではサイドバーを使うので表示しない）
export default function TabBar({ variant }: { variant: "admin" | "employee" }) {
  const pathname = usePathname();
  const { user } = useAuth();
  // 表示中のエリアに合わせる（役割が読み込まれる前も、エリアに合ったタブを出す）
  const role = user?.role ?? (variant === "admin" ? "manager" : "employee");
  const tabs = bottomTabs(role, pathname);

  return (
    <nav
      data-no-print
      aria-label="メインメニュー"
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-app-border flex z-[100] pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map((t) => {
        const active = isActive(t, pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 pt-2 pb-1.5 flex flex-col items-center gap-0.5 no-underline text-[10px] transition-colors ${
              active ? "text-primary font-bold" : "text-app-sub"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
