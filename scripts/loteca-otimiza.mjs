#!/usr/bin/env node
// Otimizador de apostas da (Copa da) Loteca a partir das forças do nosso modelo.
//
// O que faz:
//   1) Lê o Elo das seleções de data/predictions.json (e o tempering de
//      data/calibration.json), exatamente como o predict.mjs.
//   2) Converte Elo -> probabilidade de 1 (mandante) / X (empate) / 2 (visitante)
//      por jogo, via o MESMO modelo Elo->Poisson do predict.mjs.
//   3) Dado um orçamento, acha a marcação (simples/duplo/triplo por jogo) que
//      MAXIMIZA a probabilidade de ser premiada (13 ou 14 acertos), respeitando o
//      limite da Loteca (no máximo 864 combinações = "5 duplos + 3 triplos").
//
// Uso:
//   node scripts/loteca-otimiza.mjs                 # tabela de probabilidades + apostas por faixa
//   node scripts/loteca-otimiza.mjs 216             # melhor aposta até R$ 216
//   node scripts/loteca-otimiza.mjs --max           # aposta de probabilidade máxima
//   node scripts/loteca-otimiza.mjs --probs         # só a tabela de probabilidades
//   node scripts/loteca-otimiza.mjs --bet 1=1X2,2=2,4=1X2,...   # avalia uma marcação sua
//   node scripts/loteca-otimiza.mjs --complemento 1=1X,2=2,... [orçamento]
//        # dada uma aposta já feita, acha a melhor 2ª aposta (maximiza a chance de
//        # QUALQUER uma ser premiada). Orçamento em reais; padrão = custo da 1ª.
//
// Os jogos do concurso são lidos de data/loteca.json se existir; senão, usa o
// concurso 1255 (Copa da Loteca) embutido abaixo. Em data/loteca.json:
//   { "concurso": 1255, "pricePerCombo": 2,
//     "jogos": [ { "casa": "Brazil", "fora": "Morocco" }, ... 14 itens ] }
// "casa"/"fora" devem casar com o nome em data/predictions.json (ex.: "Ivory Coast").

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// ----- Parâmetros do modelo (idênticos ao predict.mjs) -----
const ELO_PER_GOAL = 170;     // ~170 pontos de Elo ≈ 1 gol de diferença esperada
const AVG_TOTAL_GOALS = 2.6;
let ELO_SHRINK = 0.8;         // "tempering"; sobrescrito por data/calibration.json
const MAX_GOALS = 12;         // truncamento da Poisson (soma exata até aqui)

// ----- Limite da Loteca -----
const MAX_COMBOS = 864;       // teto oficial: 5 duplos + 3 triplos (2^5 * 3^3)
const DEFAULT_PRICE_PER_COMBO = 2; // Copa da Loteca: R$ 2,00 por combinação

// Concurso 1255 (fallback). Nomes na grafia de data/predictions.json.
const DEFAULT_CONCURSO = {
  concurso: 1255,
  pricePerCombo: DEFAULT_PRICE_PER_COMBO,
  jogos: [
    { casa: 'Brazil', fora: 'Morocco' },
    { casa: 'Haiti', fora: 'Scotland' },
    { casa: 'Germany', fora: 'Curaçao' },
    { casa: 'Netherlands', fora: 'Japan' },
    { casa: 'Ivory Coast', fora: 'Ecuador' },
    { casa: 'Sweden', fora: 'Tunisia' },
    { casa: 'Spain', fora: 'Cape Verde Islands' },
    { casa: 'Belgium', fora: 'Egypt' },
    { casa: 'Saudi Arabia', fora: 'Uruguay' },
    { casa: 'France', fora: 'Senegal' },
    { casa: 'Iraq', fora: 'Norway' },
    { casa: 'Argentina', fora: 'Algeria' },
    { casa: 'Portugal', fora: 'Congo DR' },
    { casa: 'England', fora: 'Croatia' },
  ],
};

