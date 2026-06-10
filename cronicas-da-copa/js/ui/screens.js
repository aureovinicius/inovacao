// Telas do jogo. Cada função monta o HTML no #app e liga os eventos, chamando
// métodos do controlador `app` (definido em app.js).
import { CLASSES, ORIGENS, TONS, ATRIBUTOS, montarAtributos } from '../rules.js';
import { CONQUISTAS, conquistaPorId } from '../achievements.js';
import { modificador } from '../dice.js';
import { nomeFase, proximoNivel } from '../state.js';

const $app = () => document.getElementById('app');
export function setScreen(html) {
  const app = $app();
  app.innerHTML = html;
  app.scrollTop = 0;
  window.scrollTo(0, 0);
}

function escudo(time, cls = 'crest') {
  if (!time) return '';
  return `<img class="${cls}" src="${time.crest}" alt="" loading="lazy" onerror="this.style.display='none'">`;
}
function modTxt(v) { const m = modificador(v); return (m >= 0 ? '+' : '') + m; }

// --- HOME -------------------------------------------------------------------
export function renderHome(app) {
  const temSave = !!app.save;
  setScreen(`
    <section class="tela tela-home">
      <div class="brasao">🏆</div>
      <h1 class="titulo">Crônicas<br>da Copa</h1>
      <p class="subtitulo">um RPG de mesa da Copa do Mundo</p>
      <div class="menu">
        ${temSave ? `<button class="btn btn-grande" id="b-continuar">▶ Continuar carreira</button>` : ''}
        <button class="btn ${temSave ? '' : 'btn-grande'}" id="b-nova">＋ Nova carreira</button>
        ${temSave ? `<button class="btn btn-ghost" id="b-apagar">🗑 Apagar carreira</button>` : ''}
      </div>
      <p class="rodape">2026 · 48 seleções · Mestre narrado por IA</p>
    </section>`);
  if (temSave) document.getElementById('b-continuar').onclick = () => app.irHub();
  document.getElementById('b-nova').onclick = () => app.novaCarreiraTela();
  if (temSave) document.getElementById('b-apagar').onclick = () => app.apagarCarreira();
}

