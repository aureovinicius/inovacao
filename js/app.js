// Copa 2026 · Dashboard de Estatísticas
// Lê os JSON gerados em /data (atualizados diariamente pelo script de fetch).
// Nenhuma chave de API é usada no front — tudo vem de arquivos estáticos.

import { LANGS, UI, STAGE_KEY, TEAMS, TEAMS_BY_NAME } from './i18n.js';
import { LIVE_PROXY_URL, LIVE_POLL_MS } from './config.js';

const DATA = {};
const FILES = ['matches', 'standings', 'scorers', 'teams', 'meta'];

// Abertura da Copa 2026 (usada como fallback enquanto a API não publica os jogos).
const KICKOFF = '2026-06-11T18:00:00Z';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- Idioma ----------
const LANG_CODES = LANGS.map(l => l.code);

// Resolve um código de idioma do navegador (ex.: "es", "es-AR", "EN") para um suportado.
function matchSupported(code) {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c.startsWith('pt')) return 'pt-BR';
  if (c.startsWith('en')) return 'en-US';
  if (c.startsWith('es')) return 'es-MX';
  if (c.startsWith('fr')) return 'fr-CA';
  return null;
}

function detectLang() {
  // 1) Preferência salva pelo usuário.
  const saved = localStorage.getItem('lang');
  if (saved && LANG_CODES.includes(saved)) return saved;
  // 2) Lista de idiomas do navegador, em ordem de preferência.
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) {
    const m = matchSupported(p);
    if (m) return m;
  }
  // 3) Padrão.
  return 'pt-BR';
}
let lang = detectLang();
const t = (key) => UI[lang][key] ?? key;

function teamName(team) {
  if (!team) return t('tbd');
  if (team.tla && TEAMS[team.tla]) return TEAMS[team.tla][lang];
  if (team.name && TEAMS_BY_NAME[team.name]) return TEAMS_BY_NAME[team.name][lang];
  return team.name ?? t('tbd');
}

// ---------- Carregamento ----------
async function loadData() {
  await Promise.all(FILES.map(async (name) => {
    try {
      const res = await fetch(`data/${name}.json`, { cache: 'no-store' });
      DATA[name] = res.ok ? await res.json() : null;
    } catch {
      DATA[name] = null;
    }
  }));
}

// ---------- Helpers ----------
function crest(team) {
  const url = team?.crest || '';
  return url ? `<img class="crest" src="${url}" alt="" loading="lazy">` : '<span class="crest"></span>';
}

function teamCell(team, align = '') {
  return `<span class="team-cell ${align}">${crest(team)}<span>${teamName(team)}</span></span>`;
}

// Nome do grupo traduzido: "Group A" / "GROUP_A" -> "Grupo A" / "Group A" / "Grupo A".
function groupLabel(g) {
  if (!g) return '';
  const letter = g.replace(/^group/i, '').replace(/[_\s]/g, '').toUpperCase();
  return letter ? `${t('group')} ${letter}` : g;
}

