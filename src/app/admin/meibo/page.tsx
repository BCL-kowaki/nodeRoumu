"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import PasswordInput from "@/components/PasswordInput";
import { useAuth } from "@/lib/auth-context";
import { canWriteEmployees } from "@/lib/permissions";
import { roleLabel } from "@/lib/roles";

type Employee = {
  id: string;
  name: string;
  nameKana: string;
  birthDate: string | null;
  gender: string;
  address: string;
  phone: string;
  hireDate: string;
  position: string;
  employmentType: string;
  resignDate: string | null;
  hourlyWage: number | null;
  monthlySalary: number | null;
  memo: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  shiftBreak: number | null;
  loginId: string | null;
  role: string;
  healthInsuranceEnrolled: boolean;
  pensionEnrolled: boolean;
  employmentInsuranceEnrolled: boolean;
};

type EmployeeForm = Employee & { password: string };

const EMPTY: Omit<EmployeeForm, "id"> & { id: string } = {
  id: "",
  name: "",
  nameKana: "",
  birthDate: null,
  gender: "男",
  address: "",
  phone: "",
  hireDate: "",
  position: "",
  employmentType: "正社員",
  resignDate: null,
  hourlyWage: null,
  monthlySalary: null,
  memo: "",
  shiftStart: null,
  shiftEnd: null,
  shiftBreak: null,
  loginId: null,
  password: "",
  role: "employee",
  healthInsuranceEnrolled: false,
  pensionEnrolled: false,
  employmentInsuranceEnrolled: false,
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

const inputClass = "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function AdminMeiboPage() {
  const { user } = useAuth();
  const canWrite = canWriteEmployees(user?.role);
  // 社労士（manager）には編集不可なので代わりに「詳細確認」モーダルを提供する
  const isManager = user?.role === "manager";
  const [emp, setEmp] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY as EmployeeForm);
  // 詳細確認モーダル（manager専用）
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  useEffect(() => {
    fetch("/api/employees?scope=workers")
      .then((r) => r.json())
      .then((data) => {
        setEmp(data);
        setLoading(false);
      });
  }, []);

  const reload = () =>
    fetch("/api/employees?scope=workers")
      .then((r) => r.json())
      .then(setEmp);

  const startNew = () => {
    setForm(EMPTY as EmployeeForm);
    setEditing("new");
  };

  const startEdit = (e: Employee) => {
    setForm({
      ...e,
      birthDate: e.birthDate ? e.birthDate.slice(0, 10) : null,
      hireDate: e.hireDate?.slice(0, 10) || "",
      resignDate: e.resignDate ? e.resignDate.slice(0, 10) : null,
      password: "", // パスワードは空で初期化（変更時のみ送信）
    });
    setEditing("edit");
  };

  const cancel = () => {
    setEditing(null);
    setForm(EMPTY as EmployeeForm);
  };

  const doSave = async () => {
    if (!form.name || !form.hireDate) {
      alert("氏名と入社日は必須です");
      return;
    }
    // パスワードが空文字の場合はbodyから除外（変更なし）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = { ...form };
    if (!body.password) {
      delete body.password;
    }
    if (editing === "new") {
      await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`/api/employees/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    await reload();
    cancel();
  };

  const del = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    await reload();
  };

  if (loading) return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  // --- 編集フォーム ---
  if (editing) {
    const fields: { k: string; l: string; t: string; opts?: string[] }[] = [
      { k: "name", l: "氏名 *", t: "text" },
      { k: "nameKana", l: "フリガナ", t: "text" },
      { k: "loginId", l: "ログインID", t: "text" },
      { k: "password", l: "パスワード（新規/変更時のみ）", t: "password" },
      { k: "role", l: "権限", t: "select", opts: ["admin", "manager", "employee"] },
      { k: "birthDate", l: "生年月日", t: "date" },
      { k: "gender", l: "性別", t: "select", opts: ["男", "女", "その他"] },
      { k: "address", l: "住所", t: "text" },
      { k: "phone", l: "電話番号", t: "tel" },
      { k: "hireDate", l: "入社日 *", t: "date" },
      { k: "employmentType", l: "雇用形態", t: "select", opts: ["正社員", "パート・アルバイト", "契約社員", "役員"] },
      { k: "position", l: "職種・役職", t: "text" },
      { k: "monthlySalary", l: "月額給与（円）", t: "number" },
      { k: "hourlyWage", l: "時給（円）", t: "number" },
      { k: "shiftStart", l: "勤務開始時刻", t: "time" },
      { k: "shiftEnd", l: "勤務終了時刻", t: "time" },
      { k: "shiftBreak", l: "休憩時間（分）", t: "number" },
      { k: "resignDate", l: "退職日", t: "date" },
      { k: "memo", l: "備考", t: "text" },
    ];

    const insuranceChecks = [
      { k: "healthInsuranceEnrolled", l: "健康保険" },
      { k: "pensionEnrolled", l: "厚生年金" },
      { k: "employmentInsuranceEnrolled", l: "雇用保険" },
    ];

    return (
      <Card>
        <div className="text-base font-bold text-app-text mb-4">
          {editing === "new" ? "新規登録" : "編集"}
        </div>
        <div className="flex flex-col gap-3.5">
          {fields.map((x) => (
            <div key={x.k}>
              <label className={labelClass}>{x.l}</label>
              {x.t === "select" ? (
                <select
                  className={inputClass}
                  value={(form as Record<string, unknown>)[x.k] as string || ""}
                  onChange={(e) => setForm({ ...form, [x.k]: e.target.value })}
                >
                  {x.opts!.map((o) => (
                    <option key={o} value={o}>
                      {x.k === "role" ? roleLabel(o) : o}
                    </option>
                  ))}
                </select>
              ) : x.t === "password" ? (
                <PasswordInput
                  className={inputClass}
                  value={(form as Record<string, unknown>)[x.k] as string || ""}
                  onChange={(v) => setForm({ ...form, [x.k]: v })}
                />
              ) : (
                <input
                  className={inputClass}
                  type={x.t}
                  value={(form as Record<string, unknown>)[x.k] as string || ""}
                  onChange={(e) => setForm({ ...form, [x.k]: e.target.value })}
                />
              )}
            </div>
          ))}

          {/* 社会保険加入チェックボックス */}
          <div>
            <label className={labelClass}>社会保険加入状況</label>
            <div className="flex flex-col gap-2 mt-1">
              {insuranceChecks.map((c) => (
                <label key={c.k} className="flex items-center gap-2 text-sm text-app-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(form as Record<string, unknown>)[c.k] as boolean}
                    onChange={(e) => setForm({ ...form, [c.k]: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  {c.l}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button
            onClick={doSave}
            className="px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
          >
            保存
          </button>
          <button
            onClick={cancel}
            className="px-6 py-3 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer"
          >
            キャンセル
          </button>
        </div>
      </Card>
    );
  }

  // --- 一覧表示 ---
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold">労働者名簿（管理）</div>
        {canWrite && (
          <button
            onClick={startNew}
            className="px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
          >
            + 追加
          </button>
        )}
      </div>
      {!canWrite && (
        <div className="text-xs text-app-sub bg-app-bg rounded px-3 py-2">
          閲覧のみ可能です（追加・編集・削除は代表者権限が必要）
        </div>
      )}
      {emp.length === 0 ? (
        <Card className="text-center !py-10 text-app-sub">
          従業員が登録されていません
        </Card>
      ) : (
        emp.map((e) => (
          <Card key={e.id} className="!p-4">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-lg font-bold text-primary">
                {e.name[0]}
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-app-text">
                  {e.name}{" "}
                  {e.nameKana && (
                    <span className="text-[11px] text-app-sub font-normal">
                      {e.nameKana}
                    </span>
                  )}
                </div>
                <div className="text-xs text-app-sub">
                  {e.position || e.employmentType}
                  {e.loginId && (
                    <span className="ml-2 text-app-sub">ID: {e.loginId}</span>
                  )}
                </div>
              </div>
              {e.resignDate ? (
                <Badge type="danger">退職</Badge>
              ) : (
                <Badge type="success">在籍</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-app-sub">
              <div>入社日: {e.hireDate?.slice(0, 10)}</div>
              <div>年齢: {calcAge(e.birthDate) || "—"}歳</div>
              <div>形態: {e.employmentType}</div>
              <div>
                {e.monthlySalary
                  ? "月給¥" + fmt(e.monthlySalary)
                  : e.hourlyWage
                  ? "時給¥" + fmt(e.hourlyWage)
                  : "—"}
              </div>
              <div>権限: {roleLabel(e.role)}</div>
              <div>
                {e.shiftStart && e.shiftEnd
                  ? `勤務 ${e.shiftStart}〜${e.shiftEnd}`
                  : "シフト未設定"}
              </div>
            </div>
            {canWrite && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => startEdit(e)}
                  className="px-3.5 py-1.5 rounded border border-primary text-primary text-xs font-semibold bg-transparent cursor-pointer"
                >
                  編集
                </button>
                <button
                  onClick={() => del(e.id)}
                  className="px-3.5 py-1.5 rounded border border-danger text-danger text-xs font-semibold bg-transparent cursor-pointer"
                >
                  削除
                </button>
              </div>
            )}
            {isManager && (
              <div className="mt-3">
                <button
                  onClick={() => setDetailEmp(e)}
                  className="w-full px-4 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
                >
                  詳細閲覧
                </button>
              </div>
            )}
          </Card>
        ))
      )}

      {/* 詳細確認モーダル（manager専用） */}
      {detailEmp && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[200]"
            onClick={() => setDetailEmp(null)}
          />
          <div className="fixed inset-x-4 top-[10%] bottom-[10%] bg-white rounded z-[300] shadow-lg overflow-y-auto max-w-app mx-auto">
            <div className="sticky top-0 bg-white border-b border-app-border p-4 flex items-center justify-between">
              <div className="text-sm font-bold text-app-text">{detailEmp.name} の詳細</div>
              <button
                onClick={() => setDetailEmp(null)}
                className="w-8 h-8 flex items-center justify-center rounded text-app-sub hover:bg-gray-100 border-none bg-transparent cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="text-[11px] text-app-sub bg-app-bg rounded p-2">
                給与計算・社会保険手続きに必要な最小限の情報のみ表示しています
              </div>

              {/* 基本情報（社外の顧問として必要な最小限） */}
              <div>
                <div className="text-xs font-bold text-app-sub mb-1.5">基本情報</div>
                {[
                  { l: "氏名", v: detailEmp.name },
                  { l: "雇用形態", v: detailEmp.employmentType },
                  { l: "入社日", v: detailEmp.hireDate?.slice(0, 10) || "—" },
                  { l: "退職日", v: detailEmp.resignDate ? detailEmp.resignDate.slice(0, 10) : "在籍中" },
                ].map((x) => (
                  <div key={x.l} className="flex py-1.5 border-b border-app-border last:border-0 text-sm">
                    <div className="text-xs text-app-sub w-24 shrink-0">{x.l}</div>
                    <div className="text-app-text">{x.v}</div>
                  </div>
                ))}
              </div>

              {/* 給与情報 */}
              <div>
                <div className="text-xs font-bold text-app-sub mb-1.5">給与情報</div>
                <div className="flex py-1.5 border-b border-app-border text-sm">
                  <div className="text-xs text-app-sub w-24 shrink-0">月給</div>
                  <div className="text-app-text">{detailEmp.monthlySalary ? "¥" + fmt(detailEmp.monthlySalary) : "—"}</div>
                </div>
                <div className="flex py-1.5 border-b border-app-border text-sm last:border-0">
                  <div className="text-xs text-app-sub w-24 shrink-0">時給</div>
                  <div className="text-app-text">{detailEmp.hourlyWage ? "¥" + fmt(detailEmp.hourlyWage) : "—"}</div>
                </div>
              </div>

              {/* 勤務シフト（労働時間把握用） */}
              <div>
                <div className="text-xs font-bold text-app-sub mb-1.5">固定シフト</div>
                {detailEmp.shiftStart && detailEmp.shiftEnd ? (
                  <div className="text-sm text-app-text">
                    {detailEmp.shiftStart}〜{detailEmp.shiftEnd}（休憩{detailEmp.shiftBreak || 0}分）
                  </div>
                ) : (
                  <div className="text-sm text-app-sub">シフト未設定</div>
                )}
              </div>

              {/* 社会保険加入状況 */}
              <div>
                <div className="text-xs font-bold text-app-sub mb-1.5">社会保険加入状況</div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { l: "健康保険", v: detailEmp.healthInsuranceEnrolled },
                    { l: "厚生年金", v: detailEmp.pensionEnrolled },
                    { l: "雇用保険", v: detailEmp.employmentInsuranceEnrolled },
                  ].map((x) => (
                    <div key={x.l} className="flex items-center justify-between text-sm">
                      <span className="text-app-sub">{x.l}</span>
                      {x.v ? (
                        <Badge type="success">加入</Badge>
                      ) : (
                        <Badge type="default">未加入</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ※ 住所・電話番号・生年月日・フリガナ・職種・備考は */}
              {/*    顧問社労士への開示は不要なため表示しない */}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
