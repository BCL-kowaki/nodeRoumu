// ページの見出し（左に差し色の縦バーを置く）
export default function PageTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={`flex items-center gap-2.5 m-0 text-lg lg:text-2xl font-extrabold tracking-tight text-app-text ${className}`}>
      <span className="inline-block w-[5px] h-5 lg:h-6 rounded-sm bg-accent shrink-0" aria-hidden />
      {children}
    </h1>
  );
}
