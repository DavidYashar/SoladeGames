import type { NextConfig } from "next";

/**
 * The demo build is a static export: no API routes, no database, no wallet.
 *
 * Restricting pageExtensions to .tsx is what drops the six route handlers, which are
 * the only .ts files under app/. Without it `output: "export"` refuses to build.
 */
const demo = process.env.DEMO_STATIC === "1";

const nextConfig: NextConfig = demo
  ? {
      output: "export",
      pageExtensions: ["tsx"],
      images: { unoptimized: true },
      trailingSlash: true,
    }
  : {};

export default nextConfig;
