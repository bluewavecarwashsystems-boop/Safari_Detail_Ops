/**
 * Mobile-First Layout Wrapper
 * Single column, optimized for mobile devices
 */

'use client';

import { ReactNode } from 'react';

interface MobileLayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function MobileLayout({
  children,
  title,
  showBack = false,
  onBack,
}: MobileLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      {title && (
        <header className="sticky top-0 z-30 bg-[#0b1220] text-white shadow-md">
          <div className="max-w-lg mx-auto px-4 py-4 flex items-center">
            {showBack && onBack && (
              <button
                onClick={onBack}
                className="mr-3 p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
        </header>
      )}

      {/* Main Content - Single Column */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
