// Estado do jogo: criação do personagem, persistência (localStorage),
// acúmulo de carreira e progressão da campanha (grupos -> mata-mata).
import { SAVE_KEY, SAVE_VERSION } from './config.js';
import { montarAtributos } from './rules.js';
import { adversariosDoGrupo, adversarioMataMata, expectativaElo } from './data.js';

export const FASES = ['grupos', 'R32', 'R16', 'quartas', 'semi', 'final', 'fim'];
const NOME_FASE = {
  grupos: 'Fase de Grupos', R32: 'Rodada de 32', R16: 'Oitavas de final',
  quartas: 'Quartas de final', semi: 'Semifinal', final: 'Final', fim: 'Encerrada',
};
export function nomeFase(f) { return NOME_FASE[f] || f; }

export function novoPersonagem({ nome, selecaoId, classeId, origemId, tom }) {
  const attrs = montarAtributos(classeId, origemId);
  return {
    versao: SAVE_VERSION,
    criadoEm: new Date().toISOString(),
    nome: (nome || 'Sem-nome').trim().slice(0, 28),
    selecaoId,
    classeId,
    origemId,
    tom,
    attrs,
    nivel: 1,
    xp: 0,
    carreira: {
      gols: 0, assist: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0,
      golsSofridos: 0, cleanSheets: 0, maiorGoleada: 0, hatTricks: 0, zebras: 0,
      fase: 'grupos', campeao: false, vice: false, melhorNota: 0,
    },
    campanha: {
      fase: 'grupos',
      jogoIndex: 0,          // 0..2 na fase de grupos
      pontosGrupo: 0,
      jaEnfrentados: [],
      proximoAdvId: null,
      semente: (Math.random() * 1e9) | 0,
      eliminado: false,
      concluida: false,
    },
    ultimaPartida: null,
    conquistas: [],
    cronica: [],            // [{ tipo, titulo, texto, minuto? }]
  };
}

// --- Persistência -----------------------------------------------------------
export function salvar(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* quota */ }
}
export function carregar() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && s.versao === SAVE_VERSION) return s;
  } catch { /* corrompido */ }
  return null;
}
export function apagar() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

// --- Campanha ---------------------------------------------------------------

// Define quem o jogador enfrenta no próximo jogo e o mando de campo.
export function definirProximoAdversario(dados, save) {
  const camp = save.campanha;
  if (camp.fase === 'grupos') {
    const advs = adversariosDoGrupo(dados, save.selecaoId);
    const adv = advs[camp.jogoIndex] || advs[0];
    camp.proximoAdvId = adv ? adv.id : null;
    return adv;
  }
  // mata-mata
  const faseIdx = FASES.indexOf(camp.fase);
  const rng = () => Math.random();
  const adv = adversarioMataMata(dados, save.selecaoId, faseIdx, rng, camp.jaEnfrentados);
  camp.proximoAdvId = adv ? adv.id : null;
  return adv;
}

// Aplica uma partida encerrada (engine.estado) à carreira e devolve um resumo.
export function aplicarPartida(save, eng, advTime) {
  const e = eng.estado;
  const c = save.carreira;
  const nota = eng.notaJogador();
  const ganhou = e.golsMeu > e.golsAdv || e.resultadoPenaltis === 'venci';
  const perdeu = e.golsAdv > e.golsMeu || e.resultadoPenaltis === 'perdi';
  const empate = !ganhou && !perdeu;

  c.jogos++;
  c.gols += e.golsJogador;
  c.assist += e.assistJogador;
  c.golsSofridos += e.golsAdv;
  if (e.golsAdv === 0) c.cleanSheets++;
  if (e.golsJogador >= 3) c.hatTricks++;
  const dif = Math.abs(e.golsMeu - e.golsAdv);
  if (ganhou && dif >= 1) c.maiorGoleada = Math.max(c.maiorGoleada, dif);
  // zebra: vencer quem tinha Elo bem maior que o do seu time
  if (ganhou && advTime && save._eloMeuTime && (advTime.elo - save._eloMeuTime) >= 80) c.zebras++;
  if (ganhou) c.vitorias++; else if (empate) c.empates++; else c.derrotas++;
  c.melhorNota = Math.max(c.melhorNota, nota);

  // XP simples
  const xp = 40 + e.golsJogador * 30 + e.assistJogador * 20 + (ganhou ? 40 : empate ? 15 : 5);
  save.xp += xp;
  while (save.xp >= proximoNivel(save.nivel)) { save.xp -= proximoNivel(save.nivel); save.nivel++; }

  save.ultimaPartida = {
    advNome: advTime.name, advTla: advTime.tla, advElo: advTime.elo,
    golsMeu: e.golsMeu, golsAdv: e.golsAdv,
    golsJogador: e.golsJogador, assistJogador: e.assistJogador,
    nota, ganhou, empate, perdeu, fase: e.fase, penaltis: e.resultadoPenaltis, xp,
  };

  return save.ultimaPartida;
}

export function proximoNivel(nivel) { return 100 + (nivel - 1) * 80; }

