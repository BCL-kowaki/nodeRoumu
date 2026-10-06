// ロール名の日本語ラベル
// 既存UIの英語表記（"admin"等）はスコープ外。新規画面のみ使用

export const ROLE_LABELS: Record<string, string> = {
  admin: "代表者",
  manager: "社労士",
  employee: "従業員",
};

export function roleLabel(role: string | undefined): string {
  if (!role) return "";
  return ROLE_LABELS[role] || role;
}

// ログイン後やロゴから開く最初の画面。
// 代表者は業務管理の「計画・実績」、社労士は労務管理のホーム（業務管理は使えない）、従業員は従業員のホーム
export function homePathFor(role: string | undefined): string {
  if (role === "admin") return "/admin/work/plan";
  if (role === "manager") return "/admin";
  return "/";
}
