// Offline support for the installed app: the life tracker (this folder) and card lookup (scanner/).
// Pages are fetched network-first, so a new upload is picked up the next time the app opens online,
// and fall back to the saved copy with no connection. Card data is saved by the scanner page itself.
const SHELL = 'shell-v6';
const RUNTIME = 'runtime-v1';
const IMAGES = 'images-v1';
const MAX_IMAGES = 3000; // card pictures and Printings thumbnails, roughly 120 MB

const APP_FILES = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './scanner/', './scanner/index.html',
  './scanner/vendor/tesseract.min.js', './scanner/vendor/worker.min.js', './scanner/vendor/lang/eng.traineddata.gz'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(async cache => {
    // One missing file must not stop the rest from being saved.
    await Promise.all(APP_FILES.map(f => cache.add(f).catch(() => {})));
    try { // every mana symbol, so card text looks right offline
      const map = await (await fetch('./scanner/symbols/index.json')).json();
      await cache.put('./scanner/symbols/index.json', new Response(JSON.stringify(map), { headers: { 'Content-Type': 'application/json' } }));
      await Promise.all(Object.values(map).map(f => cache.add('./scanner/symbols/' + encodeURIComponent(f)).catch(() => {})));
    } catch {}
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  const keep = [SHELL, RUNTIME, IMAGES];
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function cacheFirst(request, cacheName, after) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') { await cache.put(request, response.clone()); after?.(cache); }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const inScanner = new URL(request.url).pathname.includes('/scanner/');
      return (await cache.match(inScanner ? './scanner/index.html' : './index.html')) || Response.error();
    }
    return Response.error();
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

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/scanner/data/')) return;                       // the scanner downloads card data itself
    if (url.pathname.includes('/scanner/vendor/')) return event.respondWith(cacheFirst(request, RUNTIME)); // text reader
    if (url.pathname.includes('/icons/')) return event.respondWith(cacheFirst(request, SHELL));
    return event.respondWith(networkFirst(request));                         // pages: newest when online
  }
  if (url.hostname === 'cards.scryfall.io' || url.hostname === 'svgs.scryfall.io')
    return event.respondWith(cacheFirst(request, IMAGES, trimImages));       // card pictures and mana symbols
  if (url.hostname === 'cdn.jsdelivr.net') return event.respondWith(cacheFirst(request, RUNTIME));
  // Everything else (Scryfall's live API) goes straight to the network.
});
