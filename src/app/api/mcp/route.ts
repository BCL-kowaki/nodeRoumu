import { NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { prisma } from "@/lib/prisma";
import { hashToken, isTokenUsable, parseBearer, type TokenScope } from "@/lib/api-token";
import { canUseWorkspace } from "@/lib/permissions";
import { runAsMcp } from "@/lib/work/mcp-context";
import { buildMcpServer } from "@/lib/work/mcp-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 最終利用日時の更新は、この間隔より空いたときだけ（毎回書き込まない）
const LAST_USED_INTERVAL_MS = 5 * 60 * 1000;

function unauthorized() {
  return NextResponse.json(
    { error: "AI 連携用の鍵が無効です（期限切れ・取り消し済み・入力ミスの可能性があります）" },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="node-portal"' } }
  );
}

// AI 連携（MCP）の入口。Claude Code・Codex などから「Authorization: Bearer npk_...」で呼ばれる。
// 鍵を確かめたら、その鍵の持ち主（代表者）として、業務管理の道具だけを使えるようにする。
async function handle(req: Request): Promise<Response> {
  const token = parseBearer(req.headers.get("authorization"));
  if (!token) return unauthorized();

  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { owner: { select: { role: true, loginId: true } } },
  });
  // 鍵が有効でも、持ち主が代表者でなくなった・ログインできなくなった場合は使えない
  if (!row || !isTokenUsable(row, new Date()) || !row.owner.loginId || !canUseWorkspace(row.owner.role)) {
    return unauthorized();
  }
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_INTERVAL_MS) {
    await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }

  const ctx = { ownerId: row.ownerId, scope: row.scope as TokenScope, attendance: row.attendance, tokenId: row.id, tokenName: row.name };
  return runAsMcp(ctx, async () => {
    // 追加・変更の操作は、いつ・どの鍵で・どの道具を使ったかを記録する（鍵そのもの・入力内容は出さない）
    const server = buildMcpServer(ctx, (tool) =>
      console.log(`[mcp] write tool=${tool} token=${row.id} name=${JSON.stringify(row.name)}`)
    );
    // 1回の呼び出しごとに作り直す（状態を持たない方式。Vercel のように毎回別のサーバーで動いても問題ない）
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      return await transport.handleRequest(req);
    } finally {
      await server.close().catch(() => undefined);
    }
  });
}

export { handle as GET, handle as POST, handle as DELETE };
