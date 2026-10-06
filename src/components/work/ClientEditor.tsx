"use client";

import { useState } from "react";
import { api, inputClass, labelClass, type Client } from "./types";

// クライアントの作成・名前の変更ウィンドウ。client が null なら新規作成
export default function ClientEditor({
  client,
  onClose,
  onSaved,
  onDeleted,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved: (saved: Client) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const body = JSON.stringify({ name });
      const saved = client
        ? await api<Client>(`/api/work/clients/${client.id}`, { method: "PUT", body })
        : await api<Client>("/api/work/clients", { method: "POST", body });
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!client) return;
    if (!window.confirm(`クライアント「${client.name}」を削除しますか？`)) return;
    setSaving(true);
    try {
      await api(`/api/work/clients/${client.id}`, { method: "DELETE" });
      onDeleted?.();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[200]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={client ? "クライアントの編集" : "クライアントの追加"}
        className="fixed inset-x-4 top-[15%] bg-white rounded z-[300] shadow-lg max-w-app mx-auto p-5"
      >
        <div className="text-sm font-bold text-app-text mb-3">{client ? "クライアントの編集" : "クライアントの追加"}</div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div>
            <label className={labelClass} htmlFor="client-name">クライアント名</label>
            <input id="client-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          {error && <div className="text-sm text-danger bg-danger-light rounded p-3 text-center">{error}</div>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存する"}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded bg-white text-app-text text-sm border border-app-border cursor-pointer">
              閉じる
            </button>
          </div>
          {client && onDeleted && (
            <button type="button" onClick={remove} disabled={saving} className="text-xs text-danger bg-transparent border-none cursor-pointer self-start p-0">
              このクライアントを削除
            </button>
          )}
        </form>
      </div>
    </>
  );
}
