import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `game-platform` is its own git repository, but the workspace root above
   * it also has a `package-lock.json`. Without pinning the root, Turbopack
   * walks up, ignores that lockfile (outside the git repo) and warns on
   * every boot. Pinning it to this directory keeps resolution local.
   *
   * `process.cwd()` rather than `__dirname`: `next.config.ts` is loaded
   * either as CJS or as a native ESM import depending on the Node version,
   * and `__dirname` does not exist in the ESM path.
   */
  turbopack: {
    root: process.cwd(),
  },

  /**
   * Emit `.next/standalone`: a self-contained server with only the traced
   * dependencies. The Docker runner stage copies it instead of reinstalling
   * node_modules, which is what keeps the runtime image small.
   */
  output: "standalone",

  allowedDevOrigins: [
    "10.83.223.127",
  ],
};

export default nextConfig;
