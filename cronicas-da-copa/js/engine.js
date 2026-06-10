// Motor de partida — simulação textual estilo Brasfoot, dirigível passo a passo.
//
// A UI chama `avancar()` em loop: o motor simula minutos e devolve os lances
// narrados até bater num "Lance Decisivo" (pausa para a intervenção do jogador)
// ou no fim do jogo. O jogador resolve o Lance com o d20 e chama
// `resolverLance(...)`, e o loop continua.
//
// As probabilidades de gol vêm do Elo das seleções (curva logística), com
// bônus do protagonista e do "momento" (momentum) do jogo.
import { criarRng } from './dice.js';
import { LANCES_POR_PARTIDA } from './config.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Quanto o protagonista "puxa" o time, por classe (afeta ataque/defesa e a
// chance de o gol sair no pé dele).
const PESO_OFENSIVO = { goleiro: 0.1, zagueiro: 0.3, meia: 0.7, ponta: 0.85, centroavante: 1.0 };
const PESO_DEFENSIVO = { goleiro: 1.0, zagueiro: 0.9, meia: 0.4, ponta: 0.2, centroavante: 0.15 };

// Bônus de Elo que o protagonista dá ao time, a partir dos atributos.
export function bonusEloJogador(classeId, attrs) {
  const ofe = (attrs.TEC + attrs.MEN + attrs.VIS) / 3 - 12;
  const def = (attrs.FIS + attrs.MEN + attrs.VIS) / 3 - 12;
  const po = PESO_OFENSIVO[classeId] ?? 0.5;
  const pd = PESO_DEFENSIVO[classeId] ?? 0.5;
  return Math.round((ofe * po + def * pd) * 9); // ~ -50..+90 de Elo
}

function expectativa(eloA, eloB) {
  return 1 / (1 + Math.pow(10, -(eloA - eloB) / 400));
}

function sortearAgenda(rng) {
  // 3 janelas: começo, meio, fim — com folga aleatória.
  return [
    18 + Math.floor(rng() * 12),  // 18–29
    50 + Math.floor(rng() * 12),  // 50–61
    74 + Math.floor(rng() * 14),  // 74–87
  ].slice(0, LANCES_POR_PARTIDA);
}

