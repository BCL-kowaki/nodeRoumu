// クライアントごとの色（計画・実績のカードの色分け）。決まった答えになる処理なのでテストで固定

// 白い文字が読める濃さの色。先頭ほど見分けやすい組み合わせにしてある。差し色のオレンジ・計測中の赤とは別の色にしている
export const CLIENT_PALETTE = [
  "#2F6FDB", // 青
  "#0F766E", // 青緑
  "#7E57C2", // 紫
  "#A16207", // 黄土
  "#C2185B", // 赤紫
  "#4D7C0F", // 黄緑
  "#6D4C41", // 茶
  "#5B6B8C", // 灰青
  "#0E7490", // 水色
  "#3949AB", // 藍
  "#00897B", // 緑
  "#8E24AA", // 赤紫（濃）
] as const;

// クライアントに色を割り当てる。登録した順（作成日時、同じなら ID）に色を配るので、
// 一覧の並べ替えでは色が変わらず、色の数までは同じ色が出ない
export function assignClientColors(clients: { id: string; createdAt?: string }[]): Map<string, string> {
  const sorted = [...new Map(clients.map((c) => [c.id, c])).values()].sort(
    (a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.id.localeCompare(b.id)
  );
  return new Map(sorted.map((c, i) => [c.id, CLIENT_PALETTE[i % CLIENT_PALETTE.length]]));
}

// 計画・実績がどのクライアントのものか：プロジェクトのクライアント → ルーティンのクライアント → ルーティンのプロジェクトのクライアント
export function clientIdFor(
  item: { projectId: string | null; routineId?: string | null },
  projects: { id: string; clientId: string }[],
  routines: { id: string; clientId: string | null; projectId: string | null }[]
): string | null {
  const projectClient = (id: string | null) => (id ? projects.find((p) => p.id === id)?.clientId ?? null : null);
  const fromProject = projectClient(item.projectId);
  if (fromProject) return fromProject;
  const routine = item.routineId ? routines.find((r) => r.id === item.routineId) : undefined;
  if (!routine) return null;
  return routine.clientId ?? projectClient(routine.projectId);
}
