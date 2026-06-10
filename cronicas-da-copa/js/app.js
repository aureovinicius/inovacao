// Controlador principal de "Crônicas da Copa". Liga dados, estado, motor,
// Mestre (IA) e telas, e conduz o fluxo de partida.
import { carregarSelecoes } from './data.js';
import {
  novoPersonagem, carregar, salvar, apagar, aplicarPartida, avancarCampanha,
  resolverGrupo, definirProximoAdversario, cronicar, nomeFase,
} from './state.js';
import { criarPartida } from './engine.js';
import { rolar, modificador } from './dice.js';
import { novasConquistas, conquistaPorId } from './achievements.js';
import { gerarLance, gerarCena, mestreOnline } from './mestre.js';
import { MAX_IA_POR_PARTIDA, LANCES_POR_PARTIDA } from './config.js';
import { animarDado } from './ui/dice-anim.js';
import * as Screens from './ui/screens.js';

const app = {
  dados: null,
  save: null,
  eng: null,
  advAtual: null,
  iaUsada: 0,

  async iniciar() {
    this.dados = await carregarSelecoes();
    this.save = carregar();
    this.irHome();
  },

  // --- navegação simples ----------------------------------------------------
  irHome() { Screens.renderHome(this); },
  novaCarreiraTela() { Screens.renderCreate(this, this.dados); },
  irCronica() { Screens.renderCronica(this); },
  irFicha() { Screens.renderFicha(this, this.dados); },
  irConquistas() { Screens.renderConquistas(this); },

  irHub() {
    const camp = this.save.campanha;
    if (!camp.concluida && !camp.proximoAdvId) definirProximoAdversario(this.dados, this.save);
    this.advAtual = this.dados.porId.get(camp.proximoAdvId);
    Screens.renderHub(this, this.dados);
  },

  apagarCarreira(direto = false) {
    if (!direto && !confirm('Apagar a carreira atual? Isso não pode ser desfeito.')) return;
    apagar();
    this.save = null;
    if (direto) this.novaCarreiraTela();
    else this.irHome();
  },

  criarPersonagem(draft) {
    this.save = novoPersonagem(draft);
    const meu = this.dados.porId.get(this.save.selecaoId);
    cronicar(this.save, {
      tipo: 'inicio', titulo: 'O começo',
      texto: `${this.save.nome} veste a camisa de ${meu.name} e parte para a Copa do Mundo de 2026. Que história será essa?`,
    });
    definirProximoAdversario(this.dados, this.save);
    salvar(this.save);
    this.irHub();
  },

  // --- PARTIDA --------------------------------------------------------------
  async entrarEmCampo() {
    const save = this.save;
    const meu = this.dados.porId.get(save.selecaoId);
    const adv = this.dados.porId.get(save.campanha.proximoAdvId);
    if (!adv) { definirProximoAdversario(this.dados, save); return this.entrarEmCampo(); }
    this.advAtual = adv;
    save._eloMeuTime = meu.elo;
    this.iaUsada = 0;

    this.eng = criarPartida({
      meuTime: meu, advTime: adv,
      classeId: save.classeId, attrs: save.attrs,
      fase: save.campanha.fase,
      mataMata: save.campanha.fase !== 'grupos',
      mando: 'neutro',
      semente: (save.campanha.semente + save.carreira.jogos * 7919) | 0,
    });

    this._mountMatch(meu, adv);
    // cena de pré-jogo (IA ou offline)
    const usarIA = mestreOnline() && this.iaUsada < MAX_IA_POR_PARTIDA;
    const pre = await gerarCena({
      tipo: 'pre', tom: save.tom, personagem: { nome: save.nome },
      contexto: { meuTime: meu.name, advTime: adv.name, fase: nomeFase(save.campanha.fase) },
      usarIA,
    });
    if (pre.fonte === 'ia') this.iaUsada++;
    this._cenaPre = pre.texto;
    this._logLinha({ texto: pre.texto, tipo: 'cena' });
    this._setCtrl(`<button class="btn btn-grande" id="b-avancar">Apitar o início ▶</button>`);
    document.getElementById('b-avancar').onclick = () => this._avancar();
  },

  _mountMatch(meu, adv) {
    const elapsed = () => this.eng.estado.minuto;
    document.getElementById('app').innerHTML = `
      <section class="tela tela-match">
        <header class="match-head">
          <div class="mh-time">${this._crest(meu)}<span>${meu.tla}</span></div>
          <div class="mh-placar"><span id="mh-gm">0</span><i>–</i><span id="mh-ga">0</span>
            <small id="mh-min">0'</small></div>
          <div class="mh-time">${this._crest(adv)}<span>${adv.tla}</span></div>
        </header>
        <div class="match-meta"><span id="mh-lances">🎲 ${LANCES_POR_PARTIDA} lances</span><span id="mh-mom"></span></div>
        <div class="match-log" id="match-log"></div>
        <div class="match-ctrl" id="match-ctrl"></div>
      </section>`;
    this._refreshHead();
  },

  _crest(t) { return `<img class="crest" src="${t.crest}" alt="" onerror="this.style.display='none'">`; },

  _refreshHead() {
    const e = this.eng.estado;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('mh-gm', e.golsMeu); set('mh-ga', e.golsAdv); set('mh-min', `${e.minuto}'`);
    set('mh-lances', `🎲 ${e.lancesRestantes} lance${e.lancesRestantes === 1 ? '' : 's'}`);
    const mom = e.momentum;
    const txt = mom > 25 ? '🔥 pressão a seu favor' : mom < -25 ? '⚠️ sob pressão' : '⚖️ equilíbrio';
    set('mh-mom', txt);
  },

  _logLinha(ev) {
    const log = document.getElementById('match-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = `log-linha ${ev.tipo || 'info'}`;
    div.innerHTML = ev.minuto ? `<b class="log-min">${ev.minuto}'</b> ${ev.texto}` : ev.texto;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  },

  _setCtrl(html) { document.getElementById('match-ctrl').innerHTML = html; },

  async _renderEventos(eventos) {
    for (const ev of eventos) {
      this._logLinha(ev);
      this._refreshHead();
      await new Promise((r) => setTimeout(r, 260));
    }
  },

  async _avancar() {
    this._setCtrl(`<div class="apitando">⏱️ jogo rolando…</div>`);
    const passo = this.eng.avancar();
    await this._renderEventos(passo.eventos || []);
    if (passo.tipo === 'lance') {
      await this._lance(passo.minuto);
    } else { // fim
      await this._fimDeJogo();
    }
  },

  async _lance(minuto) {
    const save = this.save;
    const opcoesPadrao = this.eng.opcoesPadrao();
    const usarIA = mestreOnline() && this.iaUsada < MAX_IA_POR_PARTIDA;
    const r = await gerarLance({
      contexto: { ...this.eng.contexto, minuto, placar: `${this.eng.estado.golsMeu}–${this.eng.estado.golsAdv}` },
      tom: save.tom, classe: save.classeId, opcoesPadrao, usarIA,
    });
    if (r.fonte === 'ia') this.iaUsada++;

    this._logLinha({ texto: `<span class="lance-tag">⚡ LANCE DECISIVO (${minuto}')</span> ${r.narrativa}`, tipo: 'lance' });

    const e = this.eng.estado;
    const vantagem = e.momentum >= 30;
    const desvantagem = e.momentum <= -30;
    const dica = vantagem ? ' <small>(vantagem: 🔥)</small>' : desvantagem ? ' <small>(desvantagem: ⚠️)</small>' : '';

    const botoes = r.opcoes.map((o) => {
      const mod = modificador(save.attrs[o.stat]);
      const sinal = mod >= 0 ? '+' : '';
      return `<button class="btn btn-opcao" data-id="${o.id}">
        <span class="op-txt">${o.texto}</span>
        <span class="op-meta">${o.stat} ${sinal}${mod} · CD ${o.cd}</span>
      </button>`;
    }).join('');
    this._setCtrl(`<p class="lance-instr">Escolha seu lance${dica}:</p>${botoes}`);

    document.querySelectorAll('.btn-opcao').forEach((btn) => {
      btn.onclick = async () => {
        const opcao = r.opcoes.find((o) => o.id === btn.dataset.id);
        await this._resolverLance(opcao, vantagem, desvantagem);
      };
    });
  },

  async _resolverLance(opcao, vantagem, desvantagem) {
    const save = this.save;
    const mod = modificador(save.attrs[opcao.stat]);
    const resultado = rolar(mod, opcao.cd, { vantagem, desvantagem });
    await animarDado(resultado, opcao.stat);
    const { eventos, encerraApos } = this.eng.resolverLance(opcao, resultado);
    await this._renderEventos(eventos);
    this._refreshHead();
    if (encerraApos) { await this._fimDeJogo(); return; }
    this._setCtrl(`<button class="btn btn-grande" id="b-avancar">Seguir o jogo ▶</button>`);
    document.getElementById('b-avancar').onclick = () => this._avancar();
  },

  async _fimDeJogo() {
    const save = this.save;
    const adv = this.advAtual;
    this._setCtrl(`<div class="apitando">⏱️ apito final…</div>`);

    // cena de pós-jogo
    const e = this.eng.estado;
    const ganhou = e.golsMeu > e.golsAdv || e.resultadoPenaltis === 'venci';
    const empate = e.golsMeu === e.golsAdv && !e.resultadoPenaltis;
    const usarIA = mestreOnline() && this.iaUsada < MAX_IA_POR_PARTIDA;
    const pos = await gerarCena({
      tipo: 'pos', tom: save.tom, personagem: { nome: save.nome },
      contexto: { placar: `${e.golsMeu}–${e.golsAdv}`, ganhou, empate, advTime: adv.name },
      usarIA,
    });

    const resumo = aplicarPartida(save, this.eng, adv);

    // crônica
    cronicar(save, {
      tipo: ganhou ? 'vitoria' : empate ? 'empate' : 'derrota',
      titulo: `${nomeFase(e.fase)} · ${this.dados.porId.get(save.selecaoId).tla} ${e.golsMeu}–${e.golsAdv} ${adv.tla}`,
      texto: pos.texto,
    });

    // conquistas
    const ctx = { classe: save.classeId, carreira: save.carreira, ultimaPartida: resumo };
    const novas = novasConquistas(ctx, save.conquistas);
    if (novas.length) {
      save.conquistas.push(...novas);
      for (const id of novas) {
        const q = conquistaPorId(id);
        cronicar(save, { tipo: 'conquista', titulo: `🏅 ${q.nome}`, texto: q.desc });
      }
    }
    salvar(save);
    Screens.renderResultado(this, this.dados, resumo, novas, pos.texto);
  },

  aposResultado() {
    const save = this.save;
    const transicao = avancarCampanha(save, save.ultimaPartida, (s) => resolverGrupo(this.dados, s));
    cronicar(save, { tipo: 'fase', titulo: '', texto: transicao.descricao });

    // prepara próximo adversário ou encerra
    save.campanha.proximoAdvId = null;
    if (!save.campanha.concluida) definirProximoAdversario(this.dados, save);
    salvar(save);

    if (save.campanha.concluida) this.irLegado();
    else this.irHub();
  },

  async irLegado() {
    const save = this.save;
    const usarIA = mestreOnline();
    const epi = await gerarCena({
      tipo: 'epilogo', tom: save.tom, personagem: { nome: save.nome },
      contexto: { campeao: save.carreira.campeao, vice: save.carreira.vice, fase: save.carreira.fase },
      usarIA,
    });
    if (!save.cronica.some((c) => c.tipo === 'epilogo')) {
      cronicar(save, { tipo: 'epilogo', titulo: 'Legado', texto: epi.texto });
      salvar(save);
    }
    Screens.renderLegado(this, this.dados, epi.texto);
  },
};

window.addEventListener('DOMContentLoaded', () => {
  app.iniciar().catch((err) => {
    document.getElementById('app').innerHTML =
      `<div class="erro">Falha ao iniciar: ${err.message}. Rode via servidor HTTP (não abra o arquivo direto).</div>`;
    console.error(err);
  });
});

// expõe para depuração no console
window.__app = app;
