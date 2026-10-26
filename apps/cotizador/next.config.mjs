const apiUrl = process.env.API_URL || 'http://localhost:4000';

export default {
  async rewrites() {
    return [{ source: '/api/backend/:path*', destination: `${apiUrl}/:path*` }];
  }
};
