// Cloudflare Worker — "Mestre" de Crônicas da Copa.
// Faz a ponte entre o jogo (estático) e a Claude API. A chave ANTHROPIC fica
// AQUI (secret do Worker), nunca no navegador.
//
// Rotas:
//   POST /lance  -> { narrativa, opcoes:[{id,texto}] }   (situação do Lance Decisivo)
//   POST /cena   -> { texto }                            (pré/pós-jogo, epílogo)
//
// Secrets/vars (painel do Worker):
//   ANTHROPIC_API_KEY   (secret, obrigatório)
//   MODELO_LANCE        (opcional, padrão "claude-haiku-4-5")  — barato p/ lances
//   MODELO_CENA         (opcional, padrão "claude-haiku-4-5")
//   ORIGENS_PERMITIDAS  (opcional, CSV de origins p/ CORS; padrão "*")
//
// ALAVANCAS DE CUSTO embutidas:
//   - Haiku (modelo mais barato) no fluxo frequente.
//   - Saída ESTRUTURADA (output_config.format) -> JSON garantido, sem reparos.
//   - max_tokens baixo -> trava o custo de saída (saída é 5x a entrada).
//   - prompt caching no bloco de regras/tom (vira ~0,1x quando o prefixo cresce).
//   - thinking desligado (respostas curtas e diretas).

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

    const rota = new URL(request.url).pathname.replace(/^\/+/, '').split('/')[0];
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY ausente' }, 500, cors);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'json inválido' }, 400, cors); }

    try {
      if (rota === 'lance') return json(await gerarLance(body, env), 200, cors);
      if (rota === 'cena') return json(await gerarCena(body, env), 200, cors);
      return json({ error: 'rota desconhecida' }, 404, cors);
    } catch (err) {
      // o cliente tem fallback offline — devolvemos erro e ele se vira
      return json({ error: String(err && err.message || err) }, 502, cors);
    }
  },
};

// --- Lance ------------------------------------------------------------------
async function gerarLance(body, env) {
  const { contexto = {}, tom = 'epico', classe = 'centroavante', opcoes = [], idioma = 'pt-BR' } = body;
  const ids = opcoes.map((o) => o.id);
  const resumoOpcoes = opcoes.map((o) => `- ${o.id}: ${o.texto} [tipo:${o.tipo}, atributo:${o.stat}, CD:${o.cd}]`).join('\n');

  const system = [
    {
      type: 'text',
      text: BIBLIA_DO_MUNDO,
      cache_control: { type: 'ephemeral' }, // cacheia as regras fixas
    },
  ];

  const user = `Idioma: ${idioma}. Tom: ${tom}. Classe do protagonista: ${classe}.
Contexto da partida: ${JSON.stringify(contexto)}.
Opções mecânicas disponíveis (NÃO altere id, tipo, atributo nem CD):
${resumoOpcoes}

Gere a SITUAÇÃO do Lance Decisivo (1 a 2 frases, vívidas, no tom pedido) e reescreva o TEXTO de cada opção de forma evocativa (curto, no máximo ~70 caracteres), mantendo os MESMOS ids. Não revele números de dado.`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      narrativa: { type: 'string' },
      opcoes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string', enum: ids.length ? ids : ['A'] }, texto: { type: 'string' } },
          required: ['id', 'texto'],
        },
      },
    },
    required: ['narrativa', 'opcoes'],
  };

  const data = await chamarClaude(env, env.MODELO_LANCE || 'claude-haiku-4-5', system, user, schema, 400);
  return data;
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
  const data = await chamarClaude(env, env.MODELO_CENA || 'claude-haiku-4-5', system, user, schema, tipo === 'epilogo' ? 500 : 350);
  return data;
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

// --- CORS -------------------------------------------------------------------
function corsHeaders(request, env) {
  const permitidas = (env.ORIGENS_PERMITIDAS || '*').split(',').map((s) => s.trim());
  const origin = request.headers.get('Origin') || '';
  const allow = permitidas.includes('*') ? '*' : (permitidas.includes(origin) ? origin : permitidas[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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
