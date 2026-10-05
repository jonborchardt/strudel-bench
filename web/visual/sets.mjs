// The sets a tableau is shot on, painted straight on the canvas in canvas-height units: a red velvet curtain (folds,
// dark valleys, bright ridges, black falloff at the edges, a dark floor), a white cyclorama (white, a pale grey floor,
// cast shadows under the figures) and a black void; plus white sculpture silhouettes after classical statuary (a
// winged form, a draped figure, a bust, a vase, a column) as set pieces behind the actors. Every set paints past the
// frame's edges so a camera punch-in or a tilt never shows the canvas behind it. No randomness: the caller passes the
// fold positions it drew from its own generator.
import { tracePath } from './portrait.mjs';

const OVER = 0.3; // how far past the frame a set paints, in frame widths/heights

/** A curtain: `folds` is a list of { x (0..1 of the width), w (0..1), bright (0..1) }; `gap` puts a dark parting at the centre; `lit` dims everything (a dropout). */
export function curtain(ctx, w, h, folds, { gap = false, lit = 1, floor = 0.8 } = {}) {
  const x0 = -w * OVER, y0 = -h * OVER, W = w * (1 + 2 * OVER), H = h * (1 + 2 * OVER);
  const k = (v) => Math.round(v * lit);
  ctx.fillStyle = `rgb(${k(58)} ${k(9)} ${k(16)})`; ctx.fillRect(x0, y0, W, H);
  for (const f of folds) { // each fold: dark valley on the left, ridge in the middle, dark valley on the right
    const fx = x0 + f.x * W, fw = f.w * W, g = ctx.createLinearGradient(fx, 0, fx + fw, 0), b = f.bright;
    g.addColorStop(0, `rgb(${k(40)} ${k(5)} ${k(11)})`); g.addColorStop(0.45, `rgb(${k(120 + 40 * b)} ${k(18 + 8 * b)} ${k(30 + 8 * b)})`); g.addColorStop(0.6, `rgb(${k(100 + 30 * b)} ${k(14)} ${k(26)})`); g.addColorStop(1, `rgb(${k(36)} ${k(4)} ${k(10)})`);
    ctx.fillStyle = g; ctx.fillRect(fx, y0, fw + 1, H);
  }
  if (gap) { const g = ctx.createLinearGradient(w * 0.47, 0, w * 0.53, 0); g.addColorStop(0, 'rgba(0 0 0 / 0)'); g.addColorStop(0.5, `rgba(0 0 0 / ${0.7})`); g.addColorStop(1, 'rgba(0 0 0 / 0)'); ctx.fillStyle = g; ctx.fillRect(w * 0.47, y0, w * 0.06, H); }
  const e = ctx.createLinearGradient(x0, 0, x0 + W, 0); e.addColorStop(0, 'rgba(0 0 0 / .85)'); e.addColorStop(0.3, 'rgba(0 0 0 / 0)'); e.addColorStop(0.7, 'rgba(0 0 0 / 0)'); e.addColorStop(1, 'rgba(0 0 0 / .85)');
  ctx.fillStyle = e; ctx.fillRect(x0, y0, W, H);
  const fy = h * floor, fg = ctx.createLinearGradient(0, fy - h * 0.12, 0, fy); fg.addColorStop(0, 'rgba(0 0 0 / 0)'); fg.addColorStop(1, 'rgba(0 0 0 / .8)');
  ctx.fillStyle = fg; ctx.fillRect(x0, fy - h * 0.12, W, h * 0.12);
  ctx.fillStyle = `rgb(${k(12)} ${k(7)} ${k(8)})`; ctx.fillRect(x0, fy, W, H);
  ctx.fillStyle = `rgba(${k(80)} ${k(20)} ${k(28)} / .5)`; ctx.fillRect(x0, fy, W, h * 0.004);
}

