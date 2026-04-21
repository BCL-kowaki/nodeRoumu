import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

// 出勤簿CSVエクスポート
// GET /api/attendance/export?month=YYYY-MM                    … 在籍中全員分
// GET /api/attendance/export?month=YYYY-MM&employeeId=xxx     … 1名分
// - admin / manager ロールのみアクセス可
// - 月の全日を1行ずつ出す（欠勤・定休・未来日もステータス列で区別）
// - BOM付きUTF-8でExcelの日本語化けを防止

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const DOW_KEYS = [
  "closedSun",
  "closedMon",
  "closedTue",
  "closedWed",
  "closedThu",
  "closedFri",
  "closedSat",
] as const;

const STATUS_JP: Record<string, string> = {
  normal: "出勤",
  late: "遅刻",
  early_leave: "早退",
  absent: "欠勤",
  scheduled: "出勤予定",
  public_holiday: "公休",
  closed: "定休",
};

// YYYY-MM-DD 文字列を返す（ローカルではなくUTC基準、DBの @db.Date と整合）
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 実働時間（時）を小数1桁で返す
function calcWorkHours(
  startTime: string | null,
  endTime: string | null,
  breakMinutes: number | null
): string {
  if (!startTime || !endTime) return "";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const t = eh * 60 + em - (sh * 60 + sm) - (breakMinutes || 0);
  if (t <= 0) return "0";
  return (t / 60).toFixed(1);
}

// 画面のautoStatusと同じロジックをサーバー側に実装
function autoStatus(
  rec: { status: string | null; startTime: string | null } | undefined,
  closed: boolean,
  isPast: boolean
): string {
  if (rec?.status) return rec.status;
  if (closed) return "closed";
  if (rec?.startTime) return "normal";
  if (isPast) return "absent";
  return "scheduled";
}

// 実働時間を計上すべきステータスか
function isWorkingStatus(status: string): boolean {
  return status === "normal" || status === "late" || status === "early_leave";
}

export async function GET(req: NextRequest) {
  // 認証・権限チェック
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "manager") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const employeeId = searchParams.get("employeeId"); // 省略可
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month is required (YYYY-MM)" },
      { status: 400 }
    );
  }

  // 対象月の範囲
  const year = Number(month.slice(0, 4));
  const mon = Number(month.slice(5, 7)); // 1-12
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1)); // 翌月1日

  // 対象従業員を取得
  const employees = employeeId
    ? await prisma.employee.findMany({
        where: { id: employeeId },
        select: { id: true, name: true, employmentType: true },
      })
    : await prisma.employee.findMany({
        where: { resignDate: null },
        select: { id: true, name: true, employmentType: true },
        orderBy: { createdAt: "asc" },
      });

  if (employees.length === 0) {
    return NextResponse.json(
      { error: "no employees found" },
      { status: 404 }
    );
  }

  // 勤怠レコードを一括取得
  const attRecords = await prisma.attendance.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: start, lt: end },
    },
  });

  // 定休日設定と祝日・会社休日を取得
  const rate = await prisma.rate.findFirst();
  const closedDates = await prisma.closedDate.findMany({
    where: { date: { gte: start, lt: end } },
  });

  // 月の全日付を生成
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(
      `${year}-${String(mon).padStart(2, "0")}-${String(i).padStart(2, "0")}`
    );
  }

  // 実行時点の「今日」（サーバー側でUTC扱い。過去日判定に使用）
  const todayStr = toDateStr(new Date());

  // CSV ヘッダー
  const headers = [
    "社員ID",
    "氏名",
    "雇用形態",
    "日付",
    "曜日",
    "ステータス",
    "ステータス名",
    "出勤時刻",
    "退勤時刻",
    "休憩(分)",
    "実働時間(時)",
    "休日種別",
    "備考",
  ];

  // 明細行
  const rows: (string | number | null)[][] = [];
  for (const emp of employees) {
    for (const date of days) {
      const rec = attRecords.find(
        (r) => r.employeeId === emp.id && toDateStr(r.date) === date
      );

      // 休日判定
      const dow = new Date(date).getDay();
      const weekdayClosed = rate ? (rate[DOW_KEYS[dow]] as boolean) : false;
      const closedDate = closedDates.find((cd) => toDateStr(cd.date) === date);
      const closed = weekdayClosed || !!closedDate;

      const isPast = date < todayStr;
      const status = autoStatus(
        rec ? { status: rec.status, startTime: rec.startTime } : undefined,
        closed,
        isPast
      );

      const holidayName = closedDate?.name || (weekdayClosed ? "定休" : "");

      // 非稼働ステータス（closed/absent/public_holiday）の日は
      // 時刻列・実働時間列を空欄にして集計に混ざらないようにする
      const working = isWorkingStatus(status);
      rows.push([
        emp.id,
        emp.name,
        emp.employmentType,
        date,
        DOW_LABELS[dow],
        status,
        STATUS_JP[status] || status,
        working ? rec?.startTime || "" : "",
        working ? rec?.endTime || "" : "",
        working ? rec?.breakMinutes ?? "" : "",
        working
          ? calcWorkHours(
              rec?.startTime || null,
              rec?.endTime || null,
              rec?.breakMinutes || null
            )
          : "",
        holidayName,
        rec?.memo || "",
      ]);
    }
  }

  const csv = "\uFEFF" + toCsv(headers, rows);

  // ファイル名：個人指定時は氏名入り、全員時は月のみ
  const filename =
    employeeId && employees[0]
      ? `attendance_${month}_${encodeURIComponent(employees[0].name)}.csv`
      : `attendance_${month}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
