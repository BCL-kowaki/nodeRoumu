"use client";

import Header from "./Header";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";

type Props = {
  children: React.ReactNode;
  variant: "admin" | "employee";
};

// 画面の枠組み
// - PC（lg 以上）: 左にサイドバー、右に内容
// - スマホ・タブレット: 上にヘッダー、下にタブ
export default function AppShell({ children, variant }: Props) {
  return (
    <div className="min-h-screen bg-app-bg">
      <Sidebar />
      <div className="lg:pl-60">
        <div className="lg:hidden">
          <Header />
        </div>
        <main className="px-4 pt-4 pb-24 max-w-app mx-auto lg:max-w-5xl lg:px-10 lg:pt-10 lg:pb-16">{children}</main>
      </div>
      <TabBar variant={variant} />
    </div>
  );
}