/** The white studio: seamless white, the floor a pale grey from `floor` down. */
export function cyclorama(ctx, w, h, { lit = 1, floor = 0.72 } = {}) {
  const x0 = -w * OVER, y0 = -h * OVER, W = w * (1 + 2 * OVER), H = h * (1 + 2 * OVER), k = (v) => Math.round(v * lit);
  ctx.fillStyle = `rgb(${k(243)} ${k(242)} ${k(238)})`; ctx.fillRect(x0, y0, W, H);
  const g = ctx.createLinearGradient(0, h * (floor - 0.1), 0, y0 + H); g.addColorStop(0, `rgb(${k(243)} ${k(242)} ${k(238)})`); g.addColorStop(0.25, `rgb(${k(226)} ${k(225)} ${k(221)})`); g.addColorStop(1, `rgb(${k(205)} ${k(204)} ${k(200)})`);
  ctx.fillStyle = g; ctx.fillRect(x0, h * (floor - 0.1), W, H);
}

/** The black void; `band` is an interruption: { color, dir: 'h' | 'v', at (0..1), size (0..1) }, a hard bar of white, red or gold. */
export function voidSet(ctx, w, h, band = null, lit = 1) {
  const x0 = -w * OVER, y0 = -h * OVER, W = w * (1 + 2 * OVER), H = h * (1 + 2 * OVER);
  ctx.fillStyle = '#050405'; ctx.fillRect(x0, y0, W, H);
  if (band) { ctx.fillStyle = band.color; ctx.globalAlpha = lit; if (band.dir === 'h') ctx.fillRect(x0, h * band.at, W, h * band.size); else ctx.fillRect(w * band.at, y0, h * band.size, H); ctx.globalAlpha = 1; }
}

/** A night street for the dead to dance on: a near-black blue sky, a moon high right with its glow, headstones (`stones`: { x (0..1 of the width), w, h (fractions of the frame height) } from the caller's generator) standing on the back line `far`, a band of fog over them and a cold ground from `floor` down. `lit` dims it all (a dropout). */
export function graveyard(ctx, w, h, stones, { lit = 1, floor = 0.9, far = 0.7 } = {}) {
  const x0 = -w * OVER, y0 = -h * OVER, W = w * (1 + 2 * OVER), H = h * (1 + 2 * OVER), k = (v) => Math.round(v * lit);
  const sky = ctx.createLinearGradient(0, y0, 0, h * far); sky.addColorStop(0, `rgb(${k(6)} ${k(8)} ${k(18)})`); sky.addColorStop(1, `rgb(${k(22)} ${k(28)} ${k(44)})`);
  ctx.fillStyle = sky; ctx.fillRect(x0, y0, W, H);
  const mx = w * 0.78, my = h * 0.2, glow = ctx.createRadialGradient(mx, my, h * 0.05, mx, my, h * 0.4); glow.addColorStop(0, `rgba(210 214 230 / ${0.35 * lit})`); glow.addColorStop(1, 'rgba(210 214 230 / 0)');
  ctx.fillStyle = glow; ctx.fillRect(mx - h * 0.4, my - h * 0.4, h * 0.8, h * 0.8);
  ctx.fillStyle = `rgb(${k(222)} ${k(224)} ${k(214)})`; ctx.beginPath(); ctx.arc(mx, my, h * 0.055, 0, Math.PI * 2); ctx.fill();
  const fy = h * far; ctx.fillStyle = `rgb(${k(30)} ${k(38)} ${k(34)})`; ctx.fillRect(x0, fy, W, H); // the ground, from the back line down
  for (const st of stones) { const sx = x0 + st.x * W, sw = st.w * h, sh = st.h * h; ctx.fillStyle = `rgb(${k(52)} ${k(56)} ${k(58)})`; ctx.beginPath(); ctx.moveTo(sx - sw / 2, fy + h * 0.01); ctx.lineTo(sx - sw / 2, fy - sh + sw / 2); ctx.arc(sx, fy - sh + sw / 2, sw / 2, Math.PI, 0); ctx.lineTo(sx + sw / 2, fy + h * 0.01); ctx.closePath(); ctx.fill(); ctx.fillStyle = `rgba(0 0 0 / ${0.35 * lit})`; ctx.fillRect(sx + sw * 0.25, fy - sh + sw / 2, sw * 0.25, sh - sw / 2); }
  const fog = ctx.createLinearGradient(0, fy - h * 0.12, 0, fy + h * 0.1); fog.addColorStop(0, 'rgba(150 160 170 / 0)'); fog.addColorStop(0.5, `rgba(150 160 170 / ${0.28 * lit})`); fog.addColorStop(1, 'rgba(150 160 170 / 0)');
  ctx.fillStyle = fog; ctx.fillRect(x0, fy - h * 0.12, W, h * 0.22);
  const g = ctx.createLinearGradient(0, fy, 0, h * floor + h * 0.3); g.addColorStop(0, `rgb(${k(30)} ${k(38)} ${k(34)})`); g.addColorStop(1, `rgb(${k(14)} ${k(18)} ${k(17)})`);
  ctx.fillStyle = g; ctx.fillRect(x0, fy, W, H);
}

