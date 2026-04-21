"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { useAuth } from "@/lib/auth-context";
import { canWriteAttendanceTime } from "@/lib/permissions";

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

type ClosedDateRecord = { id: string; date: string; name: string; type: string };

type DakokuLog = {
  id: string;
  employeeId: string;
  date: string;
  time: string;
  type: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
};

// ステータス定義
const STATUS_OPTIONS = [
  { value: "", label: "—（自動）" },
  { value: "scheduled", label: "出勤予定" },
  { value: "normal", label: "出勤" },
  { value: "late", label: "遅刻" },
  { value: "early_leave", label: "早退" },
  { value: "absent", label: "欠勤" },
  { value: "public_holiday", label: "公休" },
  { value: "closed", label: "定休" },
];

const STATUS_BADGE: Record<string, { text: string; type: "success" | "danger" | "accent" | "default" }> = {
  scheduled: { text: "予定", type: "accent" },
  normal: { text: "出勤", type: "success" },
  late: { text: "遅刻", type: "accent" },
  early_leave: { text: "早退", type: "accent" },
  absent: { text: "欠勤", type: "danger" },
  public_holiday: { text: "公休", type: "default" },
  closed: { text: "定休", type: "default" },
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

function isClosed(date: string, rates: Rate | null, closedDates: ClosedDateRecord[]) {
  if (!rates) return false;
  const dow = new Date(date).getDay();
  if (rates[DOW_KEYS[dow]]) return true;
  return closedDates.some((cd) => cd.date.startsWith(date));
}

function getClosedDateName(date: string, rates: Rate | null, closedDates: ClosedDateRecord[]): string {
  const cd = closedDates.find((c) => c.date.startsWith(date));
  if (cd) return cd.name;
  if (rates) {
    const dow = new Date(date).getDay();
    if (rates[DOW_KEYS[dow]]) return "定休";
  }
  return "定休";
}

// ステータスの自動判定（手動設定がない場合）
function autoStatus(date: string, rec: AttRecord | undefined, closed: boolean, isPast: boolean): string {
  if (rec?.status) return rec.status;
  if (closed) return "closed";
  if (rec?.startTime) return "normal";
  if (isPast) return "absent";
  return "scheduled";
}

// そのステータスが「実働時間を計上すべき」か判定
// normal / late / early_leave のときだけ計上する
function isWorkingStatus(status: string): boolean {
  return status === "normal" || status === "late" || status === "early_leave";
}

export default function ShukkinPage() {
  const { user } = useAuth();
  const canEditTime = canWriteAttendanceTime(user?.role);
  const [emp, setEmp] = useState<Employee[]>([]);
  const [selMonth, setSelMonth] = useState(todayStr().slice(0, 7));
  const [selEmp, setSelEmp] = useState("");
  const [att, setAtt] = useState<AttRecord[]>([]);
  const [rates, setRates] = useState<Rate | null>(null);
  const [closedDates, setClosedDates] = useState<ClosedDateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalLogs, setModalLogs] = useState<DakokuLog[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const year = selMonth.slice(0, 4);
    Promise.all([
      fetch("/api/employees?scope=workers").then((r) => r.json()),
      fetch("/api/rates").then((r) => r.json()),
      fetch(`/api/closed-dates?year=${year}`).then((r) => r.json()),
    ]).then(([data, r, cd]) => {
      const active = data.filter((e: Employee) => !e.resignDate);
      setEmp(active);
      setRates(r);
      setClosedDates(cd);
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

  const getDisplay = (date: string) => {
    const rec = getRec(date);
    const closed = isClosed(date, rates, closedDates);
    if (rec) {
      return {
        startTime: rec.startTime || "",
        endTime: rec.endTime || "",
        breakMinutes: rec.breakMinutes ?? "",
        hasRecord: true,
      };
    }
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
    const rec = getRec(date);
    const body: Record<string, unknown> = {
      employeeId: selEmp,
      date,
      [field]: val,
    };
    // ステータスを「勤務扱いにならない」値に変えた場合、実働時間データをクリア
    // これにより月合計・日別表示の両方から計上されなくなる
    if (field === "status" && !isWorkingStatus(val) && val !== "") {
      body.startTime = null;
      body.endTime = null;
      body.breakMinutes = null;
    }
    if (!rec && selE && field !== "status") {
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

  // 打刻履歴モーダルを開く
  const openDakokuModal = async (date: string) => {
    setModalDate(date);
    setModalLoading(true);
    setModalLogs([]);
    try {
      const res = await fetch(`/api/dakoku?employeeId=${selEmp}&date=${date}`);
      const data: DakokuLog[] = await res.json();
      setModalLogs(data);
    } catch {
      setModalLogs([]);
    } finally {
      setModalLoading(false);
    }
  };

  // 集計
  const totalDays = days.filter((d) => {
    const rec = getRec(d);
    const st = autoStatus(d, rec, isClosed(d, rates, closedDates), d < todayStr());
    return st === "normal" || st === "late" || st === "early_leave";
  }).length;
  const totalH = days.reduce((s, d) => {
    const rec = getRec(d);
    const st = autoStatus(d, rec, isClosed(d, rates, closedDates), d < todayStr());
    // 定休・欠勤・公休・未出勤の日は時刻データがあっても計上しない
    if (!isWorkingStatus(st)) return s;
    return s + Number(calcH(rec?.startTime || null, rec?.endTime || null, rec?.breakMinutes || null) || 0);
  }, 0);
  const scheduledDays = days.filter((d) => !isClosed(d, rates, closedDates)).length;
  const absentDays = days.filter((d) => {
    const rec = getRec(d);
    return autoStatus(d, rec, isClosed(d, rates, closedDates), d < todayStr()) === "absent";
  }).length;
  const lateDays = days.filter((d) => {
    const rec = getRec(d);
    return autoStatus(d, rec, isClosed(d, rates, closedDates), d < todayStr()) === "late";
  }).length;

  const inputClass =
    "w-full p-1 px-1.5 rounded border border-app-border text-[11px] bg-white outline-none box-border";

  if (loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">出勤簿</div>
      {!canEditTime && (
        <div className="text-xs text-app-sub bg-app-bg rounded px-3 py-2">
          打刻時間は閲覧のみ可能です（時刻の修正は代表者権限が必要。状態の変更は可能）
        </div>
      )}
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

      {/* CSVエクスポート：全員一括 / 選択従業員のみ */}
      <div className="flex gap-2">
        <a
          href={`/api/attendance/export?month=${selMonth}`}
          className="flex-1 text-center py-2.5 rounded-xl text-sm font-bold bg-primary text-white no-underline cursor-pointer"
        >
          全員分CSV
        </a>
        <a
          href={selEmp ? `/api/attendance/export?month=${selMonth}&employeeId=${selEmp}` : undefined}
          aria-disabled={!selEmp}
          className={`flex-1 text-center py-2.5 rounded-xl text-sm font-bold no-underline ${
            selEmp
              ? "bg-white text-primary border border-primary cursor-pointer"
              : "bg-gray-100 text-app-sub pointer-events-none"
          }`}
        >
          {selE ? `${selE.name}のみCSV` : "従業員未選択"}
        </a>
      </div>

      {/* 月間集計 */}
      <Card className="!bg-primary-light !p-3.5">
        <div className="text-[13px] text-primary-dark font-semibold">
          {selE?.name} — {selMonth} 集計
        </div>
        <div className="text-xs text-app-sub mt-1">
          出勤 <strong className="text-primary">{totalDays}日</strong> / 予定{scheduledDays}日 ・ 実働{" "}
          <strong className="text-primary">{totalH.toFixed(1)}h</strong>
        </div>
        {(lateDays > 0 || absentDays > 0) && (
          <div className="text-xs mt-0.5">
            {lateDays > 0 && <span className="text-accent mr-2">遅刻 {lateDays}回</span>}
            {absentDays > 0 && <span className="text-danger">欠勤 {absentDays}日</span>}
          </div>
        )}
        {selE?.shiftStart && selE?.shiftEnd && (
          <div className="text-xs text-app-sub mt-0.5">
            固定シフト: {selE.shiftStart}〜{selE.shiftEnd}（休憩{selE.shiftBreak || 0}分）
          </div>
        )}
      </Card>

      {/* 日別 */}
      {days.map((date) => {
        const closed = isClosed(date, rates, closedDates);
        const dow = new Date(date).toLocaleDateString("ja-JP", { weekday: "short" });
        const display = getDisplay(date);
        const rec = getRec(date);
        const isPast = date < todayStr();
        const currentStatus = autoStatus(date, rec, closed, isPast);
        const badge = STATUS_BADGE[currentStatus];
        // 定休・欠勤・公休・未出勤の日は実働時間を表示しない
        const h = isWorkingStatus(currentStatus)
          ? calcH(display.startTime || null, display.endTime || null, typeof display.breakMinutes === "number" ? display.breakMinutes : null)
          : "";

        return (
          <Card
            key={date}
            className={`!p-3 ${
              currentStatus === "closed" || currentStatus === "public_holiday" ? "!bg-gray-50" : ""
            } ${currentStatus === "absent" ? "!bg-red-50" : ""}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`text-sm font-bold min-w-[70px] ${closed || currentStatus === "public_holiday" ? "text-app-sub" : "text-app-text"}`}>
                {date.slice(5)} ({dow})
              </div>
              {badge && (
                <Badge type={badge.type}>
                  {currentStatus === "closed" ? getClosedDateName(date, rates, closedDates) : badge.text}
                </Badge>
              )}
              {h && (
                <div className="text-[13px] font-bold text-primary ml-auto">{h}h</div>
              )}
            </div>
            {/* 定休・公休以外は出退勤入力を表示 */}
            <div className={`grid gap-1 ${currentStatus === "closed" || currentStatus === "public_holiday" ? "grid-cols-1" : "grid-cols-2"}`}>
              {currentStatus !== "closed" && currentStatus !== "public_holiday" && (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold text-app-sub mb-0.5">出勤</label>
                    <input
                      type="time"
                      className={`${inputClass} ${!display.hasRecord && display.startTime ? "text-app-sub" : ""} ${!canEditTime ? "bg-gray-50" : ""}`}
                      value={display.startTime}
                      onChange={(e) => canEditTime && upsert(date, "startTime", e.target.value)}
                      readOnly={!canEditTime}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-app-sub mb-0.5">退勤</label>
                    <input
                      type="time"
                      className={`${inputClass} ${!display.hasRecord && display.endTime ? "text-app-sub" : ""} ${!canEditTime ? "bg-gray-50" : ""}`}
                      value={display.endTime}
                      onChange={(e) => canEditTime && upsert(date, "endTime", e.target.value)}
                      readOnly={!canEditTime}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-app-sub mb-0.5">休憩(分)</label>
                    <input
                      type="number"
                      className={`${inputClass} ${!display.hasRecord && display.breakMinutes ? "text-app-sub" : ""} ${!canEditTime ? "bg-gray-50" : ""}`}
                      value={display.breakMinutes}
                      onChange={(e) => canEditTime && upsert(date, "breakMinutes", e.target.value)}
                      readOnly={!canEditTime}
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-[10px] font-semibold text-app-sub mb-0.5">状態</label>
                <select
                  className={`${inputClass} ${
                    currentStatus === "absent" ? "text-danger" :
                    currentStatus === "late" || currentStatus === "early_leave" ? "text-accent" :
                    currentStatus === "normal" ? "text-primary" : ""
                  }`}
                  value={rec?.status || ""}
                  onChange={(e) => upsert(date, "status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* 打刻履歴ボタン（レコードがある日のみ） */}
            {display.hasRecord && (
              <button
                onClick={() => openDakokuModal(date)}
                className="mt-1.5 text-[11px] text-primary underline bg-transparent border-none cursor-pointer p-0"
              >
                打刻履歴を確認
              </button>
            )}
          </Card>
        );
      })}

      {/* 打刻履歴モーダル */}
      {modalDate && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[200]"
            onClick={() => setModalDate(null)}
          />
          <div className="fixed inset-x-4 top-[10%] bottom-[10%] bg-white rounded z-[300] shadow-lg overflow-y-auto max-w-app mx-auto">
            <div className="sticky top-0 bg-white border-b border-app-border p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-app-text">打刻履歴</div>
                <div className="text-xs text-app-sub">
                  {selE?.name} — {modalDate}
                </div>
              </div>
              <button
                onClick={() => setModalDate(null)}
                className="w-8 h-8 flex items-center justify-center rounded text-app-sub hover:bg-gray-100 border-none bg-transparent cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {modalLoading ? (
                <div className="text-center text-app-sub py-8">読み込み中...</div>
              ) : modalLogs.length === 0 ? (
                <div className="text-center text-app-sub py-8">打刻記録がありません</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {modalLogs.map((log) => {
                    const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
                      in: { label: "出勤", icon: "🟢", color: "text-primary" },
                      out: { label: "退勤", icon: "🔴", color: "text-danger" },
                      break_start: { label: "休憩開始", icon: "☕", color: "text-accent" },
                      break_end: { label: "休憩終了", icon: "🔄", color: "text-primary" },
                    };
                    const info = typeLabels[log.type] || { label: log.type, icon: "⏱️", color: "text-app-text" };

                    return (
                      <div
                        key={log.id}
                        className="border border-app-border rounded p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{info.icon}</span>
                          <span className={`text-sm font-bold ${info.color}`}>{info.label}</span>
                          <span className="text-lg font-bold text-app-text tabular-nums ml-auto">
                            {log.time}
                          </span>
                        </div>
                        <div className="text-[11px] text-app-sub">
                          {new Date(log.timestamp).toLocaleString("ja-JP")}
                        </div>
                        {log.latitude && log.longitude ? (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-xs">📍</span>
                            <a
                              href={`https://maps.google.com/maps?q=${log.latitude},${log.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-primary underline"
                            >
                              {log.latitude.toFixed(6)}, {log.longitude.toFixed(6)}
                            </a>
                            <span className="text-[10px] text-app-sub ml-1">
                              (Google Mapsで確認)
                            </span>
                          </div>
                        ) : (
                          <div className="mt-1.5 text-[11px] text-app-sub">
                            📍 位置情報なし
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
