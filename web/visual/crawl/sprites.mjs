// crawl's cast and props, painted in code as palette-indexed bitmaps when the module loads: nothing is drawn per frame
// but a lookup. The method is the one a pixel artist uses on a small canvas: a few solid forms (a ball, a tapered
// limb, a polygon), each shaded along its own colour ramp from one light up and to the left, the steps broken up by
// a 2x2 dither, then a dark line run round the whole silhouette. A sprite is { w, h, px, ax, ay }: ax, ay is the
// pixel that stands on the floor at the thing's position. 64 pixels are one map unit, as the walls are.
// The creatures are this world's own: the husk, the gnasher, the drifter and the warden.
import { R, ix } from './art.mjs';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const LX = -0.48, LY = -0.62, LZ = 0.62;
const DTH = [-0.3, 0.1, 0.3, -0.1];
const cv = (w, h, ax = w / 2, ay = h - 1) => ({ w, h, px: new Uint8Array(w * h), ax, ay });
const set = (c, x, y, v) => { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < c.w && y < c.h) c.px[y * c.w + x] = v; };
const get = (c, x, y) => (x >= 0 && y >= 0 && x < c.w && y < c.h ? c.px[y * c.w + x] : 0);
const tone = (ramp, lo, hi, lam, x, y) => ix(ramp, lo + (hi - lo) * clamp(lam * 0.5 + 0.5, 0, 1) ** 1.15 + DTH[(x & 1) | ((y & 1) << 1)]);

/** A shaded ball (or egg). o: { lo, hi } the ramp's ends in shadow and light, flat: a shade, no modelling. */
function ell(c, cx, cy, rx, ry, ramp, o = {}) {
  const lo = o.lo ?? 1, hi = o.hi ?? 6;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, r2 = u * u + v * v; if (r2 > 1) continue;
    set(c, x, y, o.flat !== undefined ? ix(ramp, o.flat) : tone(ramp, lo, hi, u * LX + v * LY + Math.sqrt(1 - r2) * LZ, x, y));
  }
}
/** A tapered limb from (x0, y0) radius r0 to (x1, y1) radius r1, round in section. */
function limb(c, x0, y0, x1, y1, r0, r1, ramp, o = {}) {
  const lo = o.lo ?? 1, hi = o.hi ?? 6, dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1, m = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(y0, y1) - m); y <= Math.ceil(Math.max(y0, y1) + m); y++) for (let x = Math.floor(Math.min(x0, x1) - m); x <= Math.ceil(Math.max(x0, x1) + m); x++) {
    const t = clamp(((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2, 0, 1), px = x + 0.5 - (x0 + dx * t), py = y + 0.5 - (y0 + dy * t), r = r0 + (r1 - r0) * t, d2 = px * px + py * py;
    if (d2 > r * r) continue;
    const nx = px / r, ny = py / r;
    set(c, x, y, o.flat !== undefined ? ix(ramp, o.flat) : tone(ramp, lo, hi, nx * LX + ny * LY + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * LZ, x, y));
  }
}
/** A filled polygon; `s` is a shade or (x, y) -> shade. */
function poly(c, pts, ramp, s = 3) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    let inside = false; const X = x + 0.5, Y = y + 0.5;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside; }
    if (inside) set(c, x, y, ix(ramp, (typeof s === 'function' ? s(x, y) : s) + DTH[(x & 1) | ((y & 1) << 1)]));
  }
}
const box = (c, x, y, w, h, ramp, s) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(c, x + i, y + j, ix(ramp, typeof s === 'function' ? s(i, j) : s)); };
const dot = (c, x, y, ramp, s) => set(c, x, y, ix(ramp, s));
/** Move a painted pixel `d` shades along its own ramp: a crease, a scar, a wet edge, laid over the modelling. */
const shade = (c, x, y, d) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= c.w || y >= c.h) return; const v = c.px[y * c.w + x]; if (v >= 8) c.px[y * c.w + x] = 8 + ((v - 8) & ~7) + clamp(((v - 8) & 7) + d, 0, 7); };
/** A line of shadow from (x0, y0) to (x1, y1), sagging by `bend`, lit along its upper edge: the fold under a muscle, the seam of a plate. */
const crease = (c, x0, y0, x1, y1, bend = 0, d = -2) => { const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1; for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * bend; shade(c, x, y, d); shade(c, x, y - 1, 1); } };
/** The dark line round the silhouette, and a one-shade shadow just inside its lower right. */
function outline(c) {
  const src = c.px.slice();
  const g = (x, y) => (x >= 0 && y >= 0 && x < c.w && y < c.h ? src[y * c.w + x] : 0);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (!g(x, y) && (g(x - 1, y) || g(x + 1, y) || g(x, y - 1) || g(x, y + 1))) c.px[y * c.w + x] = 1;
  return c;
}
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
/** Scatter `n` pixels of a ramp inside a disc: blood, embers. Deterministic by `s`. */
const spatter = (c, cx, cy, r, n, ramp, lo, hi, s) => { let a = s; const rnd = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 2 ** 32; }; for (let k = 0; k < n; k++) { const an = rnd() * 6.283, d = Math.sqrt(rnd()) * r, x = cx + Math.cos(an) * d, y = cy + Math.sin(an) * d * 0.7; if (get(c, x | 0, y | 0)) set(c, x, y, ix(ramp, lo + rnd() * (hi - lo))); } };

