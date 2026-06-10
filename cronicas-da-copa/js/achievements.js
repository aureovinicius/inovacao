// Sistema de conquistas. Cada conquista tem um id, rótulo, emoji e uma função
// `checa(ctx)` que recebe o contexto acumulado da carreira e diz se foi obtida.
//
// ctx = {
//   classe, carreira: { gols, assist, jogos, vitorias, golsSofridos, cleanSheets,
//                       maiorGoleada, hatTricks, zebras, fase, campeao, vice },
//   ultimaPartida: { gols, assist, sofreu, golsTime, golsAdv, eloAdv, eloMeu, ... }
// }

export const CONQUISTAS = [
  { id: 'primeiro_gol', nome: 'Primeiro Gol', emoji: '⚽',
    desc: 'Balançar as redes pela primeira vez.',
    checa: (c) => c.carreira.gols >= 1 },
  { id: 'garcom', nome: 'Garçom', emoji: '🅰️',
    desc: 'Dar 3 assistências na carreira.',
    checa: (c) => c.carreira.assist >= 3 },
  { id: 'hat_trick', nome: 'Hat-trick', emoji: '🎩',
    desc: 'Marcar 3 gols numa mesma partida.',
    checa: (c) => c.carreira.hatTricks >= 1 },
  { id: 'goleada', nome: 'Goleada', emoji: '💥',
    desc: 'Vencer por 4 ou mais gols de diferença.',
    checa: (c) => c.carreira.maiorGoleada >= 4 },
  { id: 'zebra', nome: 'Zebra', emoji: '🦓',
    desc: 'Bater uma seleção bem mais forte (Elo +80).',
    checa: (c) => c.carreira.zebras >= 1 },
  { id: 'muralha', nome: 'Muralha', emoji: '🧱',
    desc: 'Terminar 3 partidas sem sofrer gol.',
    checa: (c) => c.carreira.cleanSheets >= 3 },
  { id: 'artilheiro', nome: 'Artilheiro', emoji: '👑',
    desc: 'Marcar 5 gols ou mais numa campanha.',
    checa: (c) => c.carreira.gols >= 5 },
  { id: 'oitavas', nome: 'Mata-mata', emoji: '🗺️',
    desc: 'Avançar do grupo para o mata-mata.',
    checa: (c) => faseIndice(c.carreira.fase) >= faseIndice('R32') },
  { id: 'final', nome: 'Decisão', emoji: '🏟️',
    desc: 'Chegar à final da Copa.',
    checa: (c) => faseIndice(c.carreira.fase) >= faseIndice('final') },
  { id: 'vice', nome: 'Vice com honra', emoji: '🥈',
    desc: 'Perder a final — mas chegar lá.',
    checa: (c) => c.carreira.vice },
  { id: 'campeao', nome: 'Campeão do Mundo', emoji: '🏆',
    desc: 'Levantar a taça.',
    checa: (c) => c.carreira.campeao },
];

const ORDEM_FASES = ['grupos', 'R32', 'R16', 'quartas', 'semi', 'final', 'fim'];
export function faseIndice(f) { return ORDEM_FASES.indexOf(f); }

// Retorna a lista de ids recém-desbloqueados (que ainda não estavam em `jaTem`).
export function novasConquistas(ctx, jaTem = []) {
  const set = new Set(jaTem);
  const novas = [];
  for (const conq of CONQUISTAS) {
    if (!set.has(conq.id)) {
      try {
        if (conq.checa(ctx)) novas.push(conq.id);
      } catch { /* ignora conquista mal-formada */ }
    }
  }
  return novas;
}

export function conquistaPorId(id) { return CONQUISTAS.find((c) => c.id === id); }
