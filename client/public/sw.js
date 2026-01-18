// AudioNoise PWA - Aggressive Update Service Worker
// BUILD_VERSION gets replaced at build time, fallback to timestamp
const BUILD_VERSION = '__BUILD_VERSION__';
const VERSION = BUILD_VERSION !== '__BUILD_VERSION__' ? BUILD_VERSION : Date.now().toString();
const APP_NAME = 'audionoise';
const CACHE_NAME = `${APP_NAME}-v${VERSION}`;
const RUNTIME_CACHE = `${APP_NAME}-runtime-v${VERSION}`;
const IMAGE_CACHE = `${APP_NAME}-images-v${VERSION}`;
const API_CACHE = `${APP_NAME}-api-v${VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/manifest.json'
];

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
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
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
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Not available', { status: 503 });
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