// ----- Modelo Elo -> probabilidades de 1 / X / 2 -----
function poissonPMF(k, lambda) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

// Probabilidades exatas de mandante/empate/visitante (jogo neutro por padrão).
function outcomeProbs(eloHome, eloAway, homeAdv = 0) {
  const mu = ((eloHome - eloAway) * ELO_SHRINK + homeAdv) / ELO_PER_GOAL; // saldo esperado
  const la = Math.max(0.15, (AVG_TOTAL_GOALS + mu) / 2);
  const lb = Math.max(0.15, (AVG_TOTAL_GOALS - mu) / 2);
  const ph = []; const pa = [];
  for (let k = 0; k <= MAX_GOALS; k++) { ph[k] = poissonPMF(k, la); pa[k] = poissonPMF(k, lb); }
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= MAX_GOALS; i++)
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = ph[i] * pa[j];
      if (i > j) home += p; else if (i === j) draw += p; else away += p;
    }
  const s = home + draw + away;
  return { '1': home / s, 'X': draw / s, '2': away / s, la, lb };
}

// ----- Otimização da marcação -----
// Para cada jogo, "cobertura" de c colunas = soma das c probabilidades mais altas.
// Com duplos/triplos, o bilhete contém TODAS as combinações marcadas; então ele
// faz 14 acertos sse o resultado real de cada jogo está entre as colunas marcadas.
//   P(14) = ∏ cobertura_i
//   P(13) = ∏ cobertura_i × Σ (1 - cobertura_i) / cobertura_i   (exatamente 1 erro)
//   P(premiada) = P(14) + P(13) = ∏cob × (Σ 1/cob_i − (N−1))
const ORDER = ['1', 'X', '2'];
function gameCoverage(probs) {
  // colunas ordenadas por probabilidade desc
  const sorted = ORDER.map(k => ({ k, p: probs[k] })).sort((a, b) => b.p - a.p);
  const cov = [null]; const lab = [null];
  let acc = 0; const cols = [];
  for (let c = 1; c <= 3; c++) {
    acc += sorted[c - 1].p; cols.push(sorted[c - 1].k);
    cov[c] = c === 3 ? 1 : acc;           // triplo cobre 100%
    lab[c] = ORDER.filter(k => cols.includes(k)); // mantém ordem 1,X,2
  }
  return { cov, lab };
}

function premiadaProb(covprod, invsum, n) {
  return covprod * (invsum - (n - 1)); // P(14)+P(13)
}

// Busca exaustiva (com poda pelo nº de combinações) da melhor marcação ≤ maxCombos.
function optimize(games, maxCombos) {
  const n = games.length;
  const levels = new Array(n).fill(1);
  let best = null;
  (function dfs(i, combos, covprod, invsum) {
    if (i === n) {
      const Pprem = premiadaProb(covprod, invsum, n);
      if (!best || Pprem > best.Pprem)
        best = { Pprem, P14: covprod, combos, levels: levels.slice() };
      return;
    }
    for (let c = 1; c <= 3; c++) {
      const nc = combos * c;
      if (nc > maxCombos) continue;
      levels[i] = c;
      dfs(i + 1, nc, covprod * games[i].cov[c], invsum + 1 / games[i].cov[c]);
    }
    levels[i] = 1;
  })(0, 1, 1, 0);
  return best;
}

// Avalia uma marcação fornecida (levels = colunas marcadas por jogo).
function evaluate(games, markings) {
  let combos = 1, covprod = 1, invsum = 0;
  const cov = markings.map((cols, i) => {
    const c = cols.reduce((s, k) => s + games[i].p[k], 0);
    combos *= cols.length; covprod *= c; invsum += 1 / c;
    return c;
  });
  return { combos, P14: covprod, Pprem: premiadaProb(covprod, invsum, games.length), cov };
}

