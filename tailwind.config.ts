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
        // 配色は「黒・白・オレンジ・薄いグレー」。主役は黒、オレンジは差し色に限って使う
        primary: "#1A1A1A",
        "primary-light": "#F0F0F0",
        "primary-dark": "#0D0D0D",
        // 業務管理も同じ黒系（以前は青で労務と分けていた）
        work: "#1A1A1A",
        "work-light": "#EDEDED",
        "work-dark": "#0D0D0D",
        accent: "#FF9800",
        "accent-light": "#FFF3E0",
        // 白地の小さな文字に使うときの濃いオレンジ（コントラスト 4.5:1 以上）
        "accent-dark": "#B35C00",
        // 背景は薄いグレー。補助の文字色は白地で読みやすいコントラスト（4.5:1 以上）にする
        "app-bg": "#F4F4F4",
        "app-text": "#1A1A1A",
        "app-sub": "#666666",
        "app-border": "#E5E5E5",
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
