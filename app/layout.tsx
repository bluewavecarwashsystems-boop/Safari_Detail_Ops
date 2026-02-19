/**
 * Root Layout
 * Minimal wrapper - locale-specific layouts provide HTML structure
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
