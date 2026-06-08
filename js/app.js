// Copa 2026 · Dashboard de Estatísticas
// Lê os JSON gerados em /data (atualizados diariamente pelo script de fetch).
// Nenhuma chave de API é usada no front — tudo vem de arquivos estáticos.

const DATA = {};
const FILES = ['matches', 'standings', 'scorers', 'teams', 'meta'];

// Abertura da Copa 2026 (usada como fallback enquanto a API não publica os jogos).
const KICKOFF = '2026-06-11T18:00:00Z';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STAGE_LABELS = {
  GROUP_STAGE: 'Fase de grupos',
  LAST_32: '16-avos',
  LAST_16: 'Oitavas',
  QUARTER_FINALS: 'Quartas',
  SEMI_FINALS: 'Semifinal',
  THIRD_PLACE: 'Disputa 3º lugar',
  FINAL: 'Final',
};

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
  return `<span class="team-cell ${align}">${crest(team)}<span>${team?.name ?? '—'}</span></span>`;
}

// Normaliza o nome do grupo: "Group A" ou "GROUP_A" -> "Grupo A".
function groupLabel(g) {
  if (!g) return '';
  const letter = g.replace(/^group/i, '').replace(/[_\s]/g, '').toUpperCase();
  return letter ? `Grupo ${letter}` : g;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isSameDay(iso, ref) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

// ---------- Renderização ----------
function renderMeta() {
  const meta = DATA.meta || {};
  const el = $('#last-updated');
  if (meta.generatedAt) {
    el.textContent = new Date(meta.generatedAt).toLocaleString('pt-BR');
    el.dateTime = meta.generatedAt;
  } else {
    el.textContent = '—';
  }
}

function allMatches() {
  return DATA.matches?.matches || [];
}

function startCountdown() {
  const matches = allMatches();
  const next = matches
    .filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED')
    .map(m => new Date(m.utcDate))
    .filter(d => d > new Date())
    .sort((a, b) => a - b)[0];

  // Sem jogos agendados na API ainda: usa a data de abertura como alvo.
  const target = next || (new Date(KICKOFF) > new Date() ? new Date(KICKOFF) : null);

  const box = $('#countdown');
  if (!target) { box.innerHTML = '<span class="countdown-label">🏆 Em andamento</span>'; return; }

  const label = next ? 'Próximo jogo:' : 'Abertura da Copa:';
  const tick = () => {
    const diff = target - new Date();
    if (diff <= 0) { box.innerHTML = '<span class="countdown-label">🔴 Começou!</span>'; return; }
    const d = Math.floor(diff / 864e5);
    const h = Math.floor(diff % 864e5 / 36e5);
    const m = Math.floor(diff % 36e5 / 6e4);
    box.innerHTML = `<span class="countdown-label">${label}</span>
      <span><span class="num">${d}</span><span class="unit"> d</span></span>
      <span><span class="num">${h}</span><span class="unit"> h</span></span>
      <span><span class="num">${m}</span><span class="unit"> min</span></span>`;
  };
  tick();
  setInterval(tick, 30000);
}

function renderSummary() {
  const matches = allMatches();
  const played = matches.filter(m => m.status === 'FINISHED');
  const goals = played.reduce((s, m) => s + (m.score?.fullTime?.home ?? 0) + (m.score?.fullTime?.away ?? 0), 0);
  const teams = DATA.teams?.teams?.length || DATA.meta?.totalTeams || 48;
  const avg = played.length ? (goals / played.length).toFixed(2) : '0.00';

  const cards = [
    { value: teams, label: 'Seleções' },
    { value: `${played.length}/${matches.length || '—'}`, label: 'Jogos disputados' },
    { value: goals, label: 'Gols marcados' },
    { value: avg, label: 'Média de gols/jogo' },
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
      (live ? '<div class="badge-live">AO VIVO</div>' : `<div class="stage">${STAGE_LABELS[m.stage] || ''}</div>`);
  } else {
    center = `<div class="time">${fmtTime(m.utcDate)}</div><div class="stage">${m.group ? groupLabel(m.group) : (STAGE_LABELS[m.stage] || '')}</div>`;
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
  const el = $('#today-matches');
  el.innerHTML = today.length ? today.map(matchHTML).join('')
    : '<p class="empty">Nenhum jogo hoje. Confira a aba “Jogos” para a tabela completa.</p>';
}

function renderScorers() {
  const scorers = DATA.scorers?.scorers || [];
  // Top 5 resumido
  $('#mini-scorers').innerHTML = scorers.slice(0, 5).map((s, i) =>
    `<li><span class="pos">${i + 1}</span>${teamCell(s.team)}
     <span>${s.player?.name ?? '—'}</span><span class="goals">${s.goals ?? 0} ⚽</span></li>`
  ).join('') || '<li class="empty">Sem dados de artilharia ainda.</li>';

  // Tabela completa
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
  ).join('') || '<tr><td colspan="7" class="empty">Sem dados de artilharia ainda.</td></tr>';
}

function renderStandings() {
  const groups = (DATA.standings?.standings || []).filter(s => s.type === 'TOTAL' && s.group);
  const el = $('#groups-container');
  if (!groups.length) {
    el.innerHTML = '<p class="empty">Classificação ainda não disponível (a fase de grupos começa em 11/06).</p>';
    return;
  }
  el.innerHTML = groups.map(g => `
    <div class="group-card">
      <h3>${groupLabel(g.group)}</h3>
      <table>
        <thead><tr><th>#</th><th>Seleção</th><th>P</th><th>J</th><th>SG</th></tr></thead>
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

// ---------- Comparador ----------
function teamStatsTable() {
  // Agrega estatísticas por time a partir das standings.
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
  const teams = Object.values(stats).map(s => s.team).sort((a, b) => a.name.localeCompare(b.name));
  const opts = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  if (!teams.length) {
    $('#compare-result').innerHTML = '<p class="empty">Disponível quando a fase de grupos começar.</p>';
    return;
  }
  $('#team-a').innerHTML = opts;
  $('#team-b').innerHTML = opts;
  if (teams[1]) $('#team-b').value = teams[1].id;

  const update = () => renderCompare(stats, $('#team-a').value, $('#team-b').value);
  $('#team-a').onchange = update;
  $('#team-b').onchange = update;
  update();
}

function renderCompare(stats, idA, idB) {
  const a = stats[idA], b = stats[idB];
  if (!a || !b) return;
  const rows = [
    ['Pontos', a.points, b.points],
    ['Vitórias', a.won, b.won],
    ['Gols pró', a.goalsFor, b.goalsFor],
    ['Gols contra', a.goalsAgainst, b.goalsAgainst],
    ['Saldo de gols', a.gd, b.gd],
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
  const groups = [...new Set(matches.map(m => m.group).filter(Boolean))].sort();
  filter.innerHTML = '<option value="">Todos os jogos</option>' +
    groups.map(g => `<option value="${g}">${groupLabel(g)}</option>`).join('');

  const draw = () => {
    const g = filter.value;
    const list = g ? matches.filter(m => m.group === g) : matches;
    $('#all-matches').innerHTML = list.length ? list.map(matchHTML).join('')
      : '<p class="empty">Sem jogos para este filtro.</p>';
  };
  filter.onchange = draw;
  draw();
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
  renderMeta();
  startCountdown();
  renderSummary();
  renderToday();
  renderScorers();
  renderStandings();
  renderCompareControls();
  renderAllMatches();
  initTabs();
}

init();
