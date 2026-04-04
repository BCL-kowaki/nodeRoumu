"use client";

type BadgeType = "success" | "danger" | "accent" | "default";

const styles: Record<BadgeType, string> = {
  success: "bg-primary-light text-primary",
  danger: "bg-danger-light text-danger",
  accent: "bg-orange-50 text-orange-700",
  default: "bg-gray-100 text-app-sub",
};

export default function Badge({
  children,
  type = "default",
}: {
  children: React.ReactNode;
  type?: BadgeType;
}) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${styles[type]}`}
    >
      {children}
    </span>
  );
}
