#!/usr/bin/env node
// Módulo preditivo da Copa 2026 (v1) — calcula probabilidades por seleção:
//   título, final, semifinal, quartas, oitavas, avançar do grupo, vencer o grupo.
//
// Duas peças (ver explicação no README/PREDICT.md):
//   A) Força das seleções via Elo, calculado a partir do histórico internacional.
//   B) Simulação de Monte Carlo do torneio (grupos com desempates da FIFA + mata-mata).
//
// Honestidade do v1:
//   - Grupos: desempates da FIFA (pontos, saldo, gols, confronto direto) — exato.
//   - Mata-mata: chaveamento por força (seeded), NÃO a tabela fixa oficial da FIFA.
//     A trajetória exata entra na v2. Isso é sinalizado em predictions.json (model.notes).
//
// Dados:
//   - Elo: base histórica pública (CSV). Sem rede/sem match, cai no Elo-semente embutido.
//   - Grupos e seleções: data/standings.json. Resultados já ocorridos: data/matches.json.

import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const RESULTS_CSV_URL = process.env.RESULTS_CSV_URL
  || 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv';
const SIMS = Number(process.env.PREDICT_SIMS || 20000);

// ----- Parâmetros do modelo (ajustáveis/validáveis) -----
const ELO_BASE = 1500;
const HOME_ADV = 70;       // bônus Elo de mando (só para país-sede jogando em casa)
const ELO_PER_GOAL = 170;  // ~170 pontos de Elo ≈ 1 gol de diferença esperada
const AVG_TOTAL_GOALS = 2.6;
const HOSTS = new Set(['United States', 'Mexico', 'Canada']);

// Pesos de importância por tipo de torneio (afeta o K do Elo).
function tournamentWeight(t = '') {
  const s = t.toLowerCase();
  if (s.includes('world cup') && !s.includes('qualif')) return 60;
  if (s.includes('copa am') || s.includes('european championship') || s.includes('uefa euro')) return 50;
  if (s.includes('qualif')) return 40;
  if (s.includes('nations league')) return 40;
  if (s.includes('confederations') || s.includes('gold cup') || s.includes('african cup') || s.includes('asian cup')) return 40;
  if (s.includes('friendly')) return 20;
  return 30;
}

// ----- Util -----
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Apelidos: nome na nossa base -> possíveis grafias no CSV histórico.
const ALIASES = {
  'Czechia': ['czech republic', 'czechia'],
  'Turkey': ['turkey', 'turkiye', 'türkiye'],
  'South Korea': ['south korea', 'korea republic'],
  'Iran': ['iran', 'ir iran'],
  'United States': ['united states', 'usa'],
  'Ivory Coast': ['ivory coast', "cote d'ivoire", 'côte d’ivoire'],
  'Cape Verde Islands': ['cape verde', 'cabo verde', 'cape verde islands'],
  'Congo DR': ['dr congo', 'congo dr', 'democratic republic of the congo', 'zaire'],
  'Curaçao': ['curacao', 'netherlands antilles'],
  'Bosnia-Herzegovina': ['bosnia and herzegovina', 'bosnia-herzegovina'],
};

// Elo-semente (FALLBACK apenas — usado se o CSV não puder ser baixado/casado).
// O caminho real calcula o Elo do histórico no GitHub Actions.
const SEED_ELO = {
  ARG: 2090, FRA: 2080, BRA: 2060, ESP: 2050, ENG: 2010, POR: 1990, NED: 1975, GER: 1965,
  BEL: 1930, CRO: 1900, MAR: 1890, URY: 1880, COL: 1860, NOR: 1830, SUI: 1820, JPN: 1815,
  USA: 1805, SEN: 1800, MEX: 1800, ECU: 1790, AUT: 1790, TUR: 1790, CZE: 1780, ALG: 1780,
  SWE: 1780, IRN: 1775, KOR: 1770, CAN: 1760, AUS: 1745, EGY: 1740, PAR: 1740, SCO: 1740,
  CIV: 1730, TUN: 1720, GHA: 1705, RSA: 1700, COD: 1700, UZB: 1680, QAT: 1680, KSA: 1690,
  JOR: 1655, IRQ: 1650, NZL: 1645, CPV: 1650, PAN: 1640, HAI: 1605, CUW: 1600, BIH: 1740,
};