// ---------- the creatures ----------
// Every pose is a small set of numbers: step (-1, 0, 1: which knee is up), lean (the body thrown back), drop (how far
// it has sunk toward the floor), arms (0 hanging .. 1 raised), jaw (open), and what it is doing.
const POSES = { idle: {}, walkA: { step: -1 }, walkB: { step: 1 }, attack: { arms: 1, jaw: 1, glow: 1 }, hit: { lean: 0.5, arms: 0.5, jaw: 0.6, hurt: 1 }, die1: { lean: 0.8, drop: 0.3, jaw: 1, hurt: 1 }, die2: { lean: 1.2, drop: 0.6, jaw: 1, hurt: 1 }, die3: { lean: 1.6, drop: 0.95, jaw: 1, hurt: 1 } };

/** The gnasher: squat, rust-red, more mouth than head, long arms ending in bone hooks, two short horns swept back. */
function gnasher(p) {
  const c = cv(60, 62), g = 59, step = p.step ?? 0, lean = p.lean ?? 0, drop = (p.drop ?? 0) * 22, arms = p.arms ?? 0, jaw = p.jaw ?? 0;
  const cx = 30 + step * 1.5 + lean * 4, hip = g - 17 + drop * 0.6, chest = hip - 15 + drop * 0.25, head = chest - 10 + lean * 3;
  for (const s of [-1, 1]) { // legs: bowed, the raised one drawn shorter
    const up = step === s ? 4 : 0, kx = cx + s * 10, ky = hip + 7 - up, fx = cx + s * 9, fy = g - up - drop * 0.1;
    limb(c, cx + s * 6, hip, kx, ky, 6, 4.5, R.rust, { lo: 0.5, hi: 4.5 }); limb(c, kx, ky, fx, fy - 2, 4.5, 3, R.rust, { lo: 0.5, hi: 4 });
    ell(c, fx + s * 2, fy - 1.5, 5.5, 2.6, R.rust, { lo: 0.5, hi: 3.5 }); for (const k of [-1, 0, 1]) dot(c, fx + s * 2 + k * 3, fy, R.bone, 5);
  }
  ell(c, cx, hip - 5, 14, 11, R.rust, { lo: 0.6, hi: 5 }); // belly
  ell(c, cx - lean * 3, chest, 16, 11, R.rust, { lo: 1, hi: 5.6 }); // shoulders
  for (let k = -2; k <= 2; k++) ell(c, cx + k * 4.5, hip - 6 + Math.abs(k), 2.2, 3.4, R.flesh, { lo: 1.5, hi: 4.5 }); // a ribbed pale underside
  for (const s of [-1, 1]) { crease(c, cx + s * 1.5 - lean * 3, chest + 1, cx + s * 13 - lean * 3, chest + 3, 3, -2); crease(c, cx + s * 1, chest - 6, cx + s * 1, chest + 4, 0, -2); // the chest in two slabs
    for (const k of [0, 1, 2]) limb(c, cx + s * (10 + k * 3) - lean * 3, chest - 7 + k, cx + s * (12 + k * 4) - lean * 3, chest - 13 + k * 2, 1.8, 0.4, R.bone, { lo: 3, hi: 7 }); } // spines along the shoulders
  for (const [dx, dy] of [[-7, 3], [-6, 4], [-5, 6], [5, -2], [6, -1]]) shade(c, cx + dx, chest + dy, -3); // old scars
  for (const s of [-1, 1]) { // arms
    const raise = s === 1 ? arms : arms * 0.35, sx = cx + s * 15 - lean * 3, sy = chest - 2;
    const ex = sx + s * (5 + raise * 3), ey = sy + 11 - raise * 17, hx = ex + s * (1 - raise * 2), hy = ey + 12 - raise * 22;
    limb(c, sx, sy, ex, ey, 5.5, 4, R.rust, { lo: 0.8, hi: 5.2 }); limb(c, ex, ey, hx, hy, 4, 3.4, R.rust, { lo: 0.8, hi: 5 });
    ell(c, hx, hy, 4.2, 3.6, R.rust, { lo: 1, hi: 5 });
    for (const k of [-1, 0, 1]) limb(c, hx + k * 2.4, hy + (raise > 0.5 ? -2 : 2), hx + k * 3.6 + s, hy + (raise > 0.5 ? -8 : 8), 1.3, 0.5, R.bone, { lo: 3, hi: 7 });
    if (s === 1 && p.glow) { ell(c, hx, hy - 9, 7, 7, R.fire, { lo: 2, hi: 7 }); ell(c, hx - 1, hy - 10, 3.5, 3.5, R.fire, { flat: 7 }); }
  }
  const hx = cx - lean * 7, hy = head;
  limb(c, hx + 8, hy - 5, hx + 17, hy - 14 + lean * 4, 3.4, 0.6, R.bone, { lo: 2, hi: 7 }); limb(c, hx - 8, hy - 5, hx - 12.5, hy - 9.5 + lean * 4, 3.4, 2, R.bone, { lo: 2, hi: 6 }); dot(c, hx - 13, hy - 11 + lean * 4, R.bone, 7); // horns: one whole, one snapped
  ell(c, hx, hy, 12, 9.5, R.rust, { lo: 1.2, hi: 6 });
  ell(c, hx, hy - 4, 9, 4, R.rust, { lo: 2.5, hi: 6.5 }); // brow
  for (const s of [-1, 1]) { poly(c, [[hx + s * 2.5, hy - 2.5], [hx + s * 8.5, hy - 5], [hx + s * 7.5, hy - 1]], R.fire, p.hurt ? 2 : 6); dot(c, hx + s * 5.5, hy - 3, R.fire, 7); }
  for (const s of [-1, 1]) { dot(c, hx + s * 1.5, hy + 0.5, R.red, 0); crease(c, hx + s * 3, hy - 6, hx + s * 9, hy - 7.5, 0, -2); } // nostrils, the brow's overhang
  const mh = 2.5 + jaw * 5; // the mouth: a dark gash and two rows of teeth
  ell(c, hx, hy + 4 + jaw * 2, 9.5, mh, R.red, { flat: 0 });
  for (let k = -4; k <= 4; k++) { const tx = hx + k * 2; set(c, tx, hy + 4 + jaw * 2 - mh + 1, ix(R.bone, 7)); set(c, tx, hy + 5 + jaw * 2 - mh + 1, ix(R.bone, k & 1 ? 5 : 6)); if (jaw > 0.3) set(c, tx + 1, hy + 4 + jaw * 2 + mh - 1.5, ix(R.bone, 6)); }
  for (let j = 0; j < 3 + jaw * 3; j++) dot(c, hx - 3, hy + 6 + jaw * 4 + j, R.red, 4 - (j & 1)); // it drools red
  if (p.hurt) spatter(c, cx, chest + 2, 14, 46, R.red, 3, 6, 7 + Math.round(lean * 10));
  return outline(c);
}

