# Phase 2: i18n + RTL Implementation Guide

## 📦 Deliverables Summary

This document provides a complete reference for Phase 2 implementation: Multilingual support (English, Spanish, Arabic) with RTL for Safari Detail Ops.

---

## 1️⃣ Files Added/Modified

### ✨ New Files Created

#### Configuration & i18n Setup
```
/i18n.ts
/i18n/request.ts
/messages/en.json
/messages/es.json
/messages/ar.json
```

#### Localized Application Pages
```
/app/[locale]/layout.tsx
/app/[locale]/page.tsx (Today Board)
/app/[locale]/settings/page.tsx
/app/[locale]/jobs/[jobId]/page.tsx
/app/[locale]/login/page.tsx
/app/[locale]/calendar/page.tsx
```

### 🔧 Modified Files
```
/middleware.ts - Locale routing + Auth integration
/next.config.js - next-intl plugin
/tsconfig.json - Path aliases for @/* imports
/app/layout.tsx - Simplified root layout
/app/page.tsx - Root page (middleware handles redirect)
```

---

## 2️⃣ Full Code for Each File

### `/i18n.ts`
```typescript
/**
 * i18n Configuration for Safari Detail Ops
 * Defines supported locales and default locale
 */

export const locales = ['en', 'es', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  ar: 'العربية',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  ar: '🇸🇦',
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
```

### `/i18n/request.ts`
```typescript
/**
 * next-intl request configuration
 * Sets up locale and messages for the app
 */

import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '../i18n';

export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

### Translation Files

See the complete translation files in:
- [/messages/en.json](messages/en.json) - English translations
- [/messages/es.json](messages/es.json) - Spanish translations
- [/messages/ar.json](messages/ar.json) - Arabic translations

All three files contain the same structure with translations for:
- `common`: Shared UI strings
- `nav`: Navigation labels
- `today`: Today Board strings
- `job`: Job detail page
- `settings`: Settings page
- `login`: Login page

---

## 3️⃣ Settings Page Language Toggle

The language toggle has been implemented with these features:

### Cookie Persistence
```typescript
const LOCALE_COOKIE_NAME = 'safari_locale';