// ----- Distribuições -----
function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// Probabilidade de vitória de A pelo Elo (logística padrão do Elo).
const expectedScore = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));

// Gera um placar de um confronto de grupo via Poisson, a partir do Elo.
function sampleGroupMatch(ra, rb, homeAdvA = 0, homeAdvB = 0) {
  const mu = (ra + homeAdvA - rb - homeAdvB) / ELO_PER_GOAL; // saldo esperado
  const la = Math.max(0.15, (AVG_TOTAL_GOALS + mu) / 2);
  const lb = Math.max(0.15, (AVG_TOTAL_GOALS - mu) / 2);
  return [poisson(la), poisson(lb)];
}

// ----- Elo a partir do histórico -----
function parseCsvLine(line) {
  // CSV simples: date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function computeEloFromHistory(teamsByAlias) {
  let text;
  try {
    const res = await fetch(RESULTS_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.warn(`⚠ Histórico indisponível (${err.message}). Usando Elo-semente de fallback.`);
    return null;
  }
  const lines = text.split('\n');
  const ratings = new Map(); // nome normalizado -> Elo
  const get = n => ratings.get(n) ?? ELO_BASE;

  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    if (c.length < 9) continue;
    const [date, home, away, hs, as_, tour, , country, neutral] = c;
    const hg = parseInt(hs, 10), ag = parseInt(as_, 10);
    if (Number.isNaN(hg) || Number.isNaN(ag)) continue;
    const hn = norm(home), an = norm(away);
    const isNeutral = norm(neutral) === 'true';
    const ha = isNeutral ? 0 : HOME_ADV;
    const Rh = get(hn), Ra = get(an);
    const Eh = expectedScore(Rh + ha, Ra);
    const Wh = hg > ag ? 1 : hg === ag ? 0.5 : 0;
    const gd = Math.abs(hg - ag);
    const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8; // multiplicador por saldo (estilo World Football Elo)
    const K = tournamentWeight(tour) * G;
    ratings.set(hn, Rh + K * (Wh - Eh));
    ratings.set(an, Ra + K * ((1 - Wh) - (1 - Eh)));
  }

  // Casa cada uma das 48 seleções a uma grafia do CSV.
  const elo = {};
  let matched = 0;
  for (const [tla, names] of Object.entries(teamsByAlias)) {
    let r = null;
    for (const cand of names) { if (ratings.has(cand)) { r = ratings.get(cand); break; } }
    if (r != null) { elo[tla] = Math.round(r); matched++; }
    else elo[tla] = SEED_ELO[tla] ?? ELO_BASE;
  }
  console.log(`✓ Elo do histórico: ${matched}/${Object.keys(teamsByAlias).length} seleções casadas`);
  return elo;
}

// ----- Carrega grupos/seleções e resultados já ocorridos -----
async function loadJSON(name) {
  try { return JSON.parse(await readFile(join(DATA_DIR, name), 'utf8')); } catch { return null; }
}

function buildGroups(standings) {
  const groups = {};
  (standings?.standings || []).filter(s => s.type === 'TOTAL' && s.group).forEach(s => {
    const letter = (s.group || '').replace(/^group/i, '').replace(/[_\s]/g, '').toUpperCase();
    groups[letter] = s.table.map(r => r.team);
  });
  return groups;
}

// Resultados de grupo já ocorridos: chave "idMenor-idMaior" -> {a,b,ga,gb} (a = idMenor)
function playedGroupResults(matches) {
  const map = {};
  (matches?.matches || []).forEach(m => {
    if (m.status !== 'FINISHED' || !m.group) return;
    const h = m.homeTeam?.id, a = m.awayTeam?.id;
    const gh = m.score?.fullTime?.home, ga = m.score?.fullTime?.away;
    if (h == null || a == null || gh == null) return;
    const [x, y, gx, gy] = h < a ? [h, a, gh, ga] : [a, h, ga, gh];
    map[`${x}-${y}`] = { gx, gy };
  });
  return map;
}

