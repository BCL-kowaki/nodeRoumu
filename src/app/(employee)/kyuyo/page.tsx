"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import { useAuth } from "@/lib/auth-context";
import { getClosingDate, getPayDate, formatDateJP } from "@/lib/payroll-date";

type PayrollRecord = {
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

type CompanyInfo = {
  name: string;
  address: string | null;
  representativeName: string | null;
};

const curMonth = () => new Date().toISOString().slice(0, 7);
const fmt = (n: number) => n.toLocaleString("ja-JP");

export default function EmployeeKyuyo() {
  const { user, loading: authLoading } = useAuth();
  const [selMonth, setSelMonth] = useState(curMonth());
  const [pay, setPay] = useState<PayrollRecord | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPay = useCallback(() => {
    if (!user?.employeeId) return;
    fetch(`/api/payroll?employeeId=${user.employeeId}&month=${selMonth}`)
      .then((r) => r.json())
      .then((data) => {
        const rec = Array.isArray(data)
          ? data.find((p: PayrollRecord) => p.month === selMonth) || null
          : null;
        setPay(rec);
        setLoading(false);
      });
  }, [user?.employeeId, selMonth]);

  useEffect(() => {
    fetchPay();
  }, [fetchPay]);

  // 発行元（会社情報）を取得 — PDF保存時の発行元表示に使用
  useEffect(() => {
    fetch("/api/company")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setCompany(data))
      .catch(() => setCompany(null));
  }, []);

  // 対象月の表示（YYYY年MM月）
  const monthLabel = selMonth
    ? `${selMonth.slice(0, 4)}年${selMonth.slice(5, 7)}月`
    : "";
  const issueDate = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (authLoading || loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3">
      {/* 印刷時のみ表示される発行ヘッダー（画面では非表示） */}
      <div className="hidden print:block mb-4">
        {company && (
          <div className="text-right text-xs text-app-sub mb-2">
            <div className="text-sm font-bold text-app-text">{company.name}</div>
            {company.address && <div>{company.address}</div>}
            {company.representativeName && <div>代表者 {company.representativeName}</div>}
          </div>
        )}
        <div className="border-b border-app-border pb-2 mb-3">
          <div className="text-xl font-bold text-app-text">給与明細書</div>
          <div className="flex justify-between mt-2 text-sm">
            <div>
              <span className="text-app-sub">対象月: </span>
              <span className="font-bold">{monthLabel}</span>
            </div>
            <div>
              <span className="text-app-sub">発行日: </span>
              <span>{issueDate}</span>
            </div>
          </div>
          <div className="flex justify-between mt-1 text-sm">
            <div>
              <span className="text-app-sub">締日: </span>
              <span>{formatDateJP(getClosingDate(selMonth))}</span>
            </div>
            <div>
              <span className="text-app-sub">支払日: </span>
              <span className="font-bold">{formatDateJP(getPayDate(selMonth))}</span>
            </div>
          </div>
          {user?.name && (
            <div className="mt-2 text-sm">
              <span className="text-app-sub">氏名: </span>
              <span className="font-bold">{user.name}</span> 様
            </div>
          )}
        </div>
      </div>

      {/* 画面用タイトル（印刷時は非表示） */}
      <div className="text-lg font-bold print:hidden">給与明細</div>

      {/* 月選択（印刷時は非表示） */}
      <Card className="!p-4 print:hidden">
        <label className="block text-xs font-semibold text-app-sub mb-1">月</label>
        <input
          type="month"
          value={selMonth}
          onChange={(e) => setSelMonth(e.target.value)}
          className="w-full p-2 rounded border border-app-border text-sm bg-white outline-none"
        />
      </Card>

      {/* PDF保存ボタン（確定済みレコードがある時のみ表示・印刷時は非表示） */}
      {pay?.confirmed && (
        <button
          onClick={() => window.print()}
          className="print:hidden w-full py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          この明細をPDFとして保存
        </button>
      )}

      {!pay ? (
        <Card className="text-center !py-10 text-app-sub">
          {selMonth} の給与明細はまだありません
        </Card>
      ) : !pay.confirmed ? (
        <Card className="text-center !py-10 text-app-sub">
          {selMonth} の給与は未確定です
        </Card>
      ) : (
        <>
          {/* 締日・支払日（画面用・印刷時は上部ヘッダーで表示済みのため非表示） */}
          <Card className="print:hidden">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-app-bg rounded p-3 text-center">
                <div className="text-[11px] text-app-sub">締日</div>
                <div className="text-sm font-bold text-app-text">
                  {formatDateJP(getClosingDate(selMonth))}
                </div>
              </div>
              <div className="bg-primary-light rounded p-3 text-center">
                <div className="text-[11px] text-app-sub">支払日</div>
                <div className="text-sm font-bold text-primary">
                  {formatDateJP(getPayDate(selMonth))}
                </div>
              </div>
            </div>
          </Card>

          {/* 勤務情報 */}
          <Card>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-app-bg rounded p-3 text-center">
                <div className="text-[11px] text-app-sub">出勤日数</div>
                <div className="text-xl font-bold text-primary">{pay.workDays}日</div>
              </div>
              <div className="bg-app-bg rounded p-3 text-center">
                <div className="text-[11px] text-app-sub">実働時間</div>
                <div className="text-xl font-bold text-primary">{pay.workHours}h</div>
              </div>
            </div>
          </Card>

          {/* 支給 */}
          <Card>
            <div className="text-sm font-bold text-primary mb-3">支給</div>
            {[
              { l: "基本給", v: pay.grossPay },
              { l: "残業手当", v: pay.overtimePay },
              { l: "その他手当", v: pay.allowance },
            ].map((x) => (
              <div key={x.l} className="flex justify-between py-1.5 border-b border-app-border last:border-0 text-sm">
                <span className="text-app-sub">{x.l}</span>
                <span className="font-semibold">¥{fmt(x.v)}</span>
              </div>
            ))}
            <div className="bg-primary-light rounded p-3 mt-3 text-right font-bold text-lg text-primary-dark">
              総支給 ¥{fmt(pay.totalPay)}
            </div>
          </Card>

          {/* 控除 */}
          <Card>
            <div className="text-sm font-bold text-danger mb-3">控除</div>
            {[
              { l: "健康保険", v: pay.healthInsurance },
              { l: "厚生年金", v: pay.pension },
              { l: "雇用保険", v: pay.employmentInsurance },
              { l: "所得税", v: pay.incomeTax },
              { l: "住民税", v: pay.residentTax },
              { l: "その他控除", v: pay.otherDeduction },
            ].map((x) => (
              <div key={x.l} className="flex justify-between py-1.5 border-b border-app-border last:border-0 text-sm">
                <span className="text-app-sub">{x.l}</span>
                <span className="font-semibold">¥{fmt(x.v)}</span>
              </div>
            ))}
            <div className="bg-danger-light rounded p-3 mt-3 text-right font-bold text-lg text-danger">
              控除計 ¥{fmt(pay.totalDeduction)}
            </div>
          </Card>

          {/* 差引支給額 */}
          <Card className="!bg-primary-light !border-primary !border-2">
            <div className="flex justify-between items-center">
              <span className="text-base font-bold text-app-text">差引支給額</span>
              <span className="text-[28px] font-extrabold text-primary">
                ¥{fmt(pay.netPay)}
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
