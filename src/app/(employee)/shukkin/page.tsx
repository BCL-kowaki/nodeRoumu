"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { useAuth } from "@/lib/auth-context";

type AttRecord = {
  id: string;
  employeeId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  status: string | null;
};

type Rate = {
  closedSun: boolean;
  closedMon: boolean;
  closedTue: boolean;
  closedWed: boolean;
  closedThu: boolean;
  closedFri: boolean;
  closedSat: boolean;
};

type EmpData = {
  shiftStart: string | null;
  shiftEnd: string | null;
  shiftBreak: number | null;
};

type ClosedDateRecord = { id: string; date: string; name: string; type: string };

const todayStr = () => new Date().toISOString().slice(0, 10);
const DOW_KEYS = ["closedSun", "closedMon", "closedTue", "closedWed", "closedThu", "closedFri", "closedSat"] as const;

function calcH(rec: AttRecord | undefined) {
  if (!rec?.startTime || !rec?.endTime) return "";
  const [sh, sm] = rec.startTime.split(":").map(Number);
  const [eh, em] = rec.endTime.split(":").map(Number);
  const t = eh * 60 + em - (sh * 60 + sm) - (rec.breakMinutes || 0);
  return t > 0 ? (t / 60).toFixed(1) : "0";
}

function isClosed(date: string, rates: Rate | null, closedDates: ClosedDateRecord[] = []) {
  if (!rates) return false;
  const dow = new Date(date).getDay(); // 0=Sun
  if (rates[DOW_KEYS[dow]]) return true;
  return closedDates.some((cd) => cd.date.startsWith(date));
}

function getClosedDateName(date: string, rates: Rate | null, closedDates: ClosedDateRecord[]): string {
  const cd = closedDates.find((c) => c.date.startsWith(date));
  if (cd) return cd.name;
  return "定休";
}

export default function EmployeeShukkin() {
  const { user, loading: authLoading } = useAuth();
  const [selMonth, setSelMonth] = useState(todayStr().slice(0, 7));
  const [att, setAtt] = useState<AttRecord[]>([]);
  const [rates, setRates] = useState<Rate | null>(null);
  const [empData, setEmpData] = useState<EmpData | null>(null);
  const [closedDates, setClosedDates] = useState<ClosedDateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const year = selMonth.slice(0, 4);
    Promise.all([
      fetch("/api/rates").then((r) => r.json()),
      fetch(`/api/closed-dates?year=${year}`).then((r) => r.json()),
    ]).then(([r, cd]) => {
      setRates(r);
      setClosedDates(cd);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selMonth]);

  useEffect(() => {
    if (!user?.employeeId) return;
    fetch("/api/employees")
      .then((r) => r.json())
      .then((emps: (EmpData & { id: string })[]) => {
        const me = emps.find((e) => e.id === user.employeeId);
        setEmpData(me || null);
      });
  }, [user?.employeeId]);

  const fetchAtt = useCallback(() => {
    if (!user?.employeeId) return;
    fetch(`/api/attendance?employeeId=${user.employeeId}&month=${selMonth}`)
      .then((r) => r.json())
      .then((data) => {
        setAtt(data);
        setLoading(false);
      });
  }, [user?.employeeId, selMonth]);

  useEffect(() => {
    fetchAtt();
  }, [fetchAtt]);

  const dim = new Date(
    Number(selMonth.slice(0, 4)),
    Number(selMonth.slice(5, 7)),
    0
  ).getDate();
  const days = Array.from(
    { length: dim },
    (_, i) => selMonth + "-" + String(i + 1).padStart(2, "0")
  );

  const getRec = (date: string) =>
    att.find((a) => a.date.startsWith(date));

  const totalDays = days.filter((d) => getRec(d)?.startTime).length;
  const totalH = days.reduce((s, d) => s + Number(calcH(getRec(d)) || 0), 0);
  const scheduledDays = days.filter((d) => !isClosed(d, rates, closedDates)).length;

  if (authLoading || loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">出勤簿</div>

      <Card className="!p-4">
        <label className="block text-xs font-semibold text-app-sub mb-1">月</label>
        <input
          type="month"
          value={selMonth}
          onChange={(e) => setSelMonth(e.target.value)}
          className="w-full p-2 rounded border border-app-border text-sm bg-white outline-none"
        />
      </Card>

      <Card className="!bg-primary-light !p-3.5">
        <div className="text-[13px] text-primary-dark font-semibold">
          {user?.name} — {selMonth} 集計
        </div>
        <div className="text-xs text-app-sub mt-1">
          出勤 <strong className="text-primary">{totalDays}日</strong> / 予定{scheduledDays}日 ・ 実働{" "}
          <strong className="text-primary">{totalH.toFixed(1)}h</strong>
        </div>
        {empData?.shiftStart && empData?.shiftEnd && (
          <div className="text-xs text-app-sub mt-0.5">
            固定シフト: {empData.shiftStart}〜{empData.shiftEnd}（休憩{empData.shiftBreak || 0}分）
          </div>
        )}
      </Card>

      {days.map((date) => {
        const rec = getRec(date);
        const dow = new Date(date).toLocaleDateString("ja-JP", { weekday: "short" });
        const closed = isClosed(date, rates, closedDates);
        const h = calcH(rec);
        const today = date === todayStr();
        const isPast = date < todayStr();
        const isAbsent = isPast && !closed && !rec?.startTime;

        const statusLabel: Record<string, { text: string; type: "success" | "danger" | "accent" | "default" }> = {
          normal: { text: "出勤", type: "success" },
          late: { text: "遅刻", type: "accent" },
          early_leave: { text: "早退", type: "accent" },
        };

        return (
          <Card key={date} className={`!p-3 ${closed ? "!bg-gray-50" : ""} ${isAbsent ? "!bg-red-50" : ""} ${today ? "!border-primary" : ""}`}>
            <div className="flex items-center gap-2">
              <div className={`text-sm font-bold min-w-[70px] ${closed ? "text-app-sub" : "text-app-text"}`}>
                {date.slice(5)} ({dow})
              </div>
              {closed && !rec?.startTime && (
                <Badge type="default">{getClosedDateName(date, rates, closedDates)}</Badge>
              )}
              {isAbsent && <Badge type="danger">欠勤</Badge>}
              {!closed && !rec?.startTime && !isAbsent && (
                <Badge type="accent">予定</Badge>
              )}
              {rec?.status && statusLabel[rec.status] && (
                <Badge type={statusLabel[rec.status].type}>{statusLabel[rec.status].text}</Badge>
              )}
              {rec?.startTime && (
                <div className="text-xs text-app-sub">
                  {rec.startTime}〜{rec.endTime || "—"} （休憩{rec.breakMinutes || 0}分）
                </div>
              )}
              {h && (
                <div className="text-[13px] font-bold text-primary ml-auto">{h}h</div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
