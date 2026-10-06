// ルーティンのクライアントの決め方（決まった答えになる処理なのでテストで固定）
// - プロジェクトがあるときは、そのプロジェクトのクライアントにそろえる（違うものが送られたらエラー）
// - プロジェクトがないときは、送られたクライアント（送られなければ保存済みのまま）
export function routineClientFor(input: {
  sentClientId: string | null | undefined; // undefined は「送られていない」
  projectClientId: string | null; // 保存後のプロジェクトのクライアント（プロジェクトなしは null）
  currentClientId: string | null;
}): { ok: true; clientId: string | null } | { ok: false; error: string } {
  const { sentClientId, projectClientId, currentClientId } = input;
  if (projectClientId) {
    if (sentClientId && sentClientId !== projectClientId) {
      return { ok: false, error: "プロジェクトとクライアントが合っていません" };
    }
    return { ok: true, clientId: projectClientId };
  }
  return { ok: true, clientId: sentClientId !== undefined ? sentClientId : currentClientId };
}
