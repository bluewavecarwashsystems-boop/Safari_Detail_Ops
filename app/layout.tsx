/**
 * Root Layout
 * Provides HTML structure with PWA support
 */

import './globals.css';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://safari-detail-ops.vercel.app'),
  title: {
    default: 'Safari Detail Ops',
    template: '%s | Safari Detail Ops',
  },
  description: 'Mobile-first dashboard for Safari Detail Operations',
  applicationName: 'Safari Detail Ops',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Detail Ops',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0b1220',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ServiceWorkerRegister />
    </>
  );
}