// ----- Duas apostas: probabilidade de QUALQUER uma ser premiada -----
// Distribuição conjunta exata do nº de erros de A e de B (truncado em 2, pois só
// importa erros ≤ 1). Estado plano: idx = erA*3 + erB (erA,erB ∈ {0,1,≥2}).
// Por jogo, o resultado real cai em 1 de 4 categorias: cobre ambos / só A / só B /
// nenhum — e isso incrementa os contadores de erro de quem NÃO cobriu.
function jointDist(games, Acols, Bcols) {
  let dist = new Float64Array(9); dist[0] = 1; // (0,0)
  for (let i = 0; i < games.length; i++) {
    let pbb = 0, pa = 0, pb = 0, pn = 0;
    for (const k of ORDER) {
      const pk = games[i].p[k];
      const inA = Acols[i].includes(k), inB = Bcols[i].includes(k);
      if (inA && inB) pbb += pk; else if (inA) pa += pk; else if (inB) pb += pk; else pn += pk;
    }
    const nd = new Float64Array(9);
    for (let erA = 0; erA < 3; erA++) for (let erB = 0; erB < 3; erB++) {
      const v = dist[erA * 3 + erB]; if (!v) continue;
      const a1 = Math.min(erA + 1, 2), b1 = Math.min(erB + 1, 2);
      nd[erA * 3 + erB] += v * pbb;   // ambos cobrem
      nd[erA * 3 + b1] += v * pa;     // só A cobre → B erra
      nd[a1 * 3 + erB] += v * pb;     // só B cobre → A erra
      nd[a1 * 3 + b1] += v * pn;      // nenhum cobre → ambos erram
    }
    dist = nd;
  }
  return dist;
}
function unionStats(games, Acols, Bcols) {
  const d = jointDist(games, Acols, Bcols);
  const at = (a, b) => d[a * 3 + b];
  let Apr = 0, Bpr = 0, both = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    if (a <= 1) Apr += at(a, b);
    if (b <= 1) Bpr += at(a, b);
    if (a <= 1 && b <= 1) both += at(a, b);
  }
  const union = Apr + Bpr - both;
  let A14 = 0, B14 = 0; for (let b = 0; b < 3; b++) A14 += at(0, b); for (let a = 0; a < 3; a++) B14 += at(a, 0);
  const union14 = A14 + B14 - at(0, 0);
  return { union, union14, Apr, Bpr };
}

// Acha o melhor COMPLEMENTO a uma aposta já feita (Acols), até maxCombos.
// Para tratabilidade, jogos simples do complemento ficam no favorito; duplos/triplos
// podem cobrir qualquer combinação de colunas (inclusive as que A não cobre).
function optimizeComplement(games, Acols, maxCombos) {
  const n = games.length;
  // opções por jogo: favorito(1) + 3 duplos + triplo, cada uma com (colunas, tamanho)
  const PAIRS = [['1', 'X'], ['1', '2'], ['X', '2']];
  const optsByGame = games.map(g => {
    const fav = ORDER.map(k => ({ k, p: g.p[k] })).sort((a, b) => b.p - a.p)[0].k;
    return [[[fav], 1], ...PAIRS.map(pr => [pr, 2]), [['1', 'X', '2'], 3]];
  });
  const choice = new Array(n).fill(null);
  const bufs = Array.from({ length: n + 1 }, () => new Float64Array(9)); // 1 buffer por profundidade
  let best = null;
  (function dfs(i, combos, dist) {
    if (i === n) {
      let Apr = 0, Bpr = 0, both = 0;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const v = dist[a * 3 + b];
        if (a <= 1) Apr += v; if (b <= 1) Bpr += v; if (a <= 1 && b <= 1) both += v;
      }
      const union = Apr + Bpr - both;
      if (!best || union > best.union) best = { union, Bpr, combos, cols: choice.slice() };
      return;
    }
    const opts = optsByGame[i], nd = bufs[i + 1];
    for (let o = 0; o < opts.length; o++) {
      const cols = opts[o][0], sz = opts[o][1];
      const nc = combos * sz; if (nc > maxCombos) continue;
      let pbb = 0, pa = 0, pb = 0, pn = 0;
      for (const k of ORDER) {
        const pk = games[i].p[k];
        const inA = Acols[i].includes(k), inB = cols.includes(k);
        if (inA && inB) pbb += pk; else if (inA) pa += pk; else if (inB) pb += pk; else pn += pk;
      }
      nd.fill(0);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const v = dist[a * 3 + b]; if (!v) continue;
        const a1 = a < 2 ? a + 1 : 2, b1 = b < 2 ? b + 1 : 2;
        nd[a * 3 + b] += v * pbb; nd[a * 3 + b1] += v * pa; nd[a1 * 3 + b] += v * pb; nd[a1 * 3 + b1] += v * pn;
      }
      choice[i] = cols; dfs(i + 1, nc, nd);
    }
    choice[i] = null;
  })(0, 1, (() => { bufs[0][0] = 1; return bufs[0]; })());
  return best;
}

