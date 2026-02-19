/**
 * Root Layout - Redirects to locale-specific layout
 * This is a minimal wrapper that ensures all routes use locale prefixes
 */

/**
 * Root Layout
 * This is the base layout - locale-specific layouts extend this
 */

import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Safari Detail Ops',
  description: 'Internal operations app for Safari Detailing - Franklin',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
