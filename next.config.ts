import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allowlist of known, high-volume, stable image hosts that Next is allowed to
    // optimize. Arbitrary feed/publisher hosts are not listed and are rendered with
    // `unoptimized` at the call site (see src/lib/imageHosts.ts — keep in sync).
    remotePatterns: [
      { protocol: "https", hostname: "**.guim.co.uk" },
      { protocol: "https", hostname: "**.redd.it" },
      { protocol: "https", hostname: "media.defense.gov" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
      { protocol: "https", hostname: "**.ytimg.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
