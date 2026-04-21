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
