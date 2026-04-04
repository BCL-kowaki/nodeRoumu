"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";

type Employee = {
  id: string;
  name: string;
  resignDate: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  shiftBreak: number | null;
};

type AttRecord = {
  id: string;
  employeeId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  status: string | null;
  memo: string | null;
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

const todayStr = () => new Date().toISOString().slice(0, 10);
const DOW_KEYS = ["closedSun", "closedMon", "closedTue", "closedWed", "closedThu", "closedFri", "closedSat"] as const;

function calcH(startTime: string | null, endTime: string | null, breakMinutes: number | null) {
  if (!startTime || !endTime) return "";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const t = eh * 60 + em - (sh * 60 + sm) - (breakMinutes || 0);
  return t > 0 ? (t / 60).toFixed(1) : "0";
}

function isClosed(date: string, rates: Rate | null) {
  if (!rates) return false;
  const dow = new Date(date).getDay();
  return rates[DOW_KEYS[dow]];
}

export default function ShukkinPage() {
  const [emp, setEmp] = useState<Employee[]>([]);
  const [selMonth, setSelMonth] = useState(todayStr().slice(0, 7));
  const [selEmp, setSelEmp] = useState("");
  const [att, setAtt] = useState<AttRecord[]>([]);
  const [rates, setRates] = useState<Rate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/employees").then((r) => r.json()),
      fetch("/api/rates").then((r) => r.json()),
    ]).then(([data, r]) => {
      const active = data.filter((e: Employee) => !e.resignDate);
      setEmp(active);
      setRates(r);
      if (active.length > 0 && !selEmp) setSelEmp(active[0].id);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAtt = useCallback(() => {
    if (!selEmp) return;
    fetch(`/api/attendance?employeeId=${selEmp}&month=${selMonth}`)
      .then((r) => r.json())
      .then(setAtt);
  }, [selEmp, selMonth]);

  useEffect(() => {
    fetchAtt();
  }, [fetchAtt]);

  const selE = emp.find((e) => e.id === selEmp);

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
    att.find((a) => a.employeeId === selEmp && a.date.startsWith(date));

  // 表示用: レコードがなければ固定シフトをデフォルト表示
  const getDisplay = (date: string) => {
    const rec = getRec(date);
    const closed = isClosed(date, rates);
    if (rec) {
      return {
        startTime: rec.startTime || "",
        endTime: rec.endTime || "",
        breakMinutes: rec.breakMinutes ?? "",
        hasRecord: true,
      };
    }
    // 定休日でなければ固定シフトをデフォルト表示
    if (!closed && selE?.shiftStart) {
      return {
        startTime: selE.shiftStart || "",
        endTime: selE.shiftEnd || "",
        breakMinutes: selE.shiftBreak ?? "",
        hasRecord: false,
      };
    }
    return { startTime: "", endTime: "", breakMinutes: "", hasRecord: false };
  };

  const upsert = async (date: string, field: string, val: string) => {
    // 保存時、レコードがなければ固定シフトの値も一緒に送る
    const rec = getRec(date);
    const body: Record<string, unknown> = {
      employeeId: selEmp,
      date,
      [field]: val,
    };
    // 初回保存時にシフトデフォルト値を含める
    if (!rec && selE) {
      if (field !== "startTime") body.startTime = selE.shiftStart || undefined;
      if (field !== "endTime") body.endTime = selE.shiftEnd || undefined;
      if (field !== "breakMinutes") body.breakMinutes = selE.shiftBreak || undefined;
    }
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchAtt();
  };

  // 集計はレコードベース
  const totalDays = days.filter((d) => getRec(d)?.startTime).length;
  const totalH = days.reduce((s, d) => {
    const rec = getRec(d);
    return s + Number(calcH(rec?.startTime || null, rec?.endTime || null, rec?.breakMinutes || null) || 0);
  }, 0);
  const scheduledDays = days.filter((d) => !isClosed(d, rates)).length;

  const inputClass =
    "w-full p-1.5 px-2 rounded border border-app-border text-xs bg-white outline-none";

  if (loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">出勤簿</div>
      <Card className="!p-4">
        <div className="flex gap-2.5">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-app-sub mb-1">月</label>
            <input
              type="month"
              value={selMonth}
              onChange={(e) => setSelMonth(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-app-sub mb-1">従業員</label>
            <select
              value={selEmp}
              onChange={(e) => setSelEmp(e.target.value)}
              className={inputClass}
            >
              {emp.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="!bg-primary-light !p-3.5">
        <div className="text-[13px] text-primary-dark font-semibold">
          {selE?.name} — {selMonth} 集計
        </div>
        <div className="text-xs text-app-sub mt-1">
          出勤 <strong className="text-primary">{totalDays}日</strong> / 予定{scheduledDays}日 ・ 実働{" "}
          <strong className="text-primary">{totalH.toFixed(1)}h</strong>
        </div>
        {selE?.shiftStart && selE?.shiftEnd && (
          <div className="text-xs text-app-sub mt-0.5">
            固定シフト: {selE.shiftStart}〜{selE.shiftEnd}（休憩{selE.shiftBreak || 0}分）
          </div>
        )}
      </Card>

      {days.map((date) => {
        const closed = isClosed(date, rates);
        const dow = new Date(date).toLocaleDateString("ja-JP", { weekday: "short" });
        const display = getDisplay(date);
        const rec = getRec(date);
        const h = calcH(display.startTime || null, display.endTime || null, typeof display.breakMinutes === "number" ? display.breakMinutes : null);
        const isPast = date < todayStr();
        const isAbsent = isPast && !closed && !rec?.startTime;

        // ステータスバッジ
        const statusLabel: Record<string, { text: string; type: "success" | "danger" | "accent" | "default" }> = {
          normal: { text: "出勤", type: "success" },
          late: { text: "遅刻", type: "accent" },
          early_leave: { text: "早退", type: "accent" },
        };

        return (
          <Card key={date} className={`!p-3 ${closed ? "!bg-gray-50" : ""} ${isAbsent ? "!bg-red-50" : ""}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`text-sm font-bold min-w-[70px] ${closed ? "text-app-sub" : "text-app-text"}`}>
                {date.slice(5)} ({dow})
              </div>
              {closed && <Badge type="default">定休</Badge>}
              {isAbsent && <Badge type="danger">欠勤</Badge>}
              {!closed && !display.hasRecord && !isAbsent && display.startTime && (
                <Badge type="accent">予定</Badge>
              )}
              {rec?.status && statusLabel[rec.status] && (
                <Badge type={statusLabel[rec.status].type}>{statusLabel[rec.status].text}</Badge>
              )}
              {h && (
                <div className="text-[13px] font-bold text-primary ml-auto">{h}h</div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[10px] font-semibold text-app-sub mb-0.5">出勤</label>
                <input
                  type="time"
                  className={`${inputClass} ${!display.hasRecord && display.startTime ? "text-app-sub" : ""}`}
                  value={display.startTime}
                  onChange={(e) => upsert(date, "startTime", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-app-sub mb-0.5">退勤</label>
                <input
                  type="time"
                  className={`${inputClass} ${!display.hasRecord && display.endTime ? "text-app-sub" : ""}`}
                  value={display.endTime}
                  onChange={(e) => upsert(date, "endTime", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-app-sub mb-0.5">休憩(分)</label>
                <input
                  type="number"
                  className={`${inputClass} ${!display.hasRecord && display.breakMinutes ? "text-app-sub" : ""}`}
                  value={display.breakMinutes}
                  onChange={(e) => upsert(date, "breakMinutes", e.target.value)}
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
