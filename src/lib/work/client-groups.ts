// プロジェクトをクライアントごとにまとめる（選択欄の見出し分けに使う。決まった答えになる処理なのでテストで固定）
export function groupProjectsByClient<P extends { clientId: string }>(
  projects: P[],
  clients: { id: string; name: string }[]
): { clientId: string | null; label: string; projects: P[] }[] {
  const groups: { clientId: string | null; label: string; projects: P[] }[] = [];
  for (const c of clients) {
    const ps = projects.filter((p) => p.clientId === c.id);
    if (ps.length > 0) groups.push({ clientId: c.id, label: c.name, projects: ps });
  }
  const known = new Set(clients.map((c) => c.id));
  const rest = projects.filter((p) => !known.has(p.clientId));
  if (rest.length > 0) groups.push({ clientId: null, label: "その他", projects: rest });
  return groups;
}
