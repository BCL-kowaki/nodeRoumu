"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { calcDeductions, type RateValues } from "@/lib/calc";

type Employee = {
  id: string;
  name: string;
  employmentType: string;
  hourlyWage: number | null;
  monthlySalary: number | null;
  resignDate: string | null;
};

type AttRecord = {
  employeeId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
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
};

const curMonth = () => new Date().toISOString().slice(0, 7);
const fmt = (n: number) => n.toLocaleString("ja-JP");

function calcMonthHours(att: AttRecord[], empId: string, month: string) {
  return att
    .filter((a) => a.employeeId === empId && a.date?.startsWith(month))
    .reduce((s, r) => {
      if (!r.startTime || !r.endTime) return s;
      const [sh, sm] = r.startTime.split(":").map(Number);
      const [eh, em] = r.endTime.split(":").map(Number);
      const t = eh * 60 + em - (sh * 60 + sm) - (r.breakMinutes || 0);
      return s + (t > 0 ? t / 60 : 0);
    }, 0);
}

function calcMonthDays(att: AttRecord[], empId: string, month: string) {
  return att.filter(
    (a) => a.employeeId === empId && a.date?.startsWith(month) && a.startTime
  ).length;
}

const inputClass =
  "w-full p-2.5 px-3.5 rounded-xl border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function ChinginPage() {
  const [emp, setEmp] = useState<Employee[]>([]);
  const [att, setAtt] = useState<AttRecord[]>([]);
  const [pay, setPay] = useState<PayrollRecord[]>([]);
  const [rates, setRates] = useState<Rate | null>(null);
  const [selMonth, setSelMonth] = useState(curMonth());
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<PayrollRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/employees").then((r) => r.json()),
      fetch("/api/rates").then((r) => r.json()),
    ]).then(([e, r]) => {
      setEmp(e.filter((x: Employee) => !x.resignDate));
      setRates(r);
      setLoading(false);
    });
  }, []);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`/api/attendance?month=${selMonth}`).then((r) => r.json()),
      fetch(`/api/payroll?month=${selMonth}`).then((r) => r.json()),
    ]).then(([a, p]) => {
      setAtt(a);
      setPay(p);
    });
  }, [selMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startEdit = (e: Employee) => {
    if (!rates) return;
    const ex = pay.find((p) => p.employeeId === e.id && p.month === selMonth);
    if (ex) {
      setForm({ ...ex });
      setEditing(e.id);
      return;
    }
    const h = calcMonthHours(att, e.id, selMonth);
    const d = calcMonthDays(att, e.id, selMonth);
    let g = 0;
    if (e.monthlySalary) g = e.monthlySalary;
    else if (e.hourlyWage) g = Math.round(h * e.hourlyWage);

    const dd = calcDeductions(g, rates);
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
      healthInsurance: dd.healthInsurance,
      pension: dd.pension,
      employmentInsurance: dd.employmentInsurance,
      incomeTax: 0,
      residentTax: 0,
      otherDeduction: 0,
      totalDeduction: dd.totalSocial,
      netPay: g - dd.totalSocial,
      confirmed: false,
    });
    setEditing(e.id);
  };

  const recalc = (f: PayrollRecord): PayrollRecord => {
    if (!rates) return f;
    const tp = (f.grossPay || 0) + (f.overtimePay || 0) + (f.allowance || 0);
    const dd = calcDeductions(tp, rates);
    const td =
      dd.healthInsurance +
      dd.pension +
      dd.employmentInsurance +
      (f.incomeTax || 0) +
      (f.residentTax || 0) +
      (f.otherDeduction || 0);
    return {
      ...f,
      totalPay: tp,
      healthInsurance: dd.healthInsurance,
      pension: dd.pension,
      employmentInsurance: dd.employmentInsurance,
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
                className={inputClass}
                value={(form[x.k as keyof PayrollRecord] as number) || ""}
                onChange={(e) =>
                  setForm(
                    recalc({
                      ...form,
                      [x.k]: Number(e.target.value) || 0,
                    })
                  )
                }
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
                className={inputClass}
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

        <div className="flex gap-2.5">
          <button
            onClick={savePay}
            className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold border-none cursor-pointer"
          >
            確定・保存
          </button>
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

      {emp.map((e) => {
        const rec = pay.find(
          (p) => p.employeeId === e.id && p.month === selMonth
        );
        const mD = calcMonthDays(att, e.id, selMonth);
        const mH = calcMonthHours(att, e.id, selMonth);

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
              {rec?.confirmed ? "修正" : "給与計算"}
            </button>
          </Card>
        );
      })}
    </div>
  );
}
