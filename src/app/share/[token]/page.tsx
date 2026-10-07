import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { verifyShareAccess } from "@/lib/session-token";
import NoteMarkdown from "@/components/work/NoteMarkdown";
import { findOpenShare } from "@/lib/work/share-server";
import SharePasswordForm from "./SharePasswordForm";

export const dynamic = "force-dynamic";

// 共有ページは検索エンジンに載せない。題名も出さない（リンクが知られても中身の手がかりにならないように）
export const metadata: Metadata = {
  title: "共有ドキュメント",
  // 社内ポータルの説明文・アプリ名を引き継がない（チャットのリンクプレビューにも出るため）
  description: "共有されたドキュメントです。",
  manifest: null,
  appleWebApp: { title: "共有ドキュメント" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Params = { params: Promise<{ token: string }> };

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app-bg">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">{children}</div>
    </div>
  );
}

// 社外の方に見せる、ノートの読み取り専用ページ（ログイン不要）
export default async function SharedNotePage({ params }: Params) {
  const { token } = await params;
  const share = await findOpenShare(token);
  if (!share) {
    return (
      <Frame>
        <div className="bg-white rounded-[14px] border border-app-border p-8 text-center">
          <div className="text-base font-bold text-app-text">このリンクは無効です</div>
          <div className="text-sm text-app-sub mt-2">公開が終了したか、期限が切れた可能性があります。共有した方にお問い合わせください。</div>
        </div>
      </Frame>
    );
  }

  if (share.passwordHash) {
    const ok = await verifyShareAccess((await cookies()).get(`share_${share.id}`)?.value, share.id);
    if (!ok) {
      return (
        <Frame>
          <SharePasswordForm token={token} />
        </Frame>
      );
    }
  }

  // 見られた回数・最後に見られた日時（発行した人が確認できるように）
  await prisma.noteShare.update({ where: { id: share.id }, data: { viewCount: { increment: 1 }, lastViewedAt: new Date() } });

  let content: string;
  try {
    content = decrypt(share.encryptedContent);
  } catch {
    content = "（内容を読み出せませんでした）";
  }
  return (
    <Frame>
      <article className="bg-white rounded-[14px] border border-app-border px-5 py-6 sm:px-10 sm:py-10">
        <NoteMarkdown content={content} />
      </article>
      <div className="text-center text-[11px] text-app-sub mt-4">
        {share.expiresAt
          ? `このページは ${share.expiresAt.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })} まで公開されています`
          : "共有ドキュメント"}
      </div>
    </Frame>
  );
}