export function criarPartida(cfg) {
  // cfg: { meuTime, advTime, classeId, attrs, fase, mando ('casa'|'fora'|'neutro'),
  //        mataMata, semente }
  const rng = criarRng(cfg.semente);
  const bonus = bonusEloJogador(cfg.classeId, cfg.attrs);
  const mando = cfg.mando === 'casa' ? 35 : cfg.mando === 'fora' ? -20 : 0;
  const meuElo = cfg.meuTime.elo + bonus + mando;
  const advElo = cfg.advTime.elo;
  const diff = meuElo - advElo;

  const lamMeuBase = clamp(1.35 + diff / 300, 0.35, 3.2);
  const lamAdvBase = clamp(1.35 - diff / 300, 0.35, 3.2);

  const agenda = sortearAgenda(rng);

  const estado = {
    meuTime: cfg.meuTime,
    advTime: cfg.advTime,
    classeId: cfg.classeId,
    fase: cfg.fase,
    mataMata: !!cfg.mataMata,
    minuto: 0,
    golsMeu: 0,
    golsAdv: 0,
    golsJogador: 0,
    assistJogador: 0,
    momentum: 0,        // -100..100 (+ a seu favor)
    lancesRestantes: LANCES_POR_PARTIDA,
    lancesUsados: 0,
    log: [],
    encerrada: false,
    pendingLance: null,
    resultadoPenaltis: null,
    bonusElo: bonus,
  };

  function fatorMomentum(sinal) {
    // momentum a favor aumenta sua chance e reduz a do adversário
    return clamp(1 + (sinal * estado.momentum) / 250, 0.6, 1.5);
  }

  function reg(minuto, texto, tipo = 'info') {
    estado.log.push({ minuto, texto, tipo });
  }

  // modo: 'jogador' (o protagonista marca), 'time' (companheiro marca; usado
  // quando o jogador já levou a assistência), 'fluxo' (sorteia pelo peso da classe).
  function golMeu(eventos, modo) {
    estado.golsMeu++;
    estado.momentum = clamp(estado.momentum + 14, -100, 100);
    const po = PESO_OFENSIVO[estado.classeId] ?? 0.5;
    let fezGol;
    if (modo === 'jogador') fezGol = true;
    else if (modo === 'time') fezGol = false;
    else fezGol = rng() < po * 0.6;

    let texto;
    if (fezGol) {
      estado.golsJogador++;
      texto = `⚽ GOL DE ${estado.meuTime.tla}! Você marca! (${estado.golsMeu}–${estado.golsAdv})`;
    } else {
      // no fluxo normal, chance de você dar a assistência (no modo 'time' a
      // assistência já foi contada antes de chamar golMeu)
      let assistTxt = '';
      if (modo === 'fluxo' && rng() < 0.5) { estado.assistJogador++; assistTxt = ' Assistência sua!'; }
      texto = `⚽ GOL DE ${estado.meuTime.tla}!${assistTxt} (${estado.golsMeu}–${estado.golsAdv})`;
    }
    reg(estado.minuto, texto, 'gol-meu');
    eventos.push({ tipo: 'gol-meu', texto, minuto: estado.minuto });
  }

  function golAdv(eventos) {
    estado.golsAdv++;
    estado.momentum = clamp(estado.momentum - 12, -100, 100);
    const texto = `💔 Gol do ${estado.advTime.tla}. (${estado.golsMeu}–${estado.golsAdv})`;
    reg(estado.minuto, texto, 'gol-adv');
    eventos.push({ tipo: 'gol-adv', texto, minuto: estado.minuto });
  }

  // Avança a simulação até o próximo Lance Decisivo ou o fim do jogo.
  function avancar() {
    if (estado.encerrada) return { tipo: 'fim', estado };
    const eventos = [];
    while (estado.minuto < 90) {
      estado.minuto++;
      if (agenda.includes(estado.minuto) && estado.lancesRestantes > 0) {
        estado.pendingLance = { minuto: estado.minuto };
        return { tipo: 'lance', minuto: estado.minuto, eventos };
      }
      const pMeu = (lamMeuBase / 90) * fatorMomentum(+1);
      const pAdv = (lamAdvBase / 90) * fatorMomentum(-1);
      const r = rng();
      if (r < pMeu) golMeu(eventos, 'fluxo');
      else if (r < pMeu + pAdv) golAdv(eventos);
      // o momentum decai naturalmente para 0
      estado.momentum *= 0.985;
    }
    return finalizar(eventos);
  }

  function finalizar(eventos = []) {
    estado.minuto = 90;
    estado.encerrada = true;
    // mata-mata empatado: pênaltis (peso por MEN do jogador + leve Elo)
    if (estado.mataMata && estado.golsMeu === estado.golsAdv) {
      const chance = clamp(0.5 + (diff / 1200) + ((cfg.attrs.MEN - 12) * 0.03), 0.2, 0.8);
      const venci = rng() < chance;
      estado.resultadoPenaltis = venci ? 'venci' : 'perdi';
      const texto = `🥅 Nos pênaltis: ${venci ? 'classificação! ' + estado.meuTime.tla : 'eliminado — ' + estado.advTime.tla + ' avança'}.`;
      reg(90, texto, venci ? 'gol-meu' : 'gol-adv');
      eventos.push({ tipo: 'penaltis', texto, minuto: 90, venci });
    }
    return { tipo: 'fim', estado, eventos };
  }

  // Resolve um Lance Decisivo já rolado no d20.
  // opcao: { id, texto, stat, cd, tipo }  (tipo: 'finalizar'|'passar'|'driblar'|'defender'|'seguro')
  // resultado: objeto vindo de dice.rolar(...)
  function resolverLance(opcao, resultado) {
    estado.pendingLance = null;
    estado.lancesRestantes = Math.max(0, estado.lancesRestantes - 1);
    estado.lancesUsados++;
    const eventos = [];
    const minuto = estado.minuto;

    const sucesso = resultado.sucesso;
    const crit = resultado.critico;
    const critFail = resultado.falhaCritica;

    if (opcao.tipo === 'defender' || estado.classeId === 'goleiro') {
      // lances defensivos: sucesso evita/perigo; falha pode sair gol adversário
      if (critFail) { golAdv(eventos); eventos.push(efx(minuto, '💥 Falha crítica na saída — o adversário aproveita.')); estado.momentum -= 10; }
      else if (!sucesso) { eventos.push(efx(minuto, '😬 Quase! A defesa segura no susto.')); estado.momentum -= 4; }
      else if (crit) { eventos.push(efx(minuto, '🧤 DEFESAÇA! Você salva o que era gol certo e levanta a torcida.')); estado.momentum = clamp(estado.momentum + 16, -100, 100); }
      else { eventos.push(efx(minuto, '✋ Boa intervenção — perigo afastado.')); estado.momentum = clamp(estado.momentum + 8, -100, 100); }
    } else if (opcao.tipo === 'seguro') {
      // jogada segura: pouco risco, pouco ganho
      if (sucesso) { estado.momentum = clamp(estado.momentum + 6, -100, 100); eventos.push(efx(minuto, '👍 Jogada de craque sem riscos — seu time mantém o controle.')); }
      else { eventos.push(efx(minuto, '➖ A jogada segura não rende muito, mas não custa nada.')); }
    } else if (opcao.tipo === 'passar') {
      if (critFail) { eventos.push(efx(minuto, '💥 Passe errado feio — contra-ataque!')); if (rng() < 0.5) golAdv(eventos); }
      else if (!sucesso) { eventos.push(efx(minuto, '↩️ O passe não encontra ninguém. Recomeça.')); estado.momentum -= 3; }
      else {
        // assistência! grande chance de virar gol do time
        estado.assistJogador++;
        if (crit || rng() < 0.8) { golMeu(eventos, 'time'); /* gol após sua assistência: quem marca é o companheiro */ }
        else eventos.push(efx(minuto, '🅰️ Que passe! O finalizador, porém, manda por cima.'));
        if (crit) eventos.push(efx(minuto, '✨ Assistência de placa!'));
      }
    } else {
      // ofensivo: finalizar / driblar
      if (critFail) { eventos.push(efx(minuto, '💥 Falha crítica! Você perde a bola e o adversário sai em velocidade.')); if (rng() < 0.45) golAdv(eventos); estado.momentum -= 8; }
      else if (!sucesso) { eventos.push(efx(minuto, '🧤 O goleiro defende! Faltou capricho.')); estado.momentum -= 3; }
      else if (crit) { golMeu(eventos, 'jogador'); eventos.push(efx(minuto, '✨ GOLAÇO! Um lance para a história da Copa.')); estado.momentum = clamp(estado.momentum + 20, -100, 100); }
      else { golMeu(eventos, 'jogador'); }
    }

    return { eventos, encerraApos: estado.minuto >= 90 };
  }

  function efx(minuto, texto) {
    reg(minuto, texto, 'rpg');
    return { tipo: 'rpg', texto, minuto };
  }

  // Gera as opções de um Lance Decisivo de fallback (offline), conforme a classe.
  function opcoesPadrao() {
    const c = estado.classeId;
    if (c === 'goleiro') {
      return [
        { id: 'A', texto: 'Sair do gol e abafar', stat: 'MEN', cd: 15, tipo: 'defender' },
        { id: 'B', texto: 'Ficar na linha e esperar', stat: 'VIS', cd: 11, tipo: 'defender' },
        { id: 'C', texto: 'Espalmar para escanteio', stat: 'FIS', cd: 13, tipo: 'defender' },
      ];
    }
    if (c === 'zagueiro') {
      return [
        { id: 'A', texto: 'Dividir firme', stat: 'FIS', cd: 14, tipo: 'defender' },
        { id: 'B', texto: 'Dar o bote no tempo certo', stat: 'VIS', cd: 13, tipo: 'defender' },
        { id: 'C', texto: 'Subir para o ataque na bola parada', stat: 'MEN', cd: 16, tipo: 'finalizar' },
      ];
    }
    if (c === 'meia') {
      return [
        { id: 'A', texto: 'Lançar na medida (assistência)', stat: 'VIS', cd: 14, tipo: 'passar' },
        { id: 'B', texto: 'Arriscar de fora da área', stat: 'TEC', cd: 16, tipo: 'finalizar' },
        { id: 'C', texto: 'Tocar e manter a posse', stat: 'TEC', cd: 10, tipo: 'seguro' },
      ];
    }
    if (c === 'ponta') {
      return [
        { id: 'A', texto: 'Partir para cima e driblar', stat: 'TEC', cd: 15, tipo: 'driblar' },
        { id: 'B', texto: 'Cruzar rasteiro (assistência)', stat: 'VIS', cd: 13, tipo: 'passar' },
        { id: 'C', texto: 'Cortar para o meio e finalizar', stat: 'TEC', cd: 16, tipo: 'finalizar' },
      ];
    }
    // centroavante
    return [
      { id: 'A', texto: 'Finalizar de primeira', stat: 'MEN', cd: 16, tipo: 'finalizar' },
      { id: 'B', texto: 'Girar sobre o zagueiro', stat: 'TEC', cd: 15, tipo: 'driblar' },
      { id: 'C', texto: 'Tocar para o companheiro melhor posto', stat: 'VIS', cd: 11, tipo: 'passar' },
    ];
  }

  // Nota do jogador na partida (6.0 base + contribuições).
  function notaJogador() {
    let nota = 6.0;
    nota += estado.golsJogador * 1.1;
    nota += estado.assistJogador * 0.7;
    if (estado.golsMeu > estado.golsAdv) nota += 0.5;
    if (estado.classeId === 'goleiro' || estado.classeId === 'zagueiro') {
      if (estado.golsAdv === 0) nota += 1.0;
      nota -= estado.golsAdv * 0.3;
    }
    return clamp(Math.round(nota * 10) / 10, 3.0, 10.0);
  }

  return {
    estado,
    avancar,
    finalizar,
    resolverLance,
    opcoesPadrao,
    notaJogador,
    get contexto() {
      return {
        meuTime: estado.meuTime.name, advTime: estado.advTime.name,
        placar: `${estado.golsMeu}–${estado.golsAdv}`,
        minuto: estado.minuto, momentum: Math.round(estado.momentum),
        fase: estado.fase, classe: estado.classeId,
      };
    },
  };
}
