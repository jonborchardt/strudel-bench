// wallpaper: a repeating ornamental wall that turns out to be alive. A half-drop ogee lattice of vines with a motif in
// every lens (a tulip, a pine cone or a rosette), in a vintage palette, always pulling back toward its own order while
// the music pushes it out of it. Every displacement is a damped spring with zero as rest, so the wall restores itself.
// The bass and the kick breathe it: the whole wall swells, and a slow wave rolls across the motifs. A snare is
// mechanical: a row slides sideways and snaps back, a few motifs flip or turn. Hats and voices are fine detail: the
// lines shimmer and a flower opens a little. A pitched line grows the motif its pitch lands on a new curl, tip by tip,
// and the curls stay: the wall keeps a history of the melody. The pad thickens the lines and warms the palette.
// Mutation is the long story: energy builds pressure, a new motif kind appears in one lens and spreads to neighbours
// on the hits while the song is loud (proliferation, symmetry breaking); when it is quiet, stray lenses fall back,
// and a kind that has taken most of the wall becomes the new reference (reorganisation: a new order, not the old).
// A section boundary mutates the reference genome (petals, stamens, curl, the lattice's pointedness) and moves the
// palette. A riser sharpens the shimmer, a dropout stills and dims the wall.
// Deterministic: randomness only from the state's own seeded generator (kit.mjs); draw's flicker is a hash of time.
import { clamp, lerp, decay, ease, hsla, seed, rand, DEFAULT_SLOT } from './kit.mjs';

const TAU = Math.PI * 2;
const NC = 24, NR = 6; // the state's cells; the drawn wall wraps over them
const KINDS = 3; // 0 tulip, 1 pine cone, 2 rosette
// vintage palettes from the references: ground, lattice, petal, inner petal, bud, leaf, fine line (h, s, l)
const PALETTES = [
  { bg: [174, 38, 20], lat: [168, 36, 38], p1: [14, 52, 52], p2: [30, 80, 76], bud: [192, 58, 63], leaf: [18, 30, 42], line: [38, 70, 90] }, // teal, rust, sky
  { bg: [357, 52, 28], lat: [120, 12, 74], p1: [41, 78, 58], p2: [22, 70, 72], bud: [184, 24, 72], leaf: [130, 12, 66], line: [0, 0, 96] }, // maroon, mustard, sage
  { bg: [40, 45, 90], lat: [36, 45, 60], p1: [180, 22, 56], p2: [168, 22, 72], bud: [205, 38, 58], leaf: [95, 20, 45], line: [28, 30, 40] }, // cream, gold, blue
  { bg: [32, 30, 24], lat: [42, 50, 70], p1: [330, 28, 42], p2: [34, 48, 58], bud: [72, 30, 55], leaf: [68, 35, 34], line: [44, 60, 86] }, // umber, plum, olive
];
const KEYS = Object.keys(PALETTES[0]);
const GENOME = () => ({ layers: 2, stamens: 3, curl: 0.4, spread: 1, cone: 6, petals: 8, point: 1.5 });

const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
const spring = (x, v, k, c, dt, to = 0) => { v += (-k * (x - to) - c * v) * dt; return [x + v * dt, v]; };
const mixHue = (a, b, t) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;
const idx = (c, r) => ((((r % NR) + NR) % NR) * NC) + (((c % NC) + NC) % NC);

