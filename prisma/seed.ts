import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 既存の n0001 を従業員に変更
  const n0001 = await prisma.employee.findUnique({ where: { loginId: "n0001" } });
  if (n0001) {
    const empHash = await bcrypt.hash("sr1208", 10);
    await prisma.employee.update({
      where: { loginId: "n0001" },
      data: { role: "employee", passwordHash: empHash },
    });
    console.log("n0001 → employee に変更");
  }

  // 管理者: admin/admin
  const adminHash = await bcrypt.hash("admin", 10);
  await prisma.employee.upsert({
    where: { loginId: "admin" },
    update: { passwordHash: adminHash, role: "admin" },
    create: {
      name: "管理者",
      loginId: "admin",
      passwordHash: adminHash,
      role: "admin",
      hireDate: new Date("2026-03-18"),
      employmentType: "役員",
    },
  });
  console.log("Seed完了: admin/admin → 管理者, n0001/sr1208 → 従業員");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
