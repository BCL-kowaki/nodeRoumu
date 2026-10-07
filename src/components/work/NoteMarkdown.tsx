"use client";

import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkWikiLinks } from "@/lib/work/obsidian-tree";

// Obsidian のノート（Markdown）を、見出し・箇条書き・表・チェックボックス・リンクの形で表示する。
// ノートの中の HTML はそのまま文字として扱い、画面の部品にはしない（ノートに書かれたスクリプトが動かないように）。
// [[ほかのノート]] のリンクは、押すとアプリの中で開く（onOpenNote）
export default function NoteMarkdown({ content, onOpenNote }: { content: string; onOpenNote?: (path: string) => void }) {
  return (
    <div className="note-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith("obsidian:") ? url : defaultUrlTransform(url))}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("obsidian:")) {
              const path = decodeURIComponent(href.slice("obsidian:".length));
              return onOpenNote ? (
                <button type="button" onClick={() => onOpenNote(path)} className="note-md-wikilink">
                  {children}
                </button>
              ) : (
                <span className="note-md-wikilink">{children}</span>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {linkWikiLinks(content)}
      </ReactMarkdown>
    </div>
  );
}
