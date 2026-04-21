"use client";

// 従業員向けアカウント画面（middlewareの制約で employee は /admin 以外にアクセスする）
import AccountPanel from "@/components/AccountPanel";

export default function EmployeeAccountPage() {
  return <AccountPanel />;
}
