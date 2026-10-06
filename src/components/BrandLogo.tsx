// アプリのロゴ（node のマーク画像 + 「portal」の文字）
// 正式なロゴ画像ができたら、ここを差し替えるだけで全画面に反映される
export default function BrandLogo({ size = "md" }: { size?: "md" | "lg" }) {
  const imgClass = size === "lg" ? "h-14" : "h-10";
  const textClass = size === "lg" ? "text-[26px]" : "text-[18px]";
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="node-portal">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* 配色（黒・白・オレンジ・グレー）に合わせ、緑のロゴ画像を黒で表示する（画像ファイル自体はそのまま） */}
      <img src="/logo.png" alt="" className={`${imgClass} w-auto object-contain brightness-0`} />
      <span className={`${textClass} font-bold text-[#666666] tracking-wide leading-none`}>
        portal
      </span>
    </span>
  );
}
