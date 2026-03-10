import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set up next-intl config alias manually (avoids withNextIntl plugin
  // which causes 404 on login page in Next.js 16 + Turbopack).
  // This replicates what createNextIntlPlugin does internally.
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./lib/i18n/request.ts",
    },
  },
  // Static file uploads served from /uploads
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
