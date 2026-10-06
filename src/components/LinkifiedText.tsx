import { splitLinks } from "@/lib/linkify";

// 文章の中の URL（http/https）をリンクにして表示する。リンクは別のタブで開く
export default function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((s, i) =>
        s.type === "link" ? (
          <a
            key={i}
            href={s.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-dark underline underline-offset-2 break-all hover:text-app-text"
          >
            {s.value}
          </a>
        ) : (
          <span key={i}>{s.value}</span>
        )
      )}
    </>
  );
}
