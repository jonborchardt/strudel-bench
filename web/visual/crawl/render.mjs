// crawl's renderer: the whole picture is computed, pixel by pixel, into a small frame buffer (200 lines high, as wide
// as the stage's shape asks) and only then scaled up with hard edges. A floor and ceiling cast, a DDA wall cast with
// a depth per column, billboards clipped against it, then the screen-space layers (the weapon, the status bar).
// Light is a level 0..15 per map cell, less the distance, dithered on a 2x2 pattern and looked up in the light table:
// sixteen hard steps and nothing smooth. No canvas calls in here, so Node renders the same pixels the page does.
import { TS, TEX, T, LIGHTS, ix, R, glyph3, glyph5 } from './art.mjs';

export const H = 200, BAR = 34, VH = H - BAR; // the frame, the status bar, the view above it
export const TAN = 0.82; // half the horizontal field of view, as a tangent
const FALL = 0.62, FAR = 26; // light lost per map unit, and where nothing is drawn any more
const DITHER = [0, 0.5, 0.75, 0.25];

export function makeFrame(W) { const px = new Uint32Array(W * H); return { W, px, z: new Float32Array(W), wy0: new Int16Array(W), wy1: new Int16Array(W), bytes: new Uint8ClampedArray(px.buffer) }; }

const NOBOOST = new Float32Array(256);
export const PIT = 0.45; // how far a liquid floor lies under the floor around it
const isPit = (id) => id === T.toxic || id === T.lava;

/**
 * The view from `cam` ({ x, y, a, eye, pitch }) into sector `sec` (its grids), with `dyn`: { lut, flash (extra light
 * near the camera, 0..), dim (light taken off everywhere), doors: Map cell -> open fraction, t (seconds, for liquids) }.
 * Fills fb.px above the bar and fb.z, the wall depth of each column.
 * Height, cheaply: a cell is low (its ceiling one unit up) or high (`tall` 2: a ceiling two up, or none, the sky), and
 * a liquid floor lies PIT under the rest. So a ceiling pixel tries the low plane and, where that lands in a high cell,
 * the high one; a floor pixel tries the floor and, where that is liquid, the pit; and the wall pass adds the faces
 * between them: the wall over a low doorway seen from a high room, the far side of a pit.
 */
