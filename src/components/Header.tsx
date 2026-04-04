"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);


  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const isAdmin = user?.role === "admin" || user?.role === "manager";

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
        {user && (
          <span className="text-xs text-app-text font-semibold">{user.name}</span>
        )}

        {/* 設定ドロップダウン */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded bg-transparent border border-app-border cursor-pointer hover:bg-gray-50 text-base"
          >
            ⚙️
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 bg-white border border-app-border rounded shadow-lg w-40 py-1 z-50">
              {isAdmin && (
                <>
                  <button
                    onClick={() => { router.push("/admin/company"); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                  >
                    🏢 企業情報
                  </button>
                  <button
                    onClick={() => { router.push("/admin/settings"); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                  >
                    📋 料率設定
                  </button>
                  <div className="border-t border-app-border my-1" />
                </>
              )}
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-gray-50 border-none bg-transparent cursor-pointer"
              >
                🚪 ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
