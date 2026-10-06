"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import { api, inputClass, type NoteInfo, type ObsidianStatus } from "./types";

// プロジェクトに紐づく Obsidian ノートの表示・作成・ログ追記
// ノートの本文は書式なしの文字のまま表示する（Markdown を画面の部品に変換すると、
// ノートに含まれるスクリプトが動く危険があるため）
export default function ProjectNote({ projectId, onLinked }: { projectId: string; onLinked?: () => void }) {
  const [status, setStatus] = useState<ObsidianStatus | null>(null);
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [notes, setNotes] = useState<{ path: string; size: number }[] | null>(null);
  const [pick, setPick] = useState("");
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<ObsidianStatus>("/api/work/obsidian/status");
      setStatus(s);
      if (s.configured && !s.error) setNote(await api<NoteInfo>(`/api/work/projects/${projectId}/note`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onLinked?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const loadNotes = async () => {
    setError(null);
    try {
      setNotes(await api<{ path: string; size: number }[]>("/api/work/obsidian/notes"));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const post = (body: object) =>
    api(`/api/work/projects/${projectId}/note`, { method: "POST", body: JSON.stringify(body) });

  if (!status) return null;

  return (
    <Card className="!p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-bold text-app-sub">Obsidian ノート</div>
        {note?.path && (
          <button
            onClick={() => run(() => api(`/api/work/projects/${projectId}/note`, { method: "DELETE" }))}
            disabled={busy}
            className="text-[11px] text-app-sub bg-transparent border-none cursor-pointer p-0"
          >
            紐づけを外す
          </button>
        )}
      </div>

      {!status.configured ? (
        <div className="text-xs text-app-sub leading-relaxed">
          Obsidian 連携は未設定です。Vercel の環境変数 <code>OBSIDIAN_GITHUB_TOKEN</code> と <code>OBSIDIAN_REPO</code> を登録すると使えます。
        </div>
      ) : status.error ? (
        <div className="text-sm text-danger">{status.error}</div>
      ) : (
        <>
          {error && <div className="text-sm text-danger bg-danger-light rounded p-3 mb-2">{error}</div>}

          {!note?.path ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs text-app-sub">このプロジェクトに紐づくノートはまだありません</div>
              <button
                onClick={() => run(() => post({ action: "create" }))}
                disabled={busy}
                className="py-2 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
              >
                ノートを新しく作る
              </button>
              <div className="text-[11px] text-app-sub">または、既存のノートに紐づける</div>
              {notes === null ? (
                <button onClick={loadNotes} className="py-2 rounded border border-primary text-primary text-sm bg-white cursor-pointer">
                  ノートの一覧を読み込む
                </button>
              ) : (
                <div className="flex gap-2">
                  <select aria-label="紐づけるノート" className={inputClass} value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">（選んでください）</option>
                    {notes.map((n) => (
                      <option key={n.path} value={n.path}>{n.path}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => run(() => api(`/api/work/projects/${projectId}/note`, { method: "PUT", body: JSON.stringify({ path: pick }) }))}
                    disabled={busy || !pick}
                    className="px-4 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    紐づける
                  </button>
                </div>
              )}
            </div>
          ) : note.missing ? (
            <div className="text-sm text-danger">
              紐づいているノート（{note.path}）が見つかりません。Obsidian 側で移動・削除された可能性があります。紐づけを外して、選び直してください。
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[11px] text-app-sub break-all">{note.path}</div>
              <pre
                className={`text-xs text-app-text bg-app-bg rounded p-3 whitespace-pre-wrap break-words overflow-y-auto font-sans ${open ? "max-h-[70vh]" : "max-h-48"}`}
              >
                {note.content}
              </pre>
              <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-primary bg-transparent border-none cursor-pointer self-start p-0">
                {open ? "折りたたむ" : "全体を表示"}
              </button>
              <div className="flex gap-2">
                <input
                  aria-label="ノートのログに追記"
                  className={inputClass}
                  value={log}
                  onChange={(e) => setLog(e.target.value)}
                  placeholder="ノートの「ログ」に1行追記"
                  maxLength={500}
                />
                <button
                  onClick={() => run(async () => { await post({ action: "log", text: log }); setLog(""); })}
                  disabled={busy || !log.trim()}
                  className="px-4 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50 shrink-0"
                >
                  追記
                </button>
              </div>
              <div className="text-[11px] text-app-sub">
                追記は Obsidian に反映されるまで、同期の間隔（10分以内）かかることがあります。本文の編集は Obsidian で行ってください。
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
