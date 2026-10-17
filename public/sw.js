const CACHE_NAME = 'mec-cache-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Disable caching on localhost/development environments
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Exclude admin, api, and supabase database/storage calls from service worker caching
  if (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  const isHashedNextAsset = url.pathname.startsWith('/_next/static/');
  const isUnhashedStaticAsset =
    !isHashedNextAsset &&
    /\.(?:js|css|woff2?|png|jpe?g|gif|svg|webp|json|ico)$/.test(url.pathname);

  if (isHashedNextAsset) {
    // Cache-First for immutable content-hashed Next.js static chunks
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
  } else if (isUnhashedStaticAsset) {
    // Stale-While-Revalidate for unhashed public assets (world.geo.json, logos, etc.)
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cachedResponse) => {
          const networkFetch = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse || Response.error());

          return cachedResponse || networkFetch;
        })
      )
    );
  }
});
