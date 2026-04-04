"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";

type Rate = {
  id: string;
  healthInsurance: number;
  pension: number;
  employmentInsurance: number;
  childcare: number;
  label: string | null;
  closedSun: boolean;
  closedMon: boolean;
  closedTue: boolean;
  closedWed: boolean;
  closedThu: boolean;
  closedFri: boolean;
  closedSat: boolean;
  updatedAt: string;
};

const inputClass =
  "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function SettingsPage() {
  const [form, setForm] = useState<Rate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((data) => {
        setForm(data);
        setLoading(false);
      });
  }, []);

  const doSave = async () => {
    if (!form) return;
    await fetch("/api/rates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const updated = await fetch("/api/rates").then((r) => r.json());
    setForm(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading || !form)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const rateFields = [
    { k: "healthInsurance", l: "健康保険料率（%）", h: "労使合計。折半で計算されます" },
    { k: "pension", l: "厚生年金保険料率（%）", h: "18.3%固定。折半で計算" },
    { k: "employmentInsurance", l: "雇用保険料率（%）", h: "労働者負担分。業種により異なります" },
    { k: "childcare", l: "子ども・子育て拠出金率（%）", h: "事業主のみ負担。参考値" },
  ];

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
      <div className="text-lg font-bold">料率設定</div>

      {saved && (
        <Card className="!bg-primary-light text-center !p-3">
          <div className="text-sm font-bold text-primary-dark">
            ✅ 保存しました
          </div>
        </Card>
      )}

      {/* 定休日設定 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">定休日</div>
        <div className="text-[11px] text-app-sub mb-3">
          定休日に設定した曜日は出勤予定日から除外されます
        </div>
        <div className="flex gap-2">
          {closedDays.map((d) => {
            const checked = form[d.k as keyof Rate] as boolean;
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
                    setForm({ ...form, [d.k]: e.target.checked })
                  }
                  className="hidden"
                />
                {d.l}
              </label>
            );
          })}
        </div>
      </Card>

      {/* 料率設定 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">社会保険料率</div>
        <div className="text-[13px] text-app-sub mb-4 leading-relaxed">
          法改正時にここを更新すれば、賃金台帳の計算に反映されます。
        </div>

        {rateFields.map((x) => (
          <div key={x.k} className="mb-3.5">
            <label className={labelClass}>{x.l}</label>
            <div className="text-[11px] text-app-sub mb-1">{x.h}</div>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={form[x.k as keyof Rate] as number}
              onChange={(e) =>
                setForm({ ...form, [x.k]: Number(e.target.value) })
              }
            />
          </div>
        ))}

        <div className="mb-3.5">
          <label className={labelClass}>メモ</label>
          <input
            type="text"
            className={inputClass}
            value={form.label || ""}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="例: 2026年度 福岡県 協会けんぽ"
          />
        </div>

        {form.updatedAt && (
          <div className="text-xs text-app-sub mb-3">
            最終更新: {new Date(form.updatedAt).toLocaleString("ja-JP")}
          </div>
        )}

        <button
          onClick={doSave}
          className="px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          保存する
        </button>
      </Card>
    </div>
  );
}
