// Regras de personagem: atributos, classes (posições), origens e tom.
// Mantém os "números" do RPG num só lugar, fácil de balancear.

// Os seis atributos. Cada um vira modificador via dice.modificador().
export const ATRIBUTOS = [
  { id: 'TEC', nome: 'Técnica', desc: 'controle, finalização, precisão de passe' },
  { id: 'FIS', nome: 'Físico', desc: 'fôlego, força, velocidade' },
  { id: 'VIS', nome: 'Visão', desc: 'inteligência, posicionamento, leitura' },
  { id: 'MEN', nome: 'Mentalidade', desc: 'frieza sob pressão, momentos decisivos' },
  { id: 'CAR', nome: 'Carisma', desc: 'vestiário, imprensa, torcida' },
  { id: 'SOR', nome: 'Sorte', desc: 'o intangível; ajuda nos críticos' },
];

// Classes = posições. `base` define a distribuição inicial dos atributos.
// `principal` é o atributo usado por padrão nos Lances Decisivos da classe.
export const CLASSES = [
  {
    id: 'goleiro', nome: 'Goleiro', arquetipo: 'O Guardião', emoji: '🧤',
    principal: 'MEN', secundario: 'VIS',
    base: { TEC: 10, FIS: 12, VIS: 13, MEN: 14, CAR: 11, SOR: 12 },
    exito: 'Luva de Ouro — sofrer poucos gols e pegar pênaltis.',
  },
  {
    id: 'zagueiro', nome: 'Zagueiro', arquetipo: 'A Muralha', emoji: '🧱',
    principal: 'FIS', secundario: 'MEN',
    base: { TEC: 10, FIS: 14, VIS: 12, MEN: 13, CAR: 12, SOR: 11 },
    exito: 'Jogos sem sofrer gol e liderança na zaga.',
  },
  {
    id: 'meia', nome: 'Meia', arquetipo: 'O Maestro', emoji: '🎩',
    principal: 'VIS', secundario: 'TEC',
    base: { TEC: 14, FIS: 11, VIS: 14, MEN: 11, CAR: 12, SOR: 10 },
    exito: 'Valorizar o passe — reinar em assistências.',
  },
  {
    id: 'ponta', nome: 'Ponta', arquetipo: 'O Flâmula', emoji: '⚡',
    principal: 'TEC', secundario: 'FIS',
    base: { TEC: 14, FIS: 13, VIS: 11, MEN: 11, CAR: 12, SOR: 11 },
    exito: 'Dribles e jogadas decisivas pelos lados.',
  },
  {
    id: 'centroavante', nome: 'Centroavante', arquetipo: 'O Artilheiro', emoji: '🎯',
    principal: 'MEN', secundario: 'TEC',
    base: { TEC: 14, FIS: 12, VIS: 11, MEN: 14, CAR: 11, SOR: 10 },
    exito: 'Artilharia — a Chuteira de Ouro.',
  },
];

// Origens (background): pequenos ajustes + gancho narrativo para o Mestre.
export const ORIGENS = [
  {
    id: 'varzea', nome: 'Cria da várzea', emoji: '🌧️',
    ajustes: { MEN: +1, SOR: +1, CAR: +1, TEC: -1 },
    desc: 'Veio de baixo, no tapa. Faro e raça de sobra, lapidação de menos.',
  },
  {
    id: 'base', nome: 'Joia da base', emoji: '💎',
    ajustes: { TEC: +2, VIS: +1, FIS: -1 },
    desc: 'Formado na escolinha do clube. Técnica apurada, ainda franzino.',
  },
  {
    id: 'veterano', nome: 'Veterano que voltou', emoji: '🎖️',
    ajustes: { VIS: +2, MEN: +1, FIS: -2, CAR: +1 },
    desc: 'Última dança. Cabeça de sobra, pernas em negociação.',
  },
  {
    id: 'naturalizado', nome: 'Talento naturalizado', emoji: '🌍',
    ajustes: { TEC: +1, FIS: +1, CAR: -1, MEN: +1 },
    desc: 'Adotou a seleção. Quer provar que pertence à camisa.',
  },
];

export const TONS = [
  { id: 'realista', nome: 'Realista', emoji: '📰', desc: 'Pé no chão, como uma crônica de jornal.' },
  { id: 'epico', nome: 'Épico', emoji: '🔥', desc: 'Lendário, grandioso, herói do mito.' },
  { id: 'comico', nome: 'Cômico', emoji: '😂', desc: 'Leve e debochado, com humor de vestiário.' },
];

export function classePorId(id) { return CLASSES.find((c) => c.id === id); }
export function origemPorId(id) { return ORIGENS.find((o) => o.id === id); }

// Monta os atributos finais a partir de classe + origem.
export function montarAtributos(classeId, origemId) {
  const classe = classePorId(classeId);
  const origem = origemPorId(origemId);
  const attrs = { ...classe.base };
  for (const [k, v] of Object.entries(origem?.ajustes || {})) {
    attrs[k] = (attrs[k] || 10) + v;
  }
  return attrs;
}
