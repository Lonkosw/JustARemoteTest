import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // The sync e2e tests build a second copy pointed at the local test backend.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // STATIC_EXPORT=1 builds plain files into out/ for static hosts such as
  // GitHub Pages. Every screen renders on the client, so nothing is lost.
  // Folders with index.html, which static hosts serve without redirects.
  ...(process.env.STATIC_EXPORT === "1" ? { output: "export" as const, trailingSlash: true } : {}),
  basePath,
};

export default nextConfig;
