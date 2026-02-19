/**
 * Custom i18n Provider - Edge Runtime Compatible
 * Replaces next-intl with a simpler implementation
 */

'use client';

import { createContext, useContext, ReactNode } from 'react';

type Messages = Record<string, any>;

interface I18nContextValue {
  locale: string;
  messages: Messages;
  t: (key: string, params?: Record<string, any>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Messages;
  children: ReactNode;
}) {
  const t = (key: string, params?: Record<string, any>): string => {
    const keys = key.split('.');
    let value: any = messages;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    if (typeof value !== 'string') {
      return key;
    }
    
    // Handle parameter interpolation
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] !== undefined ? String(params[param]) : match;
      });
    }
    
    return value;
  };

  return (
    <I18nContext.Provider value={{ locale, messages, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useTranslations must be used within I18nProvider');
  }

  return (key: string, params?: Record<string, any>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return context.t(fullKey, params);
  };
}

export function useLocale() {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useLocale must be used within I18nProvider');
  }

  return context.locale;
}
