// Service worker da PWA Copa 2026.
// Estratégia: NETWORK-FIRST para tudo do próprio site (HTML, JS, CSS, JSON, bandeiras)
// — código e dados mais novos chegam sempre que houver rede; o cache só serve OFFLINE.
// Isso evita o app rodar uma versão antiga de JS guardada em cache (causa de bugs
// "que não somem mesmo após o deploy"). Imagens externas (se houver) ficam em cache.
// Troque a VERSION ao publicar mudanças de código.
const VERSION = 'copa2026-v15';
const SHELL = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/i18n.js', './js/config.js', './js/flags.js',
  './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const putCache = (req, res) => { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.endsWith('/sw.js')) return; // não interceptar o próprio SW

  // Tudo do próprio site — NETWORK-FIRST (fresco online; cache só como fallback offline).
  if (sameOrigin) {
    e.respondWith(
      fetch(req)
        .then((r) => { putCache(req, r); return r; })
        .catch(() => caches.match(req).then((c) =>
          c || (req.mode === 'navigate' ? caches.match('./index.html').then((h) => h || caches.match('./')) : undefined)
        ))
    );
    return;
  }

  // Cross-origin (ex.: escudos externos) — rede, com cache de imagens.
  e.respondWith(
    fetch(req).then((r) => { if (r.ok && req.destination === 'image') putCache(req, r); return r; })
      .catch(() => caches.match(req))
  );
});