// Avança a campanha após uma partida. Retorna { fase, avancou, descricao }.
// `resolverGrupoFn(save)` -> { classificou, posicao, descricao } é injetado pela
// camada de dados (precisa do dataset para simular o resto do grupo).
export function avancarCampanha(save, ultima, resolverGrupoFn) {
  const camp = save.campanha;

  if (camp.fase === 'grupos') {
    camp.pontosGrupo += ultima.ganhou ? 3 : ultima.empate ? 1 : 0;
    camp.jaEnfrentados.push(save.campanha.proximoAdvId);
    camp.jogoIndex++;
    if (camp.jogoIndex < 3) {
      return { fase: 'grupos', avancou: true, descricao: `Próximo jogo da fase de grupos (${camp.jogoIndex + 1}/3).` };
    }
    // fim da fase de grupos: resolve classificação
    const res = resolverGrupoFn(save);
    if (res.classificou) {
      camp.fase = 'R32';
      camp.jaEnfrentados = [];
      save.carreira.fase = 'R32';
      return { fase: 'R32', avancou: true, classificou: true, descricao: res.descricao };
    } else {
      camp.eliminado = true;
      camp.concluida = true;
      save.carreira.fase = 'grupos';
      return { fase: 'grupos', avancou: false, classificou: false, descricao: res.descricao };
    }
  }

  // mata-mata
  if (!ultima.ganhou) {
    if (camp.fase === 'final') { save.carreira.vice = true; }
    camp.eliminado = camp.fase !== 'final';
    camp.concluida = true;
    save.carreira.fase = camp.fase;
    return { fase: camp.fase, avancou: false, descricao: camp.fase === 'final' ? 'Vice-campeão do mundo.' : 'Eliminado no mata-mata.' };
  }
  // venceu
  camp.jaEnfrentados.push(camp.proximoAdvId);
  if (camp.fase === 'final') {
    save.carreira.campeao = true;
    save.carreira.fase = 'fim';
    camp.fase = 'fim';
    camp.concluida = true;
    return { fase: 'fim', avancou: true, campeao: true, descricao: 'CAMPEÃO DO MUNDO!' };
  }
  const idx = FASES.indexOf(camp.fase);
  camp.fase = FASES[idx + 1];
  save.carreira.fase = camp.fase;
  return { fase: camp.fase, avancou: true, descricao: `Classificado para ${nomeFase(camp.fase)}.` };
}

// Simula o resto do grupo por Elo para decidir se o jogador classifica (top 2).
// Recebe o dataset e o save; usa os resultados reais do jogador + Elo dos demais.
export function resolverGrupo(dados, save) {
  const eu = dados.porId.get(save.selecaoId);
  const advs = adversariosDoGrupo(dados, save.selecaoId);
  const times = [eu, ...advs];
  const pts = new Map(times.map((t) => [t.id, 0]));

  // pontos reais do jogador
  pts.set(eu.id, save.campanha.pontosGrupo);

  // resultados do jogador contam para os adversários também
  // (aproximação: invertemos o resultado que o jogador obteve)
  // Como não guardamos cada resultado, estimamos via Elo para os jogos restantes
  // e damos aos adversários os pontos "contra o jogador" de forma neutra.

  // jogos entre os 3 adversários (round-robin) por Elo
  for (let i = 0; i < advs.length; i++) {
    for (let j = i + 1; j < advs.length; j++) {
      const a = advs[i], b = advs[j];
      const p = expectativaElo(a.elo, b.elo);
      const r = Math.random();
      if (r < p * 0.6) pts.set(a.id, pts.get(a.id) + 3);
      else if (r > 1 - (1 - p) * 0.6) pts.set(b.id, pts.get(b.id) + 3);
      else { pts.set(a.id, pts.get(a.id) + 1); pts.set(b.id, pts.get(b.id) + 1); }
    }
    // cada adversário também jogou contra você: estimamos por Elo (sem afetar seus pontos)
    const adv = advs[i];
    const pAdv = expectativaElo(adv.elo, eu.elo);
    const r = Math.random();
    if (r < pAdv * 0.5) pts.set(adv.id, pts.get(adv.id) + 3);
    else if (r > 0.8) pts.set(adv.id, pts.get(adv.id) + 1);
  }

  const ranking = times
    .map((t) => ({ t, p: pts.get(t.id), elo: t.elo }))
    .sort((a, b) => b.p - a.p || b.elo - a.elo);
  const posicao = ranking.findIndex((x) => x.t.id === eu.id) + 1;
  const classificou = posicao <= 2;
  const descricao = classificou
    ? `Você terminou o grupo ${eu.group} em ${posicao}º com ${save.campanha.pontosGrupo} pts — classificado!`
    : `Você terminou o grupo ${eu.group} em ${posicao}º com ${save.campanha.pontosGrupo} pts — eliminado na fase de grupos.`;
  return { classificou, posicao, descricao };
}

// Adiciona um trecho à crônica.
export function cronicar(save, entrada) {
  save.cronica.push({ ts: Date.now(), ...entrada });
  if (save.cronica.length > 200) save.cronica.shift();
}
