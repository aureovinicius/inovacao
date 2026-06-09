// Configuração do front.
// LIVE_PROXY_URL: URL do proxy serverless (Cloudflare Worker) para placar ao vivo.
// Deixe '' (vazio) para desativar — o site usa só o JSON atualizado diariamente.
// Depois de publicar o Worker, cole a URL aqui, ex.:
//   export const LIVE_PROXY_URL = 'https://copa2026-live.SEU-SUBDOMINIO.workers.dev';
export const LIVE_PROXY_URL = '';

// De quanto em quanto tempo buscar o placar ao vivo (ms), enquanto há jogo em andamento.
export const LIVE_POLL_MS = 45000;
