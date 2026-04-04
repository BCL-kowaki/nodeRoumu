"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import Badge from "@/components/Badge";

type Employee = {
  id: string;
  name: string;
  employmentType: string;
  hireDate: string;
  resignDate: string | null;
};

type Rate = {
  healthInsurance: number;
  pension: number;
  employmentInsurance: number;
  childcare: number;
  updatedAt: string | null;
};

type Payroll = { netPay: number; month: string };
type Dakoku = { employeeId: string; date: string; type: string };

const fmt = (n: number) => n.toLocaleString("ja-JP");
const curMonth = () => new Date().toISOString().slice(0, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function AdminDashboard() {
  const [emp, setEmp] = useState<Employee[]>([]);
  const [rates, setRates] = useState<Rate | null>(null);
  const [pay, setPay] = useState<Payroll[]>([]);
  const [dak, setDak] = useState<Dakoku[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/employees").then((r) => r.json()),
      fetch("/api/rates").then((r) => r.json()),
      fetch(`/api/payroll?month=${curMonth()}`).then((r) => r.json()),
      fetch(`/api/dakoku?date=${todayStr()}`).then((r) => r.json()),
    ]).then(([e, r, p, d]) => {
      setEmp(e); setRates(r); setPay(p); setDak(d); setLoading(false);
    });
  }, []);

  if (loading)
    return <div className="flex items-center justify-center h-60 flex-col gap-3"><div className="text-3xl font-extrabold text-primary">node</div><div className="text-app-sub text-sm">読み込み中...</div></div>;

  const active = emp.filter((e) => !e.resignDate);
  const m = curMonth();
  const mPay = pay.filter((p) => p.month === m);
  const total = mPay.reduce((s, p) => s + (p.netPay || 0), 0);
  const d = todayStr();
  const working = active.filter((e) => {
    const logs = dak.filter((l) => l.employeeId === e.id && l.date.startsWith(d));
    const last = logs[logs.length - 1];
    return last && ["in", "break_end", "break_start"].includes(last.type);
  }).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold text-app-text mb-1">管理者ダッシュボード</div>

      {rates && !rates.updatedAt && (
        <Card className="!bg-[#FFF8E1] !border-[#FFE082]">
          <div className="text-sm font-semibold text-[#F57F17] mb-2">⚠️ 料率が未設定です</div>
          <div className="text-[13px] text-[#795548] mb-3">「料率設定」から健康保険料率等を入力してください</div>
          <Link href="/admin/settings" className="inline-block px-6 py-3 rounded bg-primary text-white text-sm font-bold no-underline">料率設定へ →</Link>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: "在籍", value: active.length + "名", icon: "👥", href: "/admin/meibo" },
          { label: "出勤中", value: working + "名", icon: "🟢", href: "/admin" },
          { label: "給与処理", value: mPay.length + "件", icon: "📋", href: "/admin/chingin" },
          { label: "支給合計", value: "¥" + fmt(total), icon: "💴", href: "/admin/chingin" },
        ].map((c) => (
          <Link key={c.label} href={c.href} className="no-underline">
            <Card className="!p-4">
              <div className="text-xl mb-1.5">{c.icon}</div>
              <div className="text-[11px] text-app-sub mb-1">{c.label}</div>
              <div className="text-xl font-extrabold text-primary">{c.value}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="text-sm font-bold text-app-text mb-3">従業員一覧</div>
        {active.length === 0 ? (
          <div className="text-center text-app-sub py-5">従業員未登録<br /><Link href="/admin/meibo" className="inline-block mt-3 px-6 py-3 rounded bg-primary text-white text-sm font-bold no-underline">登録する</Link></div>
        ) : (
          active.map((e) => (
            <div key={e.id} className="flex items-center py-2.5 border-b border-app-border gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-base font-bold text-primary shrink-0">{e.name[0]}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-app-text">{e.name}</div>
                <div className="text-[11px] text-app-sub">{e.employmentType} ・ {e.hireDate?.slice(0, 10)}入社</div>
              </div>
              <Badge type={e.employmentType === "パート・アルバイト" ? "accent" : "default"}>
                {e.employmentType === "パート・アルバイト" ? "パート" : e.employmentType}
              </Badge>
            </div>
          ))
        )}
      </Card>

      {rates && (
        <Card>
          <div className="text-sm font-bold text-app-text mb-3">現在の料率</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: "健康保険", v: rates.healthInsurance },
              { l: "厚生年金", v: rates.pension },
              { l: "雇用保険", v: rates.employmentInsurance },
              { l: "子育て拠出金", v: rates.childcare },
            ].map((r) => (
              <div key={r.l} className="bg-app-bg rounded p-2.5 px-3">
                <div className="text-[11px] text-app-sub">{r.l}</div>
                <div className="text-base font-bold text-primary">{r.v}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