export function renderView(fb, sec, cam, dyn) {
  const { W, px, z, wy0, wy1 } = fb, { w: MW, h: MH, wall, floor, ceil, light, tall, lampOf } = sec, lut = dyn.lut, boost = dyn.boost ?? NOBOOST;
  const P = W / 2 / TAN, hz = Math.round(VH / 2 + (cam.pitch ?? 0)), eye = cam.eye ?? 0.5;
  const dx = Math.cos(cam.a), dy = Math.sin(cam.a), plx = -dy * TAN, ply = dx * TAN;
  const flash = dyn.flash ?? 0, dim = dyn.dim ?? 0, drift = Math.floor((dyn.t ?? 0) * 9);
  const skyTex = TEX[sec.sky ?? T.sky], skyOff = Math.floor((cam.a / (Math.PI * 2)) * TS * 4), SKY = (LIGHTS - 1) * 256;
  const lx = dx - plx, ly = dy - ply, kx = (plx * 2) / W, ky = (ply * 2) / W; // the leftmost ray, and the step to the next column, per unit of distance
  px.fill(0xff000000, 0, VH * W); wy0.fill(0); wy1.fill(0);
  // walls: one ray per column, painting the faces it passes on the way to the wall that stops it; a door part way up
  // is drawn afterwards over whatever stands behind it
  const doors = [], face = sec.face ?? T.conc;
  for (let x = 0; x < W; x++) {
    const cx = (2 * (x + 0.5)) / W - 1, rx = dx + plx * cx, ry = dy + ply * cx;
    let mx = cam.x | 0, my = cam.y | 0;
    const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry), stx = rx < 0 ? -1 : 1, sty = ry < 0 ? -1 : 1;
    let sdx = (rx < 0 ? cam.x - mx : mx + 1 - cam.x) * ddx, sdy = (ry < 0 ? cam.y - my : my + 1 - cam.y) * ddy;
    let side = 0, id = 0, d = 0, clip = 0, from = my * MW + mx;
    for (let k = 0; k < 96; k++) {
      const here = my * MW + mx, lowHere = tall[here] !== 2, pitHere = isPit(floor[here]);
      if (sdx < sdy) { d = sdx; sdx += ddx; mx += stx; side = 0; } else { d = sdy; sdy += ddy; my += sty; side = 1; }
      if (lowHere) clip = d; // the far edge of the last low ceiling the ray passed under: nothing beyond shows above it
      if (mx < 0 || my < 0 || mx >= MW || my >= MH) { id = 0; break; }
      const to = my * MW + mx, hit = side ? cam.x + d * rx : cam.y + d * ry, flip = side ? ry > 0 : rx < 0;
      id = wall[to]; from = here;
      if (id) {
        const open = dyn.doors?.get(to);
        if (open > 0) { doors.push([x, d, side, id, open, hit, here]); id = 0; continue; }
        if (d <= FAR) column(fb, sec, dyn, x, d, side, id, hit, here, flip, pitHere ? -PIT : 0, tall[to] || 1, hz, eye, P, clip, 0, true);
        break;
      }
      if (d > FAR) break;
      if (!lowHere && tall[to] !== 2) column(fb, sec, dyn, x, d, side, face, hit, here, flip, 1, 2, hz, eye, P, 0, 0); // the wall over a low opening
      if (pitHere && !isPit(floor[to])) column(fb, sec, dyn, x, d, side, face, hit, here, flip, -PIT, 0, hz, eye, P, 0, 0); // the far bank of a pit
    }
    z[x] = id ? d : FAR;
  }
  for (let y = 0; y < VH; y++) {
    const below = y > hz, dh = below ? y - hz : hz - y, row = y * W;
    if (dh === 0) continue;
    const d0 = ((below ? eye : 1 - eye) * P) / dh, d1 = ((below ? eye + PIT : 2 - eye) * P) / dh; // the near plane and the far one (the pit, the high ceiling)
    const b0 = -d0 * FALL - dim + (flash > 0 ? Math.max(0, flash - d0 * 1.7) : 0), b1 = -d1 * FALL - dim + (flash > 0 ? Math.max(0, flash - d1 * 1.7) : 0);
    const grid = below ? floor : ceil, far0 = d0 > FAR, far1 = d1 > FAR, skyRow = (((y * TS) / hz) & 63) * TS;
    if (far0) continue;
    let gx = cam.x + d0 * lx, gy = cam.y + d0 * ly; const sx = d0 * kx, sy = d0 * ky;
    for (let x = 0; x < W; x++, gx += sx, gy += sy) {
      if (y >= wy0[x] && y < wy1[x]) continue; // a wall stands here: nothing to cast
      let fx = gx, fy = gy, cx = fx | 0, cy = fy | 0, base = b0;
      if (fx < 0 || fy < 0 || cx >= MW || cy >= MH) continue;
      let cell = cy * MW + cx, id = grid[cell];
      if (below ? isPit(id) : tall[cell] === 2) { // through to the other plane
        fx = cam.x + d1 * (lx + kx * x); fy = cam.y + d1 * (ly + ky * x); cx = fx | 0; cy = fy | 0; base = b1;
        if (far1 || fx < 0 || fy < 0 || cx >= MW || cy >= MH) { if (!below) px[row + x] = lut[SKY + skyTex[skyRow + ((x + skyOff) & 63)]]; continue; }
        cell = cy * MW + cx; id = grid[cell];
        if (below ? !isPit(id) : tall[cell] !== 2) continue; // a face between the planes: the wall pass painted it
        if (!below && id === 0) { px[row + x] = lut[SKY + skyTex[skyRow + ((x + skyOff) & 63)]]; continue; } // open sky
      }
      if (id === 0) continue;
      let u = (fx * TS) & 63, v = (fy * TS) & 63, l = light[cell] + base + boost[lampOf[cell]];
      if (below && isPit(id)) { u = (u + drift) & 63; v = (v + (drift >> 1)) & 63; if (l < 9) l = 9; }
      l = (l + DITHER[(x & 1) | ((y & 1) << 1)]) | 0;
      px[row + x] = lut[(l < 0 ? 0 : l > 15 ? 15 : l) * 256 + TEX[id][v * TS + u]];
    }
  }
  for (const [x, d, side, id, open, hit, from] of doors) column(fb, sec, dyn, x, d, side, id, hit, from, false, open, 1, hz, eye, P, 0, open);
  return fb;
}

