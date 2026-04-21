import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getClosingDate, getPayDate } from "@/lib/payroll-date";

export const dynamic = "force-dynamic";

// 賃金台帳CSVエクスポート
// GET /api/payroll/export?month=YYYY-MM
// - admin / manager ロールのみアクセス可
// - confirmed=true のレコードのみ対象
// - BOM付きUTF-8でExcelの日本語化けを防止
export async function GET(req: NextRequest) {
  // 認証・権限チェック（社労士=manager, 代表=admin のみ）
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "manager") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  // 確定済み給与のみ取得（未処理は含めない）
  const records = await prisma.payroll.findMany({
    where: { month, confirmed: true },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employmentType: true,
          // 個人情報最小化：氏名・雇用形態のみ使用
        },
      },
    },
    orderBy: { employeeId: "asc" },
  });

  // 締日・支払日（月末締め・翌月末支払い）
  const closingDate = getClosingDate(month);
  const payDate = getPayDate(month);

  // CSVヘッダー
  const headers = [
    "社員ID",
    "氏名",
    "雇用形態",
    "対象月",
    "締日",
    "支払日",
    "出勤日数",
    "実働時間",
    "基本給",
    "残業手当",
    "その他手当",
    "総支給",
    "健康保険",
    "厚生年金",
    "雇用保険",
    "所得税",
    "住民税",
    "その他控除",
    "控除計",
    "差引支給額",
  ];

  // 明細行
  const rows = records.map((r) => [
    r.employee.id,
    r.employee.name,
    r.employee.employmentType,
    month,
    closingDate,
    payDate,
    r.workDays,
    r.workHours,
    r.grossPay,
    r.overtimePay,
    r.allowance,
    r.totalPay,
    r.healthInsurance,
    r.pension,
    r.employmentInsurance,
    r.incomeTax,
    r.residentTax,
    r.otherDeduction,
    r.totalDeduction,
    r.netPay,
  ]);

  const csv = "\uFEFF" + toCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payroll_${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