// --- CRIAÇÃO ----------------------------------------------------------------
export function renderCreate(app, dados) {
  // estado de rascunho na própria função
  const draft = { nome: '', selecaoId: null, classeId: 'centroavante', origemId: 'base', tom: 'epico' };

  const gruposOrdenados = Object.keys(dados.porGrupo).sort();
  const optsSelecoes = gruposOrdenados.map((g) => {
    const times = dados.porGrupo[g].slice().sort((a, b) => a.name.localeCompare(b.name));
    return `<optgroup label="Grupo ${g}">${times.map((t) => `<option value="${t.id}">${t.name} (Elo ${t.elo})</option>`).join('')}</optgroup>`;
  }).join('');

  const cardClasses = CLASSES.map((c) => `
    <button type="button" class="card-opt" data-tipo="classe" data-id="${c.id}">
      <span class="card-emoji">${c.emoji}</span>
      <span class="card-nome">${c.nome}</span>
      <span class="card-sub">${c.arquetipo}</span>
    </button>`).join('');

  const cardOrigens = ORIGENS.map((o) => `
    <button type="button" class="card-opt" data-tipo="origem" data-id="${o.id}">
      <span class="card-emoji">${o.emoji}</span>
      <span class="card-nome">${o.nome}</span>
    </button>`).join('');

  const cardTons = TONS.map((t) => `
    <button type="button" class="card-opt" data-tipo="tom" data-id="${t.id}">
      <span class="card-emoji">${t.emoji}</span>
      <span class="card-nome">${t.nome}</span>
    </button>`).join('');

  setScreen(`
    <section class="tela tela-create">
      <header class="topo"><button class="btn-voltar" id="b-voltar">‹</button><h2>Novo personagem</h2></header>

      <label class="campo"><span>Seu nome</span>
        <input id="in-nome" type="text" maxlength="28" placeholder="ex.: Tião da Vila" autocomplete="off">
      </label>

      <label class="campo"><span>Sua seleção</span>
        <select id="in-selecao"><option value="">— escolha —</option>${optsSelecoes}</select>
      </label>

      <div class="bloco"><h3>Classe (posição)</h3><div class="grid-cards" id="g-classe">${cardClasses}</div>
        <p class="dica" id="dica-classe"></p></div>

      <div class="bloco"><h3>Origem</h3><div class="grid-cards" id="g-origem">${cardOrigens}</div>
        <p class="dica" id="dica-origem"></p></div>

      <div class="bloco"><h3>Tom da campanha</h3><div class="grid-cards grid-3" id="g-tom">${cardTons}</div></div>

      <div class="bloco"><h3>Atributos iniciais</h3><div class="attrs" id="attrs"></div></div>

      <button class="btn btn-grande" id="b-comecar" disabled>Entrar na Copa ⚽</button>
    </section>`);

  function pintarAttrs() {
    const a = montarAtributos(draft.classeId, draft.origemId);
    document.getElementById('attrs').innerHTML = ATRIBUTOS.map((at) => `
      <div class="attr">
        <span class="attr-id">${at.id}</span>
        <span class="attr-val">${a[at.id]}</span>
        <span class="attr-mod">${modTxt(a[at.id])}</span>
        <span class="attr-nome">${at.nome}</span>
      </div>`).join('');
  }
  function marcar(tipo, id) {
    document.querySelectorAll(`[data-tipo="${tipo}"]`).forEach((b) => b.classList.toggle('ativo', b.dataset.id === id));
  }
  function validar() {
    const ok = draft.nome.trim() && draft.selecaoId && draft.classeId && draft.origemId && draft.tom;
    document.getElementById('b-comecar').disabled = !ok;
  }

  document.getElementById('b-voltar').onclick = () => app.irHome();
  document.getElementById('in-nome').oninput = (e) => { draft.nome = e.target.value; validar(); };
  document.getElementById('in-selecao').onchange = (e) => { draft.selecaoId = e.target.value ? +e.target.value : null; validar(); };

  document.querySelectorAll('.card-opt').forEach((btn) => {
    btn.onclick = () => {
      const { tipo, id } = btn.dataset;
      if (tipo === 'classe') draft.classeId = id;
      if (tipo === 'origem') draft.origemId = id;
      if (tipo === 'tom') draft.tom = id;
      marcar(tipo, id);
      if (tipo === 'classe') document.getElementById('dica-classe').textContent = CLASSES.find((c) => c.id === id).exito;
      if (tipo === 'origem') document.getElementById('dica-origem').textContent = ORIGENS.find((o) => o.id === id).desc;
      pintarAttrs();
      validar();
    };
  });

  // defaults marcados
  marcar('classe', draft.classeId); marcar('origem', draft.origemId); marcar('tom', draft.tom);
  document.getElementById('dica-classe').textContent = CLASSES.find((c) => c.id === draft.classeId).exito;
  document.getElementById('dica-origem').textContent = ORIGENS.find((o) => o.id === draft.origemId).desc;
  pintarAttrs();

  document.getElementById('b-comecar').onclick = () => app.criarPersonagem(draft);
}

// --- HUB (centro da campanha) ----------------------------------------------
export function renderHub(app, dados) {
  const save = app.save;
  const meu = dados.porId.get(save.selecaoId);
  const camp = save.campanha;
  const classe = CLASSES.find((c) => c.id === save.classeId);
  const concluida = camp.concluida;

  let proximoHtml = '';
  if (!concluida) {
    const adv = app.advAtual || dados.porId.get(camp.proximoAdvId);
    proximoHtml = `
      <div class="confronto">
        <div class="time">${escudo(meu)}<span>${meu.tla}</span></div>
        <span class="vs">×</span>
        <div class="time">${escudo(adv)}<span>${adv ? adv.tla : '?'}</span></div>
      </div>
      <p class="prox-info">${nomeFase(camp.fase)}${camp.fase === 'grupos' ? ` · jogo ${camp.jogoIndex + 1} de 3` : ''} · adversário Elo ${adv ? adv.elo : '?'}</p>
      <button class="btn btn-grande" id="b-jogar">Entrar em campo 🏟️</button>`;
  } else {
    proximoHtml = `<button class="btn btn-grande" id="b-legado">Ver seu legado 🏅</button>`;
  }

  const c = save.carreira;
  setScreen(`
    <section class="tela tela-hub">
      <header class="hub-topo">
        <div class="ident">
          ${escudo(meu, 'crest-grande')}
          <div>
            <h2>${save.nome}</h2>
            <p>${classe.emoji} ${classe.nome} · ${meu.name}</p>
          </div>
        </div>
        <div class="nivel" title="Nível">N${save.nivel}</div>
      </header>

      <div class="barra-xp"><div class="barra-xp-fill" style="width:${Math.min(100, (save.xp / proximoNivel(save.nivel)) * 100).toFixed(0)}%"></div></div>

      <div class="card-prox">${proximoHtml}</div>

      <div class="stats-linha">
        <div><b>${c.gols}</b><span>gols</span></div>
        <div><b>${c.assist}</b><span>assist.</span></div>
        <div><b>${c.jogos}</b><span>jogos</span></div>
        <div><b>${c.vitorias}</b><span>vitórias</span></div>
      </div>

      <nav class="hub-nav">
        <button class="btn btn-nav" id="b-cronica">📖 Crônica</button>
        <button class="btn btn-nav" id="b-ficha">🧬 Ficha</button>
        <button class="btn btn-nav" id="b-conq">🏅 Conquistas <small>(${save.conquistas.length}/${CONQUISTAS.length})</small></button>
        <button class="btn btn-nav btn-ghost" id="b-home">🏠 Início</button>
      </nav>
    </section>`);

  if (!concluida) document.getElementById('b-jogar').onclick = () => app.entrarEmCampo();
  else document.getElementById('b-legado').onclick = () => app.irLegado();
  document.getElementById('b-cronica').onclick = () => app.irCronica();
  document.getElementById('b-ficha').onclick = () => app.irFicha();
  document.getElementById('b-conq').onclick = () => app.irConquistas();
  document.getElementById('b-home').onclick = () => app.irHome();
}

