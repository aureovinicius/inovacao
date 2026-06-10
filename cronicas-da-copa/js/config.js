// Configuração do jogo "Crônicas da Copa".
//
// MESTRE_PROXY_URL: URL do Cloudflare Worker que conversa com a Claude API
// (a chave ANTHROPIC fica no Worker, nunca no navegador). Deixe '' para jogar
// 100% offline com os eventos pré-escritos (custo zero).
//   ex.: 'https://cronicas-mestre.SEU-SUBDOMINIO.workers.dev'
export const MESTRE_PROXY_URL = '';

// Quantos "Lances Decisivos" (intervenções de RPG) o jogador tem por partida.
export const LANCES_POR_PARTIDA = 3;

// Limite de chamadas à IA por partida (trava de custo no cliente; o Worker
// também limita do lado dele). Acima disso, cai no fallback offline.
export const MAX_IA_POR_PARTIDA = 6;

// Liga/desliga a animação 3D do dado (pode desligar em aparelhos fracos).
export const ANIMACAO_DADO = true;

// Versão do save. Se mudar o formato do personagem, suba este número.
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'cronicas-da-copa:save:v1';

// Idioma da narrativa pedida ao Mestre.
export const IDIOMA = 'pt-BR';