// Resultados já decididos do mata-mata: chave "idMenor-idMaior" -> id do vencedor.
function finishedKnockout(matches) {
  const map = {};
  (matches?.matches || []).forEach(m => {
    if (m.status !== 'FINISHED' || m.group || m.stage === 'GROUP_STAGE') return;
    const h = m.homeTeam?.id, a = m.awayTeam?.id;
    if (h == null || a == null) return;
    let win = null;
    const w = m.score?.winner;
    if (w === 'HOME_TEAM') win = h;
    else if (w === 'AWAY_TEAM') win = a;
    else {
      const gh = m.score?.fullTime?.home, ga = m.score?.fullTime?.away;
      if (gh != null && ga != null && gh !== ga) win = gh > ga ? h : a;
    }
    if (win != null) map[`${Math.min(h, a)}-${Math.max(h, a)}`] = win;
  });
  return map;
}

// Ajusta o Elo (por cima do histórico) com os jogos FINISHED da própria Copa — "Elo ao vivo".
function applyTournamentResults(elo, matches) {
  let n = 0;
  (matches?.matches || []).forEach(m => {
    if (m.status !== 'FINISHED') return;
    const h = m.homeTeam, a = m.awayTeam;
    const gh = m.score?.fullTime?.home, ga = m.score?.fullTime?.away;
    if (!h?.tla || !a?.tla || gh == null || ga == null) return;
    if (elo[h.tla] == null || elo[a.tla] == null) return;
    const ha = HOSTS.has(h.name) ? HOME_ADV : 0;
    const Rh = elo[h.tla], Ra = elo[a.tla];
    const Eh = expectedScore(Rh + ha, Ra);
    const Wh = gh > ga ? 1 : gh === ga ? 0.5 : 0;
    const gd = Math.abs(gh - ga);
    const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    const K = 60 * G; // peso de Copa do Mundo
    elo[h.tla] = Math.round(Rh + K * (Wh - Eh));
    elo[a.tla] = Math.round(Ra + K * ((1 - Wh) - (1 - Eh)));
    n++;
  });
  if (n) console.log(`✓ Elo ajustado com ${n} jogo(s) já disputado(s) da Copa`);
}

// ----- Simulação de um grupo -----
function simulateGroup(teams, elo, played) {
  const rows = teams.map(t => ({
    team: t, pts: 0, gf: 0, ga: 0,
    h2h: {}, // id -> {pts,gd,gf} no confronto direto
  }));
  const byId = Object.fromEntries(rows.map(r => [r.team.id, r]));

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const A = teams[i], B = teams[j];
      const [x, y] = A.id < B.id ? [A, B] : [B, A];
      let gx, gy;
      const fixed = played[`${x.id}-${y.id}`];
      if (fixed) { gx = fixed.gx; gy = fixed.gy; }
      else {
        const haX = HOSTS.has(x.name) ? HOME_ADV : 0;
        const haY = HOSTS.has(y.name) ? HOME_ADV : 0;
        [gx, gy] = sampleGroupMatch(elo[x.tla], elo[y.tla], haX, haY);
      }
      const rx = byId[x.id], ry = byId[y.id];
      rx.gf += gx; rx.ga += gy; ry.gf += gy; ry.ga += gx;
      const px = gx > gy ? 3 : gx === gy ? 1 : 0;
      const py = gy > gx ? 3 : gx === gy ? 1 : 0;
      rx.pts += px; ry.pts += py;
      rx.h2h[y.id] = { pts: px, gd: gx - gy, gf: gx };
      ry.h2h[x.id] = { pts: py, gd: gy - gx, gf: gy };
    }
  }

  rows.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const agd = a.gf - a.ga, bgd = b.gf - b.ga;
    if (bgd !== agd) return bgd - agd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    // Confronto direto (entre os empatados deste par)
    const ah = a.h2h[b.team.id], bh = b.h2h[a.team.id];
    if (ah && bh) {
      if (bh.pts !== ah.pts) return bh.pts - ah.pts;
      if (bh.gd !== ah.gd) return bh.gd - ah.gd;
      if (bh.gf !== ah.gf) return bh.gf - ah.gf;
    }
    return Math.random() - 0.5; // sorteio
  });
  return rows; // [1º,2º,3º,4º]
}