// --- CRÔNICA ----------------------------------------------------------------
export function renderCronica(app) {
  const save = app.save;
  const itens = save.cronica.slice().reverse().map((e) => `
    <article class="cronica-item ${e.tipo || ''}">
      ${e.titulo ? `<h4>${e.titulo}</h4>` : ''}
      <p>${e.texto}</p>
    </article>`).join('') || '<p class="vazio">Sua história ainda está em branco. Entre em campo!</p>';
  setScreen(`
    <section class="tela tela-lista">
      <header class="topo"><button class="btn-voltar" id="b-voltar">‹</button><h2>📖 Crônica</h2></header>
      <div class="cronica">${itens}</div>
    </section>`);
  document.getElementById('b-voltar').onclick = () => app.irHub();
}

// --- FICHA ------------------------------------------------------------------
export function renderFicha(app, dados) {
  const save = app.save;
  const meu = dados.porId.get(save.selecaoId);
  const classe = CLASSES.find((c) => c.id === save.classeId);
  const origem = ORIGENS.find((o) => o.id === save.origemId);
  const c = save.carreira;
  const attrs = ATRIBUTOS.map((at) => `
    <div class="attr">
      <span class="attr-id">${at.id}</span>
      <span class="attr-val">${save.attrs[at.id]}</span>
      <span class="attr-mod">${modTxt(save.attrs[at.id])}</span>
      <span class="attr-nome">${at.nome}</span>
    </div>`).join('');
  setScreen(`
    <section class="tela tela-lista">
      <header class="topo"><button class="btn-voltar" id="b-voltar">‹</button><h2>🧬 Ficha</h2></header>
      <div class="ficha-cab">${escudo(meu, 'crest-grande')}<div><h3>${save.nome}</h3>
        <p>${classe.emoji} ${classe.nome} — ${classe.arquetipo}</p>
        <p class="muted">${origem.emoji} ${origem.nome} · ${meu.name}</p></div></div>
      <div class="bloco"><h3>Atributos</h3><div class="attrs">${attrs}</div></div>
      <div class="bloco"><h3>Carreira</h3>
        <div class="ficha-stats">
          <div><b>${c.gols}</b><span>gols</span></div>
          <div><b>${c.assist}</b><span>assistências</span></div>
          <div><b>${c.jogos}</b><span>jogos</span></div>
          <div><b>${c.vitorias}-${c.empates}-${c.derrotas}</b><span>V-E-D</span></div>
          <div><b>${c.cleanSheets}</b><span>sem sofrer</span></div>
          <div><b>${c.melhorNota.toFixed(1)}</b><span>melhor nota</span></div>
        </div>
      </div>
    </section>`);
  document.getElementById('b-voltar').onclick = () => app.irHub();
}

// --- CONQUISTAS -------------------------------------------------------------
export function renderConquistas(app) {
  const save = app.save;
  const tem = new Set(save.conquistas);
  const grid = CONQUISTAS.map((q) => `
    <div class="conq ${tem.has(q.id) ? 'ativa' : 'bloq'}">
      <span class="conq-emoji">${tem.has(q.id) ? q.emoji : '🔒'}</span>
      <span class="conq-nome">${q.nome}</span>
      <span class="conq-desc">${q.desc}</span>
    </div>`).join('');
  setScreen(`
    <section class="tela tela-lista">
      <header class="topo"><button class="btn-voltar" id="b-voltar">‹</button><h2>🏅 Conquistas</h2></header>
      <p class="contador">${save.conquistas.length} de ${CONQUISTAS.length}</p>
      <div class="grid-conq">${grid}</div>
    </section>`);
  document.getElementById('b-voltar').onclick = () => app.irHub();
}