/** The husk: what is left of a trooper. A cracked helmet with one lit eye slit, a jaw of bare bone, armour split open, a rifle. */
function husk(p) {
  const c = cv(52, 66), g = 63, step = p.step ?? 0, lean = p.lean ?? 0, drop = (p.drop ?? 0) * 26, arms = p.arms ?? 0;
  const cx = 26 + step + lean * 4, hip = g - 26 + drop * 0.7, sh = hip - 20 + drop * 0.25;
  for (const s of [-1, 1]) {
    const up = step === s ? 4 : 0, kx = cx + s * 6, ky = hip + 12 - up, fy = g - up;
    limb(c, cx + s * 4.5, hip, kx, ky, 5, 4.2, R.olive, { lo: 0.5, hi: 4 }); limb(c, kx, ky, kx + s, fy - 4, 4.2, 3.6, R.olive, { lo: 0.5, hi: 3.6 });
    ell(c, kx, ky, 3.6, 3, R.steel, { lo: 2, hi: 5 }); // knee plate
    limb(c, kx + s, fy - 4, kx + s * 2.5, fy - 1, 3.8, 3.4, R.steel, { lo: 0.5, hi: 3 }); // boot
  }
  const tx = cx - lean * 5;
  limb(c, cx, hip, tx, sh + 4, 8.5, 10.5, R.olive, { lo: 0.8, hi: 5 }); // torso
  poly(c, [[tx - 8, sh + 2], [tx + 8, sh + 2], [tx + 6, sh + 14], [tx - 6, sh + 14]], R.steel, (x, y) => 4.6 - (x - tx + 8) * 0.14 - (y - sh) * 0.1); // chest plate
  poly(c, [[tx - 1, sh + 5], [tx + 5, sh + 4], [tx + 3, sh + 12], [tx - 3, sh + 10]], R.red, (x, y) => 1 + ((x + y) & 1)); // the plate torn open
  for (const k of [0, 1, 2]) dot(c, tx + k * 2 - 1, sh + 7 + k, R.bone, 6);
  box(c, Math.round(cx - 8), Math.round(hip - 2), 16, 3, R.brown, (i) => (i % 5 === 0 ? 5 : 2)); // belt
  for (const s of [-1, 1]) box(c, Math.round(cx + s * 6 - 2), Math.round(hip - 1), 4, 5, R.brown, (i, j) => (j === 0 ? 5 : i === 3 ? 1 : 3)); // pouches
  for (let i = 0; i < 17; i++) { shade(c, tx - 8 + i, sh + 3 + i * 0.6, -3); shade(c, tx - 8 + i, sh + 2 + i * 0.6, 2); } // a strap across the chest
  for (const s of [-1, 1]) ell(c, tx + s * 11, sh + 3, 5, 4.4, R.olive, { lo: 1.5, hi: 6 }); // shoulders
  const hx = tx - lean * 4, hy = sh - 7;
  if (arms > 0.5) { // the rifle levelled at you: a foreshortened barrel and the flash
    for (const s of [-1, 1]) limb(c, tx + s * 11, sh + 4, tx + s * 4, sh + 13, 4, 3.5, R.olive, { lo: 1, hi: 5 });
    ell(c, tx, sh + 13, 5, 4, R.flesh, { lo: 1, hi: 4 }); ell(c, tx, sh + 13, 4, 4, R.steel, { lo: 1, hi: 5 }); ell(c, tx, sh + 13, 2, 2, R.steel, { flat: 0 });
    if (p.glow) { for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283 + 0.3, [ex, ey] = rot(0, -9 - (k & 1) * 4, a); limb(c, tx, sh + 13, tx + ex, sh + 13 + ey, 2.6, 0.4, R.fire, { lo: 4, hi: 7 }); } ell(c, tx, sh + 13, 4, 4, R.fire, { flat: 7 }); }
  } else { // carried across the body
    limb(c, tx - 11, sh + 4, tx - 9, sh + 14, 4, 3.4, R.olive, { lo: 1, hi: 5 }); limb(c, tx - 9, sh + 14, tx - 2, sh + 17, 3.4, 3, R.olive, { lo: 1, hi: 5 });
    limb(c, tx + 11, sh + 4, tx + 10, sh + 12, 4, 3.4, R.olive, { lo: 1, hi: 5 }); limb(c, tx + 10, sh + 12, tx + 4, sh + 10, 3.4, 3, R.olive, { lo: 1, hi: 5 });
    limb(c, tx - 13, sh + 20, tx + 12, sh + 5 - arms * 6, 2, 1.6, R.steel, { lo: 1, hi: 5 }); limb(c, tx - 13, sh + 20, tx - 7, sh + 16, 3, 2.4, R.brown, { lo: 1, hi: 4 });
    ell(c, tx - 2, sh + 17, 2.8, 2.6, R.flesh, { lo: 1, hi: 4 }); ell(c, tx + 4, sh + 10, 2.8, 2.6, R.flesh, { lo: 1, hi: 4 });
  }
  ell(c, hx, hy + 4, 5.5, 5, R.bone, { lo: 2, hi: 6 }); // the jaw
  for (let k = -2; k <= 2; k++) { dot(c, hx + k * 2, hy + 6, R.steel, 0); dot(c, hx + k * 2, hy + 7, R.bone, 7); }
  ell(c, hx, hy - 1, 8, 7.5, R.olive, { lo: 1.5, hi: 6.5 }); // the helmet
  for (let j = 0; j < 6; j++) { dot(c, hx + 2, hy - 8 + j, R.yellow, 5 - (j > 3 ? 2 : 0)); dot(c, hx + 3, hy - 8 + j, R.yellow, 3); } // a rank stripe, chipped
  crease(c, hx - 7, hy + 1.5, hx + 7, hy + 1.5, 0.6, -3); for (let j = 0; j < 4; j++) dot(c, hx + 3, hy + 9 + j, R.red, 5 - (j & 1)); // the rim's shadow; blood down the jaw
  box(c, Math.round(hx - 6), Math.round(hy), 12, 3, R.steel, 0);
  box(c, Math.round(hx + 1), Math.round(hy), 5, 3, R.accB, (i, j) => (p.hurt ? 2 : 7 - j * 1.5)); dot(c, hx - 4, hy + 1, R.accB, 2);
  for (const [dx, dy] of [[-3, -7], [-2, -5], [-3, -3], [-1, -2], [-2, 0]]) dot(c, hx + dx, hy + dy, R.steel, 0); // the crack
  if (p.hurt) spatter(c, tx, sh + 8, 11, 24, R.red, 3, 6, 3 + Math.round(lean * 10));
  return outline(c);
}

