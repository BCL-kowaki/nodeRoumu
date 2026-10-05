import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canUseWorkspace } from "@/lib/permissions";

// 業務管理は代表者のみ。middleware は /admin を社労士にも通すため、ここでサーバー側で締め出す
// （APIも requireWorkspace で別途守っている）
export default async function WorkLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canUseWorkspace(session.role)) redirect("/admin");
  return <>{children}</>;
}