// --- RESULTADO DA PARTIDA ---------------------------------------------------
export function renderResultado(app, dados, resumo, novas, posCena) {
  const save = app.save;
  const meu = dados.porId.get(save.selecaoId);
  const adv = { name: resumo.advNome, tla: resumo.advTla };
  const cor = resumo.ganhou ? 'verde' : resumo.empate ? 'ambar' : 'vermelho';
  const titulo = resumo.ganhou ? 'VITÓRIA' : resumo.empate ? 'EMPATE' : 'DERROTA';
  const novasHtml = novas.length ? `
    <div class="novas-conq">
      <h3>🏅 Conquistas desbloqueadas</h3>
      ${novas.map((id) => { const q = conquistaPorId(id); return `<div class="toast-conq">${q.emoji} <b>${q.nome}</b> — ${q.desc}</div>`; }).join('')}
    </div>` : '';
  setScreen(`
    <section class="tela tela-resultado ${cor}">
      <h2 class="res-titulo">${titulo}</h2>
      <div class="res-placar">
        <div class="time">${escudo(meu)}<span>${meu.tla}</span></div>
        <div class="res-num">${resumo.golsMeu} <span>–</span> ${resumo.golsAdv}</div>
        <div class="time">${escudo(dados.porId.get(save.campanha.proximoAdvId))}<span>${adv.tla}</span></div>
      </div>
      ${resumo.penaltis ? `<p class="res-pen">${resumo.penaltis === 'venci' ? 'Classificado nos pênaltis!' : 'Eliminado nos pênaltis.'}</p>` : ''}
      <div class="res-jogador">
        <div><b>${resumo.golsJogador}</b><span>seus gols</span></div>
        <div><b>${resumo.assistJogador}</b><span>assist.</span></div>
        <div><b>${resumo.nota.toFixed(1)}</b><span>nota</span></div>
        <div><b>+${resumo.xp}</b><span>XP</span></div>
      </div>
      ${posCena ? `<blockquote class="res-cena">${posCena}</blockquote>` : ''}
      ${novasHtml}
      <button class="btn btn-grande" id="b-continuar">Continuar ›</button>
    </section>`);
  document.getElementById('b-continuar').onclick = () => app.aposResultado();
}

// --- LEGADO (fim da campanha) ----------------------------------------------
export function renderLegado(app, dados, epilogo) {
  const save = app.save;
  const meu = dados.porId.get(save.selecaoId);
  const c = save.carreira;
  let faixa = 'Sua jornada';
  if (c.campeao) faixa = '🏆 CAMPEÃO DO MUNDO';
  else if (c.vice) faixa = '🥈 Vice-campeão';
  else if (c.fase !== 'grupos') faixa = `Eliminado em ${nomeFase(c.fase)}`;
  else faixa = 'Eliminado na fase de grupos';

  setScreen(`
    <section class="tela tela-legado">
      <div class="brasao">${c.campeao ? '🏆' : c.vice ? '🥈' : '🎖️'}</div>
      <h2>${faixa}</h2>
      <div class="ficha-cab center">${escudo(meu, 'crest-grande')}<div><h3>${save.nome}</h3><p class="muted">${meu.name}</p></div></div>
      <blockquote class="epilogo">${epilogo}</blockquote>
      <div class="ficha-stats">
        <div><b>${c.gols}</b><span>gols</span></div>
        <div><b>${c.assist}</b><span>assist.</span></div>
        <div><b>${c.jogos}</b><span>jogos</span></div>
        <div><b>${c.vitorias}-${c.empates}-${c.derrotas}</b><span>V-E-D</span></div>
        <div><b>${save.conquistas.length}/${CONQUISTAS.length}</b><span>conquistas</span></div>
        <div><b>${c.melhorNota.toFixed(1)}</b><span>melhor nota</span></div>
      </div>
      <button class="btn btn-grande" id="b-nova">Nova carreira</button>
      <button class="btn btn-ghost" id="b-cronica">📖 Reler a crônica</button>
    </section>`);
  document.getElementById('b-nova').onclick = () => { app.apagarCarreira(true); };
  document.getElementById('b-cronica').onclick = () => app.irCronica();
}
