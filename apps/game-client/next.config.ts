import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@era-uma-vez/shared-types",
    "@era-uma-vez/game-logic",
    "@era-uma-vez/ui-fantasy",
  ],
};

export default nextConfig;