/** One textured strip of wall between heights `zb` and `zt` (the floor is 0, a low ceiling 1). `shift` slides the texture up with a door. */
function column(fb, sec, dyn, x, d, side, id, hit, from, flip, zb, zt, hz, eye, P, clip, shift, main = false) {
  const { W, px } = fb, lut = dyn.lut, tex = TEX[id];
  let u = ((hit - Math.floor(hit)) * TS) | 0; if (flip) u = 63 - u;
  const size = P / d, top = hz - (zt - eye) * size, bot = hz - (zb - eye) * size, one = hz - (1 - eye) * size; // `one`: where height 1 falls, the texture's top edge
  let y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH, Math.ceil(bot));
  if (clip > 0 && zt > 1) y0 = Math.max(y0, Math.ceil(hz - ((1 - eye) * P) / clip));
  if (main) { fb.wy0[x] = y0; fb.wy1[x] = y1; } // the wall that stops the ray: the floor and ceiling pass skips what it covers
  const near = dyn.flash > 0 ? Math.max(0, dyn.flash - d * 1.7) : 0;
  const l0 = sec.light[from] + (dyn.boost ?? NOBOOST)[sec.lampOf[from]] - d * FALL - (dyn.dim ?? 0) + near - (side ? 0 : 1.6) - (zb < 0 && zt <= 0 ? 2 : 0); // walls facing one way sit a step and a half darker; a pit's bank darker still
  const step = TS / size, off = shift * TS + 64 * 8;
  for (let y = y0; y < y1; y++) {
    const v = ((y - one) * step + off) & 63, l = (l0 + DITHER[(x & 1) | ((y & 1) << 1)]) | 0;
    px[y * W + x] = lut[(l < 0 ? 0 : l > 15 ? 15 : l) * 256 + tex[v * TS + u]];
  }
}

/**
 * Billboards, far to near. Each: { x, y, bmp: { w, h, px, ax, ay }, z (lift off the floor, map units), s (scale, 1 =
 * 64 pixels to the unit), glow (drawn at full light), flip, tint (a light level added) }. Clipped per column against fb.z.
 */
export function renderSprites(fb, sec, cam, dyn, list) {
  const { W, px, z } = fb, lut = dyn.lut, P = W / 2 / TAN, hz = Math.round(VH / 2 + (cam.pitch ?? 0)), eye = cam.eye ?? 0.5;
  const dx = Math.cos(cam.a), dy = Math.sin(cam.a);
  const vis = [];
  for (const s of list) { const ox = s.x - cam.x, oy = s.y - cam.y, depth = ox * dx + oy * dy; if (depth > 0.12 && depth < FAR) vis.push([depth, (-ox * dy + oy * dx) / TAN, s]); }
  vis.sort((a, b) => b[0] - a[0]);
  for (const [depth, lat, s] of vis) {
    const b = s.bmp, k = (P / depth / TS) * (s.s ?? 1), sx = W / 2 + (lat / depth) * (W / 2), foot = hz + (eye - (s.z ?? 0)) * (P / depth);
    const x0 = Math.round(sx - b.ax * k), y0 = Math.round(foot - b.ay * k), wpx = Math.round(b.w * k), hpx = Math.round(b.h * k);
    if (wpx < 1 || hpx < 1 || x0 >= W || x0 + wpx <= 0) continue;
    const cell = (s.y | 0) * sec.w + (s.x | 0), near = dyn.flash > 0 ? Math.max(0, dyn.flash - depth * 1.7) : 0;
    let l = s.glow ? 15 : Math.round((sec.light[cell] ?? 8) + (dyn.boost ?? NOBOOST)[sec.lampOf[cell] ?? 0] - depth * FALL - (dyn.dim ?? 0) + near + (s.tint ?? 0));
    if (s.min && l < s.min) l = s.min; // a creature is never lost in the dark: the old games lit their monsters
    l = (l < 0 ? 0 : l > 15 ? 15 : l) * 256;
    for (let i = Math.max(0, -x0); i < wpx && x0 + i < W; i++) {
      const X = x0 + i; if (z[X] <= depth) continue;
      let u = Math.floor(i / k); if (u >= b.w) u = b.w - 1; if (s.flip) u = b.w - 1 - u;
      for (let j = Math.max(0, -y0); j < hpx && y0 + j < VH; j++) {
        let v = Math.floor(j / k); if (v >= b.h) v = b.h - 1;
        const c = b.px[v * b.w + u]; if (c) px[(y0 + j) * W + X] = lut[(s.white ? 15 * 256 : l) + (s.white ? ix(R.bone, 7) : c)];
      }
    }
  }
}

