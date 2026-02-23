/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  
  // API routes are in /api directory (Vercel serverless functions)
  // Pages/app routes are in /app directory
  
  // Environment variables exposed to browser (prefix with NEXT_PUBLIC_)
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV || 'qa',
  },
  
  // Optimize images
  images: {
    domains: ['safari-detail-ops-qa-photos.s3.amazonaws.com'],
    formats: ['image/webp'],
  },
  
  // PWA and Service Worker headers
  async headers() {
    return [
      {
        // Service worker must never be cached
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        // Security headers for PWA
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        // Never cache API responses
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
