// ロール別の権限判定ヘルパー
// CLAUDE.md 12-3 に従い、auth.ts / middleware.ts は触らず上位判定のみ提供する

export type Role = "admin" | "manager" | "employee";

// 代表者のみ
export function canWritePayroll(role: Role | string | undefined): boolean {
  return role === "admin";
}

// 代表者のみ（労働者名簿の追加・編集・削除）
export function canWriteEmployees(role: Role | string | undefined): boolean {
  return role === "admin";
}

// 代表者・社労士（管理エリア全般への閲覧アクセス）
export function canAccessAdminArea(role: Role | string | undefined): boolean {
  return role === "admin" || role === "manager";
}

// 代表者のみ（管理ユーザー自体の管理）
export function canManageAdminUsers(role: Role | string | undefined): boolean {
  return role === "admin";
}
