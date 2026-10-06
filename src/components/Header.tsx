"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import BrandLogo from "@/components/BrandLogo";
import {
  ArrowLeftRight,
  Building2,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  GitBranch,
  LogOut,
  Percent,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
} from "lucide-react";

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

  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const inWork = pathname === "/admin/work" || pathname.startsWith("/admin/work/");
  const isAdminOrManager = user?.role === "admin" || user?.role === "manager";

  return (
    <header className="bg-white border-b border-app-border px-4 flex items-center h-14 sticky top-0 z-[100] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div className="flex-1 flex items-center">
        <BrandLogo />
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-xs text-app-text font-semibold">{user.name}</span>
        )}

        {/* 設定ドロップダウン */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="メニュー"
            aria-expanded={menuOpen}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-transparent border border-app-border cursor-pointer hover:bg-gray-50 text-app-text"
          >
            <Settings size={17} strokeWidth={1.75} aria-hidden />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 bg-white border border-app-border rounded shadow-lg w-48 py-1 z-50">
              {/* アカウント（全ロール共通・middlewareの制約でpathはroleに応じて切替） */}
              <button
                onClick={() => {
                  router.push(isAdminOrManager ? "/admin/account" : "/account");
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
              >
                <UserCog size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />アカウント
              </button>

              {/* ステータス（従業員のみ：自分の基本情報） */}
              {!isAdminOrManager && (
                <button
                  onClick={() => { router.push("/status"); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                >
                  <UserRound size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />ステータス
                </button>
              )}

              {/* 管理系（admin/manager） */}
              {isAdminOrManager && (
                <>
                  <div className="border-t border-app-border my-1" />
                  <button
                    onClick={() => { router.push("/admin/company"); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                  >
                    <Building2 size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />企業情報
                  </button>
                  <button
                    onClick={() => { router.push("/admin/settings"); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                  >
                    <Percent size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />料率設定
                  </button>
                  <button
                    onClick={() => { router.push("/admin/holidays"); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                  >
                    <CalendarCheck2 size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />休日設定
                  </button>
                </>
              )}

              {/* 管理ユーザー一覧・業務管理（admin のみ） */}
              {isAdmin && (
                <>
                  <div className="border-t border-app-border my-1" />
                  <button
                    onClick={() => { router.push(inWork ? "/admin" : "/admin/work"); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                  >
                    {inWork ? <><ArrowLeftRight size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />労務管理へ戻る</> : <><CheckCircle2 size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />業務管理</>}
                  </button>
                  {inWork && (
                    <button
                      onClick={() => { router.push("/admin/work/schedule"); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                    >
                      <CalendarRange size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />スケジュール
                    </button>
                  )}
                  {inWork && (
                    <button
                      onClick={() => { router.push("/admin/work/github"); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                    >
                      <GitBranch size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />GitHub 連携
                    </button>
                  )}
                  <button
                    onClick={() => { router.push("/admin/users"); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-app-text hover:bg-gray-50 border-none bg-transparent cursor-pointer"
                  >
                    <ShieldCheck size={16} strokeWidth={1.75} className="shrink-0 text-app-sub" aria-hidden />管理ユーザー
                  </button>
                </>
              )}

              <div className="border-t border-app-border my-1" />
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-sm text-danger hover:bg-gray-50 border-none bg-transparent cursor-pointer"
              >
                <LogOut size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />ログアウト
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