// ----- Mata-mata: tabela OFICIAL da Copa 2026 (FIFA) -----
// 16-avos = jogos 73–88. Slots: ['W',g]=vencedor do grupo g; ['R',g]=2º do grupo g;
// ['T',jogo]=3º colocado alocado àquele jogo (dentre os grupos permitidos abaixo).
const THIRD_SLOTS = [
  { m: 74, allow: 'ABCDF' }, { m: 77, allow: 'CDFGH' }, { m: 79, allow: 'CEFHI' },
  { m: 80, allow: 'EHIJK' }, { m: 81, allow: 'BEFIJ' }, { m: 82, allow: 'AEHIJ' },
  { m: 85, allow: 'EFGIJ' }, { m: 87, allow: 'DEIJL' },
];
const R32 = [
  [73, ['R', 'A'], ['R', 'B']], [74, ['W', 'E'], ['T', 74]], [75, ['W', 'F'], ['R', 'C']],
  [76, ['W', 'C'], ['R', 'F']], [77, ['W', 'I'], ['T', 77]], [78, ['R', 'E'], ['R', 'I']],
  [79, ['W', 'A'], ['T', 79]], [80, ['W', 'L'], ['T', 80]], [81, ['W', 'D'], ['T', 81]],
  [82, ['W', 'G'], ['T', 82]], [83, ['R', 'K'], ['R', 'L']], [84, ['W', 'H'], ['R', 'J']],
  [85, ['W', 'B'], ['T', 85]], [86, ['W', 'J'], ['R', 'H']], [87, ['W', 'K'], ['T', 87]],
  [88, ['R', 'D'], ['R', 'G']],
];
// Árvore a partir das oitavas: [jogo, origemA, origemB]
const TREE = [
  [89, 74, 77], [90, 73, 75], [91, 76, 78], [92, 79, 80], [93, 83, 84], [94, 81, 82], [95, 86, 88], [96, 85, 87],
  [97, 89, 90], [98, 93, 94], [99, 91, 92], [100, 95, 96],
  [101, 97, 98], [102, 99, 100],
  [104, 101, 102],
];
// Nível alcançado pelo VENCEDOR de cada jogo: 1=oitavas,2=quartas,3=semi,4=final,5=campeão
const ROUND_LEVEL = m => m <= 88 ? 1 : m <= 96 ? 2 : m <= 100 ? 3 : m <= 102 ? 4 : 5;

// Aloca os 8 melhores terceiros aos 8 slots, respeitando os grupos permitidos (matching bipartido).
function assignThirds(bestThirds) {
  const n = THIRD_SLOTS.length;
  const thirdForSlot = new Array(n).fill(-1);
  const tryK = (i, seen) => {
    for (let s = 0; s < n; s++) {
      if (THIRD_SLOTS[s].allow.includes(bestThirds[i].group) && !seen[s]) {
        seen[s] = true;
        if (thirdForSlot[s] < 0 || tryK(thirdForSlot[s], seen)) { thirdForSlot[s] = i; return true; }
      }
    }
    return false;
  };
  for (let i = 0; i < bestThirds.length; i++) tryK(i, new Array(n).fill(false));
  const byMatch = {};
  for (let s = 0; s < n; s++) if (thirdForSlot[s] >= 0) byMatch[THIRD_SLOTS[s].m] = bestThirds[thirdForSlot[s]].team;
  return byMatch;
}

function koWinner(A, B, elo, finishedKO) {
  // Se o confronto já foi decidido na vida real, trava o vencedor.
  const real = finishedKO?.[`${Math.min(A.id, B.id)}-${Math.max(A.id, B.id)}`];
  if (real != null) return real === A.id ? A : B;
  const ha = t => (HOSTS.has(t.name) ? HOME_ADV : 0); // sede joga em casa
  return Math.random() < expectedScore(elo[A.tla] + ha(A), elo[B.tla] + ha(B)) ? A : B;
}

function simulateKnockout(winnersByG, runnersByG, bestThirds, elo, finishedKO) {
  const thirdByMatch = assignThirds(bestThirds);
  const resolve = slot => slot[0] === 'W' ? winnersByG[slot[1]]
    : slot[0] === 'R' ? runnersByG[slot[1]] : thirdByMatch[slot[1]];

  const reached = {};
  const mark = (t, lvl) => { if (t) reached[t.id] = Math.max(reached[t.id] || 0, lvl); };
  Object.values(winnersByG).forEach(t => { reached[t.id] = 0; });
  Object.values(runnersByG).forEach(t => { reached[t.id] = 0; });
  bestThirds.forEach(x => { reached[x.team.id] = 0; });

  const wmatch = {};
  for (const [m, a, b] of R32) {
    const w = koWinner(resolve(a), resolve(b), elo, finishedKO);
    wmatch[m] = w; mark(w, ROUND_LEVEL(m));
  }
  for (const [m, x, y] of TREE) {
    const w = koWinner(wmatch[x], wmatch[y], elo, finishedKO);
    wmatch[m] = w; mark(w, ROUND_LEVEL(m));
  }
  return reached;
}

