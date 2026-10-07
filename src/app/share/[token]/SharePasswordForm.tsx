"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 共有ページのパスワード入力
export default function SharePasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "開けませんでした");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white rounded-[14px] border border-app-border p-8 max-w-sm mx-auto flex flex-col gap-3">
      <div className="text-base font-bold text-app-text">パスワードを入力してください</div>
      <div className="text-xs text-app-sub">このページを見るには、共有した方から伝えられたパスワードが必要です。</div>
      <input
        type="password"
        aria-label="パスワード"
        autoFocus
        className="w-full p-2.5 px-3 rounded border border-app-border text-sm bg-white outline-none"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <div className="text-sm text-danger">{error}</div>}
      <button
        type="submit"
        disabled={busy || !password}
        className="py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
      >
        {busy ? "確認中…" : "開く"}
      </button>
    </form>
  );
}
