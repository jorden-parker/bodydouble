import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@vscode/tree-sitter-wasm", "shiki"],
  agentRules: false,
  turbopack: { root: path.join(__dirname, "../..") },
  redirects: async () => [
    { source: "/dependabot", destination: "/?bots=dependabot", permanent: false },
    { source: "/smartling", destination: "/?bots=smartling", permanent: false },
  ],
};

export default nextConfig;
