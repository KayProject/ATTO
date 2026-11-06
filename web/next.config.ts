import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The shared package ships raw TypeScript.
  transpilePackages: ["@atto/shared"],
};

export default nextConfig;
