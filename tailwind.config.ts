import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#21977f",
        "primary-light": "#e6f5f2",
        "primary-dark": "#1a7a66",
        // 業務管理の帳簿の色（労務＝primary の緑と見分ける）
        work: "#3b5b8c",
        "work-light": "#eaf0f8",
        "work-dark": "#2c4670",
        accent: "#FF9800",
        // 背景はわずかに緑みのあるグレー。補助の文字色は白地で読みやすいコントラスト（4.5:1 以上）にする
        "app-bg": "#F4F6F5",
        "app-text": "#1F2A27",
        "app-sub": "#66726E",
        "app-border": "#E2E8E5",
        danger: "#E53935",
        "danger-light": "#FFF0F0",
      },
      fontFamily: {
        sans: ["'Hiragino Sans'", "'Noto Sans JP'", "-apple-system", "sans-serif"],
      },
      maxWidth: {
        app: "600px",
      },
      borderRadius: {
        DEFAULT: "3px",
        sm: "2px",
        md: "3px",
        lg: "4px",
        xl: "8px",
        "2xl": "12px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
export default config;
