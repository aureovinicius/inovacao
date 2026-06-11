// Service worker da PWA Copa 2026.
// Estratégia mista: app shell rápido/offline + dados sempre frescos.
//   - Navegação (HTML): network-first → cache (offline)
//   - data/*.json:      network-first → cache (placar/probabilidades sempre atuais)
//   - css/js/ícones:    stale-while-revalidate (instantâneo + atualiza em 2º plano)
//   - cross-origin:     rede, com cache de imagens (escudos)
// Troque a VERSION ao publicar mudanças de código para renovar o cache.
const VERSION = 'copa2026-v5';
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

  // Navegação (HTML) — network-first
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => { putCache('./index.html', r); return r; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Dados — network-first (sempre tenta o mais novo)
  if (sameOrigin && url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(req).then((r) => { putCache(req, r); return r; }).catch(() => caches.match(req))
    );
    return;
  }

  // Estáticos same-origin — stale-while-revalidate
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((r) => { putCache(req, r); return r; }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Cross-origin (escudos, proxy ao vivo) — rede, com cache de imagens
  e.respondWith(
    fetch(req).then((r) => { if (r.ok && req.destination === 'image') putCache(req, r); return r; })
      .catch(() => caches.match(req))
  );
});
