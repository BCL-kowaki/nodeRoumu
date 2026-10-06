// 1日のタイムライン（ドラッグで計画を置く画面）の計算（決まった答えになる処理なのでテストで固定）
// 時刻は「その日の 0:00 からの分数」で扱う。表示範囲は 0:00〜24:00、操作は15分単位。

export const SNAP_MINUTES = 15;
export const DAY_END = 24 * 60;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const snap = (min: number) => Math.round(min / SNAP_MINUTES) * SNAP_MINUTES;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

// タイムラインの上端からの位置（px）→ 開始時刻（分）。長さ duration が 24:00 に収まる範囲に寄せる
export function yToStart(y: number, pxPerMin: number, duration: number): number {
  return clamp(snap(y / pxPerMin), 0, Math.max(0, DAY_END - duration));
}

// 置いた計画を deltaY（px）だけ動かしたときの開始時刻
export function moveStart(start: number, deltaY: number, pxPerMin: number, duration: number): number {
  return clamp(snap(start + deltaY / pxPerMin), 0, Math.max(0, DAY_END - duration));
}

// 下の端を deltaY（px）だけ引いたときの長さ（15分以上、24:00 まで）
export function resizeDuration(start: number, duration: number, deltaY: number, pxPerMin: number): number {
  return clamp(snap(duration + deltaY / pxPerMin), SNAP_MINUTES, Math.max(SNAP_MINUTES, DAY_END - start));
}

export type Interval = { id: string; start: number; end: number };

// 時間が重なる計画を横に並べるための列の割り当て。
// 重なりのまとまり（どこかでつながっているもの）ごとに列数をそろえる
export function layoutColumns(items: Interval[]): Record<string, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: Record<string, { col: number; cols: number }> = {};
  let group: Interval[] = [];
  let colEnds: number[] = [];
  let groupEnd = -1;

  const flush = () => {
    for (const it of group) result[it.id].cols = colEnds.length;
    group = [];
    colEnds = [];
  };

  for (const it of sorted) {
    if (group.length > 0 && it.start >= groupEnd) flush();
    // 空いている（前の計画が終わった）一番左の列を使う
    let col = colEnds.findIndex((end) => end <= it.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.end);
    } else colEnds[col] = it.end;
    result[it.id] = { col, cols: 1 };
    group.push(it);
    groupEnd = Math.max(groupEnd, it.end);
  }
  flush();
  return result;
}

// タイマーの実績を、指定日（日本時間）の時間帯 [start, end)（分）に直す。
// 計測中は現在時刻まで（最低1分）。その日にかからない・開始時刻がない（手入力）ものは null
export function entryInterval(
  date: string,
  startedAt: string | null,
  endedAt: string | null,
  now: Date
): { start: number; end: number } | null {
  if (!startedAt) return null;
  const dayStart = Date.parse(`${date}T00:00:00Z`) - JST_OFFSET_MS; // その日の日本時間 0:00（UTC のミリ秒）
  const s = (Date.parse(startedAt) - dayStart) / 60000;
  const e = ((endedAt ? Date.parse(endedAt) : now.getTime()) - dayStart) / 60000;
  const start = Math.max(0, Math.floor(s));
  // 計測中は、画面の「今」が開始より古くても（開始した直後など）最低1分の長さで表示する
  const end = Math.min(DAY_END, endedAt ? Math.ceil(e) : Math.max(Math.ceil(e), start + 1));
  if (end <= 0 || start >= DAY_END || end <= start) return null;
  return { start, end };
}
