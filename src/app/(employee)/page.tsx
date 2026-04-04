"use client";

import { useEffect, useState, useMemo } from "react";
import Card from "@/components/Card";
import { useAuth } from "@/lib/auth-context";
import { EMPLOYEE_SCHEDULE } from "@/lib/employee-schedule";

type AttRecord = {
  date: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
};

type DakokuLog = {
  time: string;
  type: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const curMonth = () => new Date().toISOString().slice(0, 7);

function calcHours(rec: AttRecord): number {
  if (!rec.startTime || !rec.endTime) return 0;
  const [sh, sm] = rec.startTime.split(":").map(Number);
  const [eh, em] = rec.endTime.split(":").map(Number);
  const t = (eh * 60 + em) - (sh * 60 + sm) - (rec.breakMinutes || 0);
  return t > 0 ? t / 60 : 0;
}

export default function EmployeeDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [todayLogs, setTodayLogs] = useState<DakokuLog[]>([]);
  const [monthAtt, setMonthAtt] = useState<AttRecord[]>([]);
  const [todayAtt, setTodayAtt] = useState<AttRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.employeeId) return;
    const eid = user.employeeId;
    const today = todayStr();
    const month = curMonth();

    Promise.all([
      fetch(`/api/dakoku?employeeId=${eid}&date=${today}`).then((r) => r.json()),
      fetch(`/api/attendance?employeeId=${eid}&month=${month}`).then((r) => r.json()),
    ]).then(([dak, att]) => {
      setTodayLogs(dak);
      setMonthAtt(att);
      const todayRec = att.find((a: AttRecord) => a.date.startsWith(today));
      setTodayAtt(todayRec || null);
      setLoading(false);
    });
  }, [user?.employeeId]);

  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const nextMonth = thisMonth === 12 ? 1 : thisMonth + 1;

  const upcomingEvents = useMemo(
    () => EMPLOYEE_SCHEDULE.filter((e) => e.month === thisMonth || e.month === nextMonth),
    [thisMonth, nextMonth]
  );

  const yearRoundEvents = useMemo(
    () => EMPLOYEE_SCHEDULE.filter((e) => e.month === 0),
    []
  );

  if (authLoading || loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const dateStr = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const last = todayLogs[todayLogs.length - 1];
  let status = "未出勤";
  if (last?.type === "out") status = "退勤済";
  else if (last?.type === "break_start") status = "休憩中";
  else if (last?.type === "in" || last?.type === "break_end") status = "勤務中";

  const todayHours = todayAtt ? calcHours(todayAtt) : 0;
  const monthDays = monthAtt.filter((a) => a.startTime).length;
  const monthHours = monthAtt.reduce((s, a) => s + calcHours(a), 0);

  const statusColors: Record<string, { text: string; bg: string }> = {
    未出勤: { text: "text-gray-500", bg: "bg-gray-100" },
    勤務中: { text: "text-primary", bg: "bg-primary-light" },
    休憩中: { text: "text-accent", bg: "bg-orange-50" },
    退勤済: { text: "text-app-sub", bg: "bg-gray-100" },
  };
  const sc = statusColors[status];

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold text-app-text">
        {user?.name} さん
      </div>

      {/* 今日の日付・ステータス */}
      <Card className="text-center !py-5">
        <div className="text-sm text-app-sub">{dateStr}</div>
        <div className={`text-2xl font-extrabold mt-2 ${sc.text}`}>{status}</div>
      </Card>

      {/* 今日の勤務時間 */}
      <div className="grid grid-cols-2 gap-2.5">
        <Card className="!p-4 text-center">
          <div className="text-[11px] text-app-sub mb-1">本日の勤務</div>
          <div className="text-2xl font-extrabold text-primary">
            {todayHours > 0 ? todayHours.toFixed(1) + "h" : "—"}
          </div>
          {todayAtt?.startTime && (
            <div className="text-[11px] text-app-sub mt-1">
              {todayAtt.startTime}〜{todayAtt.endTime || "勤務中"}
            </div>
          )}
        </Card>
        <Card className="!p-4 text-center">
          <div className="text-[11px] text-app-sub mb-1">
            {curMonth().slice(5)}月 合計
          </div>
          <div className="text-2xl font-extrabold text-primary">
            {monthHours.toFixed(1)}h
          </div>
          <div className="text-[11px] text-app-sub mt-1">{monthDays}日出勤</div>
        </Card>
      </div>

      {/* 本日の打刻履歴 */}
      {todayLogs.length > 0 && (
        <Card>
          <div className="text-sm font-bold text-app-text mb-3">本日の打刻</div>
          {todayLogs.map((l, i) => {
            const labels: Record<string, string> = {
              in: "🟢 出勤", out: "🔴 退勤",
              break_start: "☕ 休憩開始", break_end: "🔄 休憩終了",
            };
            return (
              <div key={i} className="flex justify-between py-2 border-b border-app-border last:border-0">
                <span className="font-bold text-lg text-primary tabular-nums">{l.time}</span>
                <span className="text-sm text-app-text">{labels[l.type] || l.type}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* お知らせ（今月・来月のイベント） */}
      {upcomingEvents.length > 0 && (
        <Card className="!bg-[#FFF8E1] !border-[#FFE082]">
          <div className="text-sm font-bold text-[#F57F17] mb-2">📋 お知らせ</div>
          {upcomingEvents.map((ev, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <div className="text-[13px] font-semibold text-[#795548]">
                ・{ev.title}（{ev.month}月）
              </div>
              <div className="text-[11px] text-[#795548] ml-3">{ev.description}</div>
            </div>
          ))}
        </Card>
      )}

      {/* 年間スケジュール */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">📅 年間スケジュール</div>
        <div className="flex flex-col gap-2">
          {EMPLOYEE_SCHEDULE.filter((e) => e.month > 0)
            .sort((a, b) => a.month - b.month)
            .map((ev, i) => {
              const isCurrent = ev.month === thisMonth;
              return (
                <div
                  key={i}
                  className={`rounded border p-2.5 ${
                    isCurrent ? "border-primary bg-primary-light" : "border-app-border bg-app-bg"
                  }`}
                >
                  <div className={`text-xs font-bold ${isCurrent ? "text-primary" : "text-app-text"}`}>
                    {ev.month}月 — {ev.title}
                    {isCurrent && (
                      <span className="ml-1.5 text-[10px] font-semibold text-white bg-primary rounded-full px-1.5 py-0.5">
                        今月
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-app-sub mt-0.5">{ev.description}</div>
                </div>
              );
            })}
          {yearRoundEvents.length > 0 && (
            <div className="rounded border border-app-border bg-gray-50 p-2.5">
              <div className="text-xs font-bold text-app-text mb-1">通年</div>
              {yearRoundEvents.map((ev, i) => (
                <div key={i} className="text-[11px] text-app-sub mb-1 last:mb-0">
                  ・{ev.title}: {ev.description}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
