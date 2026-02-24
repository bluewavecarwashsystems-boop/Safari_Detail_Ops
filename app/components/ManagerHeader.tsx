'use client';

import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ReactNode } from 'react';
import type { Locale } from '@/i18n';

interface ManagerHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showBackButton?: boolean;
}

/**
 * Shared header component for Manager/Settings pages
 * Safari-themed with consistent navigation
 */
export function ManagerHeader({ 
  title, 
  subtitle, 
  actions,
  showBackButton = true 
}: ManagerHeaderProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as Locale) || 'en';

  const homeRoute = `/${locale}/`;

  // Check if we can go back (simple heuristic: not on first page load)
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;

  const handleBack = () => {
    router.back();
  };

  const handleHome = () => {
    router.push(homeRoute);
  };

  return (
    <header 
      className="sticky top-0 z-40 bg-white border-b shadow-sm"
      style={{ borderColor: 'var(--sf-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo + Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Image 
                src="/safari-logo.png" 
                alt="Safari" 
                width={40} 
                height={40} 
                className="object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 
                className="text-lg sm:text-2xl font-bold truncate"
                style={{ color: 'var(--sf-ink)' }}
              >
                {title}
              </h1>
              {subtitle && (
                <p 
                  className="text-xs sm:text-sm truncate"
                  style={{ color: 'var(--sf-muted)' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: Navigation + Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Back button (secondary, only if history exists) */}
            {showBackButton && canGoBack && (
              <button
                onClick={handleBack}
                className="hidden sm:flex items-center gap-1 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 sf-button-transition"
                style={{ 
                  borderColor: 'var(--sf-border)',
                  color: 'var(--sf-ink)'
                }}
                aria-label="Go back"
              >
                <svg 
                  className="w-4 h-4" 
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
                <span className="text-sm font-medium">Back</span>
              </button>
            )}

            {/* Home button (primary) */}
            <button
              onClick={handleHome}
              className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-lg text-white sf-button-transition"
              style={{ 
                backgroundColor: 'var(--sf-orange)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DB6E1C'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F47C20'}
              aria-label="Go to Today's Board"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                />
              </svg>
              {/* Mobile: "Today", Desktop: "Back to Today" */}
              <span className="text-sm font-medium sm:hidden">Today</span>
              <span className="text-sm font-medium hidden sm:inline">Back to Today</span>
            </button>

            {/* Optional custom actions */}
            {actions && (
              <div className="flex items-center gap-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
