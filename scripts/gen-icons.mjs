#!/usr/bin/env node
// Gera ícones PNG placeholder do app (bola branca sobre fundo verde) usando só a stdlib.
// Troque depois pela arte final. Saída em icons/.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

// ---- PNG mínimo (RGBA) ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size, draw) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filtro 'none'
    for (let x = 0; x < size; x++) {
      const c = draw(x, y, size);
      raw[p++] = c[0]; raw[p++] = c[1]; raw[p++] = c[2]; raw[p++] = c[3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ponto dentro de um pentágono regular (ponta para cima) de raio rp
function inPentagon(dx, dy, rp) {
  const v = [];
  for (let k = 0; k < 5; k++) {
    const a = (-90 + k * 72) * Math.PI / 180;
    v.push([Math.cos(a) * rp, Math.sin(a) * rp]);
  }
  let inside = false;
  for (let i = 0, j = 4; i < 5; j = i++) {
    const [xi, yi] = v[i], [xj, yj] = v[j];
    if ((yi > dy) !== (yj > dy) && dx < (xj - xi) * (dy - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const GREEN = [29, 185, 84, 255], WHITE = [255, 255, 255, 255], DARK = [12, 18, 24, 255], RING = [18, 122, 56, 255];

function makeDraw(ballRatio) {
  return (x, y, size) => {
    const c = size / 2;
    const dx = x - c, dy = y - c, dist = Math.hypot(dx, dy);
    const R = size * ballRatio;
    if (dist <= R) {
      if (dist > R - size * 0.015) return RING;            // contorno
      if (inPentagon(dx, dy, R * 0.42)) return DARK;        // pentágono central
      return WHITE;                                         // bola
    }
    return GREEN;                                           // fundo
  };
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const out = [
    ['icon-192.png', 192, 0.36],
    ['icon-512.png', 512, 0.36],
    ['maskable-512.png', 512, 0.30], // mais respiro p/ a "safe zone"
    ['apple-touch-180.png', 180, 0.36],
  ];
  for (const [name, size, ratio] of out) {
    await writeFile(join(ICONS_DIR, name), png(size, makeDraw(ratio)));
    console.log('✓ icons/' + name);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
