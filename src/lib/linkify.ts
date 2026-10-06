// 文章の中の URL をリンクにするための分割（決まった答えになる処理なのでテストで固定）
// - 対象は http:// と https:// だけ（javascript: などは文字のまま）
// - URL は半角の記号・英数字の並びとし、日本語・空白で区切る。文末の句読点や閉じかっこは含めない

export type Segment = { type: "text" | "link"; value: string };

const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g;
const TRAILING = /[.,;:!?)\]'`]+$/;

export function splitLinks(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const trail = url.match(TRAILING)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    // 「(」が中にある URL（Wikipedia など）は、対応する「)」を残す
    if (trail.startsWith(")") && url.includes("(") && !url.includes(")")) url += ")";
    const start = m.index ?? 0;
    if (url.length <= "https://".length) continue;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    out.push({ type: "link", value: url });
    last = start + url.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out.length ? out : [{ type: "text", value: text }];
}

export function extractUrls(text: string): string[] {
  return [...new Set(splitLinks(text).filter((s) => s.type === "link").map((s) => s.value))];
}
