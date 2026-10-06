// メニューの定義（PC のサイドバー・スマホの下部タブで共通）
// ロールごとに見せる項目を1か所で決める。各画面の権限チェック（API・layout）とは別で、ここは表示だけ。
import {
  BookOpen,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FolderKanban,
  Bot,
  GitBranch,
  HelpCircle,
  Home,
  Percent,
  Repeat,
  ShieldCheck,
  Timer,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type Domain = "labor" | "work" | "settings";
export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
export type NavGroup = { domain: Domain; title: string; items: NavItem[] };
type Role = "admin" | "manager" | "employee" | undefined;

const LABOR_ADMIN: NavItem[] = [
  { href: "/admin", label: "ホーム", icon: Home, exact: true },
  { href: "/admin/meibo", label: "労働者名簿", icon: Users },
  { href: "/admin/shukkin", label: "出勤簿", icon: CalendarDays },
  { href: "/admin/chingin", label: "賃金台帳", icon: Wallet },
  { href: "/admin/faq", label: "FAQ・書類", icon: HelpCircle },
];

const WORK: NavItem[] = [
  { href: "/admin/work/plan", label: "計画・実績", icon: Timer },
  { href: "/admin/work", label: "今日", icon: CheckCircle2, exact: true },
  { href: "/admin/work/routines", label: "ルーティン", icon: Repeat },
  { href: "/admin/work/projects", label: "プロジェクト・タスク", icon: FolderKanban },
  { href: "/admin/work/schedule", label: "スケジュール", icon: CalendarRange },
  { href: "/admin/work/github", label: "GitHub 連携", icon: GitBranch },
  { href: "/admin/work/ai", label: "AI 連携", icon: Bot },
];

const SETTINGS_ADMIN: NavItem[] = [
  { href: "/admin/company", label: "企業情報", icon: Building2 },
  { href: "/admin/settings", label: "料率設定", icon: Percent },
  { href: "/admin/holidays", label: "休日設定", icon: CalendarCheck2 },
  { href: "/admin/users", label: "管理ユーザー", icon: ShieldCheck },
];

const EMPLOYEE: NavItem[] = [
  { href: "/", label: "ホーム", icon: Home, exact: true },
  { href: "/dakoku", label: "打刻", icon: Timer },
  { href: "/shukkin", label: "出勤簿", icon: CalendarDays },
  { href: "/kyuyo", label: "給与明細", icon: Wallet },
  { href: "/faq", label: "FAQ・書類", icon: BookOpen },
  { href: "/status", label: "ステータス", icon: UserRound },
];

// サイドバーに出すグループ（ロール別）。代表者は業務管理を先頭に置く
export function sidebarGroups(role: Role): NavGroup[] {
  if (role === "admin") {
    return [
      { domain: "work", title: "業務管理", items: WORK },
      { domain: "labor", title: "労務管理", items: LABOR_ADMIN },
      { domain: "settings", title: "設定", items: SETTINGS_ADMIN },
    ];
  }
  if (role === "manager") {
    return [
      { domain: "labor", title: "労務管理", items: LABOR_ADMIN },
      { domain: "settings", title: "設定", items: SETTINGS_ADMIN.filter((i) => i.href !== "/admin/users") },
    ];
  }
  return [{ domain: "labor", title: "メニュー", items: EMPLOYEE }];
}

// スマホの下部タブ（5つまで）。業務管理の画面にいるときは業務用に切り替える
export function bottomTabs(role: Role, pathname: string): NavItem[] {
  if (role === "admin" || role === "manager") {
    if (role === "admin" && (pathname === "/admin/work" || pathname.startsWith("/admin/work/"))) {
      return WORK.slice(0, 5);
    }
    return LABOR_ADMIN;
  }
  return EMPLOYEE.slice(0, 5);
}

export function isActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

// 今いる画面が属するグループ（サイドバーの色分け・スマホの見出しに使う）
export function domainOf(pathname: string): Domain {
  if (pathname === "/admin/work" || pathname.startsWith("/admin/work/")) return "work";
  if (SETTINGS_ADMIN.some((i) => pathname.startsWith(i.href))) return "settings";
  return "labor";
}
