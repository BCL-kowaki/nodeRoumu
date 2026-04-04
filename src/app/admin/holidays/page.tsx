"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import { getNationalHolidays } from "@/lib/holidays";

type Rate = {
  id: string;
  closedSun: boolean;
  closedMon: boolean;
  closedTue: boolean;
  closedWed: boolean;
  closedThu: boolean;
  closedFri: boolean;
  closedSat: boolean;
};

type ClosedDateRecord = { id: string; date: string; name: string; type: string };

const inputClass =
  "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function HolidaysPage() {
  const [rates, setRates] = useState<Rate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // 特定休日管理
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [closedDates, setClosedDates] = useState<ClosedDateRecord[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("company");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState("");

  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((data) => {
        setRates(data);
        setLoading(false);
      });
  }, []);

  const fetchClosedDates = useCallback(async (year: number) => {
    setHolidaysLoading(true);
    try {
      const res = await fetch(`/api/closed-dates?year=${year}`);
      const data: ClosedDateRecord[] = await res.json();
      setClosedDates(data);
    } catch {
      setClosedDates([]);
    } finally {
      setHolidaysLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClosedDates(holidayYear);
  }, [holidayYear, fetchClosedDates]);

  // 定休日の保存
  const doSaveClosedDays = async () => {
    if (!rates) return;
    await fetch("/api/rates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rates),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // 特定休日を追加
  const handleAddClosedDate = async () => {
    if (!newDate || !newName) return;
    const res = await fetch("/api/closed-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newDate, name: newName, type: newType }),
    });
    if (res.ok) {
      setNewDate("");
      setNewName("");
      setNewType("company");
      setShowAddForm(false);
      fetchClosedDates(holidayYear);
    }
  };

  // 特定休日を削除
  const handleDeleteClosedDate = async (id: string) => {
    await fetch(`/api/closed-dates/${id}`, { method: "DELETE" });
    fetchClosedDates(holidayYear);
  };

  // 祝日一括登録
  const handleBulkRegister = async () => {
    const holidays = getNationalHolidays(holidayYear);
    if (holidays.length === 0) {
      setHolidayMessage(`${holidayYear}年の祝日データがありません`);
      setTimeout(() => setHolidayMessage(""), 3000);
      return;
    }
    setBulkLoading(true);
    try {
      const payload = holidays.map((h) => ({
        date: h.date,
        name: h.name,
        type: "national",
      }));
      const res = await fetch("/api/closed-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setHolidayMessage(`${holidays.length}件の祝日を登録しました`);
        setTimeout(() => setHolidayMessage(""), 3000);
        fetchClosedDates(holidayYear);
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`;
  };

  if (loading || !rates)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const closedDays = [
    { k: "closedSun", l: "日" },
    { k: "closedMon", l: "月" },
    { k: "closedTue", l: "火" },
    { k: "closedWed", l: "水" },
    { k: "closedThu", l: "木" },
    { k: "closedFri", l: "金" },
    { k: "closedSat", l: "土" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">休日設定</div>

      {saved && (
        <Card className="!bg-primary-light text-center !p-3">
          <div className="text-sm font-bold text-primary-dark">保存しました</div>
        </Card>
      )}

      {/* 定休日設定 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">定休日（曜日）</div>
        <div className="text-[11px] text-app-sub mb-3">
          定休日に設定した曜日は出勤予定日から除外されます
        </div>
        <div className="flex gap-2 mb-4">
          {closedDays.map((d) => {
            const checked = rates[d.k as keyof Rate] as boolean;
            return (
              <label
                key={d.k}
                className={`flex-1 text-center py-2.5 rounded border cursor-pointer text-sm font-semibold transition-colors ${
                  checked
                    ? "bg-danger text-white border-danger"
                    : "bg-white text-app-sub border-app-border"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setRates({ ...rates, [d.k]: e.target.checked })
                  }
                  className="hidden"
                />
                {d.l}
              </label>
            );
          })}
        </div>
        <button
          onClick={doSaveClosedDays}
          className="px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          定休日を保存
        </button>
      </Card>

      {/* 特定休日管理 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">特定休日（祝日・会社休日）</div>
        <div className="text-[11px] text-app-sub mb-3">
          祝日や会社独自の休日を登録します。出勤予定日から除外されます。
        </div>

        {/* 年選択 */}
        <div className="mb-4">
          <label className={labelClass}>対象年</label>
          <input
            type="number"
            className={inputClass}
            value={holidayYear}
            onChange={(e) => setHolidayYear(Number(e.target.value))}
            min={2020}
            max={2099}
            style={{ maxWidth: 140 }}
          />
        </div>

        {/* 一括登録・追加ボタン */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleBulkRegister}
            disabled={bulkLoading}
            className="px-4 py-2 rounded bg-accent text-white text-xs font-bold border-none cursor-pointer disabled:opacity-50"
          >
            {bulkLoading ? "登録中..." : "祝日一括登録"}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 rounded bg-primary text-white text-xs font-bold border-none cursor-pointer"
          >
            {showAddForm ? "閉じる" : "追加"}
          </button>
        </div>

        {holidayMessage && (
          <div className="text-xs font-semibold text-primary-dark bg-primary-light rounded p-2.5 mb-3 text-center">
            {holidayMessage}
          </div>
        )}

        {/* 追加フォーム */}
        {showAddForm && (
          <div className="border border-app-border rounded p-4 mb-4 bg-gray-50">
            <div className="mb-3">
              <label className={labelClass}>日付</label>
              <input type="date" className={inputClass} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className={labelClass}>名称</label>
              <input type="text" className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例: 創立記念日" />
            </div>
            <div className="mb-3">
              <label className={labelClass}>種別</label>
              <select className={inputClass} value={newType} onChange={(e) => setNewType(e.target.value)}>
                <option value="company">会社休日</option>
                <option value="national">祝日</option>
              </select>
            </div>
            <button
              onClick={handleAddClosedDate}
              disabled={!newDate || !newName}
              className="px-5 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
            >
              登録する
            </button>
          </div>
        )}

        {/* 休日一覧 */}
        {holidaysLoading ? (
          <div className="text-xs text-app-sub text-center py-4">読み込み中...</div>
        ) : closedDates.length === 0 ? (
          <div className="text-xs text-app-sub text-center py-4">
            {holidayYear}年の登録済み休日はありません
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {closedDates.map((cd) => (
              <div
                key={cd.id}
                className="flex items-center justify-between bg-gray-50 border border-app-border rounded px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-sm font-semibold text-app-text whitespace-nowrap">
                    {formatDate(cd.date)}
                  </span>
                  <span className="text-sm text-app-text truncate">{cd.name}</span>
                  <Badge type={cd.type === "national" ? "accent" : "default"}>
                    {cd.type === "national" ? "祝日" : "会社"}
                  </Badge>
                </div>
                <button
                  onClick={() => handleDeleteClosedDate(cd.id)}
                  className="ml-2 w-7 h-7 flex items-center justify-center rounded-full text-app-sub hover:bg-danger-light hover:text-danger transition-colors text-sm font-bold border-none bg-transparent cursor-pointer shrink-0"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="text-[11px] text-app-sub mt-1">
              合計 {closedDates.length} 件
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
