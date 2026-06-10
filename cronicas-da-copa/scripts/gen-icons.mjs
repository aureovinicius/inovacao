// Gera os ícones PNG (512/192/180) do PWA sem dependências externas.
// Rasteriza um d20 estilizado (hexágono) e codifica PNG via zlib nativo.
// Uso:  node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const N = 512;

// --- helpers de cor / geometria --------------------------------------------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

function hexagono(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3; // pontudo em cima
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}
function dentro(px, py, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// distância de um ponto ao contorno do polígono (p/ desenhar a borda)
function distBorda(px, py, poly) {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[j], [x2, y2] = poly[i];
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const lx = x1 + t * dx, ly = y1 + t * dy;
    min = Math.min(min, Math.hypot(px - lx, py - ly));
  }
  return min;
}

// --- desenha a imagem 512x512 (RGBA) ---------------------------------------
function desenhar() {
  const buf = Buffer.alloc(N * N * 4);
  const topo = hex('#143226'), fundo = hex('#0b1411');
  const verde = hex('#2ecc71'), dentroCor = hex('#1d3329'), ouro = hex('#f2c14e');
  const cx = N / 2, cy = N / 2 + 6, r = 168;
  const poly = hexagono(cx, cy, r);
  const polyIn = hexagono(cx, cy, r * 0.46);
  const raioCanto = 96;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // canto arredondado (transparente fora)
      const inX = Math.min(x, N - 1 - x), inY = Math.min(y, N - 1 - y);
      let alpha = 255;
      if (inX < raioCanto && inY < raioCanto) {
        const d = Math.hypot(raioCanto - inX, raioCanto - inY);
        if (d > raioCanto) alpha = 0;
      }
      // fundo (gradiente radial aproximado)
      const t = Math.min(1, Math.hypot(x - cx, y - cy * 0.7) / (N * 0.7));
      let col = mix(topo, fundo, t);

      const dB = distBorda(x, y, poly);
      if (dentro(x, y, poly)) {
        col = dentroCor;
        if (dentro(x, y, polyIn)) col = ouro;       // miolo dourado
        if (dB < 11) col = verde;                    // borda verde
      } else if (dB < 11) {
        col = verde;                                  // borda externa
      }
      const i = (y * N + x) * 4;
      buf[i] = col[0] | 0; buf[i + 1] = col[1] | 0; buf[i + 2] = col[2] | 0; buf[i + 3] = alpha;
    }
  }
  return buf;
}

// --- downscale por média (box) ---------------------------------------------
function reduzir(src, size) {
  const out = Buffer.alloc(size * size * 4);
  const r = N / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0, A = 0, n = 0;
      for (let dy = 0; dy < r; dy++) for (let dx = 0; dx < r; dx++) {
        const sx = Math.floor(x * r + dx), sy = Math.floor(y * r + dy);
        const i = (sy * N + sx) * 4; R += src[i]; G += src[i + 1]; B += src[i + 2]; A += src[i + 3]; n++;
      }
      const o = (y * size + x) * 4;
      out[o] = R / n; out[o + 1] = G / n; out[o + 2] = B / n; out[o + 3] = A / n;
    }
  }
  return out;
}

// --- codificação PNG --------------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtro none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const base = desenhar();
const destinos = [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'icon-180.png']];
for (const [size, nome] of destinos) {
  const rgba = size === N ? base : reduzir(base, size);
  writeFileSync(resolve(__dirname, '..', 'icons', nome), png(rgba, size));
  console.log('gerado', nome, `(${size}x${size})`);
}