const handleLanguageChange = (newLocale: Locale) => {
  // Set cookie to persist language preference (1 year)
  document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
  
  // Navigate to the same page in the new locale
  const currentPath = window.location.pathname;
  const pathWithoutLocale = currentPath.replace(`/${currentLocale}`, '');
  router.push(`/${newLocale}${pathWithoutLocale || '/'}`);
  router.refresh();
};
```

### UI Implementation
- Radio button selector with flag icons
- Visual indication of current selection
- Instant navigation on selection
- Maintains current page context

---

## 4️⃣ Middleware Update

The middleware has been updated to:

### Locale Detection & Routing
1. Extract locale from URL path (e.g., `/en/`, `/es/`, `/ar/`)
2. If no locale in URL, redirect to preferred locale from:
   - `safari_locale` cookie
   - `Accept-Language` header
   - Default: English

### Auth Integration
- All existing auth/RBAC logic preserved
- Session verification continues to work
- Public routes remain accessible:
  - `/api/auth/*`
  - `/api/health`
  - `/api/square/webhooks/*`
  - Static assets

### Code Structure
```typescript
// Locale detection
const { locale, pathnameWithoutLocale } = getLocaleFromPathname(pathname);

// Redirect to preferred locale if missing
if (!locale) {
  const preferredLocale = getPreferredLocale(request);
  return NextResponse.redirect(new URL(`/${preferredLocale}${pathname}`, request.url));
}

// Continue with auth checks
// ... existing auth logic ...
```

---

## 5️⃣ RTL Support Implementation

### HTML Direction
Set in [app/[locale]/layout.tsx](app/[locale]/layout.tsx):
```typescript
const dir = locale === 'ar' ? 'rtl' : 'ltr';

return (
  <html lang={locale} dir={dir}>
    {/* ... */}
  </html>
);
```

### CSS Adjustments
Conditional margin/padding:
```typescript
// Instead of ml-auto, use:
className={`${locale === 'ar' ? 'mr-auto' : 'ml-auto'}`}
```

### Arrow Direction
```typescript
{locale === 'ar' ? '→' : '←'}
```

### Input Fields
Email and password inputs kept LTR:
```typescript
<input dir="ltr" />
```

---

## 6️⃣ Routing Structure

### Before (Phase 1)
```
/                    (Today Board)
/settings
/jobs/[jobId]
/login
/calendar
```

### After (Phase 2)
```
/                    → redirects to /en/ (or preferred locale)
/en/                 (English Today Board)
/es/                 (Spanish Today Board)
/ar/                 (Arabic Today Board with RTL)
/[locale]/settings
/[locale]/jobs/[jobId]
/[locale]/login
/[locale]/calendar
```

### API Routes (unchanged)
```
/api/jobs
/api/jobs/[jobId]
/api/auth/login
/api/auth/logout
/api/auth/me
/api/health
/api/square/webhooks/*
```

---

## 7️⃣ Manual Test Plan

### Quick Smoke Test (5 minutes)
1. **Start dev server:** `npm run dev`
2. **Navigate to:** `http://localhost:3000/`
3. **Verify redirect to:** `/en/` (English Today Board)
4. **Go to Settings:** Click "Settings" link
5. **Switch to Spanish:** Click "Español"
6. **Verify:** Page updates to Spanish, URL shows `/es/settings`
7. **Go to Today Board:** Click back, verify Spanish UI
8. **Switch to Arabic:** Go to Settings, click "العربية"
9. **Verify RTL:** Layout mirrors, text right-aligned
10. **Test job detail:** Click a job card, verify Arabic labels
11. **Logout & Login:** Verify login page in Arabic
12. **Close & Reopen:** Verify language persists (cookie)

### Full Test Suite
See [PHASE_2_I18N_COMPLETE.md](PHASE_2_I18N_COMPLETE.md) for 12 comprehensive test cases.

---

## 8️⃣ Vercel Deployment

### Prerequisites
- No additional environment variables needed
- `next-intl` is Edge Runtime compatible

### Deploy
```bash
# From project root
vercel deploy --prod
```

### Verify Deployment
1. Visit your Vercel URL
2. Test all three locales: `/en/`, `/es/`, `/ar/`
3. Verify middleware redirects work
4. Test auth flow in each locale
5. Confirm RTL layout in Arabic

---

## 9️⃣ Technical Architecture

### Locale Detection Flow
```
User visits URL
    ↓
Middleware checks URL path
    ↓
Has locale? (/en/, /es/, /ar/)
    ↓ No              ↓ Yes
Check cookie      Extract locale
    ↓                  ↓
Check Accept-Lang  Continue with
    ↓              auth checks
Default: 'en'          ↓
    ↓              Render page
Redirect to           with locale
/{locale}{path}
```

### Translation Loading
```
User requests /es/
    ↓
Next.js matches [locale] route
    ↓
next-intl loads messages/es.json
    ↓
useTranslations('namespace') hook available
    ↓
Component renders with Spanish text
```

### RTL Rendering
```
Locale = 'ar'?
    ↓ Yes
<html dir="rtl">
    ↓
CSS logical properties + conditional classes
    ↓
Layout mirrors horizontally
```

---

## 🔟 Translation Key Reference

### Common Keys
```typescript
t('common.loading')    // "Loading..." / "Cargando..." / "جاري التحميل..."
t('common.error')      // "Error" / "Error" / "خطأ"
t('common.back')       // "Back" / "Atrás" / "رجوع"
```

### Navigation
```typescript
t('nav.calendar')      // "Calendar" / "Calendario" / "التقويم"
t('nav.settings')      // "Settings" / "Configuración" / "الإعدادات"
```

### Today Board
```typescript
t('today.boardTitle')         // "Today's Board"
t('today.status.scheduled')   // "Scheduled" / "Programado" / "مجدول"
t('today.status.inProgress')  // "In Progress" / "En Progreso" / "قيد التنفيذ"
```

### Job Detail
```typescript
t('job.customer.name')        // "Name" / "Nombre" / "الاسم"
t('job.vehicle.makeModel')    // "Make/Model" / "Marca/Modelo" / "الصنع/الطراز"
t('job.actions.checkIn')      // "Check In" / "Registrar Entrada" / "تسجيل الدخول"
```

### Settings
```typescript
t('settings.language.title')       // "Language Preferences"
t('settings.account.logout')       // "Logout" / "Cerrar Sesión" / "تسجيل الخروج"
```

---

## 1️⃣1️⃣ Troubleshooting

### Issue: TypeScript errors for @/i18n imports
**Solution:** Path alias added to `tsconfig.json`:
```json
"paths": {
  "@/*": ["./*"],
  // ...
}
```

### Issue: Middleware not redirecting
**Solution:** Check middleware matcher in `middleware.ts`, ensure it covers all routes:
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### Issue: RTL layout broken
**Solution:** Verify `dir` attribute in `<html>` tag and use conditional logic:
```typescript
const dir = locale === 'ar' ? 'rtl' : 'ltr';
```

### Issue: Language change doesn't persist
**Solution:** Check cookie is being set correctly:
```javascript
document.cookie = `safari_locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`;
```

---

## 1️⃣2️⃣ Next Steps (Future Phases)

Phase 2 is complete, but here are potential enhancements for future phases:

1. **Calendar Full Localization** - Currently basic implementation
2. **Photo Upload Page i18n** - Not in Phase 2 scope
3. **CMS Integration** - Replace JSON files with database
4. **Dynamic Locale Switching** - Without page reload
5. **Locale-Specific Formatting** - Dates, times, currency
6. **Translation Management UI** - For non-developers

---

## ✅ Acceptance Checklist

- ✅ English, Spanish, Arabic locales implemented
- ✅ RTL support for Arabic (dir="rtl")
- ✅ Today Board translated
- ✅ Job Detail page translated  
- ✅ Settings page translated
- ✅ Login page translated
- ✅ Language toggle with cookie persistence
- ✅ Middleware preserves auth/RBAC
- ✅ No breaking changes to business logic
- ✅ Ready for Vercel deployment

---

## 📚 Documentation Files

1. **[PHASE_2_I18N_COMPLETE.md](PHASE_2_I18N_COMPLETE.md)** - Comprehensive completion report with full test plan
2. **[PHASE_2_IMPLEMENTATION_GUIDE.md](PHASE_2_IMPLEMENTATION_GUIDE.md)** - This file (implementation reference)

---

**Phase 2 Implementation:** ✅ **COMPLETE**

*All code is ready for review, testing, and deployment.*