/** A cast shadow on the floor under a figure standing at (x, floorY), `r` its half width in canvas units. */
export function floorShadow(ctx, x, y, r, dark = 0.14) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0 0 0 / ${dark})`); g.addColorStop(0.6, `rgba(0 0 0 / ${dark * 0.5})`); g.addColorStop(1, 'rgba(0 0 0 / 0)');
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22); ctx.translate(-x, -y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/** The dark edges a stage has: a vignette over the frame. */
export function vignette(ctx, w, h, amount = 0.55) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95); g.addColorStop(0, 'rgba(0 0 0 / 0)'); g.addColorStop(1, `rgba(0 0 0 / ${amount})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// sculptures: silhouettes in a 100-wide box, feet at y = 200, drawn upward; pale and subordinate
const S = {
  winged: ['M 50 200 L 42 120 C 30 110, 8 90, 10 40 C 24 60, 36 80, 44 100 L 46 60 C 46 40, 54 40, 54 60 L 56 100 C 64 80, 76 60, 90 40 C 92 90, 70 110, 58 120 Z', 'M 50 60 C 42 60, 40 44, 50 40 C 60 44, 58 60, 50 60 Z'],
  draped: ['M 32 200 L 36 110 C 30 90, 38 70, 44 62 C 40 52, 46 40, 50 40 C 54 40, 60 52, 56 62 C 62 70, 70 90, 64 110 L 68 200 Z', 'M 44 120 L 48 200 L 40 200 Z'],
  bust: ['M 30 200 L 34 172 L 66 172 L 70 200 Z', 'M 36 172 C 38 150, 44 140, 50 138 C 56 140, 62 150, 64 172 Z', 'M 50 84 C 62 84, 68 98, 66 116 C 64 132, 56 140, 50 140 C 44 140, 36 132, 34 116 C 32 98, 38 84, 50 84 Z'],
  vase: ['M 34 200 L 66 200 L 62 180 C 74 150, 76 110, 62 90 L 66 74 L 34 74 L 38 90 C 24 110, 26 150, 38 180 Z'],
  column: ['M 30 200 L 70 200 L 70 190 L 30 190 Z', 'M 36 190 L 64 190 L 60 40 L 40 40 Z', 'M 28 40 L 72 40 L 70 30 L 30 30 Z'],
};
export const SCULPTURES = Object.keys(S);
/** A sculpture standing with its feet at (x, y), `size` its height in canvas units, in the pale of the set. */
export function sculpture(ctx, kind, x, y, size, { fill = '#dcdad5', shade = '#c9c7c2' } = {}) {
  const paths = S[kind] ?? S.vase, k = size / 160;
  ctx.save(); ctx.translate(x - 50 * k, y - 200 * k); ctx.scale(k, k);
  for (const d of paths) { ctx.fillStyle = fill; ctx.beginPath(); tracePath(ctx, d); ctx.fill(); }
  ctx.fillStyle = shade; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.rect(50, 0, 60, 200); ctx.clip(); for (const d of paths) { ctx.beginPath(); tracePath(ctx, d); ctx.fill(); } // the far half a shade darker
  ctx.restore();
}
