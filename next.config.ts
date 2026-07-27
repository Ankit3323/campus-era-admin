import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin uses native Node modules that Next's bundler can't inline.
  // Marking it external makes the server require() it at runtime instead of
  // bundling it — without this the /api/delete-user route crashes at import
  // (a bare HTTP 500 before any handler code runs).
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
