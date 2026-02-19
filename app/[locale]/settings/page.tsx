/**
 * Settings Page with i18n support
 * Shows user profile, language settings, and logout
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { UserRole } from '@/lib/types';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n';

interface User {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

const LOCALE_COOKIE_NAME = 'safari_locale';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const currentLocale = params.locale as Locale;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.data.user);
      } else {
        setError('Failed to load user profile');
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push(`/${currentLocale}/login`);
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout. Please try again.');
      setLoggingOut(false);
    }
  };

  const handleLanguageChange = (newLocale: Locale) => {
    // Set cookie to persist language preference
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    
    // Navigate to the same page in the new locale
    const currentPath = window.location.pathname;
    const pathWithoutLocale = currentPath.replace(`/${currentLocale}`, '');
    router.push(`/${newLocale}${pathWithoutLocale || '/'}`);
    router.refresh();
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'MANAGER':
        return 'bg-purple-100 text-purple-800';
      case 'QC':
        return 'bg-blue-100 text-blue-800';
      case 'TECH':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-sky-500"></div>
          <p className="mt-4 text-gray-600">{t('loadingProfile')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d={currentLocale === 'ar' ? 'M14 5l7 7m0 0l-7 7m7-7H3' : 'M10 19l-7-7m0 0l7-7m-7 7h18'} 
                />
              </svg>
              {tCommon('back')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* User Profile Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('userProfile.title')}</h2>
            
            {user && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('userProfile.name')}</label>
                  <p className="text-gray-900 text-lg">{user.name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('userProfile.email')}</label>
                  <p className="text-gray-900">{user.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('userProfile.role')}</label>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">{t('userProfile.userId')}</label>
                  <p className="text-gray-600 text-sm font-mono">{user.userId}</p>
                </div>
              </div>
            )}
          </div>

          {/* Language Settings Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('language.title')}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t('language.description')}
            </p>

            <div className="space-y-2">
              {locales.map((locale) => (
                <label
                  key={locale}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => handleLanguageChange(locale)}
                >
                  <input
                    type="radio"
                    name="language"
                    value={locale}
                    checked={currentLocale === locale}
                    onChange={() => {}}
                    className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                  />
                  <span className="text-2xl">{localeFlags[locale]}</span>
                  <span className="text-gray-900 font-medium">{localeNames[locale]}</span>
                  {currentLocale === locale && (
                    <span className={`${currentLocale === 'ar' ? 'mr-auto' : 'ml-auto'} text-sky-500 text-sm`}>
                      {t('language.selected')}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Account Actions Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('account.title')}</h2>
            
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded-md transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loggingOut ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('account.loggingOut')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d={currentLocale === 'ar' ? 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' : 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'} 
                    />
                  </svg>
                  {t('account.logout')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