// Converte "1=1X,2=2,..." em colunas por jogo (default = favorito).
function parseMarkings(str, games) {
  const m = games.map(g => [ORDER.map(k => ({ k, p: g.p[k] })).sort((a, b) => b.p - a.p)[0].k]);
  for (const part of str.split(',')) {
    const [j, cols] = part.split('=');
    const idx = parseInt(j, 10) - 1;
    if (idx >= 0 && idx < m.length && cols)
      m[idx] = cols.toUpperCase().split('').filter(k => ORDER.includes(k));
  }
  return m;
}

// ----- Util de exibição -----
const NAME_PT = {
  Brazil: 'Brasil', Morocco: 'Marrocos', Haiti: 'Haiti', Scotland: 'Escócia',
  Germany: 'Alemanha', 'Curaçao': 'Curaçao', Netherlands: 'Holanda', Japan: 'Japão',
  'Ivory Coast': 'Costa do Marfim', Ecuador: 'Equador', Sweden: 'Suécia', Tunisia: 'Tunísia',
  Spain: 'Espanha', 'Cape Verde Islands': 'Cabo Verde', Belgium: 'Bélgica', Egypt: 'Egito',
  'Saudi Arabia': 'Arábia Saudita', Uruguay: 'Uruguai', France: 'França', Senegal: 'Senegal',
  Iraq: 'Iraque', Norway: 'Noruega', Argentina: 'Argentina', Algeria: 'Argélia',
  Portugal: 'Portugal', 'Congo DR': 'Congo', England: 'Inglaterra', Croatia: 'Croácia',
};
const pt = n => NAME_PT[n] || n;
const pct = x => (x * 100).toFixed(1).padStart(5) + '%';
const oneIn = p => (p > 0 ? `1 em ${Math.round(1 / p).toLocaleString('pt-BR')}` : '—');

function printProbs(games) {
  console.log('\n📊 Probabilidades por jogo (modelo Elo→Poisson, tempering ' + ELO_SHRINK + ', jogo neutro)\n');
  console.log('  # Mandante           Visitante         |     1      X      2 | favorito');
  console.log('  ' + '─'.repeat(74));
  games.forEach((g, i) => {
    const fav = ORDER.map(k => ({ k, p: g.p[k] })).sort((a, b) => b.p - a.p)[0];
    const favName = fav.k === '1' ? pt(g.casa) : fav.k === '2' ? pt(g.fora) : 'Empate';
    console.log(
      `  ${String(i + 1).padStart(2)} ${pt(g.casa).padEnd(18)} ${pt(g.fora).padEnd(16)} |` +
      ` ${pct(g.p['1'])}${pct(g.p['X'])}${pct(g.p['2'])} | ${fav.k} ${favName} (${(fav.p * 100).toFixed(1)}%)`,
    );
  });
}

