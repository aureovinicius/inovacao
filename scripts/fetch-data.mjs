#!/usr/bin/env node
// Busca dados da Copa do Mundo 2026 na football-data.org e grava em /data.
// Uso: FOOTBALL_DATA_TOKEN=xxxxx node scripts/fetch-data.mjs
//
// A chave gratuita sai em https://www.football-data.org/client/register
// Free tier: ~10 req/min — por isso espaçamos as chamadas.
// Sem token, o script encerra sem sobrescrever os JSON de exemplo já versionados.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
const COMP = process.env.FOOTBALL_COMP || 'WC'; // World Cup
const BASE = 'https://api.football-data.org/v4';

const ENDPOINTS = {
  matches:   `/competitions/${COMP}/matches`,
  standings: `/competitions/${COMP}/standings`,
  scorers:   `/competitions/${COMP}/scorers?limit=30`,
  teams:     `/competitions/${COMP}/teams`,
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchJSON(path) {
  const res = await fetch(BASE + path, { headers: { 'X-Auth-Token': TOKEN } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} em ${path}: ${await res.text()}`);
  }
  return res.json();
}

async function save(name, data) {
  await writeFile(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  console.log(`✓ data/${name}.json`);
}

async function main() {
  if (!TOKEN) {
    console.warn('⚠ FOOTBALL_DATA_TOKEN não definido. Mantendo os JSON de exemplo. Saindo.');
    process.exit(0);
  }
  await mkdir(DATA_DIR, { recursive: true });

  const names = Object.keys(ENDPOINTS);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    try {
      const data = await fetchJSON(ENDPOINTS[name]);
      await save(name, data);
    } catch (err) {
      console.error(`✗ Falha em ${name}: ${err.message}`);
    }
    if (i < names.length - 1) await sleep(7000); // respeita o rate limit do free tier
  }

  await save('meta', {
    generatedAt: new Date().toISOString(),
    competition: COMP,
    source: 'football-data.org',
    totalTeams: 48,
  });

  console.log('Concluído.');
}

main().catch(err => { console.error(err); process.exit(1); });
