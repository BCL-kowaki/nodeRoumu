"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { LABOR_ROADMAP, categoryColor } from "@/lib/labor-roadmap";

type Employee = {
  id: string;
  name: string;
  employmentType: string;
  hireDate: string;
  resignDate: string | null;
  contractEndDate: string | null;
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
      fetch("/api/employees?scope=workers").then((r) => r.json()),
      fetch("/api/rates").then((r) => r.json()),
      fetch(`/api/payroll?month=${curMonth()}`).then((r) => r.json()),
      fetch(`/api/dakoku?date=${todayStr()}`).then((r) => r.json()),
    ]).then(([e, r, p, d]) => {
      setEmp(e); setRates(r); setPay(p); setDak(d); setLoading(false);
    });
  }, []);

  // --- 労務カレンダーのアラート用データ ---
  const now = new Date();
  const thisMonth = now.getMonth() + 1; // 1-12
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1;

  // 今月・来月の労務イベント
  const upcomingEvents = useMemo(
    () => LABOR_ROADMAP.filter((e) => e.month === thisMonth || e.month === nextMonth),
    [thisMonth, nextMonth]
  );

  // 契約満了30日以内の従業員
  const expiringContracts = useMemo(() => {
    const today = new Date();
    const threshold = new Date();
    threshold.setDate(today.getDate() + 30);
    return emp.filter((e) => {
      if (!e.contractEndDate || e.resignDate) return false;
      const end = new Date(e.contractEndDate);
      return end >= today && end <= threshold;
    });
  }, [emp]);

  const hasAlerts = upcomingEvents.length > 0 || expiringContracts.length > 0;

  // --- 年間ロードマップ用データ ---
  const roadmapByMonth = useMemo(() => {
    const map = new Map<number, typeof LABOR_ROADMAP>();
    for (const ev of LABOR_ROADMAP) {
      const arr = map.get(ev.month) || [];
      arr.push(ev);
      map.set(ev.month, arr);
    }
    return map;
  }, []);

  const monthLabels: Record<number, string> = {
    0: "通年", 1: "1月", 2: "2月", 3: "3月", 4: "4月", 5: "5月", 6: "6月",
    7: "7月", 8: "8月", 9: "9月", 10: "10月", 11: "11月", 12: "12月",
  };

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
      <div className="flex justify-between items-center mb-1">
        <div className="text-lg font-bold text-app-text">管理者ダッシュボード</div>
        <div className="text-xs text-app-sub">
          {new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </div>
      </div>

      {/* 料率未設定の警告 */}
      {rates && !rates.updatedAt && (
        <Card className="!bg-[#FFF8E1] !border-[#FFE082]">
          <div className="text-sm font-semibold text-[#F57F17] mb-2">⚠️ 料率が未設定です</div>
          <div className="text-[13px] text-[#795548] mb-3">「料率設定」から健康保険料率等を入力してください</div>
          <Link href="/admin/settings" className="inline-block px-6 py-3 rounded bg-primary text-white text-sm font-bold no-underline">料率設定へ →</Link>
        </Card>
      )}

      {/* 労務カレンダーのアラート */}
      {hasAlerts && (
        <Card className="!bg-[#FFF8E1] !border-[#FFE082]">
          <div className="text-sm font-bold text-[#F57F17] mb-2">📋 労務カレンダーのお知らせ</div>
          <div className="flex flex-col gap-1.5">
            {upcomingEvents.map((ev, i) => (
              <div key={`ev-${i}`} className="text-[13px] text-[#795548]">
                ・{ev.title}が{ev.month}月頃にあります。{ev.deadline ? `（${ev.deadline}）` : ""}書類の準備をしておきましょう
              </div>
            ))}
            {expiringContracts.map((e) => (
              <div key={`contract-${e.id}`} className="text-[13px] text-[#E53935] font-semibold">
                ⚠️ {e.name}さんの契約が{e.contractEndDate!.slice(0, 10)}に満了します。更新手続きを確認してください
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* サマリーカード 2x2 */}
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

      {/* 従業員一覧 */}
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

      {/* 現在の料率 */}
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

      {/* 年間労務ロードマップ */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">📅 年間労務ロードマップ</div>
        <div className="flex flex-col gap-3">
          {/* 月カード: 1-12 + 通年(0) */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0]
            .filter((mo) => roadmapByMonth.has(mo))
            .map((mo) => {
              const events = roadmapByMonth.get(mo)!;
              const isCurrent = mo === thisMonth;
              return (
                <div
                  key={mo}
                  className={`rounded-xl border p-3 ${
                    isCurrent
                      ? "border-primary bg-primary-light"
                      : "border-app-border bg-app-bg"
                  }`}
                >
                  <div className={`text-[13px] font-bold mb-2 ${isCurrent ? "text-primary" : "text-app-text"}`}>
                    {monthLabels[mo]}
                    {isCurrent && (
                      <span className="ml-2 text-[11px] font-semibold text-white bg-primary rounded-full px-2 py-0.5">
                        今月
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {events.map((ev, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${categoryColor(ev.category)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-bold text-app-text">{ev.title}</span>
                            {ev.deadline && (
                              <span className="text-[11px] text-[#E53935] font-semibold">{ev.deadline}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-app-sub leading-snug">{ev.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}