function printBet(games, res, title) {
  const nd = res.levels.filter(c => c === 2).length;
  const nt = res.levels.filter(c => c === 3).length;
  const price = games.price * res.combos;
  console.log(`\n🎯 ${title}`);
  console.log(`   ${res.combos} combinações · R$ ${price.toLocaleString('pt-BR')} · ${nd} duplo(s) + ${nt} triplo(s)`);
  console.log(`   P(premiada 13/14) = ${(res.Pprem * 100).toFixed(2)}% (${oneIn(res.Pprem)})  |  P(14 acertos) = ${(res.P14 * 100).toFixed(3)}% (${oneIn(res.P14)})`);
  res.levels.forEach((c, i) => {
    const g = games[i]; const tag = { 1: 'simples', 2: 'DUPLO ', 3: 'TRIPLO' }[c];
    const cols = g.lab[c].join('');
    console.log(`     J${String(i + 1).padStart(2)} ${pt(g.casa).padEnd(16)} x ${pt(g.fora).padEnd(14)} ${tag} [${cols.padEnd(3)}] cobertura ${(g.cov[c] * 100).toFixed(1)}%`);
  });
}

// ----- Main -----
async function main() {
  // Elo + tempering
  const predFile = process.env.PRED_FILE || 'predictions.json'; // PRED_FILE=predictions-v2.json p/ a base 1970+
  const preds = JSON.parse(await readFile(join(DATA_DIR, predFile), 'utf8'));
  const elo = Object.fromEntries(preds.teams.map(t => [t.name, t.elo]));
  try {
    const calib = JSON.parse(await readFile(join(DATA_DIR, 'calibration.json'), 'utf8'));
    if (calib?.shrink) ELO_SHRINK = calib.shrink;
  } catch { if (preds?.model?.tempering) ELO_SHRINK = preds.model.tempering; }

  // Jogos do concurso
  let cfg = DEFAULT_CONCURSO;
  try { cfg = JSON.parse(await readFile(join(DATA_DIR, 'loteca.json'), 'utf8')); } catch { /* usa fallback */ }
  const price = cfg.pricePerCombo || DEFAULT_PRICE_PER_COMBO;

  const games = cfg.jogos.map(j => {
    if (elo[j.casa] == null) throw new Error(`Sem Elo para "${j.casa}" (confira a grafia em predictions.json)`);
    if (elo[j.fora] == null) throw new Error(`Sem Elo para "${j.fora}" (confira a grafia em predictions.json)`);
    const p = outcomeProbs(elo[j.casa], elo[j.fora]);
    const { cov, lab } = gameCoverage(p);
    return { casa: j.casa, fora: j.fora, eloCasa: elo[j.casa], eloFora: elo[j.fora], p, cov, lab };
  });
  games.price = price;

  if (games.length !== 14) console.warn(`⚠ ${games.length} jogos (a Loteca tem 14).`);

  const args = process.argv.slice(2);
  const arg = args[0];

  console.log(`\n🍀 Loteca — concurso ${cfg.concurso ?? '?'} · R$ ${price.toFixed(2)}/combinação · teto ${MAX_COMBOS} combinações`);

  // --bet 1=1X2,2=2,...  (avalia marcação do usuário)
  if (arg === '--bet' && args[1]) {
    printProbs(games);
    const res = evaluate(games, parseMarkings(args[1], games));
    console.log(`\n🎯 Sua marcação: ${res.combos} combinações · R$ ${(price * res.combos).toLocaleString('pt-BR')}`);
    console.log(`   P(premiada 13/14) = ${(res.Pprem * 100).toFixed(2)}% (${oneIn(res.Pprem)})  |  P(14) = ${(res.P14 * 100).toFixed(3)}% (${oneIn(res.P14)})`);
    return;
  }

  // --complemento "1=1X,2=2,..." [orçamento]  -> melhor 2ª aposta dado o bilhete já feito
  if (arg === '--complemento' && args[1]) {
    const Acols = parseMarkings(args[1], games);
    const A = evaluate(games, Acols);
    const budget = args[2] && !Number.isNaN(Number(args[2])) ? Number(args[2]) : A.combos * price;
    const maxCombos = Math.min(MAX_COMBOS, Math.floor(budget / price));
    const best = optimizeComplement(games, Acols, maxCombos);
    const Bcols = best.cols;
    const B = evaluate(games, Bcols);
    const u = unionStats(games, Acols, Bcols);
    console.log(`\n🎟️  Aposta já feita (A): ${A.combos} comb · R$ ${(A.combos * price).toLocaleString('pt-BR')} · P(premiada)=${(A.Pprem * 100).toFixed(2)}%`);
    console.log(`🎯 Melhor COMPLEMENTO (B) até R$ ${budget.toLocaleString('pt-BR')}: ${B.combos} comb · R$ ${(B.combos * price).toLocaleString('pt-BR')} · P(premiada)=${(B.Pprem * 100).toFixed(2)}%`);
    console.log(`\n   ⇒ A ∪ B: P(premiada 13/14) = ${(u.union * 100).toFixed(2)}% (${oneIn(u.union)})   P(14 acertos) = ${(u.union14 * 100).toFixed(3)}% (${oneIn(u.union14)})`);
    console.log(`   (A sozinha: ${(A.Pprem * 100).toFixed(2)}% → ganho de +${((u.union - A.Pprem) * 100).toFixed(2)} ponto(s) com a 2ª aposta)\n`);
    console.log('   Jogo                                A        B (complemento)');
    console.log('   ' + '─'.repeat(60));
    games.forEach((g, i) => {
      const diff = JSON.stringify([...Acols[i]].sort()) !== JSON.stringify([...Bcols[i]].sort());
      const tag = { 1: 'simples', 2: 'DUPLO', 3: 'TRIPLO' }[Bcols[i].length];
      console.log(`   J${String(i + 1).padStart(2)} ${(pt(g.casa) + ' x ' + pt(g.fora)).padEnd(30)} [${Acols[i].join('').padEnd(3)}]   [${Bcols[i].join('').padEnd(3)}] ${tag}${diff ? '  ← difere' : ''}`);
    });
    return;
  }

  printProbs(games);

  if (arg === '--probs') return;

  if (arg === '--max') {
    printBet(games, optimize(games, MAX_COMBOS), 'Aposta de PROBABILIDADE MÁXIMA (limite Loteca)');
    return;
  }

  // Orçamento específico (em reais)
  if (arg && !Number.isNaN(Number(arg))) {
    const budget = Number(arg);
    const maxCombos = Math.min(MAX_COMBOS, Math.floor(budget / price));
    if (maxCombos < 1) { console.log(`\nOrçamento insuficiente: a combinação custa R$ ${price.toFixed(2)}.`); return; }
    printBet(games, optimize(games, maxCombos), `Melhor aposta até R$ ${budget.toLocaleString('pt-BR')}`);
    return;
  }

  // Padrão: faixas de custo-benefício + máxima
  const tiers = [4, 8, 24, 72, 216, 486];
  console.log('\n══════════ Apostas ótimas por faixa de preço ══════════');
  for (const reais of tiers) {
    const maxCombos = Math.min(MAX_COMBOS, Math.floor(reais / price));
    printBet(games, optimize(games, maxCombos), `Faixa R$ ${reais}`);
  }
  printBet(games, optimize(games, MAX_COMBOS), 'PROBABILIDADE MÁXIMA (limite Loteca)');
  console.log('\nDica: `<orçamento>` para qualquer valor · `--bet 1=1X2,...` avalia a sua · `--complemento 1=1X2,...` acha a melhor 2ª aposta.');
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
