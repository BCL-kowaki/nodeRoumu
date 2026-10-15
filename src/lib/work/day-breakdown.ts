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