// ---------- screen space ----------
/** A bitmap at (x, y) in frame pixels, unscaled, at light `l`; `maxY` clips it (the weapon stops at the bar). */
export function blit(fb, lut, b, x, y, l = 15, maxY = H) {
  const { W, px } = fb; x = Math.round(x); y = Math.round(y);
  for (let j = Math.max(0, -y); j < b.h && y + j < maxY; j++) for (let i = Math.max(0, -x); i < b.w && x + i < W; i++) { const c = b.px[j * b.w + i]; if (c) px[(y + j) * W + x + i] = lut[l * 256 + c]; }
}
export function rect(fb, lut, x, y, w, h, c, l = 15) { const { W, px } = fb, col = lut[l * 256 + c]; for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) px[j * W + i] = col; }
/** Small caps, 3x5, one pixel apart. Returns the x after the last glyph. */
export function text(fb, lut, x, y, str, c, l = 15) {
  for (const ch of String(str).toUpperCase()) { const g = glyph3(ch); for (let k = 0; k < 15; k++) if (g[k] === '1') rect(fb, lut, x + (k % 3), y + ((k / 3) | 0), 1, 1, c, l); x += 4; }
  return x;
}
/** The big numerals: 5x7 doubled, a lit edge up and left and a dark one down and right, so they stand off the plate. */
export function digits(fb, lut, x, y, str, ramp = R.red) {
  for (const ch of String(str)) {
    const g = glyph5(ch);
    for (let k = 0; k < 35; k++) if (g[k] === '1') { const gx = x + (k % 5) * 2, gy = y + ((k / 5) | 0) * 2; rect(fb, lut, gx + 1, gy + 1, 2, 2, ix(ramp, 0)); }
    for (let k = 0; k < 35; k++) if (g[k] === '1') { const gx = x + (k % 5) * 2, gy = y + ((k / 5) | 0) * 2, up = k < 5 || g[k - 5] !== '1', lf = k % 5 === 0 || g[k - 1] !== '1'; rect(fb, lut, gx, gy, 2, 2, ix(ramp, 5)); if (up) rect(fb, lut, gx, gy, 2, 1, ix(ramp, 7)); if (lf) rect(fb, lut, gx, gy, 1, 2, ix(ramp, 6)); }
    x += 12;
  }
  return x;
}
/** A full-frame colour wash over the view: pain, a pickup. `a` in 0..1 picks how many pixels of a 2x2 pattern take it. */
export function wash(fb, lut, c, a) {
  const { W, px } = fb, col = lut[15 * 256 + c], n = Math.min(3, Math.round(a * 4));
  if (n <= 0) return;
  for (let y = 0; y < VH; y++) for (let x = 0; x < W; x++) if (DITHER[(x & 1) | ((y & 1) << 1)] * 4 < n) px[y * W + x] = col;
}
/** A tile of a texture as a panel in the frame (the bar's plates, the end card's backdrop). */
export function panel(fb, lut, id, x, y, w, h, l = 9) { const { W, px } = fb, tex = TEX[id]; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (y + j >= 0 && y + j < H && x + i >= 0 && x + i < W) px[(y + j) * W + x + i] = lut[l * 256 + tex[((j) & 63) * TS + ((i) & 63)]]; }
