/**
 * Service Worker for Safari Detail Ops PWA
 * 
 * SECURITY-FIRST CACHING STRATEGY:
 * - Cache ONLY static assets and app shell
 * - NEVER cache API routes or authenticated data
 * - NEVER cache receipt images or job data
 * 
 * Last updated: 2026-02-23
 */

const CACHE_VERSION = 'safari-ops-v1';
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;

// Static assets to cache (fonts, images, CSS)
const STATIC_ASSETS = [
  '/safari-logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/_next/static/css/app/globals.css',
];

// App shell routes (HTML pages only - no data)
const APP_SHELL_ROUTES = [
  '/en',
  '/es',
  '/ar',
  '/en/install',
  '/es/install',
  '/ar/install',
];

// Routes that should NEVER be cached
const NEVER_CACHE_PATTERNS = [
  /^\/api\//,                    // All API routes
  /^\/.*\/api\//,                // Locale-prefixed API routes
  /\/jobs\//,                    // Job data routes
  /\/manager\//,                 // Manager routes
  /receipt/,                     // Receipt uploads
  /\.(jpg|jpeg|png|gif|webp)$/,  // Uploaded images
];

/**
 * Check if a URL should never be cached
 */
function shouldNeverCache(url) {
  const urlPath = new URL(url).pathname;
  return NEVER_CACHE_PATTERNS.some(pattern => pattern.test(urlPath));
}

/**
 * Install event - cache app shell
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    Promise.all([
      caches.open(ASSET_CACHE).then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(Boolean));
      }),
      caches.open(APP_SHELL_CACHE).then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL_ROUTES);
      }),
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            // Delete caches from old versions
            return cacheName.startsWith('safari-ops-') && 
                   cacheName !== ASSET_CACHE && 
                   cacheName !== APP_SHELL_CACHE;
          })
          .map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event - serve from cache or network
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // NEVER cache sensitive routes
  if (shouldNeverCache(request.url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Handle HTML requests (network-first)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Only cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(APP_SHELL_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Handle static assets (cache-first)
  if (STATIC_ASSETS.some(asset => url.pathname.includes(asset))) {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(ASSET_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network-only for everything else
  event.respondWith(fetch(request));
});

/**
 * Message event - handle commands from client
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});