export default {
  name: 'wallpaper',

  init(score, rng) {
    const s = {
      cps: score.cps, t: 0,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      cells: [], rows: Array.from({ length: NR }, () => ({ x: 0, v: 0 })),
      breath: { x: 0, v: 0 }, swell: 0, wave: 0, shimmer: 0, bend: 0, bendPhase: 0, thick: 0,
      energy: 0.5, dark: 0, riser: 0, pressure: 0, calm: 0,
      ref: 0, gene: GENOME(), geneTo: GENOME(),
      pal: 0, col: null, warm: 0, ghost: 0, zoom: 1, zoomTo: 1, // the camera: 1 close to the wall, smaller further back
    };
    seed(s, rng);
    s.pal = Math.floor(rng() * PALETTES.length); s.ref = Math.floor(rng() * KINDS);
    s.col = JSON.parse(JSON.stringify(PALETTES[s.pal]));
    s.ghost = rng() * TAU;
    for (let i = 0; i < NC * NR; i++) s.cells.push({ x: 0, vx: 0, y: 0, vy: 0, r: 0, vr: 0, sx: 1, vsx: 0, flip: 1, hold: 0, sc: 0, vsc: 0, kind: s.ref, from: s.ref, f: 1, grown: 0, bloom: 0 });
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 1.5, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    const still = 1 - 0.85 * s.dark, E = s.energy;
    if (clock.boundary) { // a boundary moves the camera too: mostly a step back from the wall, sometimes back in
      mutateGenome(s, true);
      s.zoomTo = rand(s) < 0.3 ? Math.min(1.05, s.zoomTo + 0.25) : Math.max(0.6, s.zoomTo - 0.1);
    }
    s.zoom = ease(s.zoom, s.zoomTo, 0.08, dt);
    // the slow layers: genome and palette ease toward their targets, the wave rolls, the levels decay
    for (const k of Object.keys(s.gene)) s.gene[k] = ease(s.gene[k], s.geneTo[k], 0.35, dt);
    const P = PALETTES[s.pal];
    for (const k of KEYS) { const c = s.col[k], p = P[k], t = 1 - Math.exp(-0.25 * dt); c[0] = mixHue(c[0], p[0] + 14 * s.warm, t); c[1] = lerp(c[1], p[1], t); c[2] = lerp(c[2], p[2], t); }
    s.warm = decay(s.warm, 0.15, dt); s.thick = decay(s.thick, 0.4, dt);
    s.swell = decay(s.swell, 0.7, dt); s.wave += dt * TAU * s.cps * 0.5 * still;
    s.shimmer = decay(s.shimmer, 5, dt); s.shimmer = Math.max(s.shimmer, 0.6 * s.riser);
    s.bend = decay(s.bend, 0.6, dt); s.bendPhase += dt * (0.4 + s.bend) * still;
    s.ghost += dt * 0.02 * still;
    [s.breath.x, s.breath.v] = spring(s.breath.x, s.breath.v, 18, 4.5, dt);
    for (const r of s.rows) [r.x, r.v] = spring(r.x, r.v, 26, 5, dt);
    for (const c of s.cells) {
      [c.x, c.vx] = spring(c.x, c.vx, 30, 5, dt); [c.y, c.vy] = spring(c.y, c.vy, 30, 5, dt);
      [c.r, c.vr] = spring(c.r, c.vr, 22, 4, dt); [c.sc, c.vsc] = spring(c.sc, c.vsc, 35, 6, dt);
      if (c.hold > 0 && (c.hold -= dt) <= 0) c.flip = 1; // the pull back to order: a flipped motif turns back
      [c.sx, c.vsx] = spring(c.sx, c.vsx, 40, 9, dt, c.flip);
      c.bloom = decay(c.bloom, 1.2, dt);
      c.grown = Math.max(0, c.grown - dt * 0.004); // the curls stay, almost
      if (c.f < 1) c.f = Math.min(1, c.f + dt * 0.8);
    }
    // mutation: loud passages build pressure and seed a new kind; quiet ones fold strays back or crown a new order
    s.pressure += dt * Math.max(0, E - 0.45) * 0.12;
    s.calm = E < 0.45 ? s.calm + dt : 0;
    if (s.pressure > 1) { s.pressure = 0; seedMutant(s); }
    if (s.calm > 4 && rand(s) < dt * 0.6) {
      const counts = Array(KINDS).fill(0); for (const c of s.cells) counts[c.kind]++;
      const top = counts.indexOf(Math.max(...counts));
      if (top !== s.ref && counts[top] > NC * NR * 0.55) { s.ref = top; mutateGenome(s, false); }
      else { const c = s.cells[Math.floor(rand(s) * s.cells.length)]; if (c.kind !== s.ref) turn(c, s.ref); }
    }
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5) * still;
      if (e.role === 'pulse' || slot === 'ground' || (e.note !== null && e.note < 52 && slot !== 'line' && slot !== 'field')) {
        s.breath.v += (e.role === 'pulse' ? 0.9 : 0.5) * g; s.swell = Math.min(1, s.swell + 0.45 * g);
      } else if (e.role === 'impact') {
        const row = s.rows[Math.floor(rand(s) * NR)]; row.v += (rand(s) < 0.5 ? -1 : 1) * (2 + 3 * E) * g;
        const n = 1 + Math.floor(g * (1 + 5 * E));
        for (let k = 0; k < n; k++) {
          const c = s.cells[Math.floor(rand(s) * s.cells.length)];
          if (rand(s) < 0.5) { c.flip = -c.flip; c.hold = lerp(0.5, 2.5, rand(s)); } else c.vr += (rand(s) < 0.5 ? -1 : 1) * (6 + 6 * E) * g;
        }
        if (E > 0.5) spread(s, 2);
        s.pressure += 0.03 * g;
      } else if (e.role === 'grain' || (slot === 'grain' && e.note === null)) {
        s.shimmer = Math.min(1, s.shimmer + 0.25 * g);
        const c = s.cells[Math.floor(rand(s) * s.cells.length)]; c.bloom = Math.min(1, c.bloom + 0.5 * g); c.vr += (rand(s) - 0.5) * 2 * g;
      } else if (slot === 'field') {
        s.thick = Math.min(1, s.thick + 0.3 * g); s.warm = clamp(s.warm + (e.cutoff !== null && e.cutoff > 1500 ? 0.1 : -0.05), -1, 1);
      } else if (slot === 'transition') {
        if (e.dur >= 1) seedMutant(s);
      } else if (e.note !== null) { // a line: the cell its pitch lands on blooms and grows a curl; the lattice bends
        const c = s.cells[idx(Math.round(((e.note % 12) / 12) * NC + Math.floor(e.note / 12) * 5), Math.floor(e.note / 7))];
        c.bloom = 1; c.vsc += 2 * g; c.grown = Math.min(6, c.grown + 0.35 * g);
        s.bend = Math.min(1, s.bend + 0.2 * g);
      }
    }
  },

  draw(s, ctx, w, h) {
    const C = s.col, E = s.energy, G = s.gene;
    const ch = (h / 2.2) * s.zoom, cw = ch * 0.68, u = ch * 0.72;
    const B = 1 + 0.05 * s.breath.x; // the whole wall breathes about the centre
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = hsla(...C.bg); ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2); ctx.scale(B, B); ctx.translate(-w / 2, -h / 2);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const rowAt = (y) => { const f = y / ch - 0.5, r0 = Math.floor(f), t = f - r0, a = s.rows[((r0 % NR) + NR) % NR].x, b = s.rows[(((r0 + 1) % NR) + NR) % NR].x; return lerp(a, b, (1 - Math.cos(t * Math.PI)) / 2) * cw * 0.25; };
    const bendAt = (y) => Math.sin(y / ch * 2.1 + s.bendPhase) * s.bend * cw * 0.08;
    const wav = (y) => { const v = Math.sin((Math.PI * y) / ch); return Math.sign(v) * Math.abs(v) ** G.point; };
    // the ghost layer: a larger, fainter lattice behind, drifting the other way
    ghost(s, ctx, w, h, ch * 1.7, C);
    // the lattice: two families of vines crossing into lenses, a half-drop ogee
    const k0 = -2, k1 = Math.ceil(w / cw) + 2, dy = Math.max(2, ch / 24);
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass ? hsla(...C.line, 0.55) : hsla(...C.lat);
      ctx.lineWidth = pass ? Math.max(1, u * 0.004) : u * (0.03 + 0.02 * s.thick);
      for (let k = k0; k <= k1; k++) for (const sg of [1, -1]) {
        ctx.beginPath();
        for (let y = -ch; y <= h + ch; y += dy) {
          const x = k * cw + sg * (cw / 2) * wav(y) + rowAt(y) + bendAt(y) + (pass ? sg * u * 0.006 : 0);
          y === -ch ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    // filigree: beads where the vines touch, more of them as the wall gets busy
    const cx = lerp(0.2, 1, E) + s.shimmer * 0.5;
    if (cx > 0.4) {
      ctx.fillStyle = hsla(...C.line, 0.8);
      for (let k = k0; k <= k1; k++) for (let n = -1; n <= Math.ceil(h / ch) + 1; n++) {
        const y = (n + 0.5) * ch, x = k * cw + cw / 2 + rowAt(y) + bendAt(y);
        const j = s.shimmer * (hash(k, n + Math.floor(s.t * 20)) - 0.5) * u * 0.02;
        ctx.beginPath(); ctx.arc(x + j, y, u * 0.018 * cx, 0, TAU); ctx.fill();
      }
    }
    // the motifs: one per lens, centred on a column or between two
    const disorder = s.cells.reduce((n, c) => n + (c.kind !== s.ref), 0) / s.cells.length;
    for (let c = 2 * k0; c <= 2 * k1; c++) for (let r = -1; r <= Math.ceil(h / ch) + 1; r++) {
      const odd = ((c % 2) + 2) % 2, y0 = (r + (odd ? 0 : 0.5)) * ch, x0 = (c / 2) * cw;
      const cell = s.cells[idx(c, r)], i = idx(c, r);
      const wave = s.swell * 0.09 * Math.sin(s.wave - (x0 + y0) / ch * 0.9);
      const drift = (disorder * 0.35 + 0.04 * E) * Math.sin(s.t * 0.6 + i * 1.7);
      ctx.save();
      ctx.translate(x0 + rowAt(y0) + bendAt(y0) + cell.x * cw, y0 + cell.y * ch);
      ctx.rotate(cell.r + drift);
      const sc = (1 + wave + cell.sc * 0.15) * u, px = u * 1.25;
      ctx.scale(sc * cell.sx, sc);
      if (cell.f < 1) motif(ctx, s, cell.from, cell, i, 1 - cell.f, 1 - 0.4 * cell.f, px);
      motif(ctx, s, cell.kind, cell, i, cell.f, lerp(0.4, 1, cell.f), px);
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.55 * s.dark})`; ctx.fillRect(0, 0, w, h); }
  },
};

function turn(c, kind) { if (c.kind === kind) return; c.from = c.kind; c.kind = kind; c.f = 0; c.vsc += 3; }
function seedMutant(s) { const c = s.cells[Math.floor(rand(s) * s.cells.length)]; turn(c, (s.ref + 1 + Math.floor(rand(s) * (KINDS - 1))) % KINDS); }
/** On a hit while loud: a few stray lenses pass their kind to a neighbour. */
function spread(s, n) {
  const strays = []; s.cells.forEach((c, i) => { if (c.kind !== s.ref) strays.push(i); });
  for (let k = 0; k < n && strays.length; k++) {
    const i = strays[Math.floor(rand(s) * strays.length)], col = i % NC, row = Math.floor(i / NC);
    const [dc, dr] = [[1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0]][Math.floor(rand(s) * 8)];
    turn(s.cells[idx(col + dc, row + dr)], s.cells[i].kind);
  }
}
/** The reference pattern changes one gene (two at a boundary) and, at a boundary, the palette moves on. */
function mutateGenome(s, boundary) {
  const g = s.geneTo, picks = [
    () => { g.layers = 1 + Math.floor(rand(s) * 3); }, () => { g.stamens = 1 + Math.floor(rand(s) * 5); },
    () => { g.curl = rand(s); }, () => { g.spread = lerp(0.8, 1.25, rand(s)); },
    () => { g.cone = 4 + Math.floor(rand(s) * 4); }, () => { g.petals = 5 + Math.floor(rand(s) * 6); },
    () => { g.point = lerp(1.1, 2.2, rand(s)); },
  ];
  for (let k = 0; k < (boundary ? 2 : 1); k++) picks[Math.floor(rand(s) * picks.length)]();
  if (boundary && rand(s) < 0.5) s.pal = (s.pal + 1 + Math.floor(rand(s) * (PALETTES.length - 1))) % PALETTES.length;
}

function ghost(s, ctx, w, h, ch, C) {
  const cw = ch * 0.68, off = Math.sin(s.ghost) * cw, br = 1 - 0.03 * s.breath.x;
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(br, br); ctx.translate(-w / 2 + off, -h / 2 - s.ghost * ch * 0.3 % ch);
  ctx.strokeStyle = hsla(C.bg[0], C.bg[1], C.bg[2] + (C.bg[2] > 50 ? -8 : 8), 0.8); ctx.lineWidth = ch * 0.012;
  for (let k = -3; k <= Math.ceil(w / cw) + 3; k++) for (const sg of [1, -1]) {
    ctx.beginPath();
    for (let y = -2 * ch; y <= h + 2 * ch; y += ch / 14) { const x = k * cw + sg * (cw / 2) * Math.sin((Math.PI * y) / ch); y === -2 * ch ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let k = -3; k <= Math.ceil(w / cw) + 3; k++) for (let n = -2; n <= Math.ceil(h / ch) + 2; n++) { ctx.beginPath(); ctx.arc(k * cw, (n + 0.5) * ch, ch * 0.12, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// --- the motifs, in lens units: height 1, width .85, centred ---
function motif(ctx, s, kind, cell, i, alpha, scale, px) {
  if (alpha < 0.02) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.scale(scale, scale);
  curls(ctx, s, cell);
  const img = cell.bloom < 0.05 && s.shimmer < 0.15 ? sprite(s, kind, px) : null;
  if (img) ctx.drawImage(img, -0.5, -0.5, 1, 1); else vector(ctx, s, kind, cell, i);
  ctx.restore();
}
const vector = (ctx, s, kind, cell, i) => kind === 0 ? tulip(ctx, s, cell) : kind === 1 ? cone(ctx, s, cell, i) : rosette(ctx, s, cell, i);
// a motif at rest is the same picture in every lens: drawn once per kind, genome and palette (quantised) and size,
// then stamped. A pure function of its key, so it is a cache outside the state, not memory of the world.
const SPRITES = new Map(), REST = { bloom: 0 };
function sprite(s, kind, px) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const S = Math.max(8, Math.ceil(px * 1.15 / 16) * 16), q = (x, n) => Math.round(x * n);
  const key = [kind, S, ...Object.values(s.gene).map((x) => q(x, 20)), ...KEYS.flatMap((k) => s.col[k].map((x) => q(x, 0.5)))].join(',');
  let img = SPRITES.get(key);
  if (!img) {
    if (SPRITES.size > 48) SPRITES.clear();
    img = new OffscreenCanvas(S, S); const c = img.getContext('2d');
    c.setTransform(S, 0, 0, S, S / 2, S / 2); c.lineCap = 'round'; c.lineJoin = 'round';
    vector(c, { ...s, shimmer: 0 }, kind, REST, 0);
    SPRITES.set(key, img);
  }
  return img;
}
const fill = (ctx, c, a = 1) => { ctx.fillStyle = hsla(...c, a); ctx.fill(); };
const stroke = (ctx, c, wd, a = 1) => { ctx.strokeStyle = hsla(...c, a); ctx.lineWidth = wd; ctx.stroke(); };
function petal(ctx, side, len, wid, curl, by = 0) {
  ctx.beginPath(); ctx.moveTo(0, by);
  ctx.bezierCurveTo(side * wid * 1.25, by - len * 0.05, side * wid * 1.15, by - len * 0.7, side * wid * (1 + curl * 0.35), by - len);
  ctx.bezierCurveTo(side * wid * 0.45, by - len * 0.8, side * wid * 0.2, by - len * 0.35, 0, by);
}
function leaf(ctx, side, x, y, len, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(side * ang); ctx.scale(side, 1);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.35, len, -len * 0.05); ctx.quadraticCurveTo(len * 0.45, len * 0.12, 0, 0);
  ctx.restore();
}
function shim(s, i, k) { return s.shimmer * (hash(i * 7 + k, Math.floor(s.t * 24)) - 0.5) * 0.02; }

function tulip(ctx, s, cell) {
  const C = s.col, G = s.gene, open = G.spread * (1 + 0.25 * cell.bloom), lw = 0.012;
  ctx.beginPath(); ctx.moveTo(0, 0.38); ctx.quadraticCurveTo(0.02, 0.26, 0, 0.12); stroke(ctx, C.lat, 0.03);
  for (const sd of [1, -1]) { leaf(ctx, sd, 0, 0.26, 0.26, 0.55 + 0.2 * G.curl); fill(ctx, C.lat); stroke(ctx, C.line, lw * 0.6, 0.7); }
  const layers = Math.round(G.layers);
  for (let L = layers; L >= 1; L--) {
    const f = L / layers, col = L === layers ? C.p1 : L % 2 ? C.p2 : C.p1;
    for (const sd of [1, -1]) { petal(ctx, sd, 0.32 * (0.7 + 0.3 * f), 0.26 * open * f, G.curl, 0.12); fill(ctx, col); stroke(ctx, C.bg, lw); }
  }
  ctx.beginPath(); ctx.moveTo(0, 0.12); ctx.bezierCurveTo(0.1, 0.05, 0.08, -0.12, 0, -0.17); ctx.bezierCurveTo(-0.08, -0.12, -0.1, 0.05, 0, 0.12); fill(ctx, C.bud);
  const n = Math.round(G.stamens), len = 0.1 + 0.05 * cell.bloom;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (n > 1 ? (k / (n - 1) - 0.5) * 1.2 * open : 0), x = Math.cos(a) * len, y = -0.15 + Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(0, -0.15); ctx.lineTo(x, y); stroke(ctx, C.bud, 0.014);
    ctx.beginPath(); ctx.arc(x, y, 0.024, 0, TAU); fill(ctx, C.bud);
  }
  if (s.energy > 0.55 || s.shimmer > 0.2) { ctx.beginPath(); ctx.moveTo(0, 0.08); ctx.lineTo(0, -0.1); stroke(ctx, C.line, 0.006, 0.6); }
}

function cone(ctx, s, cell, i) {
  const C = s.col, G = s.gene, rows = Math.round(G.cone), b = 1 + 0.2 * cell.bloom;
  ctx.beginPath(); ctx.moveTo(0, 0.46); ctx.quadraticCurveTo(-0.04, 0.32, 0, 0.18); stroke(ctx, C.leaf, 0.025);
  for (const sd of [1, -1]) { // acanthus: a serrated leaf curling up
    ctx.save(); ctx.translate(0, 0.32); ctx.scale(sd, 1); ctx.beginPath(); ctx.moveTo(0, 0);
    for (let k = 0; k <= 10; k++) { const t = k / 10, x = 0.3 * t, y = -0.28 * t * t + (k % 2 ? 0.025 : 0) + G.curl * 0.08 * t; ctx.lineTo(x, y - 0.02); }
    ctx.quadraticCurveTo(0.15, 0.06, 0, 0); ctx.restore(); fill(ctx, C.p2, 0.9); stroke(ctx, C.leaf, 0.008);
  }
  ctx.beginPath(); ctx.ellipse(0, -0.04, 0.15 * b, 0.22 * b, 0, 0, TAU); fill(ctx, C.p1);
  for (let r = 0; r < rows; r++) {
    const y = -0.22 * b + (r + 0.6) * (0.42 * b / rows), half = Math.sqrt(Math.max(0, 1 - ((y + 0.04) / (0.22 * b)) ** 2)) * 0.15 * b;
    const n = Math.max(1, Math.round(half / 0.045)), rr = Math.min(0.045, half / n + 0.01);
    for (let k = 0; k < n; k++) {
      const x = -half + (k + 0.5 + (r % 2 ? 0.25 : -0.25)) * (2 * half / n) + shim(s, i, r * 9 + k);
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI); fill(ctx, C.bud); stroke(ctx, C.p1, 0.006);
    }
  }
}

function rosette(ctx, s, cell, i) {
  const C = s.col, G = s.gene, n = Math.round(G.petals), R = 0.3 * (1 + 0.15 * cell.bloom), lw = 0.01;
  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < n; k++) {
    ctx.save(); ctx.rotate((k + pass * 0.5) / n * TAU);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.07, -R * 0.5, 0, -R * (pass ? 0.7 : 1)); ctx.quadraticCurveTo(-0.07, -R * 0.5, 0, 0);
    fill(ctx, pass ? C.p2 : C.p1); stroke(ctx, C.bg, lw);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 0.075, 0, TAU); fill(ctx, C.bud); stroke(ctx, C.line, lw, 0.8);
  ctx.beginPath(); ctx.arc(0, 0, R + 0.04, 0, TAU); stroke(ctx, C.line, 0.006, 0.5);
  for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * TAU, rr = R + 0.04 + shim(s, i, k); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 0.018, 0, TAU); fill(ctx, C.line, 0.85); }
}

/** The motif's memory: one curl per grown step, alternating sides up the stem, the last one drawn as far as it has grown. */
function curls(ctx, s, cell) {
  if (cell.grown < 0.05) return;
  const C = s.col, n = Math.ceil(cell.grown);
  for (let k = 0; k < n; k++) {
    const part = Math.min(1, cell.grown - k), sd = k % 2 ? -1 : 1, y0 = 0.4 - Math.floor(k / 2) * 0.13, steps = Math.max(2, Math.floor(30 * part));
    ctx.beginPath(); ctx.moveTo(0, y0);
    let x = 0, y = y0;
    for (let j = 1; j <= steps; j++) {
      const t = j / 30, a = -0.3 + t * 9, r = 0.22 * (1 - t * 0.8);
      x = sd * (0.12 + Math.cos(a) * r * 0.6) * Math.min(1, t * 4); y = y0 - 0.1 * t - Math.sin(a) * r * 0.4 * Math.min(1, t * 4);
      ctx.lineTo(x, y);
    }
    stroke(ctx, C.leaf, 0.016);
    ctx.beginPath(); ctx.arc(x, y, 0.018 * part, 0, TAU); fill(ctx, C.p1);
  }
}
