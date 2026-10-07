"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Pencil } from "lucide-react";
import Card from "@/components/Card";
import RichTextEditor from "@/components/RichTextEditor";
import NoteMarkdown from "./NoteMarkdown";
import { api } from "./types";

// クライアントのメモ（アカウント情報など）。中身は最初は隠し、「表示」を押したときだけ読み込む
export default function ClientMemo({ clientId, hasMemo, onChanged }: { clientId: string; hasMemo: boolean; onChanged: () => void }) {
  const [memo, setMemo] = useState<string | null>(null); // 読み込んだ中身（未読み込みは null）
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // クライアントを切り替えたら、隠した状態に戻す（前のクライアントの中身を残さない）
  useEffect(() => {
    setMemo(null);
    setShown(false);
    setEditing(false);
    setError(null);
  }, [clientId]);

  const fetchMemo = async () => {
    const r = await api<{ memo: string | null }>(`/api/work/clients/${clientId}/memo`);
    setMemo(r.memo ?? "");
    return r.memo ?? "";
  };

  const show = async () => {
    setError(null);
    setBusy(true);
    try {
      if (memo === null) await fetchMemo();
      setShown(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const edit = async () => {
    setError(null);
    setBusy(true);
    try {
      setDraft(memo ?? (hasMemo ? await fetchMemo() : ""));
      setEditing(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/work/clients/${clientId}/memo`, { method: "PUT", body: JSON.stringify({ memo: draft }) });
      setMemo(draft.trim() ? draft : "");
      setEditing(false);
      setShown(!!draft.trim());
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const btn = "flex items-center gap-1 px-2.5 py-1 rounded-lg border border-app-border text-xs bg-white cursor-pointer hover:bg-app-bg disabled:opacity-50";

  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2">
        <Lock size={14} className="text-app-sub shrink-0" aria-hidden />
        <div className="text-sm font-bold text-app-text mr-auto">メモ（アカウント情報など）</div>
        {!editing && hasMemo && (
          <button type="button" onClick={shown ? () => setShown(false) : show} disabled={busy} className={btn}>
            {shown ? <EyeOff size={12} aria-hidden /> : <Eye size={12} aria-hidden />}
            {shown ? "隠す" : "表示"}
          </button>
        )}
        {!editing && (
          <button type="button" onClick={edit} disabled={busy} className={btn}>
            <Pencil size={12} aria-hidden />
            {hasMemo ? "編集" : "書く"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder={"例:\n[管理画面](https://example.com/admin)\nID: ○○○\n担当: ○○さん"}
            minHeight={160}
            ariaLabel="クライアントのメモ"
            mono
          />
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={busy} className="flex-1 py-2 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50">
              {busy ? "保存中…" : "保存する"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer">
              やめる
            </button>
          </div>
        </div>
      ) : hasMemo ? (
        shown && memo !== null ? (
          <div className="mt-2 bg-app-bg rounded p-3">
            <NoteMarkdown content={memo} />
          </div>
        ) : (
          <div className="mt-1 text-xs text-app-sub">メモがあります。「表示」を押すと見られます</div>
        )
      ) : (
        <div className="mt-1 text-xs text-app-sub">まだありません。ログイン先やアカウント、担当者などを書いておけます</div>
      )}
      {error && <div className="mt-2 text-xs text-danger bg-danger-light rounded p-2">{error}</div>}
      <div className="mt-2 text-[10px] text-app-sub">
        暗号化して保存され、AI 連携からは読めません。パスワードは、できればパスワード管理アプリに保存してください。
      </div>
    </Card>
  );
}
