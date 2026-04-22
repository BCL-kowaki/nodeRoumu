"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { calcDeductions, type RateValues } from "@/lib/calc";
import { getClosingDate, getPayDate, formatDateJP } from "@/lib/payroll-date";
import { useAuth } from "@/lib/auth-context";
import { canWritePayroll } from "@/lib/permissions";

type Employee = {
  id: string;
  name: string;
  employmentType: string;
  hourlyWage: number | null;
  monthlySalary: number | null;
  resignDate: string | null;
  healthInsuranceEnrolled: boolean;
  pensionEnrolled: boolean;
  employmentInsuranceEnrolled: boolean;
};

type AttRecord = {
  employeeId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  status: string | null;
};

type PayrollRecord = {
  id: string;
  employeeId: string;
  month: string;
  workDays: number;
  workHours: number;
  grossPay: number;
  overtimePay: number;
  allowance: number;
  totalPay: number;
  healthInsurance: number;
  pension: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  otherDeduction: number;
  totalDeduction: number;
  netPay: number;
  confirmed: boolean;
};

type Rate = RateValues & {
  childcare: number;
  label: string | null;
  updatedAt: string | null;
  closedSun?: boolean;
  closedMon?: boolean;
  closedTue?: boolean;
  closedWed?: boolean;
  closedThu?: boolean;
  closedFri?: boolean;
  closedSat?: boolean;
};

type ClosedDateRecord = { date: string };

const curMonth = () => new Date().toISOString().slice(0, 7);
const fmt = (n: number) => n.toLocaleString("ja-JP");
const DOW_KEYS = [
  "closedSun",
  "closedMon",
  "closedTue",
  "closedWed",
  "closedThu",
  "closedFri",
  "closedSat",
] as const;

// 指定日が定休日（曜日指定 or ClosedDate 登録）かどうか
function isClosedDay(
  date: string,
  rates: Rate | null,
  closedDates: ClosedDateRecord[]
): boolean {
  if (!rates) return false;
  const dow = new Date(date).getDay();
  if (rates[DOW_KEYS[dow]]) return true;
  return closedDates.some((cd) => cd.date.startsWith(date));
}

// 出勤日として計上すべきか
// 出勤簿側の autoStatus と揃えたロジック：
// - 手動ステータス設定あり → そのステータスが working か
// - 定休日・祝日 → 計上しない
// - startTime あり → 計上
function isCountableDay(
  rec: AttRecord | undefined,
  closed: boolean
): boolean {
  if (!rec) return false;
  if (rec.status) {
    return rec.status === "normal" || rec.status === "late" || rec.status === "early_leave";
  }
  if (closed) return false;
  return !!(rec.startTime && rec.endTime);
}

function calcMonthHours(
  att: AttRecord[],
  empId: string,
  month: string,
  rates: Rate | null,
  closedDates: ClosedDateRecord[]
) {
  return att
    .filter((a) => a.employeeId === empId && a.date?.startsWith(month))
    .reduce((s, r) => {
      const dateStr = r.date.slice(0, 10);
      const closed = isClosedDay(dateStr, rates, closedDates);
      if (!isCountableDay(r, closed)) return s;
      if (!r.startTime || !r.endTime) return s;
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      const t = eh * 60 + em - (sh * 60 + sm) - (r.breakMinutes || 0);
      return s + (t > 0 ? t / 60 : 0);
    }, 0);
}

function calcMonthDays(
  att: AttRecord[],
  empId: string,
  month: string,
  rates: Rate | null,
  closedDates: ClosedDateRecord[]
) {
  return att.filter((a) => {
    if (a.employeeId !== empId || !a.date?.startsWith(month)) return false;
    const dateStr = a.date.slice(0, 10);
    return isCountableDay(a, isClosedDay(dateStr, rates, closedDates));
  }).length;
}

