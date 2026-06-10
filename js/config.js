// Configuração do front.
// LIVE_PROXY_URL: URL do proxy serverless (Cloudflare Worker) para placar ao vivo.
// Deixe '' (vazio) para desativar — o site usa só o JSON atualizado diariamente.
//   export const LIVE_PROXY_URL = 'https://copa2026-live.SEU-SUBDOMINIO.workers.dev';
export const LIVE_PROXY_URL = 'https://copa.aureovinicius-a0d.workers.dev';

// De quanto em quanto tempo buscar o placar ao vivo (ms), enquanto há jogo em andamento.
export const LIVE_POLL_MS = 45000;

// Janela diária (em hora de Brasília, BRT = UTC-3) em que o placar ao vivo fica ativo.
// Fora dela, o front não faz nenhuma chamada ao proxy. Cruza a meia-noite quando start > end.
export const LIVE_WINDOW_BRT = { start: 16, end: 2 }; // 16h às 2h BRT
