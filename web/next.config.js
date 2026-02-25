/** @type {import('next').NextConfig} */

// Only proxy to API when this header is present (avoids rewriting page navigation for /bugs, /features, etc.)
const API_REWRITE_HAS = [{ type: "header", key: "X-Ideahome-Api", value: "1" }];

const nextConfig = {
  async rewrites() {
    const useBuiltinApi = process.env.USE_BUILTIN_API === "true";
    if (useBuiltinApi) {
      return [
        { source: "/issues", destination: "/api/issues" },
        { source: "/issues/:path*", destination: "/api/issues/:path*" },
        { source: "/organizations", destination: "/api/organizations" },
        {
          source: "/organizations/:path*",
          destination: "/api/organizations/:path*",
        },
        { source: "/projects", destination: "/api/projects" },
        { source: "/projects/:path*", destination: "/api/projects/:path*" },
        { source: "/users", destination: "/api/users" },
        { source: "/users/:path*", destination: "/api/users/:path*" },
        { source: "/uploads/:path*", destination: "/api/uploads/:path*" },
        { source: "/tests", destination: "/api/tests", has: API_REWRITE_HAS },
        {
          source: "/tests/:path*",
          destination: "/api/tests/:path*",
          has: API_REWRITE_HAS,
        },
        { source: "/auth", destination: "/api/auth" },
        { source: "/auth/:path*", destination: "/api/auth/:path*" },
        { source: "/todos", destination: "/api/todos" },
        { source: "/todos/:path*", destination: "/api/todos/:path*" },
        { source: "/ideas", destination: "/api/ideas", has: API_REWRITE_HAS },
        {
          source: "/ideas/:path*",
          destination: "/api/ideas/:path*",
          has: API_REWRITE_HAS,
        },
        { source: "/bugs", destination: "/api/bugs", has: API_REWRITE_HAS },
        {
          source: "/bugs/:path*",
          destination: "/api/bugs/:path*",
          has: API_REWRITE_HAS,
        },
        {
          source: "/features",
          destination: "/api/features",
          has: API_REWRITE_HAS,
        },
        {
          source: "/features/:path*",
          destination: "/api/features/:path*",
          has: API_REWRITE_HAS,
        },
        {
          source: "/expenses",
          destination: "/api/expenses",
          has: API_REWRITE_HAS,
        },
        {
          source: "/expenses/:path*",
          destination: "/api/expenses/:path*",
          has: API_REWRITE_HAS,
        },
      ];
    }
    const backend = process.env.BACKEND_URL || "http://localhost:3001";
    return [
      { source: "/issues", destination: `${backend}/issues` },
      { source: "/issues/:path*", destination: `${backend}/issues/:path*` },
      {
        source: "/organizations/:path*",
        destination: `${backend}/organizations/:path*`,
      },
      { source: "/organizations", destination: `${backend}/organizations` },
      { source: "/projects/:path*", destination: `${backend}/projects/:path*` },
      { source: "/projects", destination: `${backend}/projects` },
      { source: "/users/:path*", destination: `${backend}/users/:path*` },
      { source: "/users", destination: `${backend}/users` },
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
      {
        source: "/tests/:path*",
        destination: `${backend}/tests/:path*`,
        has: API_REWRITE_HAS,
      },
      {
        source: "/tests",
        destination: `${backend}/tests`,
        has: API_REWRITE_HAS,
      },
      { source: "/auth/:path*", destination: `${backend}/auth/:path*` },
      { source: "/auth", destination: `${backend}/auth` },
      { source: "/todos", destination: `${backend}/todos` },
      { source: "/todos/:path*", destination: `${backend}/todos/:path*` },
      {
        source: "/ideas",
        destination: `${backend}/ideas`,
        has: API_REWRITE_HAS,
      },
      {
        source: "/ideas/:path*",
        destination: `${backend}/ideas/:path*`,
        has: API_REWRITE_HAS,
      },
      { source: "/bugs", destination: `${backend}/bugs`, has: API_REWRITE_HAS },
      {
        source: "/bugs/:path*",
        destination: `${backend}/bugs/:path*`,
        has: API_REWRITE_HAS,
      },
      {
        source: "/features",
        destination: `${backend}/features`,
        has: API_REWRITE_HAS,
      },
      {
        source: "/features/:path*",
        destination: `${backend}/features/:path*`,
        has: API_REWRITE_HAS,
      },
      {
        source: "/expenses",
        destination: `${backend}/expenses`,
        has: API_REWRITE_HAS,
      },
      {
        source: "/expenses/:path*",
        destination: `${backend}/expenses/:path*`,
        has: API_REWRITE_HAS,
      },
    ];
  },
  transpilePackages: ["backend"],
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
