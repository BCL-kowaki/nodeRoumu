"use client";

import Card from "@/components/Card";

// FAQ（チャットボット）画面 — Coming Soon
// 将来的に Google Drive から会社書類を取り込み、AI チャットボットで
// 就業規則・社内ルール等の質問に答える機能を追加予定
export default function FaqPage() {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold">FAQ</div>

      <Card className="text-center !py-16">
        <div className="text-5xl mb-4">💬</div>
        <div className="text-xl font-extrabold text-primary mb-2">Coming Soon</div>
      </Card>
    </div>
  );
}
