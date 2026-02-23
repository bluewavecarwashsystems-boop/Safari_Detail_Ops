/**
 * Login Page with i18n support
 * Simple email/password authentication form
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from '@/lib/i18n/provider';
import type { Locale } from '@/i18n';

function LoginForm() {
  const t = useTranslations('login');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = params.locale as Locale;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get redirect path from query params (if user was redirected from protected route)
  const redirectPath = searchParams.get('redirect') || `/${locale}`;

  useEffect(() => {
    // Clear any existing errors when inputs change
    setError('');
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error?.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Login successful, redirect to intended page or home with locale
      // Ensure redirect path includes locale
      const finalRedirect = redirectPath.startsWith(`/${locale}`) 
        ? redirectPath 
        : `/${locale}${redirectPath}`;
      
      router.push(finalRedirect);
      router.refresh(); // Refresh to update auth state
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--sf-bg)' }}>
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Image src="/safari-logo.png" alt="Safari Car Wash" width={120} height={120} className="object-contain" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--sf-ink)' }}>{t('title')}</h1>
          <p style={{ color: 'var(--sf-muted)' }}>{t('subtitle')}</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl p-8" style={{ boxShadow: 'var(--sf-shadow)', border: '1px solid var(--sf-border)' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--sf-brown)' }}>
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#F47C20] focus:border-transparent sf-button-transition"
                style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-ink)' }}
                placeholder={t('emailPlaceholder')}
                disabled={loading}
                dir={locale === 'ar' ? 'ltr' : 'ltr'}
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--sf-brown)' }}>
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#F47C20] focus:border-transparent sf-button-transition"
                style={{ borderColor: 'var(--sf-border)', color: 'var(--sf-ink)' }}
                placeholder={t('passwordPlaceholder')}
                disabled={loading}
                dir="ltr"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F47C20] hover:bg-[#DB6E1C] text-white font-medium py-3 px-4 rounded-xl sf-button-transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('signingIn')}
                </>
              ) : (
                t('signIn')
              )}
            </button>
          </form>

          {/* Footer Note */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: 'var(--sf-muted)' }}>
              {t('contactManager')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--sf-bg)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#F47C20] border-t-transparent mb-4"></div>
          <p style={{ color: 'var(--sf-muted)' }}>Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
