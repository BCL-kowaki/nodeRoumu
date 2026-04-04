"use client";

import Header from "./Header";
import TabBar from "./TabBar";

type Props = {
  children: React.ReactNode;
  variant: "admin" | "employee";
};

export default function AppShell({ children, variant }: Props) {
  return (
    <div className="min-h-screen bg-app-bg">
      <Header />
      <div className="px-4 pt-4 pb-20 max-w-app mx-auto">{children}</div>
      <TabBar variant={variant} />
    </div>
  );
}
