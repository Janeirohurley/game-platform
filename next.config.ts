import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