const inputClass =
  "w-full p-2.5 px-3.5 rounded-xl border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function ChinginPage() {
  const { user } = useAuth();
  const canWrite = canWritePayroll(user?.role);
  const [emp, setEmp] = useState<Employee[]>([]);
  const [att, setAtt] = useState<AttRecord[]>([]);
  const [pay, setPay] = useState<PayrollRecord[]>([]);
  const [rates, setRates] = useState<Rate | null>(null);
  const [closedDates, setClosedDates] = useState<ClosedDateRecord[]>([]);
  const [selMonth, setSelMonth] = useState(curMonth());
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PayrollRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/employees?scope=workers").then((r) => r.json()),
      fetch("/api/rates").then((r) => r.json()),
    ]).then(([e, r]) => {
      setEmp(e.filter((x: Employee) => !x.resignDate));
      setRates(r);
      setLoading(false);
    });
  }, []);

  const fetchData = useCallback(() => {
    const year = selMonth.slice(0, 4);
    Promise.all([
      fetch(`/api/attendance?month=${selMonth}`).then((r) => r.json()),
      fetch(`/api/payroll?month=${selMonth}`).then((r) => r.json()),
      fetch(`/api/closed-dates?year=${year}`).then((r) => r.json()),
    ]).then(([a, p, cd]) => {
      setAtt(a);
      setPay(p);
      setClosedDates(cd);
    });
  }, [selMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startEdit = (e: Employee) => {
    if (!rates) return;
    // 最新の出勤簿データから出勤日数・実働時間を再計算
    // 定休日・祝日は計上しない
    const h = calcMonthHours(att, e.id, selMonth, rates, closedDates);
    const d = calcMonthDays(att, e.id, selMonth, rates, closedDates);
    const ex = pay.find((p) => p.employeeId === e.id && p.month === selMonth);
    if (ex) {
      // 既存レコードがあっても、出勤日数と実働時間は最新の出勤簿から再計算した値で上書き
      // （ステータス変更や打刻修正が反映されるようにする）
      setForm({
        ...ex,
        workDays: d,
        workHours: Math.round(h * 10) / 10,
      });
      setEditing(e.id);
      return;
    }
    let g = 0;
    if (e.monthlySalary) g = e.monthlySalary;
    else if (e.hourlyWage) g = Math.round(h * e.hourlyWage);

    const dd = calcDeductions(g, rates);
    // 社保未加入の項目は0にする
    const hi = e.healthInsuranceEnrolled ? dd.healthInsurance : 0;
    const pn = e.pensionEnrolled ? dd.pension : 0;
    const ei = e.employmentInsuranceEnrolled ? dd.employmentInsurance : 0;
    const socialTotal = hi + pn + ei;
    setForm({
      id: "",
      employeeId: e.id,
      month: selMonth,
      workDays: d,
      workHours: Math.round(h * 10) / 10,
      grossPay: g,
      overtimePay: 0,
      allowance: 0,
      totalPay: g,
      healthInsurance: hi,
      pension: pn,
      employmentInsurance: ei,
      incomeTax: 0,
      residentTax: 0,
      otherDeduction: 0,
      totalDeduction: socialTotal,
      netPay: g - socialTotal,
      confirmed: false,
    });
    setEditing(e.id);
  };

  const recalc = (f: PayrollRecord): PayrollRecord => {
    if (!rates) return f;
    const e = emp.find((x) => x.id === f.employeeId);
    const tp = (f.grossPay || 0) + (f.overtimePay || 0) + (f.allowance || 0);
    const dd = calcDeductions(tp, rates);
    // 社保未加入の項目は0
    const hi = e?.healthInsuranceEnrolled ? dd.healthInsurance : 0;
    const pn = e?.pensionEnrolled ? dd.pension : 0;
    const ei = e?.employmentInsuranceEnrolled ? dd.employmentInsurance : 0;
    const td =
      hi + pn + ei +
      (f.incomeTax || 0) +
      (f.residentTax || 0) +
      (f.otherDeduction || 0);
    return {
      ...f,
      totalPay: tp,
      healthInsurance: hi,
      pension: pn,
      employmentInsurance: ei,
      totalDeduction: td,
      netPay: tp - td,
    };
  };

  const savePay = async () => {
    if (!form) return;
    const c = { ...form, confirmed: true };
    await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    });
    fetchData();
    setEditing(null);
    setForm(null);
  };

  if (loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  // 編集画面
  if (editing && form) {
    const e = emp.find((x) => x.id === editing);
    return (
      <div className="flex flex-col gap-3">
        <Card>
          <div className="text-base font-bold">
            {e?.name} — {selMonth}
          </div>
          {/* 締日・支払日（月末締め・翌月末支払い） */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-app-bg rounded-xl p-3 text-center">
              <div className="text-[11px] text-app-sub">締日</div>
              <div className="text-sm font-bold text-app-text">
                {formatDateJP(getClosingDate(selMonth))}
              </div>
            </div>
            <div className="bg-primary-light rounded-xl p-3 text-center">
              <div className="text-[11px] text-app-sub">支払日</div>
              <div className="text-sm font-bold text-primary">
                {formatDateJP(getPayDate(selMonth))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-app-bg rounded-xl p-3 text-center">
              <div className="text-[11px] text-app-sub">出勤日数</div>
              <div className="text-xl font-bold text-primary">
                {form.workDays}日
              </div>
            </div>
            <div className="bg-app-bg rounded-xl p-3 text-center">
              <div className="text-[11px] text-app-sub">実働時間</div>
              <div className="text-xl font-bold text-primary">
                {form.workHours}h
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-sm font-bold text-primary mb-3">支給</div>
          {[
            { k: "grossPay", l: "基本給" },
            { k: "overtimePay", l: "残業手当" },
            { k: "allowance", l: "その他手当" },
          ].map((x) => (
            <div key={x.k} className="mb-2.5">
              <label className={labelClass}>{x.l}</label>
              <input
                type="number"
                className={`${inputClass} ${!canWrite ? "bg-gray-50" : ""}`}
                value={(form[x.k as keyof PayrollRecord] as number) || ""}
                onChange={(e) =>
                  setForm(
                    recalc({
                      ...form,
                      [x.k]: Number(e.target.value) || 0,
                    })
                  )
                }
                readOnly={!canWrite}
              />
            </div>
          ))}
          <div className="bg-primary-light rounded-xl p-3.5 text-right font-bold text-lg text-primary-dark">
            総支給 ¥{fmt(form.totalPay)}
          </div>
        </Card>

        <Card>
          <div className="text-sm font-bold text-danger mb-3">控除</div>
          {[
            {
              k: "healthInsurance",
              l: `健康保険（${rates?.healthInsurance}%折半）`,
            },
            { k: "pension", l: `厚生年金（${rates?.pension}%折半）` },
            {
              k: "employmentInsurance",
              l: `雇用保険（${rates?.employmentInsurance}%）`,
            },
            { k: "incomeTax", l: "所得税" },
            { k: "residentTax", l: "住民税" },
            { k: "otherDeduction", l: "その他控除" },
          ].map((x) => (
            <div key={x.k} className="mb-2.5">
              <label className={labelClass}>{x.l}</label>
              <input
                type="number"
                className={`${inputClass} ${!canWrite ? "bg-gray-50" : ""}`}
                value={(form[x.k as keyof PayrollRecord] as number) || ""}
                onChange={(e) => {
                  const u = {
                    ...form,
                    [x.k]: Number(e.target.value) || 0,
                  };
                  const td =
                    u.healthInsurance +
                    u.pension +
                    u.employmentInsurance +
                    u.incomeTax +
                    u.residentTax +
                    u.otherDeduction;
                  setForm({ ...u, totalDeduction: td, netPay: u.totalPay - td });
                }}
                readOnly={!canWrite}
              />
            </div>
          ))}
          <div className="bg-danger-light rounded-xl p-3.5 text-right font-bold text-lg text-danger">
            控除計 ¥{fmt(form.totalDeduction)}
          </div>
        </Card>

        <Card className="!bg-primary-light !border-primary !border-2">
          <div className="flex justify-between items-center">
            <span className="text-base font-bold text-app-text">差引支給額</span>
            <span className="text-[28px] font-extrabold text-primary">
              ¥{fmt(form.netPay)}
            </span>
          </div>
        </Card>

        {!canWrite && (
          <div className="text-xs text-app-sub bg-app-bg rounded p-3">
            閲覧のみ可能です（編集・確定は代表者権限が必要）
          </div>
        )}

        <div className="flex gap-2.5">
          {canWrite && (
            <button
              onClick={savePay}
              className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold border-none cursor-pointer"
            >
              確定・保存
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null);
              setForm(null);
            }}
            className="px-6 py-3 rounded-xl bg-white text-app-text text-sm border border-app-border cursor-pointer"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // 選択月の確定済み件数（CSVエクスポート可否判定に使用）
  const confirmedCount = pay.filter(
    (p) => p.month === selMonth && p.confirmed
  ).length;

  // 一覧画面
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold">賃金台帳</div>
        <input
          type="month"
          value={selMonth}
          onChange={(e) => setSelMonth(e.target.value)}
          className="w-36 p-2.5 px-3.5 rounded-xl border border-app-border text-sm bg-white outline-none"
        />
      </div>

      {/* CSVエクスポート（確定済みが1件以上ある月のみ有効） */}
      <a
        href={confirmedCount > 0 ? `/api/payroll/export?month=${selMonth}` : undefined}
        aria-disabled={confirmedCount === 0}
        className={`text-center py-2.5 rounded-xl text-sm font-bold no-underline ${
          confirmedCount > 0
            ? "bg-primary text-white cursor-pointer"
            : "bg-gray-100 text-app-sub pointer-events-none"
        }`}
      >
        {confirmedCount > 0
          ? `CSVダウンロード（${confirmedCount}名分）`
          : "確定済みの給与がありません"}
      </a>

      {emp.map((e) => {
        const rec = pay.find(
          (p) => p.employeeId === e.id && p.month === selMonth
        );
        const mD = calcMonthDays(att, e.id, selMonth, rates, closedDates);
        const mH = calcMonthHours(att, e.id, selMonth, rates, closedDates);

        return (
          <Card key={e.id} className="!p-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="text-[15px] font-bold">{e.name}</div>
                <div className="text-[11px] text-app-sub">
                  {e.employmentType} ・ {mD}日 / {mH.toFixed(1)}h
                </div>
              </div>
              {rec?.confirmed ? (
                <Badge type="success">確定</Badge>
              ) : (
                <Badge type="default">未処理</Badge>
              )}
            </div>
            {rec && (
              <div className="grid grid-cols-3 gap-1.5 mb-2.5 text-xs">
                <div className="bg-app-bg rounded-lg p-2 text-center">
                  <div className="text-app-sub">総支給</div>
                  <div className="font-bold">¥{fmt(rec.totalPay)}</div>
                </div>
                <div className="bg-app-bg rounded-lg p-2 text-center">
                  <div className="text-app-sub">控除計</div>
                  <div className="font-bold text-danger">
                    ¥{fmt(rec.totalDeduction)}
                  </div>
                </div>
                <div className="bg-primary-light rounded-lg p-2 text-center">
                  <div className="text-app-sub">手取り</div>
                  <div className="font-bold text-primary">
                    ¥{fmt(rec.netPay)}
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={() => startEdit(e)}
              className="w-full px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold border-none cursor-pointer"
            >
              {canWrite
                ? rec?.confirmed ? "修正" : "給与計算"
                : rec?.confirmed ? "内容を確認" : "計算内容を確認"}
            </button>
          </Card>
        );
      })}
    </div>
  );
}
