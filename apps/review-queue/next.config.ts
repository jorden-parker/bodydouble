import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@vscode/tree-sitter-wasm", "shiki"],
  agentRules: false,
  turbopack: { root: path.join(__dirname, "../..") },
};

export default nextConfig;
