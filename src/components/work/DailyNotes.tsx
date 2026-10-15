"use client";

import { useEffect, useState } from "react";
import { ChevronDown, NotebookPen, Pencil, Wand2 } from "lucide-react";
import Card from "@/components/Card";
import NoteMarkdown from "./NoteMarkdown";
import { api, type DailyNote } from "./types";

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

// 前回からの引き継ぎ（読むだけ）
export function Handover({ note }: { note: DailyNote }) {
  return (
    <div className="rounded-lg bg-accent-light/60 border border-accent/30 px-3 py-2">
      <div className="text-[10px] font-bold text-accent-dark mb-0.5">前回（{md(note.date)}）からの引き継ぎ</div>
      <div className="text-[12px] text-app-text">
        <NoteMarkdown content={note.body} />
      </div>
    </div>
  );
}

// その日のクライアントごとのメモ（日報）。翌日以降の「引き継ぎ」になる
export function ClientDailyNote({
  clientId,
  date,
  note,
  previous,
  onSaved,
  draft,
}: {
  clientId: string;
  date: string;
  note: DailyNote | undefined;
  previous: DailyNote | undefined;
  onSaved: () => void;
  // 今日のタスク（完了・次にやること）から作るメモの下書き。空なら下書きボタンを出さない
  draft?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setText(note?.body ?? "");
    setError(null);
    setEditing(true);
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/work/daily-notes", { method: "PUT", body: JSON.stringify({ clientId, date, body: text }) });
      setEditing(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 mt-2.5">
      {previous && <Handover note={previous} />}
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            rows={3}
            maxLength={5000}
            aria-label="引き継ぎメモ"
            placeholder="今日やったこと・次にやること・相手の返事待ちなど（翌日以降の引き継ぎになります）"
            className="w-full p-2 rounded-lg border border-app-border text-[13px] text-app-text bg-white outline-none resize-y focus:border-primary"
          />
          {error && <div className="text-[11px] text-danger">{error}</div>}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold border-none cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg border border-app-border bg-white text-xs cursor-pointer whitespace-nowrap">
              やめる
            </button>
            {draft && (
              <button
                type="button"
                onClick={() => setText((cur) => (cur.trim() ? `${cur.trimEnd()}\n\n${draft}` : draft))}
                title="今日完了したタスクと、次にやること（未完了の上から3件）を書き足す"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-app-border bg-white text-xs cursor-pointer whitespace-nowrap hover:border-app-sub"
              >
                <Wand2 size={12} aria-hidden /> 今日のタスクから下書き
              </button>
            )}
          </div>
          <div className="text-[10px] text-app-sub">⌘+Enter で保存。空にして保存すると消えます</div>
        </div>
      ) : note ? (
        <div className="group relative rounded-lg border border-app-border bg-white px-3 py-2">
          <div className="text-[10px] font-bold text-app-sub mb-0.5 flex items-center gap-1">
            <NotebookPen size={11} aria-hidden /> 今日のメモ
          </div>
          <div className="text-[12px] text-app-text pr-6">
            <NoteMarkdown content={note.body} />
          </div>
          <button
            type="button"
            onClick={open}
            aria-label="今日のメモを編集"
            title="編集"
            className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded text-app-sub bg-transparent border-none cursor-pointer hover:bg-app-bg hover:text-app-text"
          >
            <Pencil size={12} aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          className="self-start flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-app-sub bg-transparent border border-dashed border-app-border cursor-pointer hover:text-app-text hover:border-app-sub"
        >
          <NotebookPen size={12} aria-hidden /> 引き継ぎメモを書く
        </button>
      )}
    </div>
  );
}

const COLLAPSED_KEY = "node-portal:handover-collapsed";

// タイムラインの上に出す「前回からの引き継ぎ」のまとめ（開閉はこの端末に覚える）
export function HandoverPanel({ previous, colors }: { previous: DailyNote[]; colors: Map<string, string> }) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true);
    } catch {
      // 保存できない環境では開いた状態で始める
    }
  }, []);
  if (previous.length === 0) return null;
  const toggle = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1");
    } catch {
      // 覚えられなくても開閉はできる
    }
  };
  return (
    <Card className="!p-0 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-transparent border-none cursor-pointer hover:bg-app-bg"
      >
        <NotebookPen size={14} className="text-accent-dark shrink-0" aria-hidden />
        <span className="text-sm font-bold text-app-text">前回からの引き継ぎ</span>
        <span className="text-[11px] text-app-sub">{previous.length}件</span>
        <ChevronDown size={14} className={`ml-auto text-app-sub transition-transform ${collapsed ? "-rotate-90" : ""}`} aria-hidden />
      </button>
      {!collapsed && (
        <ul className="list-none m-0 p-0 border-t border-app-border grid grid-cols-1 md:grid-cols-2">
          {previous.map((n) => (
            <li key={n.clientId} className="px-4 py-2.5 border-b border-app-border md:odd:border-r">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colors.get(n.clientId) ?? "#9AA6A2" }} aria-hidden />
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-app-text">{n.clientName}</span>
                <span className="text-[10px] text-app-sub tabular-nums">{md(n.date)}</span>
              </div>
              <div className="text-[12px] text-app-text pl-[18px]">
                <NoteMarkdown content={n.body} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
