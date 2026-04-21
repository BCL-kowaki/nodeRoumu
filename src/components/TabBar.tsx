"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: string };

const ADMIN_TABS: Tab[] = [
  { href: "/admin", label: "ダッシュボード", icon: "📊" },
  { href: "/admin/meibo", label: "名簿", icon: "👥" },
  { href: "/admin/shukkin", label: "出勤簿", icon: "📅" },
  { href: "/admin/chingin", label: "賃金台帳", icon: "💰" },
];

const EMPLOYEE_TABS: Tab[] = [
  { href: "/", label: "ホーム", icon: "📊" },
  { href: "/dakoku", label: "打刻", icon: "⏱️" },
  { href: "/shukkin", label: "出勤簿", icon: "📅" },
  { href: "/kyuyo", label: "給与明細", icon: "💰" },
  { href: "/faq", label: "FAQ", icon: "💬" },
];

export default function TabBar({ variant }: { variant: "admin" | "employee" }) {
  const pathname = usePathname();
  const tabs = variant === "admin" ? ADMIN_TABS : EMPLOYEE_TABS;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-app-border flex z-[100] shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      {tabs.map((t) => {
        const active =
          variant === "admin"
            ? t.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(t.href)
            : pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 py-2 pb-1.5 flex flex-col items-center gap-0.5 no-underline text-[10px] transition-colors ${
              active ? "text-primary font-bold" : "text-app-sub"
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
