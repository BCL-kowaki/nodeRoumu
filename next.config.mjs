/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack: (config) => {
    // pdfjs-distが要求するcanvasモジュールを無視
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
