/**
 * Not Found Page - 404 Handler
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NotFound() {
  const [locale, setLocale] = useState('en');
  
  useEffect(() => {
    // Get preferred locale from cookie or default to 'en'
    const cookies = document.cookie.split(';');
    
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'safari_locale' && ['en', 'es', 'ar'].includes(value)) {
        setLocale(value);
        break;
      }
    }
  }, []);
  
  return (
    <html lang={locale}>
      <body>
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'linear-gradient(to bottom right, #38bdf8, #2563eb)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '600px' }}>
            <h1 style={{ fontSize: '72px', marginBottom: '16px', fontWeight: 'bold' }}>404</h1>
            <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>Page Not Found</h2>
            <p style={{ marginBottom: '32px', opacity: 0.9 }}>
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Link 
              href={`/${locale}`}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: 'white',
                color: '#2563eb',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                transition: 'transform 0.2s'
              }}
            >
              Go to Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
