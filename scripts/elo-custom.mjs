#!/usr/bin/env node
// Base de Elo ALTERNATIVA: só jogos de 1970+, com pesos de torneio customizados.
// Mesma mecânica do predict.mjs (1500, mando 70, 170 pts/gol, mult. de goleada).
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CSV = process.env.RESULTS_CSV_URL || 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv';
const SINCE = 1970, ELO_BASE = 1500, HOME_ADV = 70;

// Pesos por NOME EXATO da competição; qualquer outra = 10.
const WEIGHTS = {
  'FIFA World Cup': 60,
  'UEFA Euro': 50, 'Copa América': 50, 'FIFA World Cup qualification': 50,
  'UEFA Euro qualification': 40, 'Copa América qualification': 40,
  'African Cup of Nations': 40, 'UEFA Nations League': 40,
  'CONCACAF Nations League': 40, 'Gold Cup': 40, 'AFC Asian Cup': 40,
  'Friendly': 20,
};
const weight = t => WEIGHTS[t] ?? 10;
const expectedScore = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));
const parseLine = (line) => { const o=[]; let c='',q=false; for(const ch of line){ if(ch==='"')q=!q; else if(ch===','&&!q){o.push(c);c='';} else c+=ch; } o.push(c); return o; };

const txt = await (await fetch(CSV)).text();
const lines = txt.split('\n');
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const c = parseLine(lines[i]); if (c.length < 9) continue;
  const hg = parseInt(c[3],10), ag = parseInt(c[4],10);
  if (Number.isNaN(hg)||Number.isNaN(ag)) continue;
  const year = parseInt(c[0].slice(0,4),10); if (!(year>=SINCE)) continue;
  rows.push({ date:c[0], home:c[1].trim(), away:c[2].trim(), hg, ag, tour:c[5], neutral:(c[8]||'').toLowerCase().includes('true') });
}
rows.sort((a,b)=> a.date<b.date?-1: a.date>b.date?1:0);

const R = new Map(), played = new Map(); // nome -> elo / jogos
const get = n => R.get(n) ?? ELO_BASE;
for (const m of rows) {
  const Rh = get(m.home), Ra = get(m.away), ha = m.neutral?0:HOME_ADV;
  const Eh = expectedScore(Rh+ha, Ra);
  const Wh = m.hg>m.ag?1: m.hg===m.ag?0.5:0;
  const gd = Math.abs(m.hg-m.ag);
  const G = gd<=1?1: gd===2?1.5:(11+gd)/8;
  const K = weight(m.tour)*G;
  R.set(m.home, Rh + K*(Wh-Eh));
  R.set(m.away, Ra + K*((1-Wh)-(1-Eh)));
  played.set(m.home,(played.get(m.home)||0)+1); played.set(m.away,(played.get(m.away)||0)+1);
}
const all = [...R.entries()].map(([name,elo])=>({ name, elo: Math.round(elo), played: played.get(name)||0 }))
  .sort((a,b)=> b.elo-a.elo);
await writeFile(join(DATA,'elo-1970-custom.json'), JSON.stringify({ generatedAt:new Date().toISOString(), since:SINCE, homeAdv:HOME_ADV, weights:WEIGHTS, jogos:rows.length, teams:all }, null, 2));
console.log('jogos usados (1970+):', rows.length, '| seleções:', all.length, '| salvo em data/elo-1970-custom.json');
console.log('\nTOP 30 do novo Elo:');
all.slice(0,30).forEach((t,i)=>console.log(String(i+1).padStart(2), t.name.padEnd(22), t.elo, '('+t.played+' jogos)'));
