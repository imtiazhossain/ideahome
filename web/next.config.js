/** @type {import('next').NextConfig} */
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
        { source: "/tests", destination: "/api/tests" },
        { source: "/tests/:path*", destination: "/api/tests/:path*" },
        { source: "/auth", destination: "/api/auth" },
        { source: "/auth/:path*", destination: "/api/auth/:path*" },
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
      { source: "/tests/:path*", destination: `${backend}/tests/:path*` },
      { source: "/tests", destination: `${backend}/tests` },
      { source: "/auth/:path*", destination: `${backend}/auth/:path*` },
      { source: "/auth", destination: `${backend}/auth` },
      { source: "/todos", destination: `${backend}/todos` },
      { source: "/todos/:path*", destination: `${backend}/todos/:path*` },
      { source: "/ideas", destination: `${backend}/ideas` },
      { source: "/ideas/:path*", destination: `${backend}/ideas/:path*` },
      { source: "/bugs", destination: `${backend}/bugs` },
      { source: "/bugs/:path*", destination: `${backend}/bugs/:path*` },
      { source: "/features", destination: `${backend}/features` },
      { source: "/features/:path*", destination: `${backend}/features/:path*` },
      { source: "/expenses", destination: `${backend}/expenses` },
      { source: "/expenses/:path*", destination: `${backend}/expenses/:path*` },
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
