// Cloudflare Worker — "Mestre" de Crônicas da Copa.
// Faz a ponte entre o jogo (estático) e a Claude API. A chave ANTHROPIC fica
// AQUI (secret do Worker), nunca no navegador.
//
// Rotas:
//   POST /lance  -> { narrativa, opcoes:[{id,texto}] }   (situação do Lance Decisivo)
//   POST /cena   -> { texto }                            (pré/pós-jogo, epílogo)
//
// Secrets/vars (painel do Worker ou wrangler.toml):
//   ANTHROPIC_API_KEY   (secret, obrigatório)
//   MODELO_LANCE        (opcional, padrão "claude-haiku-4-5")  — barato p/ lances
//   MODELO_CENA         (opcional, padrão "claude-haiku-4-5")
//   ORIGENS_PERMITIDAS  (opcional, CSV de origins; padrão "*"). Em produção,
//                        coloque a origem do seu site (ex.: https://USER.github.io)
//                        para bloquear chamadas de fora.
//   RL_POR_MINUTO       (opcional, padrão 30) — teto de chamadas por IP/min
//                        (só vale se houver o binding KV "RATE_LIMIT").
//
// Binding opcional (wrangler.toml): KV namespace "RATE_LIMIT" para rate-limit
// por IP. Sem ele, use as "Rate Limiting Rules" do painel da Cloudflare.
//
// ALAVANCAS DE CUSTO embutidas:
//   - Haiku (modelo mais barato) no fluxo frequente.
//   - Saída ESTRUTURADA (output_config.format) -> JSON garantido, sem reparos.
//   - max_tokens baixo -> trava o custo de saída (saída é 5x a entrada).
//   - prompt caching no bloco de regras (kicka quando o prefixo passa do mínimo).
//   - lock de origem + rate-limit + guarda de tamanho -> evita abuso/estouro.

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const MAX_BODY = 8 * 1024; // 8 KB: payload do jogo é pequeno; corta abuso

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

    // lock de origem (defesa contra chamadas fora do seu site)
    if (!origemPermitida(request, env)) return json({ error: 'origem não permitida' }, 403, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY ausente' }, 500, cors);

    // guarda de tamanho
    const tamanho = Number(request.headers.get('content-length') || 0);
    if (tamanho > MAX_BODY) return json({ error: 'payload grande demais' }, 413, cors);

    // rate-limit por IP (opcional, só com binding KV "RATE_LIMIT")
    const rl = await rateLimit(request, env);
    if (rl && rl.bloqueado) {
      return json({ error: 'muitas requisições, tente em instantes' }, 429,
        { ...cors, 'retry-after': '30' });
    }

    const rota = new URL(request.url).pathname.replace(/^\/+/, '').split('/')[0];
    let body;
    try {
      const txt = await request.text();
      if (txt.length > MAX_BODY) return json({ error: 'payload grande demais' }, 413, cors);
      body = JSON.parse(txt);
    } catch { return json({ error: 'json inválido' }, 400, cors); }

    try {
      if (rota === 'lance') return json(await gerarLance(body, env), 200, cors);
      if (rota === 'cena') return json(await gerarCena(body, env), 200, cors);
      return json({ error: 'rota desconhecida' }, 404, cors);
    } catch (err) {
      // o cliente tem fallback offline — devolvemos erro e ele se vira
      return json({ error: String((err && err.message) || err) }, 502, cors);
    }
  },
};

// --- Lance ------------------------------------------------------------------
async function gerarLance(body, env) {
  const { contexto = {}, tom = 'epico', classe = 'centroavante', opcoes = [], idioma = 'pt-BR' } = body;
  const ids = opcoes.map((o) => o.id).filter(Boolean);
  const resumoOpcoes = opcoes
    .map((o) => `- ${o.id}: ${o.texto} [tipo:${o.tipo}, atributo:${o.stat}, CD:${o.cd}]`)
    .join('\n');

  const system = [{ type: 'text', text: BIBLIA_DO_MUNDO, cache_control: { type: 'ephemeral' } }];
  const user = `Idioma: ${idioma}. Tom: ${tom}. Classe do protagonista: ${classe}.
Contexto da partida: ${JSON.stringify(contexto)}.
Opções mecânicas disponíveis (NÃO altere id, tipo, atributo nem CD):
${resumoOpcoes}

Gere a SITUAÇÃO do Lance Decisivo (1 a 2 frases, vívidas, no tom pedido) e reescreva o TEXTO de cada opção de forma evocativa (curto, no máximo ~70 caracteres), mantendo os MESMOS ids. Não revele números de dado.`;

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      narrativa: { type: 'string' },
      opcoes: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          properties: { id: { type: 'string', enum: ids.length ? ids : ['A'] }, texto: { type: 'string' } },
          required: ['id', 'texto'],
        },
      },
    },
    required: ['narrativa', 'opcoes'],
  };

  return chamarClaude(env, env.MODELO_LANCE || 'claude-haiku-4-5', system, user, schema, 400);
}

