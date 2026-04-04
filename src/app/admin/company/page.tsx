"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";

type Company = {
  id: string;
  name: string;
  nameKana: string | null;
  representativeName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  establishedDate: string | null;
  businessType: string | null;
  corporateNumber: string | null;
  memo: string | null;
};

const inputClass = "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function CompanyPage() {
  const [form, setForm] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/company")
      .then((r) => r.json())
      .then((data) => {
        setForm({
          ...data,
          establishedDate: data.establishedDate?.slice(0, 10) || null,
        });
        setLoading(false);
      });
  }, []);

  const doSave = async () => {
    if (!form) return;
    await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading || !form)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  const fields = [
    { k: "name", l: "会社名", t: "text" },
    { k: "nameKana", l: "フリガナ", t: "text" },
    { k: "representativeName", l: "代表者名", t: "text" },
    { k: "address", l: "所在地", t: "text" },
    { k: "phone", l: "電話番号", t: "tel" },
    { k: "email", l: "メールアドレス", t: "email" },
    { k: "establishedDate", l: "設立日", t: "date" },
    { k: "businessType", l: "事業内容", t: "text" },
    { k: "corporateNumber", l: "法人番号", t: "text" },
    { k: "memo", l: "備考", t: "text" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">企業情報</div>

      {saved && (
        <Card className="!bg-primary-light text-center !p-3">
          <div className="text-sm font-bold text-primary-dark">✅ 保存しました</div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3.5">
          {fields.map((x) => (
            <div key={x.k}>
              <label className={labelClass}>{x.l}</label>
              <input
                className={inputClass}
                type={x.t}
                value={(form as Record<string, unknown>)[x.k] as string || ""}
                onChange={(e) => setForm({ ...form, [x.k]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <button
          onClick={doSave}
          className="mt-5 px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          保存する
        </button>
      </Card>
    </div>
  );
}
