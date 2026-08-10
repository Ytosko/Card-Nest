const CACHE = 'card-nest-shell-v1';
const PUBLIC_SHELL = ['/', '/privacy', '/terms', '/logo.svg', '/cardnest-icon.png'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_SHELL))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/app') || url.pathname.startsWith('/api')) return;
  event.respondWith(fetch(event.request).then((response) => { const clone = response.clone(); void caches.open(CACHE).then((cache) => cache.put(event.request, clone)); return response; }).catch(() => caches.match(event.request)));
});
