// O "Mestre" — narrador do jogo. Fala com a Claude API através do Cloudflare
// Worker (a chave fica no Worker). Se não houver Worker configurado, ou se a
// chamada falhar/estourar a cota, cai numa biblioteca de eventos pré-escritos
// (custo zero, jogo nunca trava).
//
// Princípio de custo/robustez: a IA gera só o SABOR (texto da situação e das
// opções). A MECÂNICA (atributo, CD, tipo de lance) vem do motor e nunca é
// decidida pela IA — barateia, evita exploits e mantém o balanceamento.
import { MESTRE_PROXY_URL, IDIOMA } from './config.js';

export function mestreOnline() { return !!MESTRE_PROXY_URL; }

async function chamarWorker(rota, payload, timeoutMs = 12000) {
  if (!MESTRE_PROXY_URL) throw new Error('offline');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${MESTRE_PROXY_URL.replace(/\/$/, '')}/${rota}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, idioma: IDIOMA }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`worker ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(t);
  }
}

// Gera a narrativa de um Lance Decisivo. Recebe as opções "padrão" (com a
// mecânica) e devolve { narrativa, opcoes } — opcoes mantém id/stat/cd/tipo,
// só o texto pode ter sido reescrito pela IA.
export async function gerarLance({ contexto, tom, classe, opcoesPadrao, usarIA }) {
  if (usarIA) {
    try {
      const data = await chamarWorker('lance', { contexto, tom, classe, opcoes: opcoesPadrao });
      if (data && data.narrativa && Array.isArray(data.opcoes)) {
        // mescla o texto da IA sobre a mecânica do motor (por id)
        const mapa = new Map(opcoesPadrao.map((o) => [o.id, o]));
        const opcoes = data.opcoes
          .filter((o) => mapa.has(o.id))
          .map((o) => ({ ...mapa.get(o.id), texto: String(o.texto || mapa.get(o.id).texto).slice(0, 80) }));
        if (opcoes.length === opcoesPadrao.length) {
          return { narrativa: String(data.narrativa).slice(0, 400), opcoes, fonte: 'ia' };
        }
      }
    } catch { /* cai no offline */ }
  }
  return { narrativa: lanceOffline(contexto, classe), opcoes: opcoesPadrao, fonte: 'offline' };
}

// Gera uma cena narrativa (pré-jogo, pós-jogo, epílogo). Devolve string.
export async function gerarCena({ tipo, contexto, tom, personagem, usarIA }) {
  if (usarIA) {
    try {
      const data = await chamarWorker('cena', { tipo, contexto, tom, personagem });
      if (data && data.texto) return { texto: String(data.texto).slice(0, 700), fonte: 'ia' };
    } catch { /* offline */ }
  }
  return { texto: cenaOffline(tipo, contexto, personagem, tom), fonte: 'offline' };
}

// --- Biblioteca offline -----------------------------------------------------

function pick(arr, seed) {
  const i = Math.abs(Math.floor((seed ?? Math.random() * 1e6))) % arr.length;
  return arr[i];
}

function lanceOffline(ctx, classe) {
  const min = ctx.minuto;
  const placar = ctx.placar;
  const baseGoleiro = [
    `Aos ${min}', o atacante adversário escapa na cara do gol. O estádio prende a respiração (${placar}).`,
    `Escanteio perigoso aos ${min}'. A bola sobe na pequena área e sobra para o ataque rival.`,
  ];
  const baseLinha = [
    `Aos ${min}', a bola chega limpa nos seus pés na entrada da área. Dois marcadores fecham o espaço (${placar}).`,
    `Contra-ataque aos ${min}'! Você avança com a defesa adversária desorganizada.`,
    `Falta frontal perigosa aos ${min}'. Todo o banco se levanta — a chance é sua (${placar}).`,
  ];
  const base = classe === 'goleiro' ? baseGoleiro : baseLinha;
  return pick(base, min);
}

function cenaOffline(tipo, ctx, personagem, tom) {
  const nome = personagem?.nome || 'você';
  if (tipo === 'pre') {
    const opts = [
      `O vestiário cheira a liniment e nervosismo. ${nome} aperta a chuteira e encara o gramado pelo túnel. ${ctx.advTime} espera do outro lado. É a hora.`,
      `O hino ecoa pelo estádio lotado. ${nome} fecha os olhos por um instante — todo o caminho até aqui pesa nos ombros, e levanta junto. Contra ${ctx.advTime}, vale a história.`,
    ];
    return pick(opts);
  }
  if (tipo === 'pos') {
    const venceu = ctx.ganhou;
    if (venceu) return `Apito final: ${ctx.placar}. ${nome} respira fundo no centro do gramado, a torcida cantando seu nome. Mais um capítulo escrito na própria lenda.`;
    if (ctx.empate) return `Apito final: ${ctx.placar}. Um empate amargo. ${nome} caminha cabisbaixo, mas a Copa ainda guarda páginas em branco.`;
    return `Apito final: ${ctx.placar}. A derrota dói. ${nome} ergue a cabeça da grama — quem constrói uma história sabe que reveses fazem parte dela.`;
  }
  // epílogo
  return `Quando ${nome} pendurou as chuteiras, restou a crônica: uma Copa vivida intensamente, com gols, suor e decisões que ninguém mais tomaria igual. A taça pode não ter vindo — mas a lenda, essa, ficou.`;
}