/** The drifter: nothing with legs. A ribbed bell that hangs in the air, a ring of small lit eyes round a lamprey mouth, and a skirt of trailing arms. */
function drifter(p) {
  const c = cv(60, 70, 30, 69), step = p.step ?? 0, lean = p.lean ?? 0, drop = (p.drop ?? 0), jaw = p.jaw ?? 0, cx = 30 + lean * 3, cy = 24 + drop * 26, sq = 1 - drop * 0.45;
  for (let k = -3; k <= 3; k++) { // the arms, swaying with the step
    const x0 = cx + k * 5, y0 = cy + 12 * sq, sway = Math.sin(k * 1.3 + step * 1.4) * 4, len = (26 - Math.abs(k) * 3) * (1 - drop * 0.6) + (p.arms ?? 0) * (k & 1 ? -8 : 2);
    limb(c, x0, y0, x0 + sway, y0 + len * 0.5, 2.6, 1.8, R.purple, { lo: 0.5, hi: 4.5 }); limb(c, x0 + sway, y0 + len * 0.5, x0 - sway * 0.6 + k * (p.arms ?? 0) * 2, y0 + len, 1.8, 0.6, R.purple, { lo: 0.5, hi: 5 });
  }
  ell(c, cx, cy, 20, 19 * sq, R.purple, { lo: 0.8, hi: 6 }); // the bell
  for (let k = -3; k <= 3; k++) for (let j = -16; j < 14; j++) { const x = cx + k * 5.6 * Math.sqrt(Math.max(0, 1 - (j / 19) ** 2)), y = cy + j * sq; if (get(c, x | 0, y | 0)) { const v = get(c, x | 0, y | 0); set(c, x, y, v > 8 + R.purple * 8 ? v - 1 : v); } } // ribs
  ell(c, cx - 6, cy - 9 * sq, 7, 4 * sq, R.purple, { lo: 4, hi: 7 }); // the wet highlight
  for (const [x0, y0, x1, y1, bd] of [[-15, -4, -6, -12, -2], [15, -2, 7, -11, -2], [-12, 6, -17, 0, 1], [12, 8, 17, 1, 1], [-3, -15, 4, -13, 1]]) crease(c, cx + x0, cy + y0 * sq, cx + x1, cy + y1 * sq, bd, -2); // veins
  for (let j = 0; j < 5 + jaw * 4; j++) dot(c, cx + 2, cy + (9 + jaw * 3) * sq + j, R.red, 5 - (j & 1)); // it drips
  const my = cy + 3 * sq, mr = 5 + jaw * 3.5;
  ell(c, cx, my, mr + 2, (mr + 2) * sq, R.flesh, { lo: 1, hi: 5 }); ell(c, cx, my, mr, mr * sq, R.red, { flat: p.glow ? 2 : 0 });
  for (let k = 0; k < 10; k++) { const a = (k / 10) * 6.283; set(c, cx + Math.cos(a) * (mr - 1), my + Math.sin(a) * (mr - 1) * sq, ix(R.bone, 7)); }
  if (p.glow) { ell(c, cx, my, mr * 0.6, mr * 0.6 * sq, R.accB, { lo: 4, hi: 7 }); }
  for (let k = 0; k < 5; k++) { const a = -Math.PI * (0.1 + 0.2 * k), ex = cx + Math.cos(a) * 13, ey = my + Math.sin(a) * 11 * sq - 1; ell(c, ex, ey, 2.4, 2.2, R.accB, { flat: p.hurt ? 1 : 6 }); dot(c, ex, ey, R.accB, p.hurt ? 0 : 7); dot(c, ex, ey + 1, R.steel, 0); }
  if (p.hurt) spatter(c, cx, cy, 16, 30, R.red, 3, 6, 5 + Math.round(lean * 10));
  return outline(c);
}

