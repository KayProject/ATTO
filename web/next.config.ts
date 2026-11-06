import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The workspace packages ship raw TypeScript.
  transpilePackages: ["@atto/shared", "@atto/title-search", "@atto/follower", "@atto/bot"],
};

export default nextConfig;
