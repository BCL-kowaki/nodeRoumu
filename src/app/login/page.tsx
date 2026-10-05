"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import PasswordInput from "@/components/PasswordInput";
import BrandLogo from "@/components/BrandLogo";

// Google ログイン（代表者用）から戻ってきたときのエラー表示
const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Googleログインは現在利用できません。ログインIDとパスワードでログインしてください。",
  google_canceled: "Googleログインがキャンセルされました。",
  google_not_allowed: "このGoogleアカウントではログインできません（代表者のアカウントのみ利用できます）。",
  google_failed: "Googleログインに失敗しました。もう一度お試しください。",
};

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && GOOGLE_ERRORS[code]) setError(GOOGLE_ERRORS[code]);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password, remember }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "ログインに失敗しました");
      return;
    }

    if (data.role === "admin" || data.role === "manager") {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <BrandLogo size="lg" />
        </div>
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-app-sub mb-1">
                ログインID
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="w-full p-3 rounded border border-app-border text-sm bg-white outline-none"
                placeholder="例: n0001"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-app-sub mb-1">
                パスワード
              </label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                className="w-full p-3 rounded border border-app-border text-sm bg-white outline-none"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="text-sm text-danger bg-danger-light rounded p-3 text-center">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded bg-primary text-white text-base font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
            <label className="flex items-center gap-2 justify-center cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-xs text-app-sub">30日間ログイン状態を保持する</span>
            </label>
          </form>
          {/* 代表者専用。社労士・従業員は上のID・パスワードでログインする */}
          <div className="mt-5 pt-4 border-t border-app-border">
            <a
              href="/api/auth/google/start"
              className="block w-full py-3 rounded border border-app-border text-sm font-semibold text-app-text bg-white text-center no-underline"
            >
              Googleでログイン（代表者）
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
