"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { useAuth } from "@/lib/auth-context";

type EmployeeData = {
  id: string;
  name: string;
  nameKana: string | null;
  birthDate: string | null;
  gender: string;
  address: string | null;
  phone: string | null;
  hireDate: string;
  position: string | null;
  employmentType: string;
  resignDate: string | null;
  hourlyWage: number | null;
  monthlySalary: number | null;
  healthInsuranceEnrolled: boolean;
  pensionEnrolled: boolean;
  employmentInsuranceEnrolled: boolean;
  shiftStart: string | null;
  shiftEnd: string | null;
  shiftBreak: number | null;
};

function calcAge(bd: string | null) {
  if (!bd) return "";
  const b = new Date(bd);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

const fmt = (n: number) => n.toLocaleString("ja-JP");

export default function EmployeeStatus() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.employeeId) return;
    fetch(`/api/employees`)
      .then((r) => r.json())
      .then((emps: EmployeeData[]) => {
        const me = emps.find((e) => e.id === user.employeeId);
        setData(me || null);
        setLoading(false);
      });
  }, [user?.employeeId]);

  if (authLoading || loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  if (!data)
    return <div className="text-center text-app-sub py-10">データが見つかりません</div>;

  const rows = [
    { l: "氏名", v: data.name },
    { l: "フリガナ", v: data.nameKana || "—" },
    { l: "生年月日", v: data.birthDate ? data.birthDate.slice(0, 10) + `（${calcAge(data.birthDate)}歳）` : "—" },
    { l: "性別", v: data.gender },
    { l: "住所", v: data.address || "—" },
    { l: "電話番号", v: data.phone || "—" },
    { l: "入社日", v: data.hireDate?.slice(0, 10) || "—" },
    { l: "職種・役職", v: data.position || "—" },
    { l: "雇用形態", v: data.employmentType },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">ステータス</div>

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center text-xl font-bold text-primary">
            {data.name[0]}
          </div>
          <div>
            <div className="text-lg font-bold text-app-text">{data.name}</div>
            <div className="text-xs text-app-sub">{data.employmentType}</div>
          </div>
          <div className="ml-auto">
            {data.resignDate ? <Badge type="danger">退職</Badge> : <Badge type="success">在籍</Badge>}
          </div>
        </div>

        {rows.map((r) => (
          <div key={r.l} className="flex py-2 border-b border-app-border last:border-0">
            <div className="text-xs text-app-sub w-24 shrink-0">{r.l}</div>
            <div className="text-sm text-app-text">{r.v}</div>
          </div>
        ))}
      </Card>

      {/* 給与情報 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">給与情報</div>
        <div className="grid grid-cols-2 gap-2">
          {data.monthlySalary && (
            <div className="bg-app-bg rounded p-3 text-center">
              <div className="text-[11px] text-app-sub">月給</div>
              <div className="text-lg font-bold text-primary">¥{fmt(data.monthlySalary)}</div>
            </div>
          )}
          {data.hourlyWage && (
            <div className="bg-app-bg rounded p-3 text-center">
              <div className="text-[11px] text-app-sub">時給</div>
              <div className="text-lg font-bold text-primary">¥{fmt(data.hourlyWage)}</div>
            </div>
          )}
        </div>
      </Card>

      {/* 固定シフト */}
      {data.shiftStart && data.shiftEnd && (
        <Card>
          <div className="text-sm font-bold text-app-text mb-3">勤務シフト</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-app-bg rounded p-3 text-center">
              <div className="text-[11px] text-app-sub">出勤</div>
              <div className="text-base font-bold text-primary">{data.shiftStart}</div>
            </div>
            <div className="bg-app-bg rounded p-3 text-center">
              <div className="text-[11px] text-app-sub">退勤</div>
              <div className="text-base font-bold text-primary">{data.shiftEnd}</div>
            </div>
            <div className="bg-app-bg rounded p-3 text-center">
              <div className="text-[11px] text-app-sub">休憩</div>
              <div className="text-base font-bold text-primary">{data.shiftBreak || 0}分</div>
            </div>
          </div>
        </Card>
      )}

      {/* 社会保険加入状況 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">社会保険加入状況</div>
        <div className="flex flex-col gap-2">
          {[
            { l: "健康保険", v: data.healthInsuranceEnrolled },
            { l: "厚生年金", v: data.pensionEnrolled },
            { l: "雇用保険", v: data.employmentInsuranceEnrolled },
          ].map((x) => (
            <div key={x.l} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-app-sub">{x.l}</span>
              {x.v ? (
                <Badge type="success">加入</Badge>
              ) : (
                <Badge type="default">未加入</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
