// crawl's paint box: one 256-colour palette of eight-shade ramps, a light table that darkens it in sixteen hard steps,
// and the wall, floor and ceiling textures, each a 64x64 tile of palette indices painted once when the module loads.
// Nothing here knows about a song except the two accent ramps, which take the song's hues (lamps, monitors, eyes).
// The art's own generator is fixed: the same tiles for every song, so a look can be judged once.
export const TS = 64;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---------- palette ----------
// index 0 is transparent (sprites), 1 black; ramp r shade s (0 dark .. 7 light) sits at 8 + r * 8 + s
export const R = { steel: 0, conc: 1, brown: 2, tan: 3, olive: 4, green: 5, red: 6, rust: 7, fire: 8, flesh: 9, bone: 10, blue: 11, yellow: 12, purple: 13, accA: 14, accB: 15 };
export const ix = (ramp, s) => 8 + ramp * 8 + clamp(Math.round(s), 0, 7);
const RAMPS = [ // hue, saturation, darkest and lightest lightness
  [214, 9, 7, 68], [38, 8, 9, 60], [26, 40, 6, 46], [33, 36, 18, 68], [82, 30, 6, 44], [118, 62, 6, 58], [2, 74, 6, 50], [17, 68, 8, 50],
  null, [20, 40, 14, 70], [44, 24, 20, 86], [218, 58, 8, 60], [47, 88, 12, 60], [288, 34, 8, 52], null, null,
];
const FIRE = [[52, 4, 0], [118, 14, 0], [186, 44, 0], [232, 92, 8], [255, 150, 22], [255, 204, 64], [255, 238, 150], [255, 255, 236]];
const hsl = (h, s, l) => { // degrees, percent, percent -> [r, g, b]
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2, k = Math.floor(h / 60);
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};
const rampOf = ([h, s, lo, hi]) => Array.from({ length: 8 }, (_, i) => { const t = i / 7; return hsl(h - 14 * (1 - t), s * (1.25 - 0.4 * t), lo + (hi - lo) * t ** 0.9); }); // the darks lean blue and saturated, as a painted ramp does
const glow = (h) => Array.from({ length: 8 }, (_, i) => { const t = i / 7; return hsl(h - 10 * (1 - t), 95 - 45 * t * t, 10 + 80 * t ** 0.85); });
export const EMISSIVE = new Set([R.fire, R.accA, R.accB]); // ramps the light table leaves alone: they are the light

/** The palette for a song: the fixed ramps plus its two hues as the glowing ones. Returns 256 [r, g, b]. */
export function paletteOf(hueA = 120, hueB = 190) {
  const pal = Array.from({ length: 256 }, () => [0, 0, 0]);
  RAMPS.forEach((r, k) => { const cols = k === R.fire ? FIRE : k === R.accA ? glow(hueA) : k === R.accB ? glow(hueB) : rampOf(r); cols.forEach((c, s) => { pal[8 + k * 8 + s] = c; }); });
  return pal;
}
export const LIGHTS = 16;
/** light level (0 black .. 15 full) x palette index -> a canvas pixel (ABGR in a Uint32). The steps are the look: no smooth shading. */
export function lightTable(pal) {
  const lut = new Uint32Array(LIGHTS * 256);
  for (let l = 0; l < LIGHTS; l++) for (let i = 1; i < 256; i++) {
    const ramp = (i - 8) >> 3, f = i >= 8 && EMISSIVE.has(ramp) ? 0.55 + 0.45 * (l / 15) : 0.07 + 0.93 * (l / 15) ** 1.12;
    const [r, g, b] = pal[i], q = (v) => Math.min(255, Math.round((v * f) / 6) * 6); // six-step channels: a darkened colour lands on a coarse grid
    lut[l * 256 + i] = (0xff000000 | (q(b * (0.9 + 0.1 * f)) << 16) | (q(g) << 8) | q(r)) >>> 0; // blue falls off last, so the dark is cold
  }
  for (let l = 0; l < LIGHTS; l++) lut[l * 256] = 0xff000000;
  return lut;
}

