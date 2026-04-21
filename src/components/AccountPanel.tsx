"use client";

import { useState } from "react";
import Card from "@/components/Card";
import { useAuth } from "@/lib/auth-context";
import { roleLabel } from "@/lib/roles";

const inputClass =
  "w-full p-2.5 px-3.5 rounded border border-app-border text-sm text-app-text bg-white outline-none";
const labelClass = "block text-xs font-semibold text-app-sub mb-1";

export default function AccountPanel() {
  const { user, loading: authLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword) {
      setMessage({ type: "err", text: "現在のパスワードと新しいパスワードを入力してください" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "err", text: "新しいパスワード（確認）が一致しません" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: "err", text: "新しいパスワードは8文字以上で入力してください" });
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setMessage({ type: "err", text: "新しいパスワードは英字と数字の両方を含めてください" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "変更に失敗しました" });
      } else {
        setMessage({ type: "ok", text: "パスワードを変更しました" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage({ type: "err", text: "通信エラーが発生しました" });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading)
    return <div className="text-center text-app-sub py-10">読み込み中...</div>;

  if (!user)
    return <div className="text-center text-app-sub py-10">ログインが必要です</div>;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">アカウント</div>

      {/* プロフィール情報 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">ログイン情報</div>
        {[
          { l: "氏名", v: user.name },
          { l: "ログインID", v: user.loginId },
          { l: "ロール", v: roleLabel(user.role) },
        ].map((x) => (
          <div key={x.l} className="flex py-2 border-b border-app-border last:border-0">
            <div className="text-xs text-app-sub w-24 shrink-0">{x.l}</div>
            <div className="text-sm text-app-text font-semibold">{x.v}</div>
          </div>
        ))}
      </Card>

      {/* パスワード変更 */}
      <Card>
        <div className="text-sm font-bold text-app-text mb-3">パスワード変更</div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>現在のパスワード</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelClass}>新しいパスワード</label>
            <div className="text-[11px] text-app-sub mb-1">8文字以上・英字と数字を含む</div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelClass}>新しいパスワード（確認）</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>

          {message && (
            <div
              className={`text-sm rounded p-3 text-center ${
                message.type === "ok"
                  ? "text-primary-dark bg-primary-light"
                  : "text-danger bg-danger-light"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
          >
            {submitting ? "変更中..." : "パスワードを変更する"}
          </button>
        </form>
      </Card>
    </div>
  );
}