function stageLabel(stage) {
  return STAGE_KEY[stage] ? t(STAGE_KEY[stage]) : '';
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString(lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isSameDay(iso, ref) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Tempo relativo nativo no idioma atual ("há 2 h", "2 hours ago", "il y a 2 h"…).
function relTime(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return rtf.format(-hrs, 'hour');
  return rtf.format(-Math.round(hrs / 24), 'day');
}

// ---------- Renderização ----------
function renderMeta() {
  const meta = DATA.meta || {};
  const el = $('#last-updated');
  if (meta.generatedAt) {
    el.textContent = new Date(meta.generatedAt).toLocaleString(lang);
    el.dateTime = meta.generatedAt;
  } else {
    el.textContent = '—';
  }
}

function allMatches() {
  return DATA.matches?.matches || [];
}

let countdownTimer = null;
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  const matches = allMatches();
  const next = matches
    .filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED')
    .map(m => new Date(m.utcDate))
    .filter(d => d > new Date())
    .sort((a, b) => a - b)[0];

  // Sem jogos agendados na API ainda: usa a data de abertura como alvo.
  const target = next || (new Date(KICKOFF) > new Date() ? new Date(KICKOFF) : null);

  const box = $('#countdown');
  if (!target) { box.innerHTML = `<span class="countdown-label">${t('cd_live')}</span>`; return; }

  const label = next ? t('cd_next') : t('cd_kickoff');
  const tick = () => {
    const diff = target - new Date();
    if (diff <= 0) { box.innerHTML = `<span class="countdown-label">${t('cd_started')}</span>`; return; }
    const d = Math.floor(diff / 864e5);
    const h = Math.floor(diff % 864e5 / 36e5);
    const m = Math.floor(diff % 36e5 / 6e4);
    box.innerHTML = `<span class="countdown-label">${label}</span>
      <span><span class="num">${d}</span><span class="unit"> ${t('unit_d')}</span></span>
      <span><span class="num">${h}</span><span class="unit"> ${t('unit_h')}</span></span>
      <span><span class="num">${m}</span><span class="unit"> ${t('unit_min')}</span></span>`;
  };
  tick();
  countdownTimer = setInterval(tick, 30000);
}

function renderSummary() {
  const matches = allMatches();
  const played = matches.filter(m => m.status === 'FINISHED');
  const goals = played.reduce((s, m) => s + (m.score?.fullTime?.home ?? 0) + (m.score?.fullTime?.away ?? 0), 0);
  const teams = DATA.teams?.teams?.length || DATA.meta?.totalTeams || 48;
  const avg = played.length ? (goals / played.length).toFixed(2) : '0.00';

  const cards = [
    { value: teams, label: t('card_teams') },
    { value: `${played.length}/${matches.length || '—'}`, label: t('card_played') },
    { value: goals, label: t('card_goals') },
    { value: avg, label: t('card_avg') },
  ];
  $('#summary-cards').innerHTML = cards.map(c =>
    `<div class="stat-card"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`
  ).join('');
}

function matchHTML(m) {
  const ft = m.score?.fullTime || {};
  const live = m.status === 'IN_PLAY' || m.status === 'PAUSED';
  const finished = m.status === 'FINISHED';
  let center;
  if (finished || live) {
    center = `<div class="score">${ft.home ?? 0} : ${ft.away ?? 0}</div>` +
      (live ? `<div class="badge-live">${t('live')}</div>` : `<div class="stage">${stageLabel(m.stage)}</div>`);
  } else {
    center = `<div class="time">${fmtTime(m.utcDate)}</div><div class="stage">${m.group ? groupLabel(m.group) : stageLabel(m.stage)}</div>`;
  }
  return `<div class="match">
    <div class="side home">${teamCell(m.homeTeam, 'home')}</div>
    <div class="center">${center}</div>
    <div class="side away">${teamCell(m.awayTeam)}</div>
  </div>`;
}

function renderToday() {
  const ref = new Date();
  const today = allMatches().filter(m => isSameDay(m.utcDate, ref));
  $('#today-matches').innerHTML = today.length ? today.map(matchHTML).join('')
    : `<p class="empty">${t('no_today')}</p>`;
}

function renderScorers() {
  const scorers = DATA.scorers?.scorers || [];
  $('#mini-scorers').innerHTML = scorers.slice(0, 5).map((s, i) =>
    `<li><span class="pos">${i + 1}</span>${teamCell(s.team)}
     <span>${s.player?.name ?? '—'}</span><span class="goals">${s.goals ?? 0} ⚽</span></li>`
  ).join('') || `<li class="empty">${t('no_scorers')}</li>`;

  const tbody = $('#scorers-table tbody');
  tbody.innerHTML = scorers.map((s, i) =>
    `<tr>
      <td>${i + 1}</td>
      <td>${s.player?.name ?? '—'}</td>
      <td>${teamCell(s.team)}</td>
      <td><strong>${s.goals ?? 0}</strong></td>
      <td>${s.assists ?? 0}</td>
      <td>${s.penalties ?? 0}</td>
      <td>${s.playedMatches ?? '—'}</td>
    </tr>`
  ).join('') || `<tr><td colspan="7" class="empty">${t('no_scorers')}</td></tr>`;
}

function renderStandings() {
  const groups = (DATA.standings?.standings || []).filter(s => s.type === 'TOTAL' && s.group);
  const el = $('#groups-container');
  if (!groups.length) {
    el.innerHTML = `<p class="empty">${t('standings_empty')}</p>`;
    return;
  }
  el.innerHTML = groups.map(g => `
    <div class="group-card">
      <h3>${groupLabel(g.group)}</h3>
      <table>
        <thead><tr><th>#</th><th>${t('th_team')}</th><th>${t('th_p')}</th><th>${t('th_j')}</th><th>${t('th_sg')}</th></tr></thead>
        <tbody>
          ${g.table.map(r => `
            <tr class="${r.position <= 2 ? 'qualify' : ''}">
              <td>${r.position}</td>
              <td class="team-name">${teamCell(r.team)}</td>
              <td><strong>${r.points}</strong></td>
              <td>${r.playedGames}</td>
              <td>${r.goalDifference > 0 ? '+' : ''}${r.goalDifference}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`).join('');
}

// ---------- Chaveamento ----------
// Formato da Copa 2026: 32 classificados -> oitavas -> quartas -> semis -> final.
const KO_STAGES = [
  { key: 'LAST_32', tkey: 'ko_last32', slots: 16 },
  { key: 'LAST_16', tkey: 'ko_last16', slots: 8 },
  { key: 'QUARTER_FINALS', tkey: 'ko_qf', slots: 4 },
  { key: 'SEMI_FINALS', tkey: 'ko_sf', slots: 2 },
  { key: 'FINAL', tkey: 'ko_final', slots: 1 },
];

function bracketTeam(team, isWinner) {
  return `<div class="bt ${isWinner ? 'win' : ''}">${crest(team)}<span>${teamName(team)}</span></div>`;
}

function bracketMatch(m) {
  if (!m) return `<div class="bm pending">${bracketTeam(null)}${bracketTeam(null)}</div>`;
  const ft = m.score?.fullTime || {};
  const done = m.status === 'FINISHED';
  const hw = m.score?.winner === 'HOME_TEAM';
  const aw = m.score?.winner === 'AWAY_TEAM';
  const sc = (v) => done ? `<span class="bs">${v ?? 0}</span>` : '';
  return `<div class="bm">
    <div class="bm-row">${bracketTeam(m.homeTeam, hw)}${sc(ft.home)}</div>
    <div class="bm-row">${bracketTeam(m.awayTeam, aw)}${sc(ft.away)}</div>
  </div>`;
}

function renderBracket() {
  const ko = allMatches().filter(m => m.stage && m.stage !== 'GROUP_STAGE');
  const byStage = (key) => ko.filter(m => m.stage === key)
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  $('#bracket').innerHTML = KO_STAGES.map(st => {
    const ms = byStage(st.key);
    const cells = Array.from({ length: st.slots }, (_, i) => bracketMatch(ms[i]));
    return `<div class="bracket-col">
      <h3>${t(st.tkey)}</h3>
      <div class="bracket-cells">${cells.join('')}</div>
    </div>`;
  }).join('');

  const third = ko.find(m => m.stage === 'THIRD_PLACE');
  $('#third-place').innerHTML = `<h3>${t('bracket_third')}</h3>${bracketMatch(third)}`;
}

// ---------- Notícias ----------
const NEWS = {}; // cache por idioma
async function renderNews() {
  let data = NEWS[lang];
  if (data === undefined) {
    try {
      const res = await fetch(`data/news.${lang}.json`, { cache: 'no-store' });
      data = res.ok ? await res.json() : null;
    } catch { data = null; }
    NEWS[lang] = data;
  }
  const digest = data?.digest || [];
  const news = data?.news || [];

  if (data?.summary) {
    // Síntese das manchetes gerada por IA.
    $('#news-digest').innerHTML =
      `<p class="digest-summary">${esc(data.summary)}</p>
       <p class="digest-note">${t('news_ai_note')}</p>`;
  } else {
    // Fallback: resumo a partir dos nossos dados (contagem, resultados, líderes…).
    $('#news-digest').innerHTML = digest.length
      ? `<ul class="digest-list">${digest.map(d => `
          <li class="digest-item">
            <span class="digest-dot" aria-hidden="true"></span>
            <div><strong>${esc(d.title)}</strong>${d.detail ? `<div class="digest-detail">${esc(d.detail)}</div>` : ''}</div>
          </li>`).join('')}</ul>`
      : `<p class="empty">—</p>`;
  }

  $('#news-list').innerHTML = news.length ? news.map(n => `
    <a class="news-card" href="${esc(n.url)}" target="_blank" rel="noopener">
      <div class="news-meta">
        <span class="news-source">${esc(n.source || '')}</span>
        <span class="news-time">${relTime(n.publishedAt)}</span>
      </div>
      <div class="news-headline">${esc(n.title)}</div>
    </a>`).join('') : `<p class="empty">${t('news_empty')}</p>`;
}

// ---------- Comparador ----------
function teamStatsTable() {
  const map = {};
  (DATA.standings?.standings || []).filter(s => s.type === 'TOTAL').forEach(s => {
    s.table.forEach(r => {
      map[r.team.id] = {
        team: r.team,
        points: r.points, played: r.playedGames,
        won: r.won, draw: r.draw, lost: r.lost,
        goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, gd: r.goalDifference,
      };
    });
  });
  return map;
}

function renderCompareControls() {
  const stats = teamStatsTable();
  const teams = Object.values(stats).map(s => s.team)
    .sort((a, b) => teamName(a).localeCompare(teamName(b), lang));
  if (!teams.length) {
    $('#compare-result').innerHTML = `<p class="empty">${t('compare_empty')}</p>`;
    return;
  }
  const opts = teams.map(tm => `<option value="${tm.id}">${teamName(tm)}</option>`).join('');
  const a = $('#team-a'), b = $('#team-b');
  const prevA = a.value, prevB = b.value;        // preserva seleção ao trocar idioma
  a.innerHTML = opts;
  b.innerHTML = opts;
  a.value = prevA || teams[0].id;
  b.value = prevB || (teams[1] ? teams[1].id : teams[0].id);

  const update = () => renderCompare(stats, a.value, b.value);
  a.onchange = update;
  b.onchange = update;
  update();
}

function renderCompare(stats, idA, idB) {
  const a = stats[idA], b = stats[idB];
  if (!a || !b) return;
  const rows = [
    [t('cmp_points'), a.points, b.points],
    [t('cmp_wins'), a.won, b.won],
    [t('cmp_goals_for'), a.goalsFor, b.goalsFor],
    [t('cmp_goals_against'), a.goalsAgainst, b.goalsAgainst],
    [t('cmp_gd'), a.gd, b.gd],
  ];
  $('#compare-result').innerHTML = `
    <div class="compare-row"><div class="va">${teamCell(a.team)}</div><div></div><div class="vb">${teamCell(b.team)}</div></div>
    ${rows.map(([label, va, vb]) => {
      const total = Math.abs(va) + Math.abs(vb) || 1;
      const pa = Math.max(0, va) / total * 100;
      const pb = Math.max(0, vb) / total * 100;
      return `<div class="compare-row">
        <div class="va">${va}</div>
        <div class="bar"><span class="a" style="width:${pa}%"></span><span class="b" style="width:${pb}%"></span></div>
        <div class="vb">${vb}</div>
        <div class="label">${label}</div>
      </div>`;
    }).join('')}`;
}

// ---------- Jogos ----------
function renderAllMatches() {
  const matches = [...allMatches()].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const filter = $('#matches-filter');
  const prev = filter.value;
  const groups = [...new Set(matches.map(m => m.group).filter(Boolean))].sort();
  filter.innerHTML = `<option value="">${t('matches_all')}</option>` +
    groups.map(g => `<option value="${g}">${groupLabel(g)}</option>`).join('');
  filter.value = prev;

  const draw = () => {
    const g = filter.value;
    const list = g ? matches.filter(m => m.group === g) : matches;
    $('#all-matches').innerHTML = list.length ? list.map(matchHTML).join('')
      : `<p class="empty">${t('matches_empty')}</p>`;
  };
  filter.onchange = draw;
  draw();
}

// ---------- i18n estático + seletor de idioma ----------
function applyStaticI18n() {
  document.documentElement.lang = lang.toLowerCase();
  document.title = t('title');
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
}

function renderLangSwitcher() {
  const box = $('#lang-switcher');
  box.innerHTML = LANGS.map(l =>
    `<button class="lang-btn ${l.code === lang ? 'is-active' : ''}" data-lang="${l.code}" title="${l.code}">
       <span class="lang-flag">${l.flag}</span><span class="lang-label">${l.label}</span>
     </button>`
  ).join('');
  $$('.lang-btn', box).forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.lang === lang) return;
      lang = btn.dataset.lang;
      localStorage.setItem('lang', lang);
      renderAll();
    });
  });
}

// ---------- Render geral ----------
function renderAll() {
  applyStaticI18n();
  renderLangSwitcher();
  renderMeta();
  startCountdown();
  renderSummary();
  renderToday();
  renderScorers();
  renderStandings();
  renderBracket();
  renderCompareControls();
  renderAllMatches();
  renderNews();
}

// ---------- Placar ao vivo ----------
// Liga sozinho quando há jogo em andamento (ou prestes a começar) e o proxy está configurado.
function inLiveWindow() {
  const now = Date.now();
  return allMatches().some(m => {
    if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return true;
    if (m.status === 'FINISHED') return false;
    const t = new Date(m.utcDate).getTime();
    return t <= now + 15 * 60000 && t >= now - 3 * 3600000; // janela: ~15min antes a 3h depois do início
  });
}

function setLiveStatus(on) {
  const el = $('#live-status');
  if (!el) return;
  el.hidden = !on;
  if (on) el.innerHTML = `<span class="live-dot" aria-hidden="true"></span>${t('live')} · ${t('updated')} ${new Date().toLocaleTimeString(lang)}`;
}

async function pollLive() {
  if (!LIVE_PROXY_URL || document.visibilityState !== 'visible' || !inLiveWindow()) {
    setLiveStatus(false);
    return;
  }
  try {
    const res = await fetch(`${LIVE_PROXY_URL.replace(/\/$/, '')}/matches`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.matches) return;
    DATA.matches = data;
    renderSummary();
    renderToday();
    renderAllMatches();
    renderBracket();
    startCountdown();
    setLiveStatus(true);
  } catch { /* mantém os dados atuais em caso de falha de rede */ }
}

function startLivePolling() {
  if (!LIVE_PROXY_URL) return;
  setInterval(pollLive, LIVE_POLL_MS);
  pollLive();
}

// ---------- Navegação ----------
function initTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('is-active'));
      $$('.view').forEach(v => v.classList.remove('is-active'));
      tab.classList.add('is-active');
      $(`.view[data-view="${tab.dataset.view}"]`).classList.add('is-active');
    });
  });
}

// ---------- Boot ----------
async function init() {
  await loadData();
  renderAll();
  initTabs();
  startLivePolling();
}

init();
