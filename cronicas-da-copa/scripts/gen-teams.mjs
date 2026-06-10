// Gera data/teams-2026.json para o jogo a partir dos dados do dashboard da Copa.
// Fonte: ../../data/predictions.json (Elo + grupo) e ../../data/teams.json (cores/técnico).
// Uso (a partir da pasta cronicas-da-copa):  node scripts/gen-teams.mjs
//
// O Elo vira a "força" da seleção, usada pelo motor de partida. Mantemos um
// arquivo enxuto (só o que o jogo precisa) para baratear o carregamento no mobile.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..'); // repositório copa

const predictions = JSON.parse(readFileSync(resolve(root, 'data/predictions.json'), 'utf8'));
const teamsRaw = JSON.parse(readFileSync(resolve(root, 'data/teams.json'), 'utf8'));

// índice de cores/técnico por id
const meta = new Map();
for (const t of teamsRaw.teams || []) {
  const coach = t.coach ? [t.coach.firstName, t.coach.lastName].filter(Boolean).join(' ') : null;
  meta.set(t.id, { clubColors: t.clubColors || null, coach: coach || null });
}

const teams = (predictions.teams || []).map((t) => {
  const m = meta.get(t.id) || {};
  return {
    id: t.id,
    name: t.name,
    tla: t.tla,
    crest: t.crest,
    group: t.group,
    elo: Math.round(t.elo),
    clubColors: m.clubColors,
    coach: m.coach,
  };
});

teams.sort((a, b) => (a.group + a.name).localeCompare(b.group + b.name));

const out = {
  competition: 'Copa do Mundo 2026',
  edition: 2026,
  teamCount: teams.length,
  source: 'football-data.org + Elo histórico (projeto Copa 2026)',
  generatedAt: new Date().toISOString(),
  teams,
};

const dest = resolve(__dirname, '..', 'data', 'teams-2026.json');
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log(`OK: ${teams.length} seleções -> ${dest}`);
console.log('Elo range:', Math.min(...teams.map(t => t.elo)), '..', Math.max(...teams.map(t => t.elo)));
