#!/usr/bin/env node
// Gera o módulo de notícias da Copa 2026 em data/news.<lang>.json.
// 1) Resumo do dia ("digest") gerado a partir dos nossos dados (matches/standings/scorers).
// 2) Últimas notícias via Google News RSS (público, sem chave), um feed por idioma.
//
// Sem dependências externas: parser de RSS minimalista. Falhas de rede não derrubam o build
// (o arquivo é gravado ao menos com o resumo do dia).

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEAMS } from '../js/i18n.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const FEEDS = [
  { lang: 'pt-BR', q: 'Copa do Mundo 2026', hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt' },
  { lang: 'en-US', q: 'World Cup 2026 soccer', hl: 'en-US', gl: 'US', ceid: 'US:en' },
  { lang: 'es-MX', q: 'Mundial 2026', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
  { lang: 'fr-CA', q: 'Coupe du monde 2026 soccer', hl: 'fr-CA', gl: 'CA', ceid: 'CA:fr' },
];

// Textos do resumo, por idioma.
const DT = {
  'pt-BR': { kickoffN: d => `Faltam ${d} dias para a abertura da Copa 2026`, kickoff1: 'A Copa do Mundo 2026 começa amanhã!', kickoff0: 'É dia de Copa! A bola vai rolar hoje.', today: 'Jogos de hoje', yesterday: 'Resultados de ontem', leaders: 'Líderes dos grupos', topscorer: 'Artilharia', goals: 'gols', group: 'Grupo', pts: 'pts' },
  'en-US': { kickoffN: d => `${d} days until the 2026 World Cup kicks off`, kickoff1: 'The 2026 World Cup starts tomorrow!', kickoff0: "It's World Cup day! Kickoff is today.", today: "Today's matches", yesterday: "Yesterday's results", leaders: 'Group leaders', topscorer: 'Top scorers', goals: 'goals', group: 'Group', pts: 'pts' },
  'es-MX': { kickoffN: d => `Faltan ${d} días para el inicio del Mundial 2026`, kickoff1: '¡El Mundial 2026 comienza mañana!', kickoff0: '¡Hoy arranca el Mundial!', today: 'Partidos de hoy', yesterday: 'Resultados de ayer', leaders: 'Líderes de grupo', topscorer: 'Goleo', goals: 'goles', group: 'Grupo', pts: 'pts' },
  'fr-CA': { kickoffN: d => `Encore ${d} jours avant le coup d’envoi de la Coupe 2026`, kickoff1: 'La Coupe du monde 2026 commence demain!', kickoff0: 'C’est jour de Coupe! Le coup d’envoi est aujourd’hui.', today: 'Matchs du jour', yesterday: 'Résultats d’hier', leaders: 'Meneurs de groupe', topscorer: 'Buteurs', goals: 'buts', group: 'Groupe', pts: 'pts' },
};

const KICKOFF = new Date('2026-06-11T18:00:00Z');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Síntese das manchetes via Claude API (opcional) ----------
// Se ANTHROPIC_API_KEY estiver definido, gera um resumo em texto das manchetes do dia,
// em cada idioma. Sem a chave (ou se a API falhar), o front usa o resumo dos dados.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUMMARY_MODEL = process.env.SUMMARY_MODEL || 'claude-haiku-4-5';

const SUMMARY_SYSTEM = {
  'pt-BR': 'Você é um editor de jornalismo esportivo. Com base APENAS nas manchetes fornecidas, escreva um resumo coeso de 2 a 3 frases sobre o noticiário da Copa do Mundo de 2026, em português do Brasil. Tom jornalístico e neutro. Não invente fatos que não estejam nas manchetes. Responda somente com o resumo — sem preâmbulo, listas, títulos ou aspas.',
  'en-US': 'You are a sports news editor. Based ONLY on the headlines provided, write a cohesive 2–3 sentence summary of the 2026 World Cup news, in English. Neutral, journalistic tone. Do not invent facts not present in the headlines. Respond with the summary only — no preamble, lists, titles, or quotes.',
  'es-MX': 'Eres un editor de periodismo deportivo. Basándote ÚNICAMENTE en los titulares proporcionados, escribe un resumen coherente de 2 a 3 frases sobre las noticias del Mundial 2026, en español. Tono periodístico y neutral. No inventes datos que no estén en los titulares. Responde solo con el resumen, sin preámbulo, listas, títulos ni comillas.',
  'fr-CA': 'Tu es un rédacteur en chef de journalisme sportif. En te basant UNIQUEMENT sur les manchettes fournies, rédige un résumé cohérent de 2 à 3 phrases sur l’actualité de la Coupe du monde 2026, en français. Ton journalistique et neutre. N’invente aucun fait absent des manchettes. Réponds uniquement avec le résumé — sans préambule, liste, titre ni guillemets.',
};
const SUMMARY_USER = {
  'pt-BR': 'Manchetes de hoje sobre a Copa 2026:',
  'en-US': "Today's 2026 World Cup headlines:",
  'es-MX': 'Titulares de hoy sobre el Mundial 2026:',
  'fr-CA': 'Manchettes du jour sur la Coupe du monde 2026 :',
};

async function summarizeHeadlines(lang, news) {
  if (!ANTHROPIC_API_KEY || !news.length) return null;
  const headlines = news.slice(0, 10).map((n, i) => `${i + 1}. ${n.title}`).join('\n');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        max_tokens: 320,
        system: SUMMARY_SYSTEM[lang],
        messages: [{ role: 'user', content: `${SUMMARY_USER[lang]}\n${headlines}` }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
    return text || null;
  } catch (err) {
    console.error(`  ⚠ resumo IA (${lang}) falhou: ${err.message}`);
    return null;
  }
}

// ---------- Helpers de dados ----------
async function readJSON(name) {
  try { return JSON.parse(await readFile(join(DATA_DIR, name), 'utf8')); }
  catch { return null; }
}

function teamName(team, lang) {
  if (!team) return '';
  if (team.tla && TEAMS[team.tla]) return TEAMS[team.tla][lang];
  return team.name ?? '';
}

function groupLetter(g) {
  return (g || '').replace(/^group/i, '').replace(/[_\s]/g, '').toUpperCase();
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ---------- Resumo do dia ----------
function buildDigest(lang, { matches, standings, scorers }) {
  const tx = DT[lang];
  const now = new Date();
  const nowISO = now.toISOString();
  const items = [];
  const ms = matches?.matches || [];

  // Contagem regressiva para a abertura (enquanto nada foi jogado).
  const finished = ms.filter(m => m.status === 'FINISHED');
  if (!finished.length && KICKOFF > now) {
    const days = Math.ceil((KICKOFF - now) / 864e5);
    const title = days <= 0 ? tx.kickoff0 : days === 1 ? tx.kickoff1 : tx.kickoffN(days);
    items.push({ title, detail: '', publishedAt: nowISO });
  }

  // Jogos de hoje.
  const today = ms.filter(m => sameDay(new Date(m.utcDate), now));
  if (today.length) {
    items.push({
      title: tx.today,
      detail: today.map(m => `${teamName(m.homeTeam, lang)} × ${teamName(m.awayTeam, lang)}`).join(' · '),
      publishedAt: nowISO,
    });
  }

  // Resultados de ontem.
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const yesterday = ms.filter(m => m.status === 'FINISHED' && sameDay(new Date(m.utcDate), yest));
  if (yesterday.length) {
    items.push({
      title: tx.yesterday,
      detail: yesterday.map(m => `${teamName(m.homeTeam, lang)} ${m.score?.fullTime?.home ?? 0}-${m.score?.fullTime?.away ?? 0} ${teamName(m.awayTeam, lang)}`).join(' · '),
      publishedAt: nowISO,
    });
  }

  // Líderes dos grupos (só se já houver pontuação).
  const groups = (standings?.standings || []).filter(s => s.type === 'TOTAL' && s.group);
  const leaders = groups.map(g => ({ g, top: g.table[0] })).filter(x => x.top && x.top.points > 0);
  if (leaders.length) {
    items.push({
      title: tx.leaders,
      detail: leaders.map(({ g, top }) => `${tx.group} ${groupLetter(g.group)}: ${teamName(top.team, lang)} (${top.points} ${tx.pts})`).join(' · '),
      publishedAt: nowISO,
    });
  }

  // Artilharia.
  const sc = scorers?.scorers || [];
  if (sc.length) {
    items.push({
      title: tx.topscorer,
      detail: sc.slice(0, 3).map(s => `${s.player?.name} (${teamName(s.team, lang)}) — ${s.goals} ${tx.goals}`).join(' · '),
      publishedAt: nowISO,
    });
  }

  return items;
}

// ---------- RSS (Google News) ----------
function unescapeXml(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '').trim();
}
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? unescapeXml(m[1]) : '';
};