// ----- Main -----
async function main() {
  const standings = await loadJSON('standings.json');
  const matches = await loadJSON('matches.json');
  const groups = buildGroups(standings);
  const groupLetters = Object.keys(groups).sort();
  const allTeams = groupLetters.flatMap(g => groups[g]);

  if (allTeams.length < 2) {
    console.warn('Sem grupos suficientes em standings.json — pulando predição.');
    return;
  }

  // alias por TLA para casar com o CSV
  const teamsByAlias = {};
  for (const t of allTeams) {
    teamsByAlias[t.tla] = (ALIASES[t.name] || [norm(t.name)]).map(norm);
  }
  const eloFromHist = await computeEloFromHistory(teamsByAlias);
  const elo = {};
  for (const t of allTeams) elo[t.tla] = (eloFromHist?.[t.tla]) ?? SEED_ELO[t.tla] ?? ELO_BASE;
  applyTournamentResults(elo, matches); // Elo "ao vivo": absorve jogos já disputados da Copa

  const played = playedGroupResults(matches);   // resultados de grupo (fixados na simulação)
  const finKO = finishedKnockout(matches);       // jogos do mata-mata já decididos (travados)

  // acumuladores
  const acc = {};
  allTeams.forEach(t => { acc[t.id] = { team: t, win: 0, fin: 0, sf: 0, qf: 0, r16: 0, adv: 0, top1: 0 }; });

  for (let s = 0; s < SIMS; s++) {
    const winnersByG = {}, runnersByG = {}, thirds = [];
    for (const g of groupLetters) {
      const r = simulateGroup(groups[g], elo, played);
      acc[r[0].team.id].top1++;
      acc[r[0].team.id].adv++; acc[r[1].team.id].adv++;
      winnersByG[g] = r[0].team; runnersByG[g] = r[1].team;
      thirds.push({ team: r[2].team, group: g, pts: r[2].pts, gd: r[2].gf - r[2].ga, gf: r[2].gf });
    }
    // 8 melhores terceiros
    thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || Math.random() - 0.5);
    const bestThirds = thirds.slice(0, 8);
    bestThirds.forEach(t => acc[t.team.id].adv++);

    const reached = simulateKnockout(winnersByG, runnersByG, bestThirds, elo, finKO);
    for (const [id, r] of Object.entries(reached)) {
      if (r >= 1) acc[id].r16++;
      if (r >= 2) acc[id].qf++;
      if (r >= 3) acc[id].sf++;
      if (r >= 4) acc[id].fin++;
      if (r >= 5) acc[id].win++;
    }
  }

  const pct = n => Math.round((n / SIMS) * 1000) / 10; // 1 casa decimal
  const teams = allTeams.map(t => {
    const a = acc[t.id];
    return {
      id: t.id, name: t.name, tla: t.tla, crest: t.crest,
      group: groupLetters.find(g => groups[g].some(x => x.id === t.id)),
      elo: elo[t.tla],
      pChampion: pct(a.win), pFinal: pct(a.fin), pSemi: pct(a.sf),
      pQuarter: pct(a.qf), pR16: pct(a.r16), pAdvance: pct(a.adv), pWinGroup: pct(a.top1),
    };
  }).sort((a, b) => b.pChampion - a.pChampion || b.elo - a.elo);

  const out = {
    generatedAt: new Date().toISOString(),
    sims: SIMS,
    model: {
      ratings: (eloFromHist ? 'elo_historico' : 'elo_semente_fallback') + ' + jogos da Copa (Elo ao vivo)',
      groupStage: 'exato (desempates FIFA: pts, saldo, gols, confronto direto); resultados já ocorridos são fixados',
      knockout: 'tabela oficial FIFA 2026 (jogos 73–104); 3ºs por matching nos grupos permitidos; jogos já decididos são travados',
    },
    teams,
  };
  await writeFile(join(DATA_DIR, 'predictions.json'), JSON.stringify(out, null, 2));
  console.log(`✓ data/predictions.json (${SIMS} simulações) — favorito: ${teams[0].name} ${teams[0].pChampion}%`);
}

main().catch(err => { console.error(err); process.exit(1); });
