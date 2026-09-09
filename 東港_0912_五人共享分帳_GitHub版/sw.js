const CACHE = 'donggang-supabase-illustrated-v5';
const ASSETS = ['./', './index.html', './style.css', './icons.js', './assets/harbor.webp', './assets/avatar-0.svg', './assets/avatar-1.svg', './assets/avatar-2.svg', './assets/avatar-3.svg', './assets/avatar-4.svg', './app.js', './core.js', './store.js', './config.js', './vendor/supabase.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const allowed = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('donggang-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  // 只快取本站 App 外殼；Supabase API、Realtime 及帳目均不進入快取。
  const canonical=new URL(event.request.url);canonical.search='';canonical.hash='';
  if (event.request.method !== 'GET' || !allowed.has(canonical.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const response=await fetch(new Request(event.request,{cache:'no-cache',signal:AbortSignal.timeout(8000)}));
      if(!response.ok)throw new Error('App resource unavailable');
      await cache.put(canonical.href,response.clone());
      return response;
    } catch(error) {
      const cached=await cache.match(canonical.href);
      if(cached)return cached;
      return Response.error();
    }
  }));
});
