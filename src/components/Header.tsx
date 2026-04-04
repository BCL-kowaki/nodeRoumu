"use client";

import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const { user, logout } = useAuth();

  const today = new Date().toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });

  return (
    <header className="bg-white border-b border-app-border px-4 flex items-center h-14 sticky top-0 z-[100] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex-1 flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="node 労務管理"
          className="h-10 w-auto object-contain"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-app-sub">{today}</span>
        {user && (
          <button
            onClick={logout}
            className="text-[11px] text-app-sub border border-app-border rounded px-2 py-1 bg-transparent cursor-pointer hover:bg-gray-50"
          >
            ログアウト
          </button>
        )}
      </div>
    </header>
  );
}
