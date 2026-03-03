/** @type {import('next').NextConfig} */

// Only proxy to API when this header is present (avoids rewriting page navigation for /bugs, /features, etc.)
const API_REWRITE_HAS = [{ type: "header", key: "X-Ideahome-Api", value: "1" }];

const REWRITE_ROUTE_DEFS = [
  { base: "issues" },
  { base: "organizations" },
  { base: "projects" },
  { base: "users" },
  { base: "uploads", includeRoot: false },
  { base: "tests", apiOnly: true },
  { base: "auth" },
  { base: "todos" },
  { base: "ideas", apiOnly: true },
  { base: "bugs", apiOnly: true },
  { base: "features", apiOnly: true },
  { base: "expenses", apiOnly: true },
  { base: "plaid", apiOnly: true },
  { base: "code", apiOnly: true },
];

function buildRewrites(targetBase) {
  const rewrites = [];
  for (const def of REWRITE_ROUTE_DEFS) {
    const includeRoot = def.includeRoot !== false;
    const has = def.apiOnly ? { has: API_REWRITE_HAS } : {};
    if (includeRoot) {
      rewrites.push({
        source: `/${def.base}`,
        destination: `${targetBase}/${def.base}`,
        ...has,
      });
    }
    rewrites.push({
      source: `/${def.base}/:path*`,
      destination: `${targetBase}/${def.base}/:path*`,
      ...has,
    });
  }
  return rewrites;
}

const nextConfig = {
  async rewrites() {
    const useBuiltinApi = process.env.USE_BUILTIN_API === "true";
    if (useBuiltinApi) {
      return buildRewrites("/api");
    }
    const backend = process.env.BACKEND_URL || "http://localhost:3001";
    return buildRewrites(backend);
  },
  transpilePackages: ["backend", "@ideahome/shared"],
  experimental: {
    serverComponentsExternalPackages: ["backend"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("backend", "backend/serverless");
    }
    return config;
  },
};

module.exports = nextConfig;
