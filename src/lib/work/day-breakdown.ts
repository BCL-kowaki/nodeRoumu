// 1日・1週の計画・実績の内訳（何に何分）。クライアントごとにまとめる。決まった答えになる処理なのでテストで固定
import { dayOfWeek } from "@/lib/attendance-status";
import { addDays } from "@/lib/date-jst";

export type BreakdownRow = { title: string; minutes: number; clientId: string | null; projectId: string | null };
export type BreakdownItem = { title: string; projectId: string | null; minutes: number; count: number };
export type BreakdownGroup = { clientId: string | null; totalMin: number; items: BreakdownItem[] };

// 同じクライアント・プロジェクト・題名はまとめる。クライアントもその中の項目も時間の長い順。
// 同じ時間ならクライアントは一覧の並び順。一覧に無いクライアントとクライアントなしは最後の「クライアントなし」
export function breakdownByClient(rows: BreakdownRow[], clientOrder: string[]): { totalMin: number; groups: BreakdownGroup[] } {
  const order = new Map(clientOrder.map((id, i) => [id, i]));
  const groups = new Map<string | null, BreakdownGroup>();
  for (const r of rows) {
    if (r.minutes <= 0) continue;
    const clientId = r.clientId && order.has(r.clientId) ? r.clientId : null;
    const g = groups.get(clientId) ?? { clientId, totalMin: 0, items: [] };
    g.totalMin += r.minutes;
    const item = g.items.find((i) => i.title === r.title && i.projectId === r.projectId);
    if (item) {
      item.minutes += r.minutes;
      item.count += 1;
    } else g.items.push({ title: r.title, projectId: r.projectId, minutes: r.minutes, count: 1 });
    groups.set(clientId, g);
  }
  const list = [...groups.values()];
  for (const g of list) g.items.sort((a, b) => b.minutes - a.minutes || a.title.localeCompare(b.title, "ja"));
  list.sort((a, b) => {
    if (a.clientId === null) return 1;
    if (b.clientId === null) return -1;
    return b.totalMin - a.totalMin || order.get(a.clientId)! - order.get(b.clientId)!;
  });
  return { totalMin: list.reduce((n, g) => n + g.totalMin, 0), groups: list };
}

export type ClientDiff = { clientId: string | null; plannedMin: number; actualMin: number; diffMin: number };

// クライアントごとの計画と実績の差（差＝実績−計画。プラスは計画より多くかかった）。
// 並びは計画・実績の多いほうの時間が長い順、同じなら一覧の並び順。クライアントなしは最後
export function compareByClient(planned: BreakdownGroup[], actual: BreakdownGroup[], clientOrder: string[]): ClientDiff[] {
  const order = new Map(clientOrder.map((id, i) => [id, i]));
  const rows = new Map<string | null, ClientDiff>();
  const row = (clientId: string | null) => {
    const r = rows.get(clientId) ?? { clientId, plannedMin: 0, actualMin: 0, diffMin: 0 };
    rows.set(clientId, r);
    return r;
  };
  for (const g of planned) row(g.clientId).plannedMin += g.totalMin;
  for (const g of actual) row(g.clientId).actualMin += g.totalMin;
  const list = [...rows.values()].map((r) => ({ ...r, diffMin: r.actualMin - r.plannedMin }));
  const size = (r: ClientDiff) => Math.max(r.plannedMin, r.actualMin);
  return list.sort((a, b) => {
    if (a.clientId === null) return 1;
    if (b.clientId === null) return -1;
    return size(b) - size(a) || (order.get(a.clientId) ?? Infinity) - (order.get(b.clientId) ?? Infinity);
  });
}

// その日を含む週（月曜〜日曜）
export function weekRange(date: string): { from: string; to: string } {
  const from = addDays(date, -((dayOfWeek(date) + 6) % 7));
  return { from, to: addDays(from, 6) };
}

type DayTotals = { plannedMin: number; actualMin: number; attendanceMin: number | null; unrecordedMin: number | null };

// 期間の合計。計画・実績は足し、出勤簿・未記録は記録のある日だけ足す（1日も無ければ null）
export function sumDaySummaries(days: DayTotals[]): DayTotals {
  const sumOrNull = (xs: (number | null)[]) => {
    const vs = xs.filter((x): x is number => x !== null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
  };
  return {
    plannedMin: days.reduce((n, d) => n + d.plannedMin, 0),
    actualMin: days.reduce((n, d) => n + d.actualMin, 0),
    attendanceMin: sumOrNull(days.map((d) => d.attendanceMin)),
    unrecordedMin: sumOrNull(days.map((d) => d.unrecordedMin)),
  };
}

// その日を含む月（1日〜末日）
export function monthRange(date: string): { from: string; to: string } {
  const from = `${date.slice(0, 7)}-01`;
  return { from, to: addDays(shiftMonth(from, 1), -1) };
}

// n か月前後の月の1日
export function shiftMonth(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
}

// 月のカレンダーのマス（月曜はじまりの週ごとに7マス。月の前後は null）
export function monthGrid(date: string): (string | null)[][] {
  const { from, to } = monthRange(date);
  const cells: (string | null)[] = Array((dayOfWeek(from) + 6) % 7).fill(null);
  for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

// 日ごと・クライアントごとの分数（カレンダーのマスに色の帯を出すため）。時間の長いクライアント順、0分は除く
export function minutesByDayClient(
  rows: { date: string; clientId: string | null; minutes: number }[]
): Map<string, { clientId: string | null; minutes: number }[]> {
  const byDay = new Map<string, Map<string | null, number>>();
  for (const r of rows) {
    if (r.minutes <= 0) continue;
    const day = byDay.get(r.date) ?? new Map<string | null, number>();
    day.set(r.clientId, (day.get(r.clientId) ?? 0) + r.minutes);
    byDay.set(r.date, day);
  }
  return new Map(
    [...byDay].map(([date, m]) => [date, [...m].map(([clientId, minutes]) => ({ clientId, minutes })).sort((a, b) => b.minutes - a.minutes)])
  );
}