// ---------- painting a tile ----------
const hash = (x, y, s) => { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 362437)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const sm = (t) => t * t * (3 - 2 * t);
/** Tiling value noise over a TS tile, `cell` pixels to the lattice step. */
const vn = (x, y, cell, s) => {
  const per = TS / cell, gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = sm(gx - x0), fy = sm(gy - y0), w = (a) => ((a % per) + per) % per;
  const a = hash(w(x0), w(y0), s), b = hash(w(x0 + 1), w(y0), s), c = hash(w(x0), w(y0 + 1), s), d = hash(w(x0 + 1), w(y0 + 1), s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};
const at = (x, y) => ((y & 63) << 6) | (x & 63);
const put = (t, x, y, v) => { t[at(x, y)] = v; };
/** Move a pixel `d` shades along its own ramp: how every bevel, seam, stain and shadow is painted. */
const sh = (t, x, y, d) => { const i = at(x, y), v = t[i]; if (v >= 8) t[i] = 8 + ((v - 8) & ~7) + clamp(((v - 8) & 7) + d, 0, 7); };
const fill = (ramp, lo, hi, s, grain = 0.25) => { // a mottled ground: slow blotches, finer ones and a little grit
  const t = new Uint8Array(TS * TS);
  for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) t[at(x, y)] = ix(ramp, lo + (hi - lo) * (vn(x, y, 16, s) * (0.7 - grain) + vn(x, y, 4, s + 1) * 0.3 + hash(x, y, s + 2) * grain));
  return t;
};
const rect = (t, x, y, w, h, f) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) f(x + i, y + j, i, j); };
const box = (t, x, y, w, h, v) => rect(t, x, y, w, h, (px, py) => put(t, px, py, v));
const tone = (t, x, y, w, h, d) => rect(t, x, y, w, h, (px, py) => sh(t, px, py, d));
/** A raised (d > 0) or sunk (d < 0) plate: lit along the top and left, shadowed along the bottom and right. */
const bevel = (t, x, y, w, h, d = 2) => { tone(t, x, y, w, 1, d); tone(t, x, y, 1, h, d); tone(t, x, y + h - 1, w, 1, -d); tone(t, x + w - 1, y, 1, h, -d); };
const rivet = (t, x, y) => { sh(t, x, y, 3); sh(t, x + 1, y, 1); sh(t, x, y + 1, 1); sh(t, x + 1, y + 1, -3); sh(t, x + 2, y + 2, -2); };
const line = (t, x0, y0, x1, y1, f) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) f(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)); };
const rng = (s) => { let a = s | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/** A streak running down from (x, y): rust under a rivet, a leak under a pipe. */
const drip = (t, x, y, len, ramp, r) => { for (let j = 0; j < len; j++) { const w = j < len * 0.4 ? 2 : 1; for (let i = 0; i < w; i++) if (r() < 0.85) put(t, x + i, y + j, ix(ramp, 3 - (j / len) * 2 + r())); } };
const crack = (t, x, y, len, r, d = -3) => { let cx = x, cy = y; for (let i = 0; i < len; i++) { sh(t, cx, cy, d); sh(t, cx + 1, cy, 1); cy++; if (r() < 0.45) cx += r() < 0.5 ? -1 : 1; } };
const hazard = (t, x, y, w, h) => rect(t, x, y, w, h, (px, py, i, j) => put(t, px, py, ((i + j) >> 2) & 1 ? ix(R.yellow, 5 - (j === h - 1 ? 2 : 0)) : ix(R.steel, 1)));

// ---------- the tiles ----------
const steel = (s) => { // riveted plates, two to the tile, scratched and weeping rust
  const t = fill(R.steel, 2.6, 4.6, s), r = rng(s);
  for (const [x, y, w, h] of [[0, 0, 32, 40], [32, 0, 32, 24], [32, 24, 32, 40], [0, 40, 32, 24]]) {
    bevel(t, x, y, w, h, 2); tone(t, x + 1, y + 1, w - 2, 1, 1);
    for (const [rx, ry] of [[3, 3], [w - 5, 3], [3, h - 5], [w - 5, h - 5]]) rivet(t, x + rx, y + ry);
    if (r() < 0.6) drip(t, x + 3 + (r() < 0.5 ? 0 : w - 8), y + 6, 6 + Math.floor(r() * 12), R.rust, r);
  }
  for (let k = 0; k < 7; k++) { const x = Math.floor(r() * 64), y = Math.floor(r() * 64), l = 3 + Math.floor(r() * 7); line(t, x, y, x + l, y - Math.floor(l / 2), (px, py) => sh(t, px, py, 2)); }
  return t;
};
const brick = (s, ramp = R.brown, lo = 2.2, hi = 4.4) => {
  const t = fill(ramp, lo, hi, s, 0.35), r = rng(s);
  for (let row = 0; row < 8; row++) {
    const y = row * 8, off = row & 1 ? 8 : 0;
    tone(t, 0, y + 7, 64, 1, -4); tone(t, 0, y, 64, 1, 1);
    for (let b = 0; b < 4; b++) { const x = off + b * 16; tone(t, x, y, 1, 8, -4); tone(t, x + 1, y, 1, 7, 1); const d = Math.floor(r() * 3) - 1; if (d) tone(t, x + 1, y + 1, 14, 6, d); if (r() < 0.2) crack(t, x + 3 + Math.floor(r() * 9), y + 1, 5, r, -2); }
  }
  return t;
};
const concrete = (s) => { // poured slabs: form lines, stains running down, a crack or two
  const t = fill(R.conc, 2.8, 4.8, s, 0.3), r = rng(s);
  for (const y of [0, 32]) { tone(t, 0, y, 64, 1, -3); tone(t, 0, y + 1, 64, 1, 1); }
  tone(t, 31, 0, 1, 64, -2);
  for (const [x, y] of [[8, 6], [52, 6], [8, 38], [52, 38]]) { tone(t, x, y, 3, 3, -3); sh(t, x, y, 2); }
  for (let k = 0; k < 4; k++) { const x = Math.floor(r() * 60), y = Math.floor(r() * 30); for (let j = 0; j < 14 + r() * 16; j++) { sh(t, x, y + j, -1); if (r() < 0.5) sh(t, x + 1, y + j, -1); } }
  crack(t, 20 + Math.floor(r() * 24), 4, 26, r);
  return t;
};
const tech = (s) => { // a computer bay: a lit screen of ragged text, a strip of indicator lamps, a vent
  const t = fill(R.steel, 2.2, 3.6, s), r = rng(s);
  bevel(t, 0, 0, 64, 64, 2);
  box(t, 6, 6, 38, 26, ix(R.accA, 0)); bevel(t, 5, 5, 40, 28, -3);
  for (let row = 0; row < 7; row++) { let x = 8; const y = 8 + row * 3; while (x < 40) { const w = 1 + Math.floor(r() * 6); if (r() < 0.75) for (let i = 0; i < w && x + i < 42; i++) put(t, x + i, y, ix(R.accA, 4 + (r() < 0.3 ? 2 : 0))); x += w + 1 + Math.floor(r() * 2); } }
  for (let y = 6; y < 32; y += 2) for (let x = 6; x < 44; x++) if (t[at(x, y)] === ix(R.accA, 0)) put(t, x, y, ix(R.accA, 1)); // scanlines
  for (let k = 0; k < 6; k++) { const x = 49, y = 7 + k * 4; box(t, x, y, 3, 2, ix([R.red, R.accB, R.yellow][k % 3], 3 + Math.floor(r() * 4))); box(t, x + 6, y, 3, 2, ix([R.accB, R.yellow, R.red][k % 3], 2 + Math.floor(r() * 5))); }
  bevel(t, 47, 5, 13, 28, -2);
  for (let y = 40; y < 58; y += 3) { tone(t, 6, y, 30, 1, -3); tone(t, 6, y + 1, 30, 1, 2); }
  bevel(t, 4, 37, 34, 23, -2);
  box(t, 43, 39, 15, 9, ix(R.steel, 1)); bevel(t, 42, 38, 17, 11, -2);
  for (let i = 0; i < 4; i++) box(t, 45 + i * 3, 41, 2, 5, ix(i < 3 ? R.accA : R.red, 5));
  for (const [x, y] of [[41, 52], [47, 52], [53, 52]]) { box(t, x, y, 4, 4, ix(R.steel, 4)); bevel(t, x, y, 4, 4, 2); }
  return t;
};
const door = (s, lamp = R.accB, key = false) => { // two leaves meeting at a seam, ribbed, a hazard sill, a lamp slot over the seam
  const t = fill(R.steel, 3, 4.6, s), r = rng(s);
  bevel(t, 0, 0, 64, 64, 2);
  for (const x of [3, 34]) { bevel(t, x, 4, 27, 46, 2); for (let y = 10; y < 46; y += 6) { tone(t, x + 3, y, 21, 2, -2); tone(t, x + 3, y + 2, 21, 1, 2); } }
  tone(t, 31, 0, 2, 64, -4); tone(t, 30, 0, 1, 64, 2); tone(t, 33, 0, 1, 64, 1);
  hazard(t, 1, 52, 62, 10);
  if (key) { for (const x of [1, 55]) { rect(t, x, 4, 8, 46, (px, py, i, j) => put(t, px, py, ix(lamp, 5 - (i > 5 ? 2 : 0) - (j % 8 === 7 ? 3 : 0)))); bevel(t, x, 4, 8, 46, 2); } rect(t, 1, 52, 62, 10, (px, py, i, j) => put(t, px, py, ix(lamp, 4 - (j > 7 ? 2 : 0) + (j === 0 ? 2 : 0)))); }
  box(t, 26, 1, 12, 4, ix(lamp, 5)); bevel(t, 25, 0, 14, 6, -2); box(t, 28, 2, 8, 2, ix(lamp, 7));
  for (const [x, y] of [[5, 6], [26, 6], [36, 6], [57, 6], [5, 46], [26, 46], [36, 46], [57, 46]]) rivet(t, x, y);
  for (let k = 0; k < 5; k++) drip(t, Math.floor(r() * 60), 8 + Math.floor(r() * 20), 8, R.rust, r);
  return t;
};
const frame = (s) => { // the airlock every door stands in: dark ribs between two hazard bands
  const t = fill(R.steel, 1.4, 2.8, s);
  for (let x = 0; x < 64; x += 16) { tone(t, x, 0, 1, 64, -3); tone(t, x + 1, 0, 2, 64, 2); tone(t, x + 12, 0, 3, 64, -1); }
  hazard(t, 0, 0, 64, 6); hazard(t, 0, 56, 64, 8); tone(t, 0, 6, 64, 1, -3); tone(t, 0, 55, 64, 1, 2);
  box(t, 28, 24, 8, 12, ix(R.steel, 1)); bevel(t, 27, 23, 10, 14, -2); box(t, 30, 26, 4, 3, ix(R.accB, 6)); box(t, 30, 31, 4, 3, ix(R.red, 4));
  return t;
};
const pipes = (s) => { // a service wall: fat pipes run along it, each a shaded cylinder with flanges and a leak
  const t = fill(R.steel, 1.2, 2.4, s), r = rng(s);
  for (const [y, h, ramp] of [[6, 10, R.steel], [22, 7, R.rust], [34, 12, R.olive], [52, 6, R.steel]]) {
    rect(t, 0, y, 64, h, (px, py, i, j) => put(t, px, py, ix(ramp, 1.5 + 4.5 * Math.sin(((j + 0.5) / h) * Math.PI) ** 1.5 - (j > h * 0.6 ? 1.5 : 0) + hash(px, py, s) * 0.8)));
    tone(t, 0, y + h, 64, 2, -2);
    for (const x of [10 + Math.floor(r() * 8), 42 + Math.floor(r() * 8)]) { tone(t, x, y - 1, 3, h + 2, 1); tone(t, x + 3, y - 1, 1, h + 2, -3); }
    if (r() < 0.6) drip(t, Math.floor(r() * 60), y + h, 6 + Math.floor(r() * 6), ramp === R.olive ? R.green : R.rust, r);
  }
  return t;
};
const rusty = (s) => { // plate so far gone the rust has the upper hand
  const t = fill(R.rust, 1.2, 4.2, s, 0.4), r = rng(s);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (vn(x, y, 8, s + 9) > 0.56) put(t, x, y, ix(R.steel, 2 + vn(x, y, 4, s + 3) * 2.4));
  for (const y of [0, 32]) { tone(t, 0, y, 64, 1, -3); tone(t, 0, y + 1, 64, 1, 2); for (let x = 4; x < 64; x += 14) rivet(t, x, y + 4); }
  for (let k = 0; k < 6; k++) drip(t, Math.floor(r() * 62), Math.floor(r() * 40), 10 + Math.floor(r() * 10), R.rust, r);
  return t;
};
const stone = (s, ramp = R.brown, lo = 1.6, hi = 4) => { // rough-cut blocks of uneven size, deep joints
  const t = fill(ramp, lo, hi, s, 0.4), r = rng(s);
  let y = 0;
  for (const h of [14, 18, 12, 20]) {
    tone(t, 0, y, 64, 1, 1); tone(t, 0, y + h - 1, 64, 1, -4); tone(t, 0, y + h - 2, 64, 1, -1);
    let x = Math.floor(r() * 10);
    while (x < 64) { const w = 12 + Math.floor(r() * 14); tone(t, x, y, 1, h, -4); tone(t, x + 1, y + 1, 1, h - 2, 1); const d = Math.floor(r() * 3) - 1; if (d) tone(t, x + 2, y + 1, w - 3, h - 3, d); x += w; }
    y += h;
  }
  return t;
};
const hell = (s) => { // red rock shot through with glowing veins
  const t = stone(s, R.red, 1.2, 3.8), r = rng(s + 5);
  for (let k = 0; k < 5; k++) { let x = Math.floor(r() * 64), y = Math.floor(r() * 64); for (let i = 0; i < 22; i++) { put(t, x, y, ix(R.fire, 3 + r() * 3)); sh(t, x + 1, y, -2); sh(t, x - 1, y, -2); y++; x += r() < 0.5 ? (r() < 0.5 ? -1 : 1) : 0; } }
  return t;
};
const flesh = (s) => { // something grown, not built: swollen lobes, wet highlights, dark folds
  const t = new Uint8Array(TS * TS), r = rng(s), pts = Array.from({ length: 9 }, () => [r() * 64, r() * 64]);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    let d1 = 99, d2 = 99;
    for (const [px, py] of pts) { const dx = Math.min(Math.abs(x - px), 64 - Math.abs(x - px)), dy = Math.min(Math.abs(y - py), 64 - Math.abs(y - py)), d = Math.hypot(dx, dy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const edge = d2 - d1;
    t[at(x, y)] = edge < 1.6 ? ix(R.red, 0.5) : ix(d1 < 3 ? R.flesh : R.red, clamp(5.4 - d1 * 0.28 + hash(x, y, s) * 1.2, 1, 6.4));
  }
  for (const [px, py] of pts) { put(t, Math.round(px) - 2, Math.round(py) - 2, ix(R.bone, 6)); put(t, Math.round(px) - 1, Math.round(py) - 2, ix(R.flesh, 6)); }
  return t;
};
const skull = (s) => { // a relief of a horned skull set into dark stone
  const t = stone(s, R.conc, 1, 2.6);
  const el = (cx, cy, rx, ry, f) => rect(t, cx - rx, cy - ry, rx * 2 + 1, ry * 2 + 1, (px, py) => { const u = (px - cx) / rx, v = (py - cy) / ry; if (u * u + v * v <= 1) f(px, py, u, v); });
  el(32, 26, 15, 14, (x, y, u, v) => put(t, x, y, ix(R.bone, 4.6 - u * 1.6 - v * 1.4 + hash(x, y, s) * 0.8)));
  rect(t, 24, 36, 17, 12, (x, y, i, j) => put(t, x, y, ix(R.bone, 3.6 - (i / 17) * 1.6 - (j > 9 ? 1.5 : 0))));
  el(25, 27, 5, 5, (x, y, u, v) => put(t, x, y, v > 0.4 && Math.abs(u) < 0.5 ? ix(R.fire, 4) : ix(R.steel, 0)));
  el(39, 27, 5, 5, (x, y, u, v) => put(t, x, y, v > 0.4 && Math.abs(u) < 0.5 ? ix(R.fire, 4) : ix(R.steel, 0)));
  el(32, 35, 2, 3, (x, y) => put(t, x, y, ix(R.steel, 0)));
  for (let x = 25; x < 41; x += 3) { tone(t, x, 42, 1, 6, -5); tone(t, x + 1, 42, 1, 6, 1); }
  for (const d of [-1, 1]) for (let i = 0; i < 16; i++) { const x = 32 + d * (15 + i * 0.9), y = 18 - i * 0.2 - (i * i) / 22; for (let w = 0; w < 4 - i / 5; w++) put(t, Math.round(x), Math.round(y + w), ix(R.bone, 3 + (w === 0 ? 2 : 0) - i / 8)); }
  return t;
};
const tiles = (s, ramp = R.conc, lo = 2, hi = 3.6) => { const t = fill(ramp, lo, hi, s, 0.3), r = rng(s); for (const k of [0, 32]) { tone(t, 0, k, 64, 1, -3); tone(t, k, 0, 1, 64, -3); tone(t, 0, k + 1, 64, 1, 1); tone(t, k + 1, 0, 1, 64, 1); } for (let k = 0; k < 3; k++) crack(t, Math.floor(r() * 60), Math.floor(r() * 40), 12, r, -2); return t; };
const grate = (s) => { const t = fill(R.steel, 2, 3.4, s); for (let y = 4; y < 64; y += 8) for (let x = 4; x < 64; x += 8) { box(t, x, y, 5, 5, 1); tone(t, x - 1, y - 1, 7, 1, 2); tone(t, x - 1, y + 5, 7, 1, -2); } bevel(t, 0, 0, 64, 64, 2); return t; };
const plateFloor = (s) => { // tread plate with a hazard edge
  const t = fill(R.steel, 2.4, 3.8, s);
  for (let y = 2; y < 64; y += 6) for (let x = (y % 12 ? 2 : 5); x < 64; x += 6) { sh(t, x, y, 3); sh(t, x + 1, y + 1, 2); sh(t, x + 2, y + 2, -3); }
  bevel(t, 0, 0, 64, 64, 2);
  return t;
};
const ceilPanel = (s) => { const t = fill(R.steel, 1.2, 2.6, s); for (const k of [0, 32]) { tone(t, 0, k, 64, 1, -3); tone(t, k, 0, 1, 64, -3); } for (const [x, y] of [[4, 4], [36, 4], [4, 36], [36, 36]]) { rivet(t, x, y); rivet(t, x + 22, y + 22); } return t; };
const ceilLamp = (s) => { const t = ceilPanel(s); box(t, 18, 22, 28, 20, ix(R.bone, 7)); rect(t, 18, 22, 28, 20, (x, y, i) => { if (i % 7 === 6) put(t, x, y, ix(R.bone, 4)); }); bevel(t, 16, 20, 32, 24, -3); return t; };
const liquid = (s, ramp, lo, hi) => { const t = new Uint8Array(TS * TS); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const v = vn(x + vn(x, y, 16, s + 4) * 14, y, 16, s) * 0.6 + vn(x, y, 8, s + 1) * 0.4; t[at(x, y)] = ix(ramp, lo + (hi - lo) * (v > 0.62 ? 1 : v > 0.5 ? 0.6 : v * 0.7)); } return t; };
const crate = (s) => { // a steel-bound shipping crate, stencilled
  const t = fill(R.tan, 2, 3.8, s, 0.35);
  for (let x = 0; x < 64; x += 9) tone(t, x, 0, 1, 64, -2);
  for (const [x, y, w, h] of [[0, 0, 64, 6], [0, 58, 64, 6], [0, 0, 6, 64], [58, 0, 6, 64]]) { rect(t, x, y, w, h, (px, py) => put(t, px, py, ix(R.steel, 2.5 + hash(px, py, s)))); bevel(t, x, y, w, h, 2); }
  for (let i = 0; i < 52; i++) for (const w of [0, 1, 2]) { put(t, 6 + i, 6 + i + w, ix(R.steel, 3 - w)); }
  for (const [x, y] of [[2, 2], [60, 2], [2, 60], [60, 60]]) rivet(t, x, y);
  box(t, 22, 22, 20, 9, ix(R.red, 3)); box(t, 24, 24, 16, 5, ix(R.tan, 5));
  return t;
};
const exitSign = (s) => { const t = steel(s); box(t, 8, 18, 48, 22, ix(R.steel, 0)); bevel(t, 7, 17, 50, 24, -3); const G = { E: ['111', '100', '110', '100', '111'], X: ['101', '101', '010', '101', '101'], I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010'] }; 'EXIT'.split('').forEach((ch, k) => G[ch].forEach((row, j) => row.split('').forEach((b, i) => { if (b === '1') box(t, 12 + k * 11 + i * 3, 21 + j * 3, 3, 3, ix(R.fire, 5)); }))); return t; };
const switchPanel = (s) => { const t = exitSign(s); for (let y = 2; y < 22; y++) for (let x = 0; x < 64; x++) t[at(x, y)] = t[at(x, y + 15)]; for (let y = 24; y < 62; y++) for (let x = 2; x < 62; x++) t[at(x, y)] = ix(R.steel, 3 + ((x * 7 + y * 3) % 5 === 0 ? 1 : 0)); box(t, 22, 28, 20, 30, ix(R.steel, 1)); bevel(t, 21, 27, 22, 32, -3); box(t, 28, 32, 8, 8, ix(R.accB, 6)); bevel(t, 28, 32, 8, 8, 2); box(t, 26, 46, 12, 7, ix(R.red, 4)); bevel(t, 26, 46, 12, 7, 2); return t; };
const sky = (s, ramp, lo, hi) => { // a banded sky with a ragged far skyline; wraps around the horizon
  const t = new Uint8Array(TS * TS);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) t[at(x, y)] = ix(ramp, lo + (hi - lo) * (y / 63) ** 1.5 + (vn(x, y * 4, 32, s) - 0.5) * 1.1 + (vn(x, y * 8, 32, s + 7) - 0.5) * 0.6); // long flat bands of cloud, lighter toward the horizon
  for (let x = 0; x < 64; x++) { const h = 6 + Math.floor(vn(x, 0, 8, s + 3) * 16 + vn(x, 0, 2, s + 4) * 5); for (let j = 0; j < h; j++) put(t, x, 63 - j, ix(R.steel, j === h - 1 ? 1 : 0)); }
  return t;
};

// wall, floor and ceiling ids; 0 is no wall / open sky
export const T = { steel: 1, tech: 2, brick: 3, conc: 4, door: 5, frame: 6, pipes: 7, rust: 8, stone: 9, hell: 10, flesh: 11, skull: 12, crate: 13, exit: 14, sw: 15, hazard: 16, doorR: 17, gate: 18, floor: 20, grate: 21, plate: 22, dirt: 23, hellFloor: 24, toxic: 25, lava: 26, ceil: 27, lamp: 28, rock: 29, blood: 30, sky: 31, skyHell: 32, doorB: 33, doorY: 34 };
export const TEX = [];
TEX[T.steel] = steel(11); TEX[T.tech] = tech(12); TEX[T.brick] = brick(13); TEX[T.conc] = concrete(14); TEX[T.door] = door(15); TEX[T.frame] = frame(16);
TEX[T.pipes] = pipes(17); TEX[T.rust] = rusty(18); TEX[T.stone] = stone(19); TEX[T.hell] = hell(20); TEX[T.flesh] = flesh(21); TEX[T.skull] = skull(22);
TEX[T.crate] = crate(23); TEX[T.exit] = exitSign(24); TEX[T.sw] = switchPanel(25);
TEX[T.hazard] = (() => { const t = steel(26); hazard(t, 0, 24, 64, 16); tone(t, 0, 23, 64, 1, -3); tone(t, 0, 40, 64, 1, -3); return t; })();
TEX[T.doorR] = door(27, R.red, true); TEX[T.doorB] = door(27, R.blue, true); TEX[T.doorY] = door(27, R.yellow, true);
TEX[T.gate] = (() => { const t = stone(28, R.red, 0.6, 2.6); for (let x = 4; x < 64; x += 12) { tone(t, x, 0, 4, 64, 2); tone(t, x + 4, 0, 1, 64, -3); } for (const y of [10, 50]) { rect(t, 0, y, 64, 5, (px, py, i, j) => put(t, px, py, ix(R.steel, 3 - j * 0.5))); for (let x = 2; x < 64; x += 12) rivet(t, x, y + 1); } return t; })();
TEX[T.floor] = tiles(31); TEX[T.grate] = grate(32); TEX[T.plate] = plateFloor(33); TEX[T.dirt] = fill(R.brown, 1.2, 3.2, 34, 0.45); TEX[T.hellFloor] = tiles(35, R.red, 0.8, 2.6);
TEX[T.toxic] = liquid(36, R.green, 2, 6.5); TEX[T.lava] = liquid(37, R.fire, 1, 5.5);
TEX[T.ceil] = ceilPanel(38); TEX[T.lamp] = ceilLamp(38); TEX[T.rock] = fill(R.brown, 0.6, 2.4, 39, 0.45);
TEX[T.blood] = (() => { const t = tiles(31); for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x - 30, y - 34) + vn(x, y, 8, 77) * 16; if (d < 22) put(t, x, y, ix(R.red, d < 12 ? 2.4 : 1.6)); } return t; })();
TEX[T.sky] = sky(40, R.steel, 0.4, 3.4); TEX[T.skyHell] = sky(41, R.red, 0.6, 4.4);

// ---------- lettering ----------
// 3x5 caps for labels; the big numerals are 5x7, drawn double with a lit edge by the renderer
const F3 = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100110101010', 7: '111001010010010', 8: '010101010101010', 9: '010101011001110', '%': '101001010100101', ':': '000010000010000', '-': '000000111000000', '.': '000000000000010', '/': '001001010100100', ' ': '000000000000000' };
const F5 = { 0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100110010001000011111', 3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110', 6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100', '%': '11001110010001000100010001001110011', '-': '00000000000000011111000000000000000', ':': '00000001000010000000001000010000000', '/': '00001000010001000100010001000010000', ' ': '00000000000000000000000000000000000' };
export const glyph3 = (ch) => F3[ch] ?? F3[' '];
export const glyph5 = (ch) => F5[ch] ?? F5[' '];
