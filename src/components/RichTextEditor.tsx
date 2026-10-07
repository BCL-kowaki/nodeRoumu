"use client";

import { useRef, useState } from "react";
import { Bold, Link2, List, ListChecks } from "lucide-react";
import NoteMarkdown from "@/components/work/NoteMarkdown";
import { insertLink, isLinkableUrl, prefixLines, wrapSelection } from "@/lib/text-edit";

const inputClass = "w-full p-2.5 px-3 rounded border border-app-border text-sm text-app-text bg-white outline-none";

// 説明・メモ欄の入力（Markdown）。リンク・太字・箇条書き・チェックのボタンと、仕上がりのプレビュー付き。
// 文字を選んだ状態で URL を貼り付けると、その文字のテキストリンクになる
export default function RichTextEditor({
  id,
  value,
  onChange,
  placeholder,
  minHeight = 120,
  ariaLabel,
  mono = false,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
  mono?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [linkForm, setLinkForm] = useState<null | { start: number; end: number; url: string }>(null);

  // 変更後にカーソル（選択範囲）を戻す
  const apply = (next: string, selStart: number, selEnd = selStart) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };
  const sel = () => ({ start: ref.current?.selectionStart ?? value.length, end: ref.current?.selectionEnd ?? value.length });

  const bold = () => {
    const { start, end } = sel();
    const r = wrapSelection(value, start, end, "**");
    apply(r.value, r.selStart, r.selEnd);
  };
  const prefix = (p: string) => {
    const { start, end } = sel();
    const r = prefixLines(value, start, end, p);
    apply(r.value, Math.min(r.value.length, end + (r.value.length - value.length)));
  };
  const insertLinkNow = () => {
    if (!linkForm || !isLinkableUrl(linkForm.url)) return;
    const r = insertLink(value, linkForm.start, linkForm.end, linkForm.url);
    setLinkForm(null);
    apply(r.value, r.cursor);
  };

  const btn =
    "flex items-center gap-1 px-2 py-1 rounded text-[11px] text-app-text bg-transparent border-none cursor-pointer hover:bg-app-bg disabled:opacity-40";

  return (
    <div className="rounded border border-app-border bg-white">
      <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-app-border">
        <button type="button" className={btn} disabled={preview} onClick={() => setLinkForm({ ...sel(), url: "" })} title="選んだ文字をリンクにする">
          <Link2 size={13} aria-hidden /> リンク
        </button>
        <button type="button" className={btn} disabled={preview} onClick={bold} title="太字">
          <Bold size={13} aria-hidden /> 太字
        </button>
        <button type="button" className={btn} disabled={preview} onClick={() => prefix("- ")} title="箇条書き">
          <List size={13} aria-hidden /> 箇条書き
        </button>
        <button type="button" className={btn} disabled={preview} onClick={() => prefix("- [ ] ")} title="チェックボックス">
          <ListChecks size={13} aria-hidden /> チェック
        </button>
        <div className="ml-auto flex rounded-md bg-app-bg p-0.5">
          {[
            { v: false, label: "書く" },
            { v: true, label: "プレビュー" },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setPreview(t.v)}
              aria-pressed={preview === t.v}
              className={`px-2 py-0.5 rounded text-[11px] border-none cursor-pointer ${preview === t.v ? "bg-white font-bold text-app-text shadow-sm" : "bg-transparent text-app-sub"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {linkForm && !preview && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-app-border bg-app-bg">
          <span className="text-[11px] text-app-sub shrink-0">
            {linkForm.end > linkForm.start ? `「${value.slice(linkForm.start, linkForm.end).slice(0, 20)}」を` : ""}リンク先
          </span>
          <input
            autoFocus
            aria-label="リンク先の URL"
            className="flex-1 min-w-0 px-2 py-1 rounded border border-app-border text-xs bg-white outline-none"
            placeholder="https://…"
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                insertLinkNow();
              }
              if (e.key === "Escape") setLinkForm(null);
            }}
          />
          <button
            type="button"
            onClick={insertLinkNow}
            disabled={!isLinkableUrl(linkForm.url)}
            className="px-2.5 py-1 rounded bg-primary text-white text-[11px] font-bold border-none cursor-pointer disabled:opacity-40"
          >
            入れる
          </button>
          <button type="button" onClick={() => setLinkForm(null)} className="px-2 py-1 rounded bg-white border border-app-border text-[11px] cursor-pointer">
            やめる
          </button>
        </div>
      )}

      {preview ? (
        <div className="px-3 py-2.5 overflow-y-auto" style={{ minHeight }}>
          {value.trim() ? <NoteMarkdown content={value} /> : <div className="text-xs text-app-sub">（まだ何も書かれていません）</div>}
        </div>
      ) : (
        <textarea
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          className={`${inputClass} !border-none !rounded-none block resize-y ${mono ? "font-mono text-[13px]" : ""}`}
          style={{ minHeight }}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            // 文字を選んだ状態で URL を貼り付けたら、その文字のテキストリンクにする
            const text = e.clipboardData.getData("text");
            const { start, end } = sel();
            if (end > start && isLinkableUrl(text)) {
              e.preventDefault();
              const r = insertLink(value, start, end, text);
              apply(r.value, r.cursor);
            }
          }}
        />
      )}
      <div className="px-2 py-1 border-t border-app-border text-[10px] text-app-sub">
        文字を選んで URL を貼り付けると、その文字のリンクになります（書き方: [表示する文字](URL)）
      </div>
    </div>
  );
}
