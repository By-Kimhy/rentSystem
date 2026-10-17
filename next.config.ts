import type { NextConfig } from "next";

// The Express API (server/). Pages call it server-side; the browser reaches it through the
// /api rewrite below, so photos and any client-side calls stay on this site's origin.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Property and room forms upload several photos (up to 5 MB each) through Server Actions.
    serverActions: { bodySizeLimit: "30mb" },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
