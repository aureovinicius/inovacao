// Animação do dado d20 — overlay que "rola" o dado, revela o número natural,
// soma os modificadores e mostra sucesso/falha. Devolve uma Promise que resolve
// quando o jogador toca em "continuar".
import { ANIMACAO_DADO } from '../config.js';
import { grauResultado } from '../dice.js';

let overlayEl = null;

function garantirOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.className = 'dado-overlay';
  overlayEl.setAttribute('aria-live', 'assertive');
  overlayEl.innerHTML = `
    <div class="dado-card">
      <div class="dado d20" id="dado-face"><span class="dado-num">?</span></div>
      <div class="dado-conta" id="dado-conta"></div>
      <div class="dado-veredito" id="dado-veredito"></div>
      <button class="btn dado-continuar" id="dado-continuar" hidden>Continuar</button>
    </div>`;
  document.body.appendChild(overlayEl);
  return overlayEl;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// resultado: objeto de dice.rolar(). label: nome do atributo (ex 'MEN').
export async function animarDado(resultado, label = '') {
  const ov = garantirOverlay();
  const face = ov.querySelector('#dado-face');
  const num = ov.querySelector('.dado-num');
  const conta = ov.querySelector('#dado-conta');
  const veredito = ov.querySelector('#dado-veredito');
  const btn = ov.querySelector('#dado-continuar');

  // reset
  face.className = 'dado d20 rolando';
  conta.textContent = '';
  veredito.textContent = '';
  veredito.className = 'dado-veredito';
  btn.hidden = true;
  ov.classList.add('aberto');

  // vibração tátil no mobile
  if (navigator.vibrate) navigator.vibrate(ANIMACAO_DADO ? [10, 40, 10] : 8);

  if (ANIMACAO_DADO) {
    // ciclo de números aleatórios enquanto "rola"
    const fim = Date.now() + 850;
    while (Date.now() < fim) {
      num.textContent = 1 + Math.floor(Math.random() * 20);
      await sleep(55);
    }
  }

  // pousa no número natural
  face.classList.remove('rolando');
  num.textContent = resultado.natural;
  const grau = grauResultado(resultado);
  if (resultado.critico) face.classList.add('critico');
  if (resultado.falhaCritica) face.classList.add('falha-critica');

  await sleep(180);

  // mostra a conta
  const sinal = resultado.mod >= 0 ? '+' : '−';
  const modAbs = Math.abs(resultado.mod);
  const vant = resultado.vantagem ? ' (vantagem)' : resultado.desvantagem ? ' (desvantagem)' : '';
  conta.innerHTML = `🎲 <b>${resultado.natural}</b> ${sinal} ${modAbs} ${label}${vant} = <b>${resultado.total}</b> &nbsp;vs&nbsp; CD ${resultado.cd}`;

  await sleep(150);

  const txt = {
    critico: '✨ CRÍTICO!',
    sucesso: '✓ SUCESSO',
    falha: '✗ FALHA',
    falhaCritica: '💥 FALHA CRÍTICA!',
  }[grau];
  veredito.textContent = txt;
  veredito.classList.add(grau);
  if (navigator.vibrate) navigator.vibrate(resultado.sucesso ? [20] : [60]);

  btn.hidden = false;
  await new Promise((resolve) => {
    const done = () => { btn.removeEventListener('click', done); resolve(); };
    btn.addEventListener('click', done);
  });

  ov.classList.remove('aberto');
  await sleep(120);
}