/** The warden: the thing at the end. Twice a man's height, antlered, a furnace where its chest should be, one arm a cannon. */
function warden(p) {
  const c = cv(110, 124), g = 121, step = p.step ?? 0, lean = p.lean ?? 0, drop = (p.drop ?? 0) * 50, arms = p.arms ?? 0;
  const cx = 55 + step * 2 + lean * 6, hip = g - 44 + drop * 0.7, sh = hip - 38 + drop * 0.25, tx = cx - lean * 8;
  for (const s of [-1, 1]) { // legs in plate
    const up = step === s ? 6 : 0, kx = cx + s * 14, ky = hip + 20 - up, fy = g - up;
    limb(c, cx + s * 10, hip, kx, ky, 10, 8, R.red, { lo: 0.5, hi: 4.5 }); limb(c, kx, ky, kx + s * 2, fy - 6, 8.5, 7, R.steel, { lo: 0.8, hi: 5 });
    ell(c, kx, ky, 7, 6, R.steel, { lo: 2, hi: 6.5 }); poly(c, [[kx - 3, ky - 8], [kx + 3, ky - 8], [kx, ky - 15]], R.bone, 5);
    ell(c, kx + s * 4, fy - 3, 11, 5, R.steel, { lo: 0.5, hi: 4.5 }); for (const k of [-1, 0, 1]) limb(c, kx + s * 4 + k * 6, fy - 2, kx + s * 4 + k * 8, fy + 1, 2, 0.6, R.bone, { lo: 3, hi: 7 });
  }
  limb(c, cx, hip, tx, sh + 12, 17, 24, R.red, { lo: 0.8, hi: 5.4 }); // torso
  ell(c, tx - 12, sh + 12, 11, 9, R.red, { lo: 1.5, hi: 6 }); ell(c, tx + 12, sh + 12, 11, 9, R.red, { lo: 1, hi: 5.4 }); // the chest's two slabs
  for (const s of [-1, 1]) { crease(c, tx + s * 2, sh + 20, tx + s * 21, sh + 18, 3, -3); for (const k of [0, 1, 2]) crease(c, cx + s * 2, hip - 22 + k * 6, cx + s * 13, hip - 21 + k * 6, 1.5, -2); } // under the chest; the belly in ranks
  crease(c, tx, sh + 6, cx, hip - 5, 0, -3);
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) dot(c, tx + s * (24 - k * 1.6), sh + 16 + k * 2.4, R.steel, k & 1 ? 6 : 2); // chains from the pauldrons to the girdle
  box(c, Math.round(tx - 9), Math.round(sh + 22), 18, 17, R.steel, (i, j) => (i === 0 || j === 0 ? 5 : i === 17 || j === 16 ? 0 : 1)); // the furnace
  for (let i = 0; i < 4; i++) for (let j = 0; j < 14; j++) set(c, tx - 7 + i * 4.3, sh + 23 + j, ix(R.fire, p.hurt ? 2 + (j & 1) : 3 + ((j * 3 + i * 5) % 5))), set(c, tx - 6 + i * 4.3, sh + 23 + j, ix(R.fire, p.hurt ? 1 : 4 + ((j * 5 + i * 3) % 4)));
  box(c, Math.round(cx - 17), Math.round(hip - 4), 34, 6, R.steel, (i, j) => (i % 8 < 2 ? 6 : j === 0 ? 4 : 2)); // girdle
  for (const s of [-1, 1]) { ell(c, tx + s * 26, sh + 6, 13, 10, R.steel, { lo: 1.2, hi: 6.5 }); for (const k of [-1, 0, 1]) poly(c, [[tx + s * (22 + k * 6) - 2, sh - 1], [tx + s * (22 + k * 6) + 2, sh - 1], [tx + s * (24 + k * 7), sh - 12 + Math.abs(k) * 3]], R.bone, 5.5 - Math.abs(k)); } // pauldrons, spiked
  { // the cannon arm (its right, our left)
    const sx = tx - 28, sy = sh + 10, ex = sx - 4 + arms * 8, ey = sy + 22 - arms * 10, hx = ex + 2 + arms * 14, hy = ey + 22 - arms * 16;
    limb(c, sx, sy, ex, ey, 9, 8, R.red, { lo: 0.8, hi: 5 });
    if (arms > 0.5) { ell(c, hx, hy, 13, 13, R.steel, { lo: 1, hi: 6 }); ell(c, hx, hy, 8, 8, R.steel, { flat: 0 }); if (p.glow) { ell(c, hx, hy, 11, 11, R.fire, { lo: 3, hi: 7 }); ell(c, hx, hy, 5, 5, R.fire, { flat: 7 }); } }
    else { limb(c, ex, ey, hx, hy, 9.5, 10.5, R.steel, { lo: 1, hi: 6 }); for (const k of [0.3, 0.6]) limb(c, ex + (hx - ex) * k - 9, ey + (hy - ey) * k, ex + (hx - ex) * k + 9, ey + (hy - ey) * k + 1, 1.6, 1.6, R.steel, { lo: 0, hi: 2 }); ell(c, hx, hy + 2, 8, 4, R.steel, { flat: 0 }); }
  }
  { // the other arm: a hand like a rake
    const sx = tx + 28, sy = sh + 10, ex = sx + 6, ey = sy + 22 - arms * 6, hx = ex + 1, hy = ey + 20 - arms * 8;
    limb(c, sx, sy, ex, ey, 9, 7, R.red, { lo: 0.8, hi: 5.4 }); limb(c, ex, ey, hx, hy, 7, 6, R.red, { lo: 0.8, hi: 5.2 }); ell(c, hx, hy + 2, 7, 6, R.red, { lo: 1, hi: 5 });
    for (const k of [-1.5, -0.5, 0.5, 1.5]) limb(c, hx + k * 3.4, hy + 5, hx + k * 5, hy + 16, 2, 0.6, R.bone, { lo: 3, hi: 7 });
  }
  const hx = tx - lean * 6, hy = sh - 6;
  for (const s of [-1, 1]) { // antlers: a main beam and three tines
    const pts = [[hx + s * 6, hy - 6], [hx + s * 16, hy - 16], [hx + s * 20, hy - 30], [hx + s * 15, hy - 42]];
    for (let k = 0; k < 3; k++) limb(c, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 3.4 - k * 0.8, 2.6 - k * 0.8, R.bone, { lo: 2, hi: 7 });
    limb(c, pts[1][0], pts[1][1], pts[1][0] + s * 12, pts[1][1] - 8, 2.2, 0.5, R.bone, { lo: 2, hi: 7 }); limb(c, pts[2][0], pts[2][1], pts[2][0] + s * 11, pts[2][1] - 9, 1.8, 0.5, R.bone, { lo: 2, hi: 7 }); limb(c, pts[2][0], pts[2][1] + 6, pts[2][0] - s * 8, pts[2][1] - 6, 1.6, 0.5, R.bone, { lo: 2, hi: 7 });
  }
  ell(c, hx, hy, 10, 11, R.bone, { lo: 1.5, hi: 6.5 }); poly(c, [[hx - 6, hy + 6], [hx + 6, hy + 6], [hx + 3, hy + 15], [hx - 3, hy + 15]], R.bone, (x, y) => 4.5 - (y - hy - 6) * 0.25); // a long skull
  for (const s of [-1, 1]) { ell(c, hx + s * 4.5, hy - 1, 3.2, 3.6, R.steel, { flat: 0 }); dot(c, hx + s * 4.5, hy, R.fire, p.hurt ? 2 : 7); dot(c, hx + s * 4.5, hy - 1, R.fire, p.hurt ? 1 : 5); }
  poly(c, [[hx - 1, hy + 4], [hx + 1, hy + 4], [hx, hy + 8]], R.steel, 0);
  for (let k = -2; k <= 2; k++) { dot(c, hx + k * 1.5, hy + 12 + (p.jaw ?? 0) * 2, R.steel, 0); }
  if (p.hurt) spatter(c, tx, sh + 20, 24, 70, R.red, 3, 6, 9 + Math.round(lean * 10));
  return outline(c);
}

