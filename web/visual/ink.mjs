// ink: the song paints one sheet, and the last frame is the painting. Time runs from the centre outward to both
// edges, the painting mirrored about the middle: each section is a band as wide as its share of the half-sheet, and
// inside it a moment is an x. Drums are marks (a kick a heavy dab low on
// the sheet, an impact a splatter with a streak, hats and percussion specks up high), the bass lays broad strokes
// along the bottom the length of its notes, each line part is a continuous calligraphic stroke (pitch is height,
// pressure is velocity, a rest longer than a bar lifts the brush), the pad bleeds a wash of pigment into the band.
// A section's role is the pressure (a climax presses harder and denser, a release lets the marks soften and settle);
// a boundary is a composition change, a fold line and a shift of ink, never a cut; a riser drags every mark toward
// the edge it is rushing to; a dropout leaves the band bare. Marks are wet for a moment (they bleed as they land) and
// then dry into the sheet. And the sheet is alive while the song plays: a kick ripples the paper (the marks near it
// heave), an impact jolts it, a boundary's fold creases the sheet so what was painted before it shifts a little, a
// climax buckles everything painted before it, a drip keeps running, and every dry mark goes on bleeding, slowly,
// into the paper, so the painting softens as it ages. The unpainted future is not bare: the paper is damp there,
// and the pigment to come is already moving in it, soft blooms drifting toward the wet edge, wide wisps of wash
// flowing across each coming band, fine dust, all more and larger where the coming section is loud and in its
// hue; and the brush glows where each line part last touched. Nothing is ever undone: the deformation lives in state and is applied at draw time to what was there
// when it happened, so draw repaints the whole sheet every frame from cheap primitives (a dry dab is a flat disc).
// Deterministic: randomness only from the state's own seeded generator (kit.mjs); draw never touches the state.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const MARGIN = 0.04, TOP = 0.08, BOTTOM = 0.94;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
// the pressure per section role: size and alpha of every mark, how long a mark stays wet (a release settles softly)
const PRESS = { establish: { size: 0.8, alpha: 0.75, bleed: 1.1 }, develop: { size: 1, alpha: 1, bleed: 1 }, climax: { size: 1.45, alpha: 1.3, bleed: 0.8 }, release: { size: 0.9, alpha: 0.7, bleed: 1.6 }, none: { size: 1, alpha: 1, bleed: 1 } };
const FALLBACK_BARS = 16; // a pattern with no sections paints this many cycles per sheet
const BUCKLE_MAX = 0.05; // the buckles together never move a mark more than this (in height)
const BLOOM = 0.11; // the future's grid of pigment blooms, a cell in height units

