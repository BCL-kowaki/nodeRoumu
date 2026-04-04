import AppShell from "@/components/AppShell";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <AppShell variant="employee">{children}</AppShell>;
}
