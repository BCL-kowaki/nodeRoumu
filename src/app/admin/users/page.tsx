"use client";

import { useEffect, useState, useCallback } from "react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import PasswordInput from "@/components/PasswordInput";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/roles";

type AdminUser = {
  id: string;
  name: string;
  loginId: string | null;
  role: string;
  createdAt: string;
};

const inputClass =
  "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", loginId: "", password: "", role: "manager" });
  const [addMsg, setAddMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // パスワードリセット用モーダル状態
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fetchUsers = useCallback(() => {
    fetch("/api/admin-users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const doAdd = async () => {
    setAddMsg(null);
    if (!addForm.name || !addForm.loginId || !addForm.password) {
      setAddMsg({ type: "err", text: "氏名・ログインID・パスワードをすべて入力してください" });
      return;
    }
    const res = await fetch("/api/admin-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setAddMsg({ type: "err", text: data.error || "追加に失敗しました" });
      return;
    }
    setAddMsg({ type: "ok", text: "追加しました" });
    setAddForm({ name: "", loginId: "", password: "", role: "manager" });
    setShowAdd(false);
    fetchUsers();
  };

  const doReset = async () => {
    if (!resetUser) return;
    setResetMsg(null);
    if (resetPassword.length < 8 || !/[A-Za-z]/.test(resetPassword) || !/\d/.test(resetPassword)) {
      setResetMsg({ type: "err", text: "パスワードは8文字以上で英字と数字を含めてください" });
      return;
    }
    const res = await fetch(`/api/admin-users/${resetUser.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResetMsg({ type: "err", text: data.error || "リセットに失敗しました" });
      return;
    }
    setResetMsg({ type: "ok", text: `パスワードをリセットしました。新しいパスワードを対象者に伝えてください（この画面を閉じると再表示できません）。` });
  };

  const closeResetModal = () => {
    setResetUser(null);
    setResetPassword("");
    setResetMsg(null);
  };

  if (authLoading || loading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  if (user?.role !== "admin")
    return <div className="text-center text-danger py-10">この画面にアクセスする権限がありません</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="text-lg font-bold">管理ユーザー</div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-5 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
        >
          {showAdd ? "閉じる" : "+ 追加"}
        </button>
      </div>

      <div className="text-xs text-app-sub bg-app-bg rounded px-3 py-2">
        代表者・社労士のアカウントをここで管理します。誤操作防止のため削除機能はありません。
      </div>

      {/* 追加フォーム */}
      {showAdd && (
        <Card>
          <div className="text-sm font-bold text-app-text mb-3">管理ユーザー追加</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelClass}>氏名</label>
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>ログインID</label>
              <input
                type="text"
                value={addForm.loginId}
                onChange={(e) => setAddForm({ ...addForm, loginId: e.target.value })}
                className={inputClass}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelClass}>初期パスワード</label>
              <div className="text-[11px] text-app-sub mb-1">8文字以上・英字と数字を含む</div>
              <PasswordInput
                value={addForm.password}
                onChange={(v) => setAddForm({ ...addForm, password: v })}
                className={inputClass}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelClass}>ロール</label>
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                className={inputClass}
              >
                <option value="admin">代表者</option>
                <option value="manager">社労士</option>
              </select>
            </div>

            {addMsg && (
              <div
                className={`text-sm rounded p-3 text-center ${
                  addMsg.type === "ok"
                    ? "text-primary-dark bg-primary-light"
                    : "text-danger bg-danger-light"
                }`}
              >
                {addMsg.text}
              </div>
            )}

            <button
              onClick={doAdd}
              className="px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
            >
              追加する
            </button>
          </div>
        </Card>
      )}

      {/* 一覧 */}
      {users.length === 0 ? (
        <Card className="text-center !py-10 text-app-sub">
          管理ユーザーが登録されていません
        </Card>
      ) : (
        users.map((u) => (
          <Card key={u.id} className="!p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-lg font-bold text-primary">
                {u.name[0]}
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-app-text">{u.name}</div>
                <div className="text-xs text-app-sub">
                  ID: {u.loginId || "—"}
                </div>
              </div>
              <Badge type={u.role === "admin" ? "success" : "accent"}>
                {roleLabel(u.role)}
              </Badge>
            </div>
            <button
              onClick={() => setResetUser(u)}
              className="px-3.5 py-1.5 rounded border border-primary text-primary text-xs font-semibold bg-transparent cursor-pointer"
            >
              パスワードをリセット
            </button>
          </Card>
        ))
      )}

      {/* パスワードリセットモーダル */}
      {resetUser && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[200]"
            onClick={closeResetModal}
          />
          <div className="fixed inset-x-4 top-[15%] bg-white rounded z-[300] shadow-lg max-w-app mx-auto p-5">
            <div className="text-sm font-bold text-app-text mb-1">
              {resetUser.name} のパスワードをリセット
            </div>
            <div className="text-xs text-app-sub mb-3">
              新しいパスワードを設定します。設定後、対象者に新パスワードを直接お伝えください。
            </div>
            <label className={labelClass}>新しいパスワード</label>
            <PasswordInput
              value={resetPassword}
              onChange={setResetPassword}
              className={inputClass}
              autoComplete="off"
            />
            {resetMsg && (
              <div
                className={`text-sm rounded p-3 text-center mt-3 ${
                  resetMsg.type === "ok"
                    ? "text-primary-dark bg-primary-light"
                    : "text-danger bg-danger-light"
                }`}
              >
                {resetMsg.text}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={doReset}
                className="px-6 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer"
              >
                リセットする
              </button>
              <button
                onClick={closeResetModal}
                className="px-6 py-2.5 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