// --- Cena -------------------------------------------------------------------
async function gerarCena(body, env) {
  const { tipo = 'pre', contexto = {}, tom = 'epico', personagem = {}, idioma = 'pt-BR' } = body;
  const instr = {
    pre: 'Escreva uma cena CURTA de pré-jogo (vestiário, túnel, hino) que crie clima.',
    pos: 'Escreva uma cena CURTA de pós-jogo reagindo ao placar e ao desempenho.',
    epilogo: 'Escreva um EPÍLOGO de carreira (legado do personagem), emocionante e conclusivo.',
  }[tipo] || 'Escreva uma cena curta.';

  const system = [{ type: 'text', text: BIBLIA_DO_MUNDO, cache_control: { type: 'ephemeral' } }];
  const user = `Idioma: ${idioma}. Tom: ${tom}. Personagem: ${JSON.stringify(personagem)}.
Contexto: ${JSON.stringify(contexto)}.
${instr} 2 a 4 frases. Trate o jogador na 3ª pessoa pelo nome quando houver.`;

  const schema = {
    type: 'object', additionalProperties: false,
    properties: { texto: { type: 'string' } }, required: ['texto'],
  };
  return chamarClaude(env, env.MODELO_CENA || 'claude-haiku-4-5', system, user, schema, tipo === 'epilogo' ? 500 : 350);
}

// --- Chamada à Claude API (raw HTTP) ---------------------------------------
async function chamarClaude(env, model, system, user, schema, maxTokens) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema } },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`claude ${resp.status}: ${t.slice(0, 200)}`);
  }
  const msg = await resp.json();
  const bloco = (msg.content || []).find((b) => b.type === 'text');
  if (!bloco) throw new Error('sem texto na resposta');
  return JSON.parse(bloco.text);
}

// --- Defesas ----------------------------------------------------------------
function listaOrigens(env) {
  return (env.ORIGENS_PERMITIDAS || '*').split(',').map((s) => s.trim()).filter(Boolean);
}
function origemPermitida(request, env) {
  const permitidas = listaOrigens(env);
  if (permitidas.includes('*')) return true;
  const origin = request.headers.get('Origin') || '';
  if (!origin) return true; // chamadas sem Origin (ex.: same-origin) passam
  return permitidas.includes(origin);
}
function corsHeaders(request, env) {
  const permitidas = listaOrigens(env);
  const origin = request.headers.get('Origin') || '';
  const allow = permitidas.includes('*') ? '*' : (permitidas.includes(origin) ? origin : permitidas[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

// Rate-limit por IP usando KV "RATE_LIMIT" (opcional). Janela de 1 minuto.
async function rateLimit(request, env) {
  if (!env.RATE_LIMIT) return null; // sem binding KV -> usa Rate Limiting Rules do painel
  const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
  const minuto = Math.floor(Date.now() / 60000);
  const chave = `rl:${ip}:${minuto}`;
  const teto = Number(env.RL_POR_MINUTO || 30);
  const atual = Number((await env.RATE_LIMIT.get(chave)) || 0);
  if (atual >= teto) return { bloqueado: true };
  // TTL de 70s cobre a janela do minuto
  await env.RATE_LIMIT.put(chave, String(atual + 1), { expirationTtl: 70 });
  return { bloqueado: false, atual: atual + 1 };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

// --- "Bíblia do mundo" (system prompt fixo e cacheável) --------------------
const BIBLIA_DO_MUNDO = `Você é o Mestre (narrador de RPG de mesa) do jogo "Crônicas da Copa", uma campanha textual ambientada na Copa do Mundo de 2026.
Seu papel: transformar cada partida e bastidor numa história única e vívida, como um bom narrador de mesa.
Regras de estilo:
- Escreva em português do Brasil (ou no idioma pedido), com vocabulário de futebol natural e brasileiro.
- Respeite o TOM pedido: "realista" (pé no chão, crônica de jornal), "epico" (grandioso, mítico), "comico" (leve, humor de vestiário).
- Seja CONCISO. Nada de parágrafos longos. Frases fortes e específicas.
- Você narra e dá sabor; você NÃO decide resultados nem mexe em números/dados. A mecânica é do motor do jogo.
- Nunca invente que o jogador marcou/defendeu: descreva apenas a SITUAÇÃO e as opções. O resultado vem do dado depois.
- Não use markdown, títulos, listas ou emojis nas respostas. Apenas texto corrido.`;
