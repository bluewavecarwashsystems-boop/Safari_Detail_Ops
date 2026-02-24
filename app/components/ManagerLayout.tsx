'use client';

import { ReactNode } from 'react';
import { ManagerHeader } from '@/app/components/ManagerHeader';

interface ManagerLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  showBackButton?: boolean;
}

/**
 * Shared layout wrapper for Manager/Settings pages
 * Provides consistent header and container styling
 */
export function ManagerLayout({ 
  children, 
  title, 
  subtitle, 
  actions,
  showBackButton = true 
}: ManagerLayoutProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--sf-bg)' }}>
      <ManagerHeader 
        title={title}
        subtitle={subtitle}
        actions={actions}
        showBackButton={showBackButton}
      />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
