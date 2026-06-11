#!/usr/bin/env node
// Calibração automática do modelo de partidas (backtest histórico).
// Percorre os jogos internacionais em ordem cronológica; para cada um, PREVÊ o
// resultado (Vitória/Empate/Derrota) com o Elo daquele momento e compara com o real.
// Mede Brier, log-loss, acurácia e a curva de calibração — vs um palpite-base.
// Grava data/calibration.json. Usa o mesmo modelo (Elo + Poisson) do predict.mjs.

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const RESULTS_CSV_URL = process.env.RESULTS_CSV_URL
  || 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv';
const EVAL_SINCE = Number(process.env.CALIB_SINCE || 2010); // só avalia jogos a partir deste ano

// Parâmetros idênticos ao predict.mjs
// HOME_ADV afinado por backtest (2010+, ~15,8k jogos): 80 minimiza log-loss/Brier (vs 70).
const ELO_BASE = 1500, HOME_ADV = 80, ELO_PER_GOAL = 170, AVG_TOTAL_GOALS = 2.6;
function tournamentWeight(t = '') {
  const s = t.toLowerCase();
  if (s.includes('world cup') && !s.includes('qualif')) return 60;
  if (s.includes('copa am') || s.includes('european championship') || s.includes('uefa euro')) return 50;
  if (s.includes('qualif') || s.includes('nations league')) return 40;
  if (s.includes('confederations') || s.includes('gold cup') || s.includes('african cup') || s.includes('asian cup')) return 40;
  if (s.includes('friendly')) return 20;
  return 30;
}
const expectedScore = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));

function poissonPmf(lambda, kmax = 10) {
  const a = []; let p = Math.exp(-lambda);
  for (let k = 0; k <= kmax; k++) { a.push(p); p = p * lambda / (k + 1); }
  return a;
}
// Probabilidades [Vitória mandante, Empate, Vitória visitante] a partir do Elo.
// `shrink` < 1 "tempera" a diferença de força (puxa as probabilidades para perto de 50%).
function wdl(ra, rb, ha, shrink = 1) {
  const mu = ((ra - rb) * shrink + ha) / ELO_PER_GOAL;
  const la = Math.max(0.15, (AVG_TOTAL_GOALS + mu) / 2);
  const lb = Math.max(0.15, (AVG_TOTAL_GOALS - mu) / 2);
  const A = poissonPmf(la), B = poissonPmf(lb);
  let w = 0, d = 0, l = 0;
  for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
    const p = A[i] * B[j];
    if (i > j) w += p; else if (i === j) d += p; else l += p;
  }
  const s = w + d + l || 1;
  return [w / s, d / s, l / s];
}

