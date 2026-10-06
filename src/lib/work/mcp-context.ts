// AI 連携（MCP）からの呼び出しの「誰として動くか」を、その処理の間だけ持ち運ぶ。
// この情報は /api/mcp の中で鍵を確かめたあとにだけ設定される。
// 外から業務管理の API を直接呼んでも、ここは空なので鍵では通れない（ログインが必要）。
// 注意: requireWorkspace を通る処理の中で、モジュール全体で共有するもの（使い回す Promise・setTimeout など）を
// 初めて作ると、そこにこの文脈が残ってしまう。そうした共有の仕組みを足すときは、この文脈の外で作ること。
import { AsyncLocalStorage } from "async_hooks";
import type { TokenScope } from "@/lib/api-token";

export type McpContext = { ownerId: string; scope: TokenScope };

const storage = new AsyncLocalStorage<McpContext>();

export function runAsMcp<T>(ctx: McpContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function currentMcpContext(): McpContext | undefined {
  return storage.getStore();
}