/** What is left on the floor: a low heap in the creature's colours, a pool round it, whatever was hard sticking up. */
function heap(w, ramp, hard, s) {
  const c = cv(w, Math.round(w * 0.36)), cy = c.h - Math.round(w * 0.1);
  ell(c, w / 2, cy + 1, w * 0.47, w * 0.09, R.red, { lo: 0.5, hi: 2.5 });
  ell(c, w * 0.42, cy - w * 0.06, w * 0.26, w * 0.1, ramp, { lo: 0.6, hi: 4.4 }); ell(c, w * 0.66, cy - w * 0.04, w * 0.17, w * 0.075, ramp, { lo: 0.6, hi: 4 });
  limb(c, w * 0.28, cy - w * 0.02, w * 0.12, cy + w * 0.02, w * 0.045, w * 0.03, ramp, { lo: 0.6, hi: 4 }); limb(c, w * 0.74, cy - w * 0.02, w * 0.9, cy, w * 0.04, w * 0.025, ramp, { lo: 0.6, hi: 3.6 });
  limb(c, w * 0.38, cy - w * 0.12, w * 0.3, cy - w * 0.24, w * 0.035, 0.6, hard, { lo: 3, hi: 7 }); limb(c, w * 0.5, cy - w * 0.12, w * 0.56, cy - w * 0.2, w * 0.03, 0.6, hard, { lo: 3, hi: 7 });
  spatter(c, w / 2, cy - 2, w * 0.4, w * 1.2, R.red, 2, 5, s);
  return outline(c);
}

const castOf = (fn, w, ramp, hard, s) => { const o = {}; for (const [k, p] of Object.entries(POSES)) o[k] = fn(p); o.dead = heap(w, ramp, hard, s); return o; };
export const FOES = {
  gnasher: { ...castOf(gnasher, 54, R.rust, R.bone, 11), z: 0, s: 1, shot: 'fire' },
  husk: { ...castOf(husk, 50, R.olive, R.steel, 12), z: 0, s: 1, shot: 'bullet' },
  drifter: { ...castOf(drifter, 54, R.purple, R.accB, 13), z: 0.42, s: 1, shot: 'bolt' },
  warden: { ...castOf(warden, 104, R.red, R.bone, 14), z: 0, s: 1.25, shot: 'fire' },
};

