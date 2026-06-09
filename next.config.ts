import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Sample team flags render via the bundled `flag-icons` SVG set (offline, no remote images).
  // No remote image hosts are required for the MVP.
  async redirects() {
    // The predictions hub moved /me -> /predictions (spec §5). Keep old links alive.
    return [
      { source: "/me", destination: "/predictions", permanent: true },
      { source: "/me/:path*", destination: "/predictions/:path*", permanent: true },
      // Browsing pages folded into the Tournament hub tabs (spec §6). The
      // match-detail route (/fixtures/:id) is intentionally left alone.
      { source: "/fixtures", destination: "/tournament?tab=matches", permanent: true },
      { source: "/groups", destination: "/tournament?tab=groups", permanent: true },
      { source: "/bracket", destination: "/tournament?tab=r32", permanent: true },
    ];
  },
};

export default nextConfig;
