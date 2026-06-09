// Cloudflare Worker — proxy de placar ao vivo da Copa 2026.
// Chama a football-data.org no servidor (a chave fica aqui, nunca no navegador)
// e devolve o JSON com headers de CORS, para o site estático poder consumir.
//
// Endpoints expostos:
//   GET /matches    -> /v4/competitions/WC/matches
//   GET /standings  -> /v4/competitions/WC/standings
//   GET /scorers    -> /v4/competitions/WC/scorers?limit=30
//
// Variáveis (configurar no painel do Worker):
//   FOOTBALL_DATA_TOKEN  (secret, obrigatório)  — a mesma chave da football-data.org
//   FOOTBALL_COMP        (opcional, padrão "WC")
//
// O resultado é cacheado na borda da Cloudflare por 30s, protegendo o limite de
// requisições da API mesmo com muitos visitantes acessando ao mesmo tempo.

const BASE = 'https://api.football-data.org/v4';
const ALLOWED = new Set(['matches', 'standings', 'scorers']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') {
      return json({ error: 'method not allowed' }, 405);
    }

    const url = new URL(request.url);
    const resource = url.pathname.replace(/^\/+/, '').split('/')[0] || 'matches';
    if (!ALLOWED.has(resource)) return json({ error: 'resource not allowed' }, 404);
    if (!env.FOOTBALL_DATA_TOKEN) return json({ error: 'FOOTBALL_DATA_TOKEN não configurado' }, 500);

    const comp = env.FOOTBALL_COMP || 'WC';
    const upstream = `${BASE}/competitions/${comp}/${resource}` + (resource === 'scorers' ? '?limit=30' : '');

    try {
      const res = await fetch(upstream, {
        headers: { 'X-Auth-Token': env.FOOTBALL_DATA_TOKEN },
        cf: { cacheTtl: 30, cacheEverything: true }, // cache de 30s na borda
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
      });
    } catch (err) {
      return json({ error: String(err) }, 502);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}
