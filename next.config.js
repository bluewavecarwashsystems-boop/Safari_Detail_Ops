/** @type {import('next').NextConfig} */

const withNextIntl = require('next-intl/plugin')(
  // Specify the path to our i18n request configuration
  './i18n/request.ts'
);

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
  
  // PWA support (next-pwa would add to this)
  // Future: Add PWA manifest and service worker config
}

module.exports = withNextIntl(nextConfig)
