/**
 * Locale Layout with i18n support
 * Handles locale-specific layout and RTL for Arabic
 */

import { Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/i18n';
import { I18nProvider } from '@/lib/i18n/provider';
import type { Metadata } from 'next';

// Import all messages statically for Edge Runtime compatibility
import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import arMessages from '@/messages/ar.json';

const inter = Inter({ subsets: ['latin'] });

const messages = {
  en: enMessages,
  es: esMessages,
  ar: arMessages,
};

export const metadata: Metadata = {
  title: 'Safari Detail Ops',
  description: 'Internal operations app for Safari Detailing - Franklin, TN',
  manifest: '/manifest.json',
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Determine text direction for RTL languages
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <I18nProvider locale={locale} messages={messages[locale as Locale]}>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