function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main() {
  let text;
  try {
    const res = await fetch(RESULTS_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.warn(`⚠ Histórico indisponível (${err.message}) — pulando calibração.`);
    return;
  }

  const rows = [];
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    if (c.length < 9) continue;
    const hg = parseInt(c[3], 10), ag = parseInt(c[4], 10);
    if (Number.isNaN(hg) || Number.isNaN(ag)) continue;
    rows.push({ date: c[0], home: c[1].toLowerCase().trim(), away: c[2].toLowerCase().trim(), hg, ag, tour: c[5], neutral: (c[8] || '').toLowerCase().includes('true') });
  }
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  const ratings = new Map();
  const get = n => ratings.get(n) ?? ELO_BASE;

  // Candidatos de "tempering": multiplicador da diferença de Elo na hora de PREVER.
  const SHRINKS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0];
  const C = SHRINKS.length;
  const BINS = 10;
  const brier = new Array(C).fill(0), logloss = new Array(C).fill(0), correct = new Array(C).fill(0);
  const binsC = Array.from({ length: C }, () => Array.from({ length: BINS }, () => ({ sumPred: 0, obs: 0, n: 0 })));
  let n = 0, nW = 0, nD = 0, nL = 0;

  for (const m of rows) {
    const Rh = get(m.home), Ra = get(m.away);
    const ha = m.neutral ? 0 : HOME_ADV;
    const year = parseInt(m.date.slice(0, 4), 10);

    if (year >= EVAL_SINCE) {
      const outcome = m.hg > m.ag ? 0 : m.hg === m.ag ? 1 : 2; // 0=V,1=E,2=D
      for (let ci = 0; ci < C; ci++) {
        const [pw, pd, pl] = wdl(Rh, Ra, ha, SHRINKS[ci]);
        brier[ci] += (pw - (outcome === 0 ? 1 : 0)) ** 2 + (pd - (outcome === 1 ? 1 : 0)) ** 2 + (pl - (outcome === 2 ? 1 : 0)) ** 2;
        logloss[ci] += -Math.log(Math.max([pw, pd, pl][outcome], 1e-12));
        const pred = [pw, pd, pl];
        if (pred.indexOf(Math.max(...pred)) === outcome) correct[ci]++;
        const bi = Math.min(BINS - 1, Math.floor(pw * BINS));
        binsC[ci][bi].sumPred += pw; binsC[ci][bi].obs += (outcome === 0 ? 1 : 0); binsC[ci][bi].n++;
      }
      if (outcome === 0) nW++; else if (outcome === 1) nD++; else nL++;
      n++;
    }

    // atualiza o Elo com o resultado (walk-forward) — SEM tempering (dinâmica do rating)
    const Eh = expectedScore(Rh + ha, Ra);
    const Wh = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0;
    const gd = Math.abs(m.hg - m.ag);
    const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
    const K = tournamentWeight(m.tour) * G;
    ratings.set(m.home, Rh + K * (Wh - Eh));
    ratings.set(m.away, Ra + K * ((1 - Wh) - (1 - Eh)));
  }

  if (!n) { console.warn('Sem jogos para avaliar.'); return; }

  // Escolhe o tempering que minimiza o log-loss.
  let best = 0;
  for (let ci = 1; ci < C; ci++) if (logloss[ci] < logloss[best]) best = ci;
  const untemperedIdx = SHRINKS.indexOf(1.0);
  const metrics = ci => ({ brier: brier[ci] / n, logloss: logloss[ci] / n, accuracy: correct[ci] / n });

  // Palpite-base: sempre as taxas médias do período.
  const bW = nW / n, bD = nD / n, bL = nL / n;
  const baseBrier = (
    nW * ((bW - 1) ** 2 + bD ** 2 + bL ** 2) +
    nD * (bW ** 2 + (bD - 1) ** 2 + bL ** 2) +
    nL * (bW ** 2 + bD ** 2 + (bL - 1) ** 2)
  ) / n;
  const baseLog = -(nW * Math.log(bW) + nD * Math.log(bD) + nL * Math.log(bL)) / n;

  const out = {
    generatedAt: new Date().toISOString(),
    sinceYear: EVAL_SINCE,
    evaluated: n,
    shrink: SHRINKS[best],                  // tempering escolhido (usado pelo predict.mjs)
    model: metrics(best),                   // métricas já com o tempering
    untempered: metrics(untemperedIdx),     // sem tempering (para o antes/depois)
    baseline: { brier: baseBrier, logloss: baseLog },
    baseRates: { homeWin: bW, draw: bD, awayWin: bL },
    bins: binsC[best].map((b, i) => ({
      from: i / BINS, to: (i + 1) / BINS,
      predicted: b.n ? b.sumPred / b.n : 0,
      observed: b.n ? b.obs / b.n : 0,
      n: b.n,
    })),
    note: 'Backtest walk-forward do modelo de partidas (Elo→Poisson) com tempering ajustado por log-loss. Brier/log-loss menores = melhor; previsto ≈ observado = bem calibrado.',
  };
  await writeFile(join(DATA_DIR, 'calibration.json'), JSON.stringify(out, null, 2));
  console.log(`✓ data/calibration.json — ${n} jogos (${EVAL_SINCE}+)`);
  console.log(`  tempering s=${out.shrink} | Brier ${out.untempered.brier.toFixed(3)}→${out.model.brier.toFixed(3)} | LogLoss ${out.untempered.logloss.toFixed(3)}→${out.model.logloss.toFixed(3)} | base ${baseLog.toFixed(3)} | acurácia ${(out.model.accuracy * 100).toFixed(1)}%`);
}

main().catch(err => { console.error(err); process.exit(1); });
