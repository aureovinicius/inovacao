#!/usr/bin/env node
// Base de Elo ALTERNATIVA: só jogos de 1970+, com pesos de torneio customizados.
// Mesma mecânica do predict.mjs (1500, mando 70, 170 pts/gol, mult. de goleada).
//
// Pesos por NOME EXATO da competição (qualquer outra = 10):
//   K60: FIFA World Cup
//   K50: UEFA Euro, Copa América
//   K40: UEFA Euro qualification, Copa América qualification, African Cup of Nations,
//        UEFA Nations League, CONCACAF Nations League, Gold Cup, AFC Asian Cup
//   K20: Friendly
//
// "FIFA World Cup qualification" é especial — o peso depende da confederação dos times:
//   UEFA (Europa) → 50 · CONMEBOL (Am. do Sul) → 40 · demais/repescagem → 30
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const CSV = process.env.RESULTS_CSV_URL || 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv';
const SINCE = 1970, ELO_BASE = 1500, HOME_ADV = 70;
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const WEIGHTS = {
  'FIFA World Cup': 60,
  'UEFA Euro': 50, 'Copa América': 50,
  'UEFA Euro qualification': 40, 'Copa América qualification': 40,
  'African Cup of Nations': 40, 'UEFA Nations League': 40,
  'CONCACAF Nations League': 40, 'Gold Cup': 40, 'AFC Asian Cup': 40,
  'Friendly': 20,
};

// Seleção -> confederação (inclui grafias históricas/variantes).
const CONFED = {
  UEFA: ['Albania', 'Andorra', 'Armenia', 'Austria', 'Azerbaijan', 'Belarus', 'Belgium', 'Bosnia-Herzegovina', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Czechia', 'Czechoslovakia', 'Denmark', 'England', 'Estonia', 'Faroe Islands', 'Finland', 'France', 'Georgia', 'Germany', 'West Germany', 'East Germany', 'German DR', 'Gibraltar', 'Greece', 'Hungary', 'Iceland', 'Israel', 'Italy', 'Kazakhstan', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Montenegro', 'Netherlands', 'North Macedonia', 'Macedonia', 'Northern Ireland', 'Norway', 'Poland', 'Portugal', 'Republic of Ireland', 'Ireland', 'Romania', 'Russia', 'Soviet Union', 'San Marino', 'Scotland', 'Serbia', 'Serbia and Montenegro', 'Yugoslavia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Turkey', 'Ukraine', 'Wales'],
  CONMEBOL: ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Paraguay', 'Peru', 'Uruguay', 'Venezuela'],
  CONCACAF: ['United States', 'Mexico', 'Canada', 'Costa Rica', 'Honduras', 'Panama', 'El Salvador', 'Guatemala', 'Jamaica', 'Trinidad and Tobago', 'Haiti', 'Cuba', 'Curaçao', 'Netherlands Antilles', 'Suriname', 'Nicaragua', 'Belize', 'Bermuda', 'Antigua and Barbuda', 'Aruba', 'Barbados', 'Bahamas', 'Cayman Islands', 'Dominica', 'Dominican Republic', 'Grenada', 'Guyana', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Montserrat', 'Puerto Rico', 'British Virgin Islands', 'United States Virgin Islands', 'Anguilla', 'Turks and Caicos Islands', 'Bonaire', 'French Guiana', 'Guadeloupe', 'Martinique', 'Sint Maarten', 'Saint Martin'],
  CAF: ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Upper Volta', 'Burundi', 'Cameroon', 'Cape Verde', 'Central African Republic', 'Chad', 'Comoros', 'Congo', 'DR Congo', 'Zaire', 'Ivory Coast', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Swaziland', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'],
  AFC: ['Afghanistan', 'Australia', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China PR', 'China', 'Chinese Taipei', 'Taiwan', 'Guam', 'Hong Kong', 'India', 'Indonesia', 'Iran', 'Iraq', 'Japan', 'Jordan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Macau', 'Malaysia', 'Maldives', 'Mongolia', 'Myanmar', 'Burma', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka', 'Syria', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Vietnam Republic', 'South Vietnam', 'Yemen', 'Yemen DPR', 'North Yemen', 'South Yemen'],
  OFC: ['American Samoa', 'Cook Islands', 'Fiji', 'New Caledonia', 'New Zealand', 'Papua New Guinea', 'Samoa', 'Solomon Islands', 'Tahiti', 'Tonga', 'Vanuatu'],
};
const CONF = {};
for (const [k, arr] of Object.entries(CONFED)) for (const n of arr) CONF[norm(n)] = k;

// Peso do jogo. Eliminatória da Copa: depende da confederação dos dois times.
function weight(tour, home, away) {
  if (tour === 'FIFA World Cup qualification') {
    const ch = CONF[norm(home)], ca = CONF[norm(away)];
    if (ch === 'UEFA' && ca === 'UEFA') return 50;           // Europa
    if (ch === 'CONMEBOL' && ca === 'CONMEBOL') return 40;   // América do Sul
    return 30;                                                // demais + repescagem
  }
  return WEIGHTS[tour] ?? 10;
}

const expectedScore = (ra, rb) => 1 / (1 + 10 ** ((rb - ra) / 400));
const parseLine = (line) => { const o = []; let c = '', q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };

const txt = await (await fetch(CSV)).text();
const lines = txt.split('\n');
const rows = [];
for (let i = 1; i < lines.length; i++) {
  const c = parseLine(lines[i]); if (c.length < 9) continue;
  const hg = parseInt(c[3], 10), ag = parseInt(c[4], 10);
  if (Number.isNaN(hg) || Number.isNaN(ag)) continue;
  const year = parseInt(c[0].slice(0, 4), 10); if (!(year >= SINCE)) continue;
  rows.push({ date: c[0], home: c[1].trim(), away: c[2].trim(), hg, ag, tour: c[5], neutral: (c[8] || '').toLowerCase().includes('true') });
}
rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

const R = new Map(), played = new Map();
const get = n => R.get(n) ?? ELO_BASE;
for (const m of rows) {
  const Rh = get(m.home), Ra = get(m.away), ha = m.neutral ? 0 : HOME_ADV;
  const Eh = expectedScore(Rh + ha, Ra);
  const Wh = m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0;
  const gd = Math.abs(m.hg - m.ag);
  const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
  const K = weight(m.tour, m.home, m.away) * G;
  R.set(m.home, Rh + K * (Wh - Eh));
  R.set(m.away, Ra + K * ((1 - Wh) - (1 - Eh)));
  played.set(m.home, (played.get(m.home) || 0) + 1); played.set(m.away, (played.get(m.away) || 0) + 1);
}
const all = [...R.entries()].map(([name, elo]) => ({ name, elo: Math.round(elo), played: played.get(name) || 0 }))
  .sort((a, b) => b.elo - a.elo);
await writeFile(join(DATA, 'elo-1970-custom.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), since: SINCE, homeAdv: HOME_ADV,
  weights: WEIGHTS, wcQualByConfed: { UEFA: 50, CONMEBOL: 40, outros: 30 },
  jogos: rows.length, teams: all,
}, null, 2));
console.log('jogos usados (1970+):', rows.length, '| seleções:', all.length, '| salvo em data/elo-1970-custom.json');
console.log('\nTOP 30 do novo Elo:');
all.slice(0, 30).forEach((t, i) => console.log(String(i + 1).padStart(2), t.name.padEnd(22), t.elo, '(' + t.played + ' jogos)'));