function parseRSS(xml, max = 12) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < max) {
    const block = m[1];
    const source = tag(block, 'source');
    let title = tag(block, 'title');
    // Google News formata "Manchete - Fonte"; remove o sufixo da fonte do título.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const link = tag(block, 'link');
    const pub = tag(block, 'pubDate');
    if (title && link) {
      items.push({ title, url: link, source, publishedAt: pub ? new Date(pub).toISOString() : null });
    }
  }
  return items;
}

async function fetchNews(feed) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(feed.q)}&hl=${feed.hl}&gl=${feed.gl}&ceid=${encodeURIComponent(feed.ceid)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseRSS(await res.text());
}

// ---------- Main ----------
async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const [matches, standings, scorers] = await Promise.all([
    readJSON('matches.json'), readJSON('standings.json'), readJSON('scorers.json'),
  ]);

  for (let i = 0; i < FEEDS.length; i++) {
    const feed = FEEDS[i];
    const digest = buildDigest(feed.lang, { matches, standings, scorers });
    let news = [];
    try {
      news = await fetchNews(feed);
      console.log(`✓ ${feed.lang}: ${news.length} notícias`);
    } catch (err) {
      console.error(`✗ ${feed.lang}: falha no RSS (${err.message}) — gravando só o resumo`);
    }
    const summary = await summarizeHeadlines(feed.lang, news);
    if (summary) console.log(`  ✨ resumo IA (${feed.lang}) gerado`);
    await writeFile(
      join(DATA_DIR, `news.${feed.lang}.json`),
      JSON.stringify({ generatedAt: new Date().toISOString(), lang: feed.lang, summary, digest, news }, null, 2),
    );
    if (i < FEEDS.length - 1) await sleep(1500);
  }
  console.log('Notícias concluídas.');
}

main().catch(err => { console.error(err); process.exit(1); });
