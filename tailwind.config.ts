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
        accent: "#FF9800",
        "app-bg": "#F5F6F8",
        "app-text": "#333333",
        "app-sub": "#888888",
        "app-border": "#E8E8E8",
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
        xl: "5px",
        "2xl": "6px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
export default config;
