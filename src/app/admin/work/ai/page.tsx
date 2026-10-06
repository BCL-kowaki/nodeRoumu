"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import PageTitle from "@/components/PageTitle";
import { api, inputClass, labelClass } from "@/components/work/types";

type Token = {
  id: string;
  name: string;
  hint: string;
  scope: "read" | "write";
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // コピーできない環境では、表示された文字を手で選んでコピーしてもらう
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-app-sub">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 px-2 py-0.5 rounded border border-app-border bg-white text-[11px] cursor-pointer hover:bg-app-bg"
        >
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      <pre className="m-0 p-3 rounded-lg bg-primary text-white text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono">{text}</pre>
    </div>
  );
}

// AI 連携：Claude Code・Codex などから業務管理を操作するための鍵（MCP）の発行・取り消し
export default function WorkAiPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", scope: "write" as "read" | "write", expiresInDays: 90 });
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    try {
      setTokens(await api<Token[]>("/api/work/ai-tokens"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();
  }, [load]);

  const issue = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api<Token & { token: string }>("/api/work/ai-tokens", { method: "POST", body: JSON.stringify(form) });
      setIssued({ name: res.name, token: res.token });
      setForm((f) => ({ ...f, name: "" }));
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (t: Token) => {
    if (!window.confirm(`鍵「${t.name}」を取り消しますか？\nこの鍵を使っている Claude Code・Codex からは、すぐに操作できなくなります。`)) return;
    try {
      await api(`/api/work/ai-tokens/${t.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const mcpUrl = `${origin}/api/mcp`;
  const now = Date.now();

  return (
    <div className="flex flex-col gap-4">
      <PageTitle>AI 連携</PageTitle>
      <Card className="!p-4">
        <div className="text-sm text-app-text leading-relaxed">
          Claude Code や Codex から、業務管理（クライアント・プロジェクト・タスク・計画・実績・タイマー・ルーティン・Google の予定・添付資料の一覧）を
          話しかけて操作できるようにします（MCP 連携）。
        </div>
        <ul className="mt-2 mb-0 pl-5 text-xs text-app-sub leading-relaxed">
          <li>できるのは「読む」と「追加・変更」だけです。削除はこの画面（アプリ）からだけ行えます。</li>
          <li>労務（給与・出勤簿・従業員）の情報は、AI からは扱えません。</li>
          <li>タスクの状態を変えると GitHub の Issue に、計画を変えると書き出し済みの Google カレンダーの予定にも反映されます（画面で操作したときと同じ）。</li>
          <li>鍵はパスワードと同じです。人に渡したり、GitHub などに載せたりしないでください。漏れたら下の一覧から取り消してください。</li>
        </ul>
      </Card>

      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      {issued ? (
        <Card className="!p-4 border-accent">
          <div className="text-sm font-bold text-app-text mb-1">鍵「{issued.name}」を発行しました</div>
          <div className="text-xs text-danger mb-1">この鍵は今だけ表示されます。閉じると二度と表示できません（なくしたら発行し直してください）。</div>
          <div className="text-[11px] text-app-sub mb-3 leading-relaxed">
            下のコマンドを実行すると、鍵はターミナルの履歴と Claude Code・Codex の設定ファイルにそのまま残ります。
            設定ファイル（~/.zshrc など）を GitHub などに公開している場合は、公開しない別のファイルに書いてください。
          </div>
          <div className="flex flex-col gap-3">
            <CopyBlock label="鍵" text={issued.token} />
            <CopyBlock
              label="Claude Code に登録（ターミナルで1回実行）"
              text={`claude mcp add --transport http --scope user node-portal ${mcpUrl} --header "Authorization: Bearer ${issued.token}"`}
            />
            <CopyBlock
              label="Codex に登録（~/.codex/config.toml に追記）"
              text={`[mcp_servers.node-portal]\nurl = "${mcpUrl}"\nbearer_token_env_var = "NODE_PORTAL_TOKEN"`}
            />
            <CopyBlock label="Codex 用：鍵を環境変数に（~/.zshrc などに追記）" text={`export NODE_PORTAL_TOKEN="${issued.token}"`} />
          </div>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="mt-3 w-full py-2.5 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer"
          >
            控えたので閉じる
          </button>
        </Card>
      ) : (
        <Card className="!p-4">
          <div className="text-sm font-bold text-app-text mb-3">鍵を発行する</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelClass} htmlFor="token-name">名前（どこで使う鍵か）</label>
              <input
                id="token-name"
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例: Claude Code（MacBook）"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass} htmlFor="token-scope">できること</label>
                <select
                  id="token-scope"
                  className={inputClass}
                  value={form.scope}
                  onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as "read" | "write" }))}
                >
                  <option value="write">読む＋追加・変更</option>
                  <option value="read">読むだけ</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="token-expiry">有効期限</label>
                <select
                  id="token-expiry"
                  className={inputClass}
                  value={form.expiresInDays}
                  onChange={(e) => setForm((f) => ({ ...f, expiresInDays: Number(e.target.value) }))}
                >
                  <option value={30}>30日</option>
                  <option value={90}>90日</option>
                  <option value={365}>365日</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={issue}
              disabled={saving}
              className="py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {saving ? "発行中…" : "鍵を発行する"}
            </button>
          </div>
        </Card>
      )}

      <Card className="!p-4">
        <div className="text-xs font-bold text-app-sub mb-1">発行した鍵</div>
        {loading ? (
          <div className="text-xs text-app-sub py-2">読み込み中...</div>
        ) : tokens.length === 0 ? (
          <div className="text-xs text-app-sub py-2">まだありません</div>
        ) : (
          tokens.map((t) => {
            const expired = new Date(t.expiresAt).getTime() <= now;
            const active = !t.revokedAt && !expired;
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-app-border last:border-b-0">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-sm font-semibold ${active ? "text-app-text" : "text-app-sub line-through"}`}>{t.name}</span>
                    <Badge type="default">{t.scope === "write" ? "読む＋追加・変更" : "読むだけ"}</Badge>
                    {t.revokedAt ? <Badge type="danger">取り消し済み</Badge> : expired ? <Badge type="danger">期限切れ</Badge> : null}
                  </div>
                  <div className="text-[11px] text-app-sub mt-0.5">
                    {t.hint}… ・ 期限 {fmt(t.expiresAt)} ・ 最終利用 {fmt(t.lastUsedAt)}
                  </div>
                </div>
                {active && (
                  <button
                    type="button"
                    onClick={() => revoke(t)}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-app-border text-xs text-danger bg-white cursor-pointer hover:bg-danger-light"
                  >
                    取り消す
                  </button>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
