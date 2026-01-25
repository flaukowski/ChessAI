// AudioNoise PWA - Aggressive Update Service Worker
// BUILD_HASH gets injected at build time (content hash for consistent versioning)
const BUILD_HASH = '__BUILD_HASH__';
// Use build hash if injected, otherwise fall back to dev timestamp
const VERSION = (BUILD_HASH && !BUILD_HASH.includes('BUILD_HASH')) ? BUILD_HASH : 'dev-' + Date.now().toString(36);
const APP_NAME = 'audionoise';
const CACHE_NAME = `${APP_NAME}-v${VERSION}`;
const RUNTIME_CACHE = `${APP_NAME}-runtime-v${VERSION}`;
const IMAGE_CACHE = `${APP_NAME}-images-v${VERSION}`;
const API_CACHE = `${APP_NAME}-api-v${VERSION}`;

// Storage quota configuration (in bytes)
const STORAGE_CONFIG = {
  // Target 80% of available quota to leave headroom
  quotaThreshold: 0.8,
  // Maximum entries per cache type
  maxRuntimeEntries: 100,
  maxImageEntries: 200,
  maxApiEntries: 50,
  // Maximum age for cached items (24 hours for API, 7 days for images)
  maxApiAge: 24 * 60 * 60 * 1000,
  maxImageAge: 7 * 24 * 60 * 60 * 1000,
};

const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];

// LRU metadata storage for tracking access times
const lruMetadata = new Map();

self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith(APP_NAME) &&
              cacheName !== CACHE_NAME &&
              cacheName !== RUNTIME_CACHE &&
              cacheName !== IMAGE_CACHE &&
              cacheName !== API_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Clean expired entries on activation
      return cleanExpiredEntries();
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' });
    }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_ACTIVATED', version: VERSION });
      });
    })
  );
});

async function networkFirst(request, cacheName = RUNTIME_CACHE) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      const cache = await caches.open(cacheName);
      // Check storage quota before caching
      await enforceStorageQuota(cacheName);
      cache.put(request, response.clone());
      updateLRUAccess(request.url);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      updateLRUAccess(request.url);
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request, cacheName = IMAGE_CACHE) {
  const cached = await caches.match(request);
  if (cached) {
    // Update LRU access time
    updateLRUAccess(request.url);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      // Check storage quota before caching
      await enforceStorageQuota(cacheName);
      cache.put(request, response.clone());
      updateLRUAccess(request.url);
    }
    return response;
  } catch (error) {
    return new Response('Not available', { status: 503 });
  }
}

// =============================================================================
// STORAGE QUOTA MANAGEMENT WITH LRU EVICTION
// =============================================================================

function updateLRUAccess(url) {
  lruMetadata.set(url, Date.now());
}

async function getStorageEstimate() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      return await navigator.storage.estimate();
    } catch (e) {
      console.warn('[SW] Storage estimate failed:', e);
    }
  }
  return { usage: 0, quota: 0 };
}

async function enforceStorageQuota(targetCacheName) {
  try {
    const estimate = await getStorageEstimate();

    // If quota info not available or we're under threshold, skip eviction
    if (!estimate.quota || estimate.usage / estimate.quota < STORAGE_CONFIG.quotaThreshold) {
      return;
    }

    console.log('[SW] Storage usage at', Math.round(estimate.usage / estimate.quota * 100) + '%', '- running LRU eviction');

    // Determine max entries for this cache type
    let maxEntries;
    if (targetCacheName.includes('images')) {
      maxEntries = STORAGE_CONFIG.maxImageEntries;
    } else if (targetCacheName.includes('api')) {
      maxEntries = STORAGE_CONFIG.maxApiEntries;
    } else {
      maxEntries = STORAGE_CONFIG.maxRuntimeEntries;
    }

    await evictLRUEntries(targetCacheName, maxEntries);
  } catch (error) {
    console.warn('[SW] Storage quota enforcement failed:', error);
  }
}

async function evictLRUEntries(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    if (requests.length <= maxEntries) {
      return;
    }

    // Sort by LRU access time (oldest first)
    const sortedRequests = requests.map(req => ({
      request: req,
      lastAccess: lruMetadata.get(req.url) || 0
    })).sort((a, b) => a.lastAccess - b.lastAccess);

    // Evict oldest entries until we're under the limit
    const toEvict = sortedRequests.slice(0, requests.length - maxEntries);

    for (const { request } of toEvict) {
      await cache.delete(request);
      lruMetadata.delete(request.url);
      console.log('[SW] LRU evicted:', request.url);
    }

    console.log('[SW] Evicted', toEvict.length, 'entries from', cacheName);
  } catch (error) {
    console.warn('[SW] LRU eviction failed for', cacheName, error);
  }
}

async function cleanExpiredEntries() {
  const now = Date.now();
  const cacheConfigs = [
    { name: API_CACHE, maxAge: STORAGE_CONFIG.maxApiAge },
    { name: IMAGE_CACHE, maxAge: STORAGE_CONFIG.maxImageAge },
  ];

  for (const { name, maxAge } of cacheConfigs) {
    try {
      const cache = await caches.open(name);
      const requests = await cache.keys();

      for (const request of requests) {
        const lastAccess = lruMetadata.get(request.url) || 0;
        if (now - lastAccess > maxAge) {
          await cache.delete(request);
          lruMetadata.delete(request.url);
          console.log('[SW] Expired entry removed:', request.url);
        }
      }
    } catch (error) {
      console.warn('[SW] Expired entry cleanup failed for', name, error);
    }
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (url.origin !== location.origin) return;
  if (request.method !== 'GET') return;
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }
  
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  
  if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  if (request.destination === 'audio' || /\.(mp3|wav|ogg|flac|m4a)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  event.respondWith(networkFirst(request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: VERSION });
  }

  if (event.data?.type === 'CHECK_UPDATE') {
    self.registration.update().then(() => {
      console.log('[SW] Update check completed');
    });
  }

  // Manual cache cleanup request
  if (event.data?.type === 'CLEAN_CACHES') {
    cleanExpiredEntries().then(() => {
      console.log('[SW] Manual cache cleanup completed');
      event.ports[0]?.postMessage({ success: true });
    }).catch(err => {
      console.error('[SW] Manual cache cleanup failed:', err);
      event.ports[0]?.postMessage({ success: false, error: err.message });
    });
  }

  // Get storage info for debugging
  if (event.data?.type === 'GET_STORAGE_INFO') {
    getStorageEstimate().then(async (estimate) => {
      const cacheNames = await caches.keys();
      const cacheInfo = {};

      for (const name of cacheNames) {
        if (name.startsWith(APP_NAME)) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          cacheInfo[name] = keys.length;
        }
      }

      event.ports[0]?.postMessage({
        version: VERSION,
        usage: estimate.usage,
        quota: estimate.quota,
        usagePercent: estimate.quota ? Math.round(estimate.usage / estimate.quota * 100) : 0,
        caches: cacheInfo,
        lruEntries: lruMetadata.size
      });
    });
  }
});

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

self.addEventListener('push', (event) => {
  let data = { title: 'AudioNoise', body: 'New notification' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data.body = event.data?.text() || 'New notification';
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data || { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow?.(url);
    })
  );
});
