import { Clock, Coffee, LogIn, LogOut, RotateCcw, type LucideIcon } from "lucide-react";

// 打刻の種類ごとの表示（名前・アイコン・色）。打刻・ホーム・出勤簿の画面で共通に使う
export const PUNCH_TYPES: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  in: { label: "出勤", icon: LogIn, color: "text-primary" },
  out: { label: "退勤", icon: LogOut, color: "text-danger" },
  break_start: { label: "休憩開始", icon: Coffee, color: "text-accent" },
  break_end: { label: "休憩終了", icon: RotateCcw, color: "text-primary" },
};

export function punchTypeInfo(type: string) {
  return PUNCH_TYPES[type] ?? { label: type, icon: Clock, color: "text-app-text" };
}

// 「アイコン＋名前」の表示
export function PunchTypeLabel({ type, className = "" }: { type: string; className?: string }) {
  const info = punchTypeInfo(type);
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon size={15} strokeWidth={2} className={`shrink-0 ${info.color}`} aria-hidden />
      {info.label}
    </span>
  );
}
