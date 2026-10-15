// 1日の計画・実績の内訳（何に何分）。クライアントごとにまとめる。決まった答えになる処理なのでテストで固定

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