// ---------- props ----------
function drum(state) { // a steel drum with a hazard band: whole, dented and leaking, or a split shell
  const c = cv(30, 42);
  if (state === 'gone') { ell(c, 15, 38, 14, 3.4, R.steel, { flat: 0 }); poly(c, [[4, 38], [7, 27], [11, 33], [14, 25], [18, 32], [22, 28], [26, 38]], R.olive, (x, y) => 1 + ((x * 7 + y * 3) % 3)); spatter(c, 15, 37, 13, 30, R.fire, 1, 4, 5); return outline(c); }
  for (let y = 6; y < 40; y++) for (let x = 3; x < 27; x++) { const u = (x - 15) / 12, bulge = Math.sqrt(Math.max(0, 1 - u * u)); if (Math.abs(u) > 1) continue; set(c, x, y, tone(R.olive, 1, 6, u * LX * 1.5 + bulge * 0.55 - 0.2, x, y)); }
  ell(c, 15, 6, 12, 3.2, R.olive, { lo: 3, hi: 6.5 }); ell(c, 15, 6, 9.5, 2.2, R.olive, { lo: 1, hi: 3.5 }); ell(c, 15, 40, 12, 2, R.olive, { lo: 0.5, hi: 2 });
  for (const y of [15, 30]) for (let x = 3; x < 27; x++) { if (get(c, x, y)) { set(c, x, y, ix(R.olive, 6.5 - Math.abs(x - 11) * 0.3)); set(c, x, y + 1, ix(R.olive, 0.5)); } }
  for (let y = 19; y < 27; y++) for (let x = 3; x < 27; x++) if (get(c, x, y)) set(c, x, y, ((x + y) >> 2) & 1 ? ix(R.yellow, 6 - Math.abs(x - 11) * 0.3) : ix(R.steel, 0.5));
  dot(c, 11, 4, R.steel, 1); dot(c, 12, 4, R.steel, 1);
  if (state === 'hurt') { ell(c, 19, 12, 4, 3, R.olive, { lo: 0, hi: 1.5 }); for (let j = 0; j < 20; j++) { set(c, 19 + ((j * 7) % 3) - 1, 14 + j, ix(R.green, 5 - (j % 3))); } spatter(c, 15, 22, 12, 14, R.rust, 2, 5, 3); }
  return outline(c);
}
function crateSprite() { const c = cv(34, 34); box(c, 1, 1, 32, 32, R.tan, (i, j) => 2.6 + ((i * 3 + j) % 4) * 0.4 - (i > 24 ? 1 : 0)); for (const [x, y, w, h] of [[1, 1, 32, 4], [1, 29, 32, 4], [1, 1, 4, 32], [29, 1, 4, 32]]) box(c, x, y, w, h, R.steel, (i, j) => (i === 0 || j === 0 ? 5 : 2.5)); for (let i = 0; i < 26; i++) { dot(c, 4 + i, 4 + i, R.steel, 4); dot(c, 5 + i, 4 + i, R.steel, 2); } return outline(c); }
function torch(f) { const c = cv(18, 60); limb(c, 9, 59, 9, 26, 1.8, 1.8, R.steel, { lo: 1, hi: 5 }); ell(c, 9, 58, 5, 1.8, R.steel, { lo: 1, hi: 4 }); poly(c, [[3, 20], [15, 20], [12, 28], [6, 28]], R.steel, (x) => 5 - (x - 3) * 0.3); const k = f ? 1 : -1; ell(c, 9 + k, 14, 5, 7, R.fire, { lo: 2, hi: 6 }); ell(c, 9 - k, 9, 3, 6, R.fire, { lo: 3, hi: 7 }); ell(c, 9, 16, 2.5, 3.5, R.fire, { flat: 7 }); dot(c, 9 + k * 2, 3, R.fire, 5); return outline(c); }
function lampPost() { const c = cv(14, 62); limb(c, 7, 61, 7, 12, 1.6, 1.4, R.steel, { lo: 1, hi: 5 }); ell(c, 7, 60, 5, 1.8, R.steel, { lo: 1, hi: 4 }); box(c, 3, 3, 8, 10, R.steel, (i, j) => (i === 0 || j === 0 ? 5 : 1)); box(c, 4, 4, 6, 8, R.accA, (i, j) => 7 - j * 0.4); return outline(c); }
function terminal() { const c = cv(30, 44); poly(c, [[3, 43], [27, 43], [25, 18], [5, 18]], R.steel, (x, y) => 4.4 - (x - 3) * 0.1 - (y - 18) * 0.04); poly(c, [[5, 18], [25, 18], [23, 3], [7, 3]], R.steel, (x) => 3 - (x - 5) * 0.07); box(c, 9, 6, 12, 9, R.accA, (i, j) => (j & 1 ? 2 : (i * 5 + j * 3) % 7 < 4 ? 6 : 3)); for (let i = 0; i < 6; i++) dot(c, 8 + i * 3, 22, [R.red, R.accB, R.yellow][i % 3], 6); box(c, 8, 27, 14, 8, R.steel, (i, j) => ((i + j) & 1 ? 2 : 1)); return outline(c); }
function skulls() { const c = cv(34, 22); for (const [x, y, r] of [[9, 15, 6], [24, 16, 5.5], [16, 9, 6]]) { ell(c, x, y, r, r * 0.9, R.bone, { lo: 2, hi: 7 }); for (const s of [-1, 1]) ell(c, x + s * r * 0.4, y, r * 0.24, r * 0.3, R.steel, { flat: 0 }); for (let k = -1; k <= 1; k++) dot(c, x + k * 2, y + r * 0.7, R.steel, 0); } return outline(c); }
function chain() { const c = cv(8, 64, 4, 63); for (let j = 0; j < 14; j++) { const y = 2 + j * 4.4; if (j & 1) limb(c, 4, y, 4, y + 4, 1.2, 1.2, R.steel, { lo: 1, hi: 5 }); else { ell(c, 4, y + 2, 2.6, 2.8, R.steel, { lo: 1, hi: 5 }); dot(c, 4, y + 2, R.steel, 0); dot(c, 4, y + 3, R.steel, 0); } } poly(c, [[2, 58], [6, 58], [5, 63], [3, 63]], R.steel, 3); return c; }
function pickup(kind) {
  const c = cv(22, 18);
  if (kind === 'med') { box(c, 2, 5, 18, 12, R.bone, (i, j) => (j === 0 || i === 0 ? 7 : i === 17 || j === 11 ? 3 : 5.5)); box(c, 9, 7, 4, 8, R.red, 4); box(c, 7, 9, 8, 4, R.red, 5); box(c, 7, 3, 8, 2, R.bone, 4); }
  else if (kind === 'armor') { poly(c, [[3, 4], [8, 2], [11, 5], [14, 2], [19, 4], [18, 16], [11, 17], [4, 16]], R.blue, (x, y) => 6 - (x - 3) * 0.22 - (y - 2) * 0.12); box(c, 9, 7, 4, 7, R.accA, (i, j) => 6 - j * 0.4); }
  else if (kind === 'ammo') { box(c, 3, 7, 16, 10, R.olive, (i, j) => (j === 0 || i === 0 ? 5.5 : i === 15 || j === 9 ? 1 : 3)); for (let i = 0; i < 5; i++) { box(c, 4 + i * 3, 3, 2, 5, R.yellow, (a, b) => 5 - a * 1.5); box(c, 4 + i * 3, 2, 2, 1, R.rust, 4); } }
  else { const ramp = kind === 'keyR' ? R.red : kind === 'keyB' ? R.blue : R.yellow; box(c, 5, 3, 12, 14, ramp, (i, j) => (j === 0 || i === 0 ? 7 : i === 11 || j === 13 ? 2 : 5)); box(c, 7, 5, 8, 3, R.steel, 0); box(c, 7, 11, 3, 3, R.bone, 7); box(c, 12, 11, 3, 1, R.steel, 1); box(c, 12, 13, 3, 1, R.steel, 1); }
  return outline(c);
}
function boom(k) { // an explosion in four frames: a white core, a fireball, the fireball breaking up, smoke
  const c = cv(72, 72, 36, 54), r = [12, 24, 31, 33][k];
  if (k === 3) { for (let i = 0; i < 9; i++) { const a = i * 0.7, d = 12 + (i * 7) % 15; ell(c, 36 + Math.cos(a) * d, 34 + Math.sin(a) * d * 0.8, 9 - (i % 3) * 2, 8 - (i % 3) * 2, R.steel, { lo: 0.5, hi: 3 }); } spatter(c, 36, 34, 30, 60, R.fire, 1, 4, 4); return c; }
  for (let i = 0; i < 12; i++) { const a = i * 0.524 + k, d = r * (0.55 + ((i * 5) % 4) * 0.1); ell(c, 36 + Math.cos(a) * d, 34 + Math.sin(a) * d, r * 0.42, r * 0.42, k === 2 && i % 3 === 0 ? R.steel : R.fire, k === 2 && i % 3 === 0 ? { lo: 0.5, hi: 2.5 } : { lo: 1 + (2 - k), hi: 5 }); }
  ell(c, 36, 34, r * 0.72, r * 0.72, R.fire, { lo: 3, hi: 7 }); if (k < 2) ell(c, 35, 33, r * 0.4, r * 0.4, R.fire, { flat: 7 });
  return c;
}
function ball(ramp, k) { const c = cv(22, 22, 11, 11); for (let i = 0; i < 7; i++) { const a = i * 0.9 + k * 0.45; limb(c, 11, 11, 11 + Math.cos(a) * 10, 11 + Math.sin(a) * 10, 2.4, 0.3, ramp, { lo: 2, hi: 5 }); } ell(c, 11, 11, 6, 6, ramp, { lo: 3, hi: 7 }); ell(c, 10, 10, 3, 3, ramp, { flat: 7 }); return c; }
function puff(k) { const c = cv(14, 14, 7, 7); ell(c, 7, 7, 3 + k * 1.6, 3 + k * 1.6, k ? R.steel : R.fire, k ? { lo: 2, hi: 5 - k } : { lo: 4, hi: 7 }); if (!k) ell(c, 7, 7, 2, 2, R.fire, { flat: 7 }); return c; }
function gore() { const c = cv(40, 12); ell(c, 20, 8, 19, 3.6, R.red, { lo: 0.5, hi: 3 }); ell(c, 14, 7, 6, 2, R.red, { lo: 2, hi: 4.5 }); spatter(c, 20, 8, 18, 30, R.red, 3, 6, 8); return c; }
function grenade() { const c = cv(12, 14, 6, 10); ell(c, 6, 8, 4.4, 4.8, R.olive, { lo: 1, hi: 6 }); box(c, 4, 1, 4, 3, R.steel, (i, j) => 5 - j - i * 0.5); dot(c, 8, 2, R.yellow, 6); for (const y of [6, 9]) for (let x = 2; x < 10; x++) if (get(c, x, y)) set(c, x, y, ix(R.olive, 1)); return outline(c); }
function wreck() { const c = cv(30, 16); ell(c, 15, 12, 14, 3.4, R.steel, { flat: 0 }); poly(c, [[5, 13], [8, 6], [12, 10], [15, 4], [19, 9], [23, 6], [26, 13]], R.steel, (x, y) => 1 + ((x * 7 + y * 3) % 3)); spatter(c, 15, 11, 13, 26, R.fire, 1, 4, 9); return outline(c); }
export const PROPS = {
  nade: grenade(), wreck: wreck(),
  drum: drum('ok'), drumHurt: drum('hurt'), drumGone: drum('gone'), crate: crateSprite(), torch: [torch(0), torch(1)], lamp: lampPost(), terminal: terminal(), skulls: skulls(), chain: chain(), gore: gore(),
  med: pickup('med'), armor: pickup('armor'), ammo: pickup('ammo'), keyR: pickup('keyR'), keyB: pickup('keyB'), keyY: pickup('keyY'),
  boom: [0, 1, 2, 3].map(boom), fire: [ball(R.fire, 0), ball(R.fire, 1)], bolt: [ball(R.accB, 0), ball(R.accB, 1)], puff: [puff(0), puff(1), puff(2)],
};
export { cv, ell, limb, poly, box, dot, set, get, shade, crease, outline };
