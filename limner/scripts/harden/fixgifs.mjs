// For every <name>-before<rest>.png in sheets/fixes with a matching <name>-after<rest>.png,
// writes <name><rest>.gif flashing between the two (red bar = before, green bar = after).
// Pairs that already have a gif are skipped, so a re-run only makes the new ones.
// Node stdlib only: a png reader (8-bit RGB/RGBA, non-interlaced) and a gif writer.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'sheets', 'fixes');
const BAR = 12, DELAY = 70; // bar height in px, centiseconds per frame

function readPng(file) {
  const b = readFileSync(file);
  let p = 8, w, h, type, depth, interlace;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), kind = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (kind === 'IDAT') idat.push(d);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(`unsupported png (type ${type}, depth ${depth}, interlace ${interlace})`);
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride, up = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[row + x - bpp] : 0, u = y ? px[up + x] : 0, c = y && x >= bpp ? px[up + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += u;
      else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      px[row + x] = v;
    }
  }
  // flatten to rgb over white
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < w * h; i++, j += bpp) {
    const al = bpp === 4 ? px[j + 3] / 255 : 1;
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.round(px[j + k] * al + 255 * (1 - al));
  }
  return { w, h, rgb };
}

// pads to w x (h + BAR), white, with a coloured bar on top
function frame(img, w, h, bar) {
  const out = new Uint8Array(w * (h + BAR) * 3).fill(255);
  for (let i = 0; i < w * BAR; i++) out.set(bar, i * 3);
  for (let y = 0; y < img.h; y++) out.set(img.rgb.subarray(y * img.w * 3, (y + 1) * img.w * 3), ((y + BAR) * w) * 3);
  return out;
}

// one shared palette for both frames (popularity over 15-bit colour bins), so only real changes flash
function palette(frames) {
  const n = new Float64Array(32768), s = new Float64Array(32768 * 3);
  for (const f of frames) for (let i = 0; i < f.length; i += 3) {
    const k = ((f[i] >> 3) << 10) | ((f[i + 1] >> 3) << 5) | (f[i + 2] >> 3);
    n[k]++; s[k * 3] += f[i]; s[k * 3 + 1] += f[i + 1]; s[k * 3 + 2] += f[i + 2];
  }
  const keys = [...n.keys()].filter(k => n[k]).sort((a, b) => n[b] - n[a]).slice(0, 256);
  const pal = keys.map(k => [0, 1, 2].map(c => Math.round(s[k * 3 + c] / n[k])));
  while (pal.length < 256) pal.push([0, 0, 0]);
  const map = new Uint8Array(32768); // ponytail: nearest by bin centre, dithering if gradients band badly
  for (let k = 0; k < 32768; k++) {
    if (!n[k]) continue;
    const r = (k >> 10) * 8 + 4, g = ((k >> 5) & 31) * 8 + 4, b = (k & 31) * 8 + 4;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const d = (pal[i][0] - r) ** 2 + (pal[i][1] - g) ** 2 + (pal[i][2] - b) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    map[k] = best;
  }
  return { pal, index: f => { const o = new Uint8Array(f.length / 3); for (let i = 0; i < o.length; i++) o[i] = map[((f[i * 3] >> 3) << 10) | ((f[i * 3 + 1] >> 3) << 5) | (f[i * 3 + 2] >> 3)]; return o; } };
}

function lzw(idx) {
  const out = new Uint8Array(idx.length * 2 + 1024);
  let o = 0, acc = 0, bits = 0, size = 9, next = 258, gen = 1;
  const code = new Int32Array(4096 * 256), stamp = new Int32Array(4096 * 256);
  const emit = c => { acc |= c << bits; bits += size; while (bits >= 8) { out[o++] = acc & 255; acc >>>= 8; bits -= 8; } };
  emit(256);
  let cur = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i], key = cur * 256 + k;
    if (stamp[key] === gen) { cur = code[key]; continue; }
    emit(cur);
    if (next === 4096) { emit(256); next = 258; size = 9; gen++; }
    else { if (next >= 1 << size) size++; code[key] = next++; stamp[key] = gen; }
    cur = k;
  }
  emit(cur); emit(257);
  if (bits) out[o++] = acc & 255;
  return out.subarray(0, o);
}

function gif(w, h, pal, frames) {
  const parts = [Buffer.from('GIF89a'), Buffer.from([w & 255, w >> 8, h & 255, h >> 8, 0xf7, 0, 0]), Buffer.from(pal.flat()),
    Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0])];
  for (const idx of frames) {
    parts.push(Buffer.from([0x21, 0xf9, 4, 0x04, DELAY & 255, DELAY >> 8, 0, 0, 0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0, 8]));
    const data = lzw(idx);
    for (let i = 0; i < data.length; i += 255) { const c = data.subarray(i, i + 255); parts.push(Buffer.from([c.length]), Buffer.from(c)); }
    parts.push(Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

let made = 0, skipped = 0;
for (const f of readdirSync(DIR).filter(f => /-before.*\.png$/.test(f))) {
  const after = f.replace('-before', '-after'), out = f.replace('-before', '').replace(/\.png$/, '.gif');
  if (!existsSync(join(DIR, after))) continue;
  if (existsSync(join(DIR, out))) { skipped++; continue; }
  try {
    const a = readPng(join(DIR, f)), b = readPng(join(DIR, after));
    const w = Math.max(a.w, b.w), h = Math.max(a.h, b.h);
    const fa = frame(a, w, h, [220, 40, 40]), fb = frame(b, w, h, [40, 170, 60]);
    const { pal, index } = palette([fa, fb]);
    writeFileSync(join(DIR, out), gif(w, h + BAR, pal, [index(fa), index(fb)]));
    console.log(`made ${out}`); made++;
  } catch (e) { console.log(`failed ${out}: ${e.message}`); }
}
console.log(`${made} made, ${skipped} already there`);
