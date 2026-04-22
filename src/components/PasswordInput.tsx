"use client";

import { useState } from "react";

// パスワード入力欄（目アイコンで表示/非表示切替）
// 既存の <input type="password"> の代替として使う

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
};

export default function PasswordInput({
  value,
  onChange,
  className = "",
  placeholder,
  autoComplete,
  disabled,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${className} pr-10`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-app-sub hover:text-app-text cursor-pointer bg-transparent border-none p-0"
      >
        {visible ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