export default {
  name: 'ink',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const light = p.luminance >= 0.5; // light paper takes dark inks; a dark sheet takes luminous ones
    const s = {
      pal, size: { ...size }, light,
      paper: light ? [pal.hue + 20, 14, 94] : [pal.hue, 25, 7], // a warm off-white, or a dark sheet
      ink: light ? lerp(26, 40, p.luminance) : lerp(60, 72, p.luminance), // the inks' lightness
      sat: pal.sat, grain: lerp(0, 1, p.jitter), spread: lerp(0.6, 1.4, p.spread), weight: lerp(0.7, 1.5, p.mass), bleed: lerp(0.6, 1.8, p.persistence), motion: lerp(0.6, 1.4, p.motion),
      cps: score.cps, total: score.total,
      bands: score.sections.map((x) => ({ x0: 0.5 + ((0.5 - MARGIN) * x.at) / score.total, x1: 0.5 + ((0.5 - MARGIN) * x.until) / score.total, at: x.at, until: x.until, role: x.role ?? 'none', energy: x.energy ?? 0.5 })), // laid out from the centre to the right edge; draw mirrors it to the left
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, sheet: 0, lastCycle: null, marks: [], pens: {}, // pens: line part -> { x, y, cycle, hot } where its brush last touched
      waves: [], folds: [], buckles: [], // the sheet alive: ripples from hits { x, amp, k, life, speed, age }; creases { x, at, amp, ampTo }; a climax's buckle { amp, ampTo, k, phase, since }
      press: { ...PRESS.none }, hueShift: 0, riser: 0, dark: 0, section: null, washAt: -1, x: 0.5, energy: 0.5,
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    // a new sheet when the song starts over (the cycle jumps back); a boundary folds the sheet and shifts the ink
    if (s.lastCycle !== null && clock.cycle < s.lastCycle - 1) { s.sheet++; s.marks = []; s.pens = {}; s.washAt = -1; s.waves = []; s.folds = []; s.buckles = []; }
    s.lastCycle = clock.cycle;
    const band = clock.index >= 0 ? s.bands[clock.index] : null;
    const role = band?.role ?? 'none', want = PRESS[role] ?? PRESS.none;
    for (const k of Object.keys(want)) s.press[k] = ease(s.press[k], want[k], 1.5, dt);
    s.energy = ease(s.energy, clock.energy, 2, dt);
    if (clock.boundary) {
      s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section;
      if (band && clock.index > 0) { // the first section's edge is the sheet's
        s.marks.push({ kind: 'seg', x: band.x0, y: TOP, x2: band.x0, y2: BOTTOM, w: 0.0012, hue: s.pal.hue + s.hueShift, light: s.ink, alpha: 0.35, born: s.t, at: clock.cycle, bleed: 0.6, dry: false });
        s.folds.push({ x: band.x0, at: clock.cycle, amp: 0, ampTo: (rand(s) < 0.5 ? -1 : 1) * (0.006 + 0.014 * rand(s)) });
      }
      if (role === 'climax') { const left = BUCKLE_MAX - s.buckles.reduce((n, b) => n + b.ampTo, 0); if (left > 0.004) s.buckles.push({ amp: 0, ampTo: Math.min(left, 0.015 + 0.03 * clock.energy), k: 1 + rand(s) * 1.5, phase: rand(s) * TAU, since: clock.cycle }); }
    }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 4, dt);
    for (const f of s.folds) f.amp = ease(f.amp, f.ampTo, 1.5, dt); // a crease sets over a second
    for (const b of s.buckles) b.amp = ease(b.amp, b.ampTo, 0.35, dt); // a buckle grows over a few bars
    for (const wv of s.waves) wv.age += dt; s.waves = s.waves.filter((wv) => wv.age < wv.life);
    for (const pen of Object.values(s.pens)) pen.hot = decay(pen.hot ?? 0, 2.5, dt);
    // where on the sheet this moment is
    const x = band ? lerp(band.x0, band.x1, (clock.cycle - band.at) / (band.until - band.at)) : 0.5 + ((clock.cycle % FALLBACK_BARS) / FALLBACK_BARS) * (0.5 - MARGIN);
    s.x = x;
    const bandW = band ? band.x1 - band.x0 : 0.5 - MARGIN, perCycle = band ? bandW / (band.until - band.at) : (0.5 - MARGIN) / FALLBACK_BARS;
    const hue = s.pal.hue + s.hueShift, drag = s.riser * 0.05; // a riser drags the marks toward the edge
    const mark = (m) => { s.marks.push({ hue, light: s.ink, dry: false, born: s.t, at: clock.cycle, ...m, r: (m.r ?? 0) * s.press.size, alpha: (m.alpha ?? 0.5) * s.press.alpha, bleed: (m.bleed ?? 0.5) * s.press.bleed * s.bleed }); };
    const wave = (amp, k, life, speed) => { s.waves.push({ x, amp, k, life, speed, age: 0 }); if (s.waves.length > 12) s.waves.shift(); };
    const j = (k) => (rand(s) - 0.5) * k * s.grain; // a little hand in every placement
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';
      const g = clamp(e.gain * e.velocity, 0, 1.5);
      const side = (e.pan - 0.5) * 0.3; // pan lifts or lowers a mark on the sheet
      if (slot === 'impulse') {
        if (e.role === 'pulse') { mark({ kind: 'dab', x: x + j(0.008), y: 0.77 + (1 - g) * 0.05 + j(0.09), r: 0.036 * (0.5 + 0.7 * g) * s.weight, alpha: 0.72, bleed: 0.55, tail: drag }); wave(0.006 * g * s.weight, 4, 1, 1.2); }
        else if (e.role === 'impact') {
          const cy = 0.53 + side + j(0.12), n = 8 + Math.floor(rand(s) * 7);
          for (let i = 0; i < n; i++) { const a = rand(s) * TAU, d = rand(s) * 0.07 * s.spread; mark({ kind: 'dab', x: x + Math.cos(a) * d * 0.6, y: cy + Math.sin(a) * d, r: 0.003 + rand(s) * 0.012 * g, alpha: 0.75, bleed: 0.25 }); }
          for (let i = 0; i < 2; i++) { const a = (rand(s) - 0.5) * 1.4; mark({ kind: 'seg', x, y: cy, x2: x + Math.cos(a) * 0.05 * g + drag, y2: cy + Math.sin(a) * 0.09 * g, w: 0.004 * g, alpha: 0.65, bleed: 0.3 }); }
          if (g > 0.6) mark({ kind: 'seg', x: x + j(0.004), y: cy, x2: x + j(0.004), y2: cy + 0.04 + rand(s) * 0.09 * g, w: 0.0025, alpha: 0.5, bleed: 1.2, drip: 0.03 + 0.06 * g }); // a drip, and it keeps running
          wave(0.01 * g, 7, 0.6, 2);
        } else if (e.role === 'grain') mark({ kind: 'dab', x: x + j(0.012), y: 0.24 + side + j(0.3), r: 0.005 * (0.5 + g), alpha: 0.55, bleed: 0.15, hue: hue + 30 });
        else mark({ kind: 'dab', x: x + j(0.008), y: 0.5 + side + j(0.25), r: 0.012 * g, alpha: 0.5, bleed: 0.3 });
      } else if (slot === 'ground') {
        const y = 0.9 - clamp((e.note ?? 40) - 28, 0, 36) / 36 * 0.14 + j(0.02);
        mark({ kind: 'seg', x, y, x2: x + Math.max(0.005, e.dur * perCycle) + drag, y2: y + j(0.03), w: 0.03 * s.weight * (0.6 + 0.5 * g), alpha: 0.45, bleed: 0.9, hue: hue - 12, light: s.ink + (s.light ? -8 : -6) });
        wave(0.004 * g * s.weight, 1.5, 1.6, 0.4); // the paper heaves under the bass, slowly
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const y = 0.7 - clamp((e.note - 40) / 50) * 0.55 + j(0.008), key = e.layer ?? slot, pen = s.pens[key];
        const lineHue = slot === 'line' ? s.pal.line + s.hueShift : s.pal.line + 45 + s.hueShift, w = 0.009 * (0.4 + g);
        if (pen && pen.sheet === s.sheet && clock.cycle - pen.cycle < 1 && x >= pen.x) mark({ kind: 'seg', x: pen.x, y: pen.y, x2: x + drag, y2: y, w, alpha: 0.88, bleed: 0.35, hue: lineHue, light: s.light ? 40 : 68 });
        mark({ kind: 'dab', x, y, r: w * 1.2, alpha: 0.85, bleed: 0.3, hue: lineHue, light: s.light ? 40 : 68 });
        s.pens[key] = { x: x + drag, y, cycle: clock.cycle, sheet: s.sheet, hot: 1, hue: lineHue };
      } else if (slot === 'field') {
        if (s.t - s.washAt < 0.5) continue; // a chord is several haps at once: one wash
        s.washAt = s.t;
        const y = 0.48 - clamp(((e.note ?? 60) - 48) / 36) * 0.2 + j(0.08);
        const rx = Math.max(0.07, Math.min(0.2, e.dur * perCycle * 1.5)) * s.spread;
        mark({ kind: 'wash', x: x + rx * 0.6, y, rx, ry: 0.26, alpha: (s.light ? 0.3 : 0.2) * (0.6 + 0.6 * g), bleed: 2.5, hue: s.pal.field + s.hueShift, light: e.cutoff !== null ? lerp(s.ink + 22, s.ink, clamp(Math.log(e.cutoff / 200) / Math.log(40))) : s.ink + 12 });
      } else if (slot === 'transition') {
        if (e.dur >= 1) { for (let i = 0; i < 26; i++) { const a = rand(s) * TAU, d = rand(s) * 0.11; mark({ kind: 'dab', x: x + Math.cos(a) * d * 0.6, y: 0.5 + Math.sin(a) * d, r: 0.002 + rand(s) * 0.014, alpha: 0.65, bleed: 0.4 }); } wave(0.014, 3, 1.2, 1.2); } // the impact: a burst on the downbeat, and the whole sheet shakes
      } else if (e.role === 'grain' || slot === 'grain') mark({ kind: 'dab', x: x + j(0.012), y: 0.32 + side + j(0.25), r: 0.004 * (0.5 + g), alpha: 0.45, bleed: 0.15, hue: hue + 30 });
    }
    for (const m of s.marks) if (!m.dry && s.t - m.born >= m.bleed) m.dry = true; // dryness is the state's, not the frame's
  },

  draw(s, ctx, w, h) {
    // ponytail: the whole sheet every frame (a fold moves history); dry dabs are flat discs, only wet ones get a gradient. Cache the settled marks to a layer when a long song's export drags.
    let sgn = 1; const X = (x) => (sgn > 0 ? x : 1 - x) * w, Y = (y) => y * h, R = (r) => r * h; // the painting is laid out from the centre rightward and painted twice, the second time mirrored to the left, so it grows from the centre toward both edges
    // the sheet's motion on any mark: ripples from the hits (fading with age and distance), the creases and buckles that came after it was painted
    const dy = (x, y, at) => {
      let d = 0;
      for (const wv of s.waves) { const dist = Math.abs(x - wv.x); d += wv.amp * (1 - wv.age / wv.life) * Math.exp(-dist * 3) * Math.sin(dist * wv.k * TAU - wv.age * wv.speed * TAU); }
      for (const f of s.folds) if (at < f.at && x < f.x) d += f.amp * clamp((f.x - x) / 0.15);
      for (const b of s.buckles) if (at < b.since) d += b.amp * Math.sin(x * b.k * TAU + b.phase) * clamp((y - TOP) / (BOTTOM - TOP)) ** 0.5;
      if (s.riser > 0.01) d += 0.002 * s.riser * Math.sin(x * 14 * TAU + s.t * 30);
      return y + d;
    };
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hsla(...s.paper); ctx.fillRect(0, 0, w, h);
    for (sgn of [1, -1]) {
    ctx.globalCompositeOperation = s.light ? 'multiply' : 'screen';
    // the future: the paper is damp there, and the pigment to come is already moving in it: soft blooms drifting toward the wet edge (more and larger where the coming section is loud, in that section's hue, breathing), wide soft wisps of wash flowing across each coming band, and a drift of fine pigment dust; all of it dissolves as it reaches the brush
    {
      const light = s.light ? s.ink + 34 : s.ink - 14, hueOf = (bi) => s.pal.field + (bi >= 0 ? ((bi * 37) % 50) - 25 : 0), fut = s.bands.map((b, i) => [b, i]).filter(([b]) => b.x1 > s.x + 0.02);
      const bandAt = (x) => { const bi = s.bands.findIndex((b) => x >= b.x0 && x < b.x1); return [bi, s.bands[bi] ? s.bands[bi].energy : s.energy]; };
      const cols = Math.ceil((1 / BLOOM) * (w / h)), rows = Math.ceil(1 / BLOOM), drift = (s.t * 0.015 * s.motion) % BLOOM;
      for (let i = 0; i <= cols; i++) for (let k = 0; k < rows; k++) { // the blooms
        const hx = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453, u = hx - Math.floor(hx); // a stable hand per cell, no generator
        const x = ((i + u) * BLOOM + drift) * (h / w), y = (k + 0.5 + ((u * 7) % 1 - 0.5) * 0.9) * BLOOM; // drifting outward, toward the edge
        if (x <= s.x + 0.02 || x > 1 - MARGIN || y < TOP || y > BOTTOM) continue;
        const [bi, energy] = bandAt(x);
        if (u > 0.4 + 0.6 * energy) continue; // the density: the section's energy
        const near = clamp((x - s.x) / 0.12), pulse = 0.55 + 0.45 * Math.sin(s.t * 0.5 * s.motion + u * TAU + k * 0.7);
        const r = R(0.04 + 0.07 * energy) * (0.7 + 0.3 * pulse) * s.spread, hue = hueOf(bi) + (u - 0.5) * 20;
        const a = (0.09 + 0.16 * energy) * near * pulse * (1 - 0.6 * s.dark), cx = X(x), cy = Y(y);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, hsla(hue, s.sat * 0.8, light, a)); g.addColorStop(1, hsla(hue, s.sat * 0.8, light, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      }
      ctx.lineCap = 'round';
      for (const [b, bi] of fut) { // the wisps: a few wide soft strokes of wash per coming band, each undulating and flowing toward the wet edge at its own pace
        const x0 = Math.max(b.x0, s.x + 0.02), n = 2 + Math.round(3 * b.energy), hue = hueOf(bi);
        for (let k = 0; k < n; k++) {
          const ph = (k * 0.618 + bi * 0.37) % 1, y = TOP + 0.08 + (BOTTOM - TOP - 0.16) * ((ph + 0.13 * Math.sin(s.t * 0.11 * s.motion + k + bi)) % 1), flow = (s.t * (0.01 + 0.012 * ph) * s.motion) % 0.2;
          ctx.strokeStyle = hsla(hue + 15 * (ph - 0.5), s.sat * 0.7, light, (0.05 + 0.08 * b.energy) * (1 - 0.6 * s.dark)); ctx.lineWidth = R(0.018 + 0.02 * b.energy) * s.spread;
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const x = lerp(x0, b.x1, i / 24), near = clamp((x - s.x) / 0.12), yy = y + Math.sin(x * 9 + flow * 30 + k * 2 - s.t * 0.4 * s.motion) * 0.05 * near + Math.sin(x * 23 + s.t * 0.9) * 0.01;
            i ? ctx.lineTo(X(x), Y(yy)) : ctx.moveTo(X(x), Y(yy));
          }
          ctx.stroke();
        }
      }
      const D = 0.022, dcols = Math.ceil((1 / D) * (w / h)), drows = Math.ceil(1 / D), ddrift = (s.t * 0.03 * s.motion) % D, dl = s.light ? s.ink + 20 : s.ink; // the dust
      for (let i = 0; i <= dcols; i++) for (let k = 0; k < drows; k++) {
        const hx = Math.sin(i * 39.3467 + k * 11.135) * 43758.5453, u = hx - Math.floor(hx);
        const x = ((i + u) * D + ddrift) * (h / w), y = (k + 0.5 + ((u * 11) % 1 - 0.5) * 0.9) * D + Math.sin(s.t * 0.7 + i) * 0.004;
        if (x <= s.x + 0.02 || x > 1 - MARGIN || y < TOP || y > BOTTOM) continue;
        const [bi, energy] = bandAt(x);
        if (u > 0.25 + 0.5 * energy) continue;
        const near = clamp((x - s.x) / 0.1), r = Math.max(1, R(0.0012 + 0.0018 * u));
        ctx.fillStyle = hsla(hueOf(bi) + 20, s.sat * 0.6, dl, (0.2 + 0.3 * energy) * near * (0.5 + 0.5 * Math.sin(s.t * 2 + u * TAU)) * (1 - 0.6 * s.dark));
        ctx.fillRect(X(x) - r / 2, Y(y) - r / 2, r, r);
      }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const m of s.marks) {
      const age = s.t - m.born, wet = clamp(age / m.bleed), settle = 1 - Math.exp(-Math.max(0, age - m.bleed) / 60); // the slow bleed: a dry mark keeps spreading into the paper and thins as it does
      const grow = lerp(0.35, 1, wet) * (1 + 0.45 * settle), alpha = Math.min(0.95, m.alpha * lerp(0.9, 1.4, wet) * (1 - 0.3 * settle)), col = hsla(m.hue, s.sat, m.light, alpha);
      if (m.kind === 'dab') {
        const cx = X(m.x), cy = Y(dy(m.x, m.y, m.at)), r = R(m.r) * grow;
        if (r < 0.6) { ctx.fillStyle = col; ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1); continue; }
        if (wet < 1) { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(0.6, hsla(m.hue, s.sat, m.light, alpha * 0.7)); g.addColorStop(1, hsla(m.hue, s.sat, m.light, 0)); ctx.fillStyle = g; }
        else ctx.fillStyle = hsla(m.hue, s.sat, m.light, alpha * 0.75);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        if (m.tail) { ctx.strokeStyle = hsla(m.hue, s.sat, m.light, alpha * 0.5); ctx.lineWidth = r * 0.7; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(X(m.x + m.tail), cy); ctx.stroke(); }
      } else if (m.kind === 'seg') {
        const run = m.drip ? Math.min(m.drip, age * 0.004) : 0; // a drip runs down the sheet for a while after it lands
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, R(m.w) * grow);
        ctx.beginPath(); ctx.moveTo(X(m.x), Y(dy(m.x, m.y, m.at))); ctx.lineTo(X(m.x2), Y(dy(m.x2, m.y2 + run, m.at))); ctx.stroke();
      } else if (m.kind === 'wash') {
        const cx = X(m.x), cy = Y(dy(m.x, m.y, m.at));
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1);
        g.addColorStop(0, col); g.addColorStop(1, hsla(m.hue, s.sat, m.light, 0));
        ctx.save(); ctx.translate(cx, cy); ctx.scale(X(m.rx) * grow, R(m.ry) * grow); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // the wet edge: the brush's place on the sheet, and each line part's brush glowing where it last touched
    ctx.strokeStyle = hsla(s.pal.hue, 20, s.light ? 40 : 80, 0.1 + 0.05 * Math.sin(s.t * 3)); ctx.lineWidth = Math.max(1, R(0.001));
    ctx.beginPath(); ctx.moveTo(X(s.x), Y(TOP)); ctx.lineTo(X(s.x), Y(BOTTOM)); ctx.stroke();
    for (const pen of Object.values(s.pens)) {
      if (!(pen.hot > 0.02) || pen.sheet !== s.sheet) continue;
      const px = X(pen.x), py = Y(dy(pen.x, pen.y, Infinity)), rr = R(0.008 + 0.012 * pen.hot);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, hsla(pen.hue, 80, s.light ? 45 : 85, 0.6 * pen.hot)); g.addColorStop(1, hsla(pen.hue, 80, 70, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    }
    }
    if (s.dark > 0.02) { ctx.fillStyle = hsla(...s.paper, 0.15 * s.dark); ctx.fillRect(0, 0, w, h); } // a dropout: the sheet breathes, faintly veiled
  },
};
