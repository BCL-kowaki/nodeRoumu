"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Lock, RefreshCw } from "lucide-react";
import { api } from "./types";

type Share = {
  id: string;
  url: string | null; // 暗号化の鍵を替えた後などで読めないときは null
  hasPassword: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  open: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ノートの共有リンク（社外の方に見せる読み取り専用ページ）の発行・一覧・更新・停止
export default function NoteSharePanel({ projectId, notePath, onClose }: { projectId: string; notePath: string; onClose: () => void }) {
  const [shares, setShares] = useState<Share[] | null>(null);
  const [days, setDays] = useState<number | null>(30);
  const [usePassword, setUsePassword] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const base = `/api/work/projects/${projectId}/shares`;

  const load = useCallback(async () => {
    setShares(await api<Share[]>(`${base}?path=${encodeURIComponent(notePath)}`));
  }, [base, notePath]);

  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const issue = () =>
    run(async () => {
      await api(base, {
        method: "POST",
        body: JSON.stringify({ path: notePath, expiresInDays: days, password: usePassword ? password : null }),
      });
      setPassword("");
    });

  const copy = async (s: Share) => {
    try {
      if (!s.url) return;
      await navigator.clipboard.writeText(s.url);
      setCopied(s.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // コピーできない環境では、リンクを手で選んでコピーしてもらう
    }
  };

  const active = (shares ?? []).filter((s) => s.open);
  const ended = (shares ?? []).filter((s) => !s.open);
  const small = "flex items-center gap-1 px-2 py-1 rounded-lg border border-app-border text-[11px] bg-white cursor-pointer hover:bg-app-bg disabled:opacity-50";

  return (
    <div className="rounded-lg border border-accent bg-accent-light/40 p-3 mb-3 flex flex-col gap-3">
      <div className="flex items-center">
        <div className="text-sm font-bold text-app-text mr-auto">このノートを社外に共有</div>
        <button type="button" onClick={onClose} className="text-[11px] text-app-sub bg-transparent border-none cursor-pointer">
          閉じる
        </button>
      </div>
      <div className="text-[11px] text-app-sub leading-relaxed">
        リンクを知っている人が、ログインなしで読める読み取り専用のページを作ります。内容は<b>発行した時点</b>のものです（あとでノートを直しても、「内容を更新」を押すまで先方には見えません）。社内向けのメモが入っていないか確かめてから発行してください。
      </div>

      {error && <div className="text-xs text-danger bg-danger-light rounded p-2">{error}</div>}

      {active.map((s) => (
        <div key={s.id} className="rounded-lg bg-white border border-app-border p-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input readOnly value={s.url ?? "（リンクを読み取れません。停止して発行し直してください）"} aria-label="共有リンク" className="flex-1 min-w-0 px-2 py-1 rounded border border-app-border text-[11px] bg-app-bg" onFocus={(e) => e.target.select()} />
            <button type="button" className={small} disabled={!s.url} onClick={() => copy(s)}>
              {copied === s.id ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
              {copied === s.id ? "コピーしました" : "コピー"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-app-sub">
            {s.hasPassword && (
              <span className="flex items-center gap-0.5">
                <Lock size={11} aria-hidden /> パスワードあり
              </span>
            )}
            <span>期限 {s.expiresAt ? fmt(s.expiresAt) : "なし"}</span>
            <span>閲覧 {s.viewCount}回（最終 {fmt(s.lastViewedAt)}）</span>
            <span>内容 {fmt(s.updatedAt)} 時点</span>
          </div>
          <div className="flex gap-1.5">
            <button type="button" className={small} disabled={busy} onClick={() => run(() => api(`/api/work/shares/${s.id}`, { method: "PUT", body: JSON.stringify({ action: "refresh" }) }).then(() => undefined))}>
              <RefreshCw size={11} aria-hidden /> 内容を更新（今のノートの内容にする）
            </button>
            <button
              type="button"
              className={`${small} text-danger`}
              disabled={busy}
              onClick={() => {
                if (window.confirm("この共有を停止しますか？ 先方はすぐに見られなくなります。"))
                  run(() => api(`/api/work/shares/${s.id}`, { method: "PUT", body: JSON.stringify({ action: "revoke" }) }).then(() => undefined));
              }}
            >
              共有を停止
            </button>
          </div>
        </div>
      ))}

      <div className="rounded-lg bg-white border border-app-border p-2.5 flex flex-col gap-2">
        <div className="text-xs font-bold text-app-text">{active.length ? "別のリンクを発行" : "共有リンクを発行"}</div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            有効期限
            <select
              aria-label="有効期限"
              className="px-2 py-1 rounded border border-app-border bg-white text-xs"
              value={days === null ? "none" : String(days)}
              onChange={(e) => setDays(e.target.value === "none" ? null : Number(e.target.value))}
            >
              <option value="7">7日</option>
              <option value="30">30日</option>
              <option value="90">90日</option>
              <option value="none">無期限</option>
            </select>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="accent-primary" />
            パスワードを付ける
          </label>
          {usePassword && (
            <input
              aria-label="共有ページのパスワード"
              className="px-2 py-1 rounded border border-app-border text-xs bg-white w-40"
              placeholder="8文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </div>
        <button
          type="button"
          onClick={issue}
          disabled={busy || (usePassword && password.trim().length < 8)}
          className="py-2 rounded bg-primary text-white text-xs font-bold border-none cursor-pointer disabled:opacity-50"
        >
          {busy ? "発行中…" : "共有リンクを発行する"}
        </button>
        {usePassword && <div className="text-[10px] text-app-sub">パスワードは、リンクとは別の方法（電話・別のメッセージなど）で先方に伝えてください。</div>}
      </div>

      {ended.length > 0 && <div className="text-[10px] text-app-sub">停止・期限切れの共有：{ended.length}件</div>}
    </div>
  );
}
