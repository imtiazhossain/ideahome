/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://localhost:3001";
    return [
      { source: "/issues", destination: `${backend}/issues` },
      { source: "/issues/:path*", destination: `${backend}/issues/:path*` },
      { source: "/organizations/:path*", destination: `${backend}/organizations/:path*` },
      { source: "/projects/:path*", destination: `${backend}/projects/:path*` },
      { source: "/users/:path*", destination: `${backend}/users/:path*` },
      { source: "/uploads/:path*", destination: `${backend}/uploads/:path*` },
      { source: "/tests/:path*", destination: `${backend}/tests/:path*` },
      { source: "/auth/:path*", destination: `${backend}/auth/:path*` },
    ];
  },
};

module.exports = nextConfig;
