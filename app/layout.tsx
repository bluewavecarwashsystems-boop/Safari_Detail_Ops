/**
 * Root Layout - Redirects to locale-specific layout
 * This is a minimal wrapper that ensures all routes use locale prefixes
 */

/**
 * Root Layout - Redirects to locale-based routes
 * The actual app layout is in /app/[locale]/layout.tsx
 */

import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
