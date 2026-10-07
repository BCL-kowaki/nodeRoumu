"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, FilePlus, FileText, Folder, FolderPlus, Pencil, RefreshCw } from "lucide-react";
import type { TreeNode } from "@/lib/work/obsidian-tree";
import NoteMarkdown from "./NoteMarkdown";
import { api, inputClass } from "./types";
import RichTextEditor from "@/components/RichTextEditor";

type Listing = { folder: string; projectNote: string | null; tree: TreeNode[] };
type OpenNote = { path: string; content: string; sha: string };

const noteName = (path: string) => path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");

// プロジェクトの Obsidian ノート：専用フォルダの中のフォルダ・ノートの一覧と、ノートの表示・編集・新規作成
export default function NoteBrowser({ projectId, projectNotePath }: { projectId: string; projectNotePath: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [open, setOpen] = useState<OpenNote | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<null | { kind: "note" | "folder"; parent: string; name: string; template: "blank" | "minutes" }>(null);
  const [log, setLog] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/work/projects/${projectId}/notes`;

  const loadList = useCallback(async () => {
    setListing(await api<Listing>(base));
  }, [base]);

  const openNote = useCallback(
    async (path: string) => {
      setError(null);
      setEditing(false);
      try {
        setOpen(await api<OpenNote>(`${base}?path=${encodeURIComponent(path)}`));
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [base]
  );

  useEffect(() => {
    loadList().catch((e) => setError((e as Error).message));
    openNote(projectNotePath);
  }, [loadList, openNote, projectNotePath]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (!open) return;
      const r = await api<{ sha: string }>(base, { method: "PUT", body: JSON.stringify({ path: open.path, content: draft, sha: open.sha }) });
      setOpen({ ...open, content: draft, sha: r.sha });
      setEditing(false);
    });

  const create = () =>
    run(async () => {
      if (!creating) return;
      const r = await api<{ path: string }>(base, {
        method: "POST",
        body: JSON.stringify({ action: creating.kind, parent: creating.parent, name: creating.name, template: creating.template }),
      });
      setCreating(null);
      await loadList();
      if (creating.kind === "note") await openNote(r.path);
    });

  const appendLog = () =>
    run(async () => {
      await api(`/api/work/projects/${projectId}/note`, { method: "POST", body: JSON.stringify({ action: "log", text: log }) });
      setLog("");
      await openNote(projectNotePath);
    });

  // フォルダの選択肢（作る場所）：専用フォルダと、その中のフォルダ
  const folderOptions: { path: string; label: string }[] = [];
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes)
      if (n.type === "folder") {
        folderOptions.push({ path: n.path, label: `${"　".repeat(depth)}${n.name}` });
        walk(n.children, depth + 1);
      }
  };
  if (listing) {
    folderOptions.push({ path: listing.folder, label: "（プロジェクトのフォルダ直下）" });
    walk(listing.tree, 1);
  }

  const renderTree = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((n) =>
      n.type === "folder" ? (
        <div key={n.path}>
          <button
            type="button"
            onClick={() => setCollapsed((s) => (s.has(n.path) ? new Set([...s].filter((x) => x !== n.path)) : new Set([...s, n.path])))}
            className="w-full flex items-center gap-1 py-1 pr-2 rounded text-left text-[13px] font-semibold text-app-text bg-transparent border-none cursor-pointer hover:bg-app-bg"
            style={{ paddingLeft: 6 + depth * 12 }}
            aria-expanded={!collapsed.has(n.path)}
          >
            <ChevronDown size={12} className={`shrink-0 text-app-sub transition-transform ${collapsed.has(n.path) ? "-rotate-90" : ""}`} aria-hidden />
            <Folder size={13} className="shrink-0 text-accent" aria-hidden />
            <span className="truncate">{n.name}</span>
          </button>
          {!collapsed.has(n.path) && renderTree(n.children, depth + 1)}
          {!collapsed.has(n.path) && n.children.length === 0 && (
            <div className="text-[11px] text-app-sub py-0.5" style={{ paddingLeft: 30 + depth * 12 }}>
              （空）
            </div>
          )}
        </div>
      ) : (
        <button
          key={n.path}
          type="button"
          onClick={() => openNote(n.path)}
          className={`w-full flex items-center gap-1.5 py-1 pr-2 rounded text-left text-[13px] border-none cursor-pointer ${
            open?.path === n.path ? "bg-primary-light font-bold text-app-text" : "bg-transparent text-app-text hover:bg-app-bg"
          }`}
          style={{ paddingLeft: 18 + depth * 12 }}
        >
          <FileText size={13} className="shrink-0 text-app-sub" aria-hidden />
          <span className="truncate">{n.name}</span>
        </button>
      )
    );

  const smallBtn =
    "flex items-center gap-1 px-2 py-1 rounded-lg border border-app-border text-[11px] bg-white cursor-pointer hover:bg-app-bg disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="text-sm text-danger bg-danger-light rounded p-3">{error}</div>}

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-4 flex flex-col gap-3">
        {/* フォルダとノートの一覧 */}
        <div className="lg:border-r lg:border-app-border lg:pr-3 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              type="button"
              className={smallBtn}
              disabled={!listing}
              onClick={() => setCreating({ kind: "note", parent: listing!.folder, name: "", template: "minutes" })}
            >
              <FilePlus size={12} aria-hidden /> ノート
            </button>
            <button
              type="button"
              className={smallBtn}
              disabled={!listing}
              onClick={() => setCreating({ kind: "folder", parent: listing!.folder, name: "", template: "blank" })}
            >
              <FolderPlus size={12} aria-hidden /> フォルダ
            </button>
            <button type="button" className={smallBtn} onClick={() => run(loadList)} aria-label="一覧を読み直す" title="一覧を読み直す">
              <RefreshCw size={12} aria-hidden />
            </button>
          </div>

          {creating && (
            <div className="mb-2 p-2 rounded-lg bg-app-bg flex flex-col gap-1.5">
              <div className="text-[11px] font-bold text-app-sub">{creating.kind === "note" ? "ノートを作る" : "フォルダを作る"}</div>
              <select
                aria-label="作る場所"
                className={`${inputClass} !py-1.5 text-xs`}
                value={creating.parent}
                onChange={(e) => setCreating({ ...creating, parent: e.target.value })}
              >
                {folderOptions.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.label}
                  </option>
                ))}
              </select>
              {creating.kind === "note" && (
                <select
                  aria-label="ひな形"
                  className={`${inputClass} !py-1.5 text-xs`}
                  value={creating.template}
                  onChange={(e) => setCreating({ ...creating, template: e.target.value as "blank" | "minutes" })}
                >
                  <option value="minutes">議事録（日付が先頭に付きます）</option>
                  <option value="blank">空のノート</option>
                </select>
              )}
              <input
                aria-label="名前"
                className={`${inputClass} !py-1.5 text-xs`}
                value={creating.name}
                onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                placeholder={creating.kind === "folder" ? "例: 議事録" : creating.template === "minutes" ? "例: 定例ミーティング" : "例: 要件メモ"}
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={create}
                  disabled={busy || !creating.name.trim()}
                  className="flex-1 py-1.5 rounded bg-primary text-white text-xs font-bold border-none cursor-pointer disabled:opacity-50"
                >
                  作る
                </button>
                <button type="button" onClick={() => setCreating(null)} className="px-3 py-1.5 rounded bg-white border border-app-border text-xs cursor-pointer">
                  やめる
                </button>
              </div>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => openNote(projectNotePath)}
              className={`w-full flex items-center gap-1.5 py-1 px-1.5 rounded text-left text-[13px] border-none cursor-pointer ${
                open?.path === projectNotePath ? "bg-primary-light font-bold text-app-text" : "bg-transparent text-app-text hover:bg-app-bg"
              }`}
            >
              <FileText size={13} className="shrink-0 text-accent" aria-hidden />
              <span className="truncate">{noteName(projectNotePath)}</span>
            </button>
            {listing ? (
              listing.tree.length > 0 ? (
                renderTree(listing.tree, 0)
              ) : (
                <div className="text-[11px] text-app-sub py-1 px-1.5">「＋ ノート」「＋ フォルダ」で、議事録などを作れます</div>
              )
            ) : (
              <div className="text-[11px] text-app-sub py-1 px-1.5">読み込み中...</div>
            )}
          </div>
        </div>

        {/* 開いているノート */}
        <div className="min-w-0">
          {!open ? (
            <div className="text-xs text-app-sub">読み込み中...</div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-[11px] text-app-sub break-all mr-auto min-w-0">{open.path}</div>
                {!editing && (
                  <button
                    type="button"
                    className={`${smallBtn} shrink-0 whitespace-nowrap`}
                    onClick={() => {
                      setDraft(open.content);
                      setEditing(true);
                    }}
                  >
                    <Pencil size={12} aria-hidden /> 編集
                  </button>
                )}
              </div>
              {editing ? (
                <div className="flex flex-col gap-2">
                  <RichTextEditor ariaLabel="ノートの本文" value={draft} onChange={setDraft} minHeight={420} mono />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={save}
                      disabled={busy}
                      className="flex-1 py-2 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50"
                    >
                      {busy ? "保存中…" : "保存する"}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded bg-white border border-app-border text-sm cursor-pointer">
                      やめる
                    </button>
                  </div>
                  <div className="text-[11px] text-app-sub">
                    Obsidian 側で先に同じノートが更新されていた場合は、上書きせずに止めます（読み直してから編集してください）。
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-app-border bg-white px-4 py-3 max-h-[70vh] overflow-y-auto">
                  <NoteMarkdown content={open.content} onOpenNote={openNote} />
                </div>
              )}

              {/* プロジェクトのノートを開いているときだけ、ログの1行追記 */}
              {!editing && open.path === projectNotePath && (
                <div className="flex gap-2 mt-3">
                  <input
                    aria-label="ノートのログに追記"
                    className={inputClass}
                    value={log}
                    onChange={(e) => setLog(e.target.value)}
                    placeholder="「ログ」に1行追記"
                    maxLength={500}
                  />
                  <button
                    type="button"
                    onClick={appendLog}
                    disabled={busy || !log.trim()}
                    className="px-4 rounded bg-primary text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    追記
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="text-[11px] text-app-sub">アプリで書いた内容が Obsidian に届くまで、同期の間隔（10分以内）かかることがあります。</div>
    </div>
  );
}
