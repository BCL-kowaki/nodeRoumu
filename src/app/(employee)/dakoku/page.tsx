"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import { useAuth } from "@/lib/auth-context";

type DakokuLog = {
  id: string;
  employeeId: string;
  date: string;
  time: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const statusMap: Record<string, { color: string; bg: string }> = {
  未出勤: { color: "text-gray-500", bg: "bg-gray-100" },
  勤務中: { color: "text-primary", bg: "bg-primary-light" },
  休憩中: { color: "text-accent", bg: "bg-orange-50" },
  退勤済: { color: "text-danger", bg: "bg-danger-light" },
};

function getStatus(logs: DakokuLog[]) {
  const last = logs[logs.length - 1];
  if (!last) return "未出勤";
  if (last.type === "out") return "退勤済";
  if (last.type === "break_start") return "休憩中";
  return "勤務中";
}

export default function EmployeeDakoku() {
  const { user, loading: authLoading } = useAuth();
  const [now, setNow] = useState(new Date());
  const [logs, setLogs] = useState<DakokuLog[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchLogs = useCallback(() => {
    if (!user?.employeeId) return;
    fetch(`/api/dakoku?employeeId=${user.employeeId}&date=${todayStr()}`)
      .then((r) => r.json())
      .then(setLogs);
  }, [user?.employeeId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const status = getStatus(logs);
  const sc = statusMap[status];

  // GPS位置情報を取得
  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const punch = async (type: string) => {
    if (!user?.employeeId) return;
    const time = hh + ":" + mm;
    const loc = await getLocation();
    await fetch("/api/dakoku", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: user.employeeId,
        date: todayStr(),
        time,
        type,
        latitude: loc?.latitude ?? null,
        longitude: loc?.longitude ?? null,
      }),
    });
    fetchLogs();
    const labels: Record<string, string> = {
      in: "出勤", out: "退勤", break_start: "休憩開始", break_end: "休憩終了",
    };
    setFlash(labels[type] + " " + time + (loc ? " 📍" : ""));
    setTimeout(() => setFlash(null), 3000);
  };

  const btns = [
    { type: "in", label: "出勤", icon: "🟢", disabled: status === "勤務中" || status === "退勤済" || status === "休憩中" },
    { type: "break_start", label: "休憩", icon: "☕", disabled: status !== "勤務中" },
    { type: "break_end", label: "戻り", icon: "🔄", disabled: status !== "休憩中" },
    { type: "out", label: "退勤", icon: "🔴", disabled: status === "未出勤" || status === "退勤済" },
  ];

  if (authLoading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3">
      {/* 時計 */}
      <Card className="text-center !py-8 !px-5">
        <div className="text-[56px] font-extrabold text-app-text tabular-nums tracking-wider leading-none">
          {hh}:{mm}
          <span className="text-[28px] text-app-sub">:{ss}</span>
        </div>
        <div className="text-sm text-app-sub mt-2.5">
          {now.toLocaleDateString("ja-JP", {
            year: "numeric", month: "long", day: "numeric", weekday: "long",
          })}
        </div>
      </Card>

      {/* ステータス */}
      <Card className={`text-center !p-4 ${sc.bg}`}>
        <div className="text-xs text-app-sub mb-1">現在のステータス</div>
        <div className={`text-2xl font-extrabold ${sc.color}`}>{status}</div>
      </Card>

      {flash && (
        <Card className="!bg-primary-light text-center !p-3.5">
          <div className="text-[15px] font-bold text-primary-dark">✅ {flash}</div>
        </Card>
      )}

      {/* 打刻ボタン */}
      <div className="grid grid-cols-2 gap-2.5">
        {btns.map((b) => (
          <button
            key={b.type}
            disabled={b.disabled}
            onClick={() => punch(b.type)}
            className={`py-7 px-3 rounded border-2 flex flex-col items-center gap-2 transition-all ${
              b.disabled
                ? "border-app-border bg-gray-50 cursor-not-allowed opacity-40"
                : "border-primary bg-white cursor-pointer shadow-[0_2px_8px_rgba(33,151,127,0.12)] hover:shadow-[0_4px_16px_rgba(33,151,127,0.2)]"
            }`}
          >
            <span className="text-4xl">{b.icon}</span>
            <span className={`text-base font-bold tracking-widest ${b.disabled ? "text-app-sub" : "text-app-text"}`}>
              {b.label}
            </span>
          </button>
        ))}
      </div>

      {/* 本日の打刻履歴 */}
      {logs.length > 0 && (
        <Card>
          <div className="text-sm font-bold text-app-text mb-3">本日の打刻履歴</div>
          {logs.map((l) => {
            const labels: Record<string, string> = {
              in: "🟢 出勤", out: "🔴 退勤", break_start: "☕ 休憩開始", break_end: "🔄 休憩終了",
            };
            return (
              <div key={l.id} className="flex items-center py-2 border-b border-app-border last:border-0 gap-2">
                <span className="font-bold text-lg text-primary tabular-nums">{l.time}</span>
                {l.latitude && l.longitude && (
                  <a
                    href={`https://maps.google.com/maps?q=${l.latitude},${l.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-app-sub no-underline"
                  >
                    📍
                  </a>
                )}
                <span className="text-sm text-app-text ml-auto">{labels[l.type] || l.type}</span>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
