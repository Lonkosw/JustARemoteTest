import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The sync e2e tests build a second copy pointed at the local test backend.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
