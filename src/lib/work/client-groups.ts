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

// タスクの選択欄を「クライアント ／ プロジェクト」の見出しごとに分ける。
// 並びはクライアント → その中のプロジェクトの順。一覧に無いプロジェクトは「その他」、プロジェクトなしは最後
export function groupTasksForSelect<T extends { projectId: string | null }>(
  tasks: T[],
  projects: { id: string; name: string; clientId: string }[],
  clients: { id: string; name: string }[]
): { key: string; label: string; tasks: T[] }[] {
  const out: { key: string; label: string; tasks: T[] }[] = [];
  for (const c of clients) {
    for (const p of projects.filter((x) => x.clientId === c.id)) {
      const ts = tasks.filter((t) => t.projectId === p.id);
      if (ts.length) out.push({ key: p.id, label: `${c.name} ／ ${p.name}`, tasks: ts });
    }
  }
  const placed = new Set(out.map((g) => g.key));
  const other = tasks.filter((t) => t.projectId && !placed.has(t.projectId));
  if (other.length) out.push({ key: "__other__", label: "その他", tasks: other });
  const none = tasks.filter((t) => !t.projectId);
  if (none.length) out.push({ key: "__none__", label: "プロジェクトなし", tasks: none });
  return out;
}
