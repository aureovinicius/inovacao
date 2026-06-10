// Service worker — cache do app shell para jogar offline.
// Estratégia: cache-first para os arquivos do jogo; rede para o resto
// (ex.: chamadas ao Worker do Mestre nunca são cacheadas).
const CACHE = 'cronicas-copa-v1';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'data/teams-2026.json',
  'js/app.js',
  'js/config.js',
  'js/data.js',
  'js/dice.js',
  'js/engine.js',
  'js/rules.js',
  'js/state.js',
  'js/achievements.js',
  'js/mestre.js',
  'js/ui/screens.js',
  'js/ui/dice-anim.js',
  'icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // só lida com GET de mesma origem (app shell). O resto vai direto pra rede.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match('index.html')))
  );
});
