// 説明・メモ欄の編集ボタン（テキストリンク・太字・箇条書き）の文字列操作（決まった答えになる処理なのでテストで固定）
// 書式は Markdown（Obsidian と同じ書き方）で保存する

export function isLinkableUrl(text: string): boolean {
  return /^https?:\/\/\S+$/.test(text.trim());
}

// 選んだ範囲（start〜end）を [表示名](URL) にする。何も選んでいなければ URL を表示名にする
export function insertLink(value: string, start: number, end: number, url: string): { value: string; cursor: number } {
  const selected = value.slice(start, end);
  const label = (selected || url).replace(/[[\]]/g, "").replace(/\s*\n\s*/g, " ").trim() || url;
  const link = `[${label}](${url.trim()})`;
  return { value: value.slice(0, start) + link + value.slice(end), cursor: start + link.length };
}

// 選んだ文字を記号（** など）で囲む。すでに囲まれていれば外す
export function wrapSelection(value: string, start: number, end: number, mark: string): { value: string; selStart: number; selEnd: number } {
  const before = value.slice(Math.max(0, start - mark.length), start);
  const after = value.slice(end, end + mark.length);
  if (before === mark && after === mark) {
    return {
      value: value.slice(0, start - mark.length) + value.slice(start, end) + value.slice(end + mark.length),
      selStart: start - mark.length,
      selEnd: end - mark.length,
    };
  }
  return {
    value: value.slice(0, start) + mark + value.slice(start, end) + mark + value.slice(end),
    selStart: start + mark.length,
    selEnd: end + mark.length,
  };
}

// 選んだ行（カーソルだけならその行）の先頭に印（"- " など）を付ける。空行には付けない。
// すべての行に付いていれば外す
export function prefixLines(value: string, start: number, end: number, prefix: string): { value: string } {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", Math.max(end - (end > start && value[end - 1] === "\n" ? 1 : 0), start));
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const target = lines.filter((l) => l.trim() !== "");
  const allHave = target.length > 0 && target.every((l) => l.startsWith(prefix));
  const next = lines.map((l) => (l.trim() === "" ? l : allHave ? l.slice(prefix.length) : prefix + l)).join("\n");
  return { value: value.slice(0, lineStart) + next + value.slice(lineEnd) };
}
