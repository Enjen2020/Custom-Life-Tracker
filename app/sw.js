/* Oracle Scanner service worker: keeps the app, the text reader, fonts and viewed card
   images available offline. Card data itself is saved by the app (IndexedDB), not here. */
const SHELL = 'shell-v3';
const RUNTIME = 'runtime-v1';
const IMAGES = 'images-v1';
const MAX_IMAGES = 1500; // roughly 100 MB of card pictures

const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'vendor/tesseract.min.js', 'vendor/worker.min.js', 'vendor/lang/eng.traineddata.gz'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(async c => {
    await Promise.all(SHELL_FILES.map(f => c.add(f).catch(() => {})));
    // every mana symbol, so card text looks right offline
    try {
      const map = await (await fetch('symbols/index.json')).json();
      await c.put('symbols/index.json', new Response(JSON.stringify(map), { headers: { 'Content-Type': 'application/json' } }));
      await Promise.all(Object.values(map).map(f => c.add('symbols/' + encodeURIComponent(f)).catch(() => {})));
    } catch {}
  }));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  const keep = [SHELL, RUNTIME, IMAGES];
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function cacheFirst(req, cacheName, after) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') { await cache.put(req, res.clone()); after?.(cache); }
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' && await cache.match('index.html'))
      || Response.error();
  }
}

let trimming = false;
async function trimImages(cache) {
  if (trimming) return; trimming = true;
  try {
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(k);
  } finally { trimming = false; }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (url.pathname.includes('/data/')) return;                    // the app downloads card data itself
    if (url.pathname.includes('/vendor/')) return e.respondWith(cacheFirst(req, RUNTIME)); // text reader
    return e.respondWith(networkFirst(req, SHELL));                 // the app: newest when online
  }
  if (url.hostname === 'cards.scryfall.io' || url.hostname === 'svgs.scryfall.io')
    return e.respondWith(cacheFirst(req, IMAGES, trimImages));      // card pictures and mana symbols
  if (['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'].includes(url.hostname))
    return e.respondWith(cacheFirst(req, RUNTIME));
  // Everything else (Scryfall's live API) goes straight to the network.
});
