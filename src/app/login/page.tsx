"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginId, password }),
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="node"
            className="mx-auto h-14 w-auto object-contain"
          />
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </form>
        </Card>
      </div>
    </div>
  );
}
