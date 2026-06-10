// Motor de dados (d20) — o coração "RPG de mesa" do jogo.
//
// Regra central:  rolagem = d20 + modificador  vs  CD (Classe de Dificuldade)
//   - 20 natural = crítico (efeito ampliado)
//   - 1 natural  = falha crítica
//   - vantagem/desvantagem: rola 2d20 e fica com o maior/menor
//
// Tudo é determinístico se você passar um RNG semeado (útil para testes e
// para reproduzir partidas).

// Modificador de atributo no estilo D&D: (valor - 10) / 2, arredondado p/ baixo.
export function modificador(valor) {
  return Math.floor((valor - 10) / 2);
}

// RNG simples e semeável (mulberry32). Sem semente, usa Math.random.
export function criarRng(semente) {
  if (semente == null) return Math.random;
  let a = semente >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function d20(rng = Math.random) {
  return 1 + Math.floor(rng() * 20);
}

// Rola um teste. Retorna tudo que a UI precisa para animar e narrar.
//   mod: modificador total (atributo + perícia + situação)
//   cd:  classe de dificuldade
//   opts: { vantagem, desvantagem, rng, bonusSorte }
export function rolar(mod, cd, opts = {}) {
  const rng = opts.rng || Math.random;
  const dados = [d20(rng)];
  if (opts.vantagem || opts.desvantagem) {
    dados.push(d20(rng));
  }
  let natural;
  if (opts.vantagem) natural = Math.max(...dados);
  else if (opts.desvantagem) natural = Math.min(...dados);
  else natural = dados[0];

  const critico = natural === 20;
  const falhaCritica = natural === 1;
  const total = natural + mod;

  // Sorte (SOR) pode "salvar" uma falha crítica por uma falha normal,
  // ou turbinar um quase-acerto em sucesso. Mantido sutil de propósito.
  let sucesso = total >= cd;
  if (critico) sucesso = true;
  if (falhaCritica) sucesso = false;

  return {
    dados,        // os d20 rolados (1 ou 2)
    natural,      // o d20 que conta
    mod,
    cd,
    total,
    sucesso,
    critico,
    falhaCritica,
    vantagem: !!opts.vantagem,
    desvantagem: !!opts.desvantagem,
  };
}

// Texto curto do grau de resultado (para narração e conquistas).
export function grauResultado(r) {
  if (r.critico) return 'critico';
  if (r.falhaCritica) return 'falhaCritica';
  return r.sucesso ? 'sucesso' : 'falha';
}
