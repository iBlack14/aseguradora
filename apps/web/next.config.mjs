/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://127.0.0.1:4000';
    return [
      {
        source: '/api/backend/:path*',
        destination: `${apiUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
