// 共有リンクのサーバー側の共通処理
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { hashToken } from "@/lib/api-token";
import { isShareOpen } from "./note-share";

function safeDecrypt(value: string): string | null {
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

// 発行した人向けの一覧の形（リンクは復号して返す。中身・ハッシュは返さない）
export function toShareView(
  s: {
    id: string;
    notePath: string;
    encryptedTitle: string;
    encryptedToken: string;
    passwordHash: string | null;
    expiresAt: Date | null;
    revokedAt: Date | null;
    viewCount: number;
    lastViewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  origin: string,
  now: Date
) {
  return {
    id: s.id,
    notePath: s.notePath,
    title: safeDecrypt(s.encryptedTitle) ?? "（読み取れません）",
    // 暗号化の鍵を替えた後などで読めないときは、一覧全体を止めずにリンクだけ出さない
    url: (() => {
      const token = safeDecrypt(s.encryptedToken);
      return token ? `${origin}/share/${token}` : null;
    })(),
    hasPassword: !!s.passwordHash,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    open: isShareOpen(s, now),
    viewCount: s.viewCount,
    lastViewedAt: s.lastViewedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// 共有ページ用：リンクの文字列から共有を探す（無い・停止・期限切れは null）
export async function findOpenShare(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const share = await prisma.noteShare.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!share || !isShareOpen(share, new Date())) return null;
  return share;
}
