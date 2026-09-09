const CACHE = 'donggang-supabase-github-v4';
const ASSETS = ['./', './index.html', './app.js', './core.js', './store.js', './config.js', './vendor/supabase.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const allowed = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('donggang-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  // 只快取本站 App 外殼；Supabase API、Realtime 及帳目均不進入快取。
  if (event.request.method !== 'GET' || !allowed.has(event.request.url)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    return fetch(event.request);
  }));
});
