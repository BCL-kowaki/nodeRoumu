/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // ノートの共有ページ（社外の方が見る）は、保存・検索エンジンへの掲載・参照元の送信をさせない
  async headers() {
    return [
      {
        source: "/share/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          // 外部の画像などを読み込ませない（閲覧者の情報が外部に渡らないように）。Next の初期化スクリプトのため inline は許可
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    // pdfjs-distが要求するcanvasモジュールを無視
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
