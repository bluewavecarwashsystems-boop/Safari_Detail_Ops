/**
 * Root Page - Client-side redirect fallback
 * Middleware should handle this, but this provides a fallback
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Get preferred locale from cookie or default to 'en'
    const cookies = document.cookie.split(';');
    let locale = 'en';
    
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'safari_locale' && ['en', 'es', 'ar'].includes(value)) {
        locale = value;
        break;
      }
    }
    
    // Redirect to locale-specific home page
    router.replace(`/${locale}`);
  }, [router]);
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(to bottom right, #38bdf8, #2563eb)',
      color: 'white'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          width: '48px',
          height: '48px',
          border: '4px solid white',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <p>Redirecting...</p>
      </div>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
