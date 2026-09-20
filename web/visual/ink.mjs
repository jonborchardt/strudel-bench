// ink: the song paints one sheet, and the last frame is the painting. Time runs left to right: each section is a
// band as wide as its share of the song, and inside it a moment is an x. Drums are marks (a kick a heavy dab low on
// the sheet, an impact a splatter with a streak, hats and percussion specks up high), the bass lays broad strokes
// along the bottom the length of its notes, each line part is a continuous calligraphic stroke (pitch is height,
// pressure is velocity, a rest longer than a bar lifts the brush), the pad bleeds a wash of pigment into the band.
// A section's role is the pressure (a climax presses harder and denser, a release lets the marks soften and settle);
// a boundary is a composition change, a fold line and a shift of ink, never a cut; a riser drags every mark toward
// the edge it is rushing to; a dropout leaves the band bare. Marks are wet for a moment (they bleed as they land) and
// then dry into the sheet. Nothing is ever cleared but by a new sheet (the song starting over) or a resize; the
// canvas persisting between draws is the host's contract (host.mjs), and draw paints only what is new.
// Deterministic: randomness only from the state's own seeded generator (kit.mjs); draw's bookkeeping lives in
// state.paint and never changes what the marks are.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const MARGIN = 0.04, TOP = 0.08, BOTTOM = 0.94;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
// the pressure per section role: size and alpha of every mark, how long a mark stays wet (a release settles softly)
const PRESS = { establish: { size: 0.8, alpha: 0.75, bleed: 1.1 }, develop: { size: 1, alpha: 1, bleed: 1 }, climax: { size: 1.45, alpha: 1.3, bleed: 0.8 }, release: { size: 0.9, alpha: 0.7, bleed: 1.6 }, none: { size: 1, alpha: 1, bleed: 1 } };
const FALLBACK_BARS = 16; // a pattern with no sections paints this many cycles per sheet

export default {
  name: 'ink',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const light = p.luminance >= 0.5; // light paper takes dark inks; a dark sheet takes luminous ones
    const s = {
      pal, size: { ...size }, light,
      paper: light ? [pal.hue + 20, 14, 94] : [pal.hue, 25, 7], // a warm off-white, or a dark sheet
      ink: light ? lerp(26, 40, p.luminance) : lerp(60, 72, p.luminance), // the inks' lightness
      sat: pal.sat, grain: lerp(0, 1, p.jitter), spread: lerp(0.6, 1.4, p.spread), weight: lerp(0.7, 1.5, p.mass), bleed: lerp(0.6, 1.8, p.persistence),
      cps: score.cps, total: score.total,
      bands: score.sections.map((x) => ({ x0: MARGIN + ((1 - 2 * MARGIN) * x.at) / score.total, x1: MARGIN + ((1 - 2 * MARGIN) * x.until) / score.total, at: x.at, until: x.until, role: x.role ?? 'none' })),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, sheet: 0, lastCycle: null, marks: [], pens: {}, // pens: line part -> { x, y, cycle } where its brush last touched
      press: { ...PRESS.none }, hueShift: 0, riser: 0, dark: 0, section: null, washAt: -1,
      paint: { sheet: -1, w: 0, h: 0, t: 0 }, // draw's bookkeeping: which sheet and size the canvas holds, the sim time of the last draw
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    // a new sheet when the song starts over (the cycle jumps back); a boundary folds the sheet and shifts the ink
    if (s.lastCycle !== null && clock.cycle < s.lastCycle - 1) { s.sheet++; s.marks = []; s.pens = {}; s.washAt = -1; }
    s.lastCycle = clock.cycle;
    const band = clock.index >= 0 ? s.bands[clock.index] : null;
    const role = band?.role ?? 'none', want = PRESS[role] ?? PRESS.none;
    for (const k of Object.keys(want)) s.press[k] = ease(s.press[k], want[k], 1.5, dt);
    if (clock.boundary) {
      s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section;
      if (band && clock.index > 0) s.marks.push({ kind: 'seg', x: band.x0, y: TOP, x2: band.x0, y2: BOTTOM, w: 0.0012, hue: s.pal.hue + s.hueShift, light: s.ink, alpha: 0.35, born: s.t, bleed: 0.6, dry: false }); // the first section's edge is the sheet's
    }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 4, dt);
    // where on the sheet this moment is
    const x = band ? lerp(band.x0, band.x1, (clock.cycle - band.at) / (band.until - band.at)) : MARGIN + ((clock.cycle % FALLBACK_BARS) / FALLBACK_BARS) * (1 - 2 * MARGIN);
    const bandW = band ? band.x1 - band.x0 : 1 - 2 * MARGIN, perCycle = band ? bandW / (band.until - band.at) : (1 - 2 * MARGIN) / FALLBACK_BARS;
    const hue = s.pal.hue + s.hueShift, drag = s.riser * 0.05; // a riser drags the marks toward the edge
    const mark = (m) => { s.marks.push({ hue, light: s.ink, dry: false, born: s.t, ...m, r: (m.r ?? 0) * s.press.size, alpha: (m.alpha ?? 0.5) * s.press.alpha, bleed: (m.bleed ?? 0.5) * s.press.bleed * s.bleed }); };
    const j = (k) => (rand(s) - 0.5) * k * s.grain; // a little hand in every placement
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';
      const g = clamp(e.gain * e.velocity, 0, 1.5);
      const side = (e.pan - 0.5) * 0.3; // pan lifts or lowers a mark on the sheet
      if (slot === 'impulse') {
        if (e.role === 'pulse') mark({ kind: 'dab', x: x + j(0.008), y: 0.77 + (1 - g) * 0.05 + j(0.09), r: 0.036 * (0.5 + 0.7 * g) * s.weight, alpha: 0.72, bleed: 0.55, tail: drag });
        else if (e.role === 'impact') {
          const cy = 0.53 + side + j(0.12), n = 8 + Math.floor(rand(s) * 7);
          for (let i = 0; i < n; i++) { const a = rand(s) * TAU, d = rand(s) * 0.07 * s.spread; mark({ kind: 'dab', x: x + Math.cos(a) * d * 0.6, y: cy + Math.sin(a) * d, r: 0.003 + rand(s) * 0.012 * g, alpha: 0.75, bleed: 0.25 }); }
          for (let i = 0; i < 2; i++) { const a = (rand(s) - 0.5) * 1.4; mark({ kind: 'seg', x, y: cy, x2: x + Math.cos(a) * 0.05 * g + drag, y2: cy + Math.sin(a) * 0.09 * g, w: 0.004 * g, alpha: 0.65, bleed: 0.3 }); }
          if (g > 0.6) mark({ kind: 'seg', x: x + j(0.004), y: cy, x2: x + j(0.004), y2: cy + 0.04 + rand(s) * 0.09 * g, w: 0.0025, alpha: 0.5, bleed: 1.2 }); // a drip, slowly
        } else if (e.role === 'grain') mark({ kind: 'dab', x: x + j(0.012), y: 0.24 + side + j(0.3), r: 0.005 * (0.5 + g), alpha: 0.55, bleed: 0.15, hue: hue + 30 });
        else mark({ kind: 'dab', x: x + j(0.008), y: 0.5 + side + j(0.25), r: 0.012 * g, alpha: 0.5, bleed: 0.3 });
      } else if (slot === 'ground') {
        const y = 0.9 - clamp((e.note ?? 40) - 28, 0, 36) / 36 * 0.14 + j(0.02);
        mark({ kind: 'seg', x, y, x2: x + Math.max(0.005, e.dur * perCycle) + drag, y2: y + j(0.03), w: 0.03 * s.weight * (0.6 + 0.5 * g), alpha: 0.45, bleed: 0.9, hue: hue - 12, light: s.ink + (s.light ? -8 : -6) });
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const y = 0.7 - clamp((e.note - 40) / 50) * 0.55 + j(0.008), key = e.layer ?? slot, pen = s.pens[key];
        const lineHue = slot === 'line' ? s.pal.line + s.hueShift : s.pal.line + 45 + s.hueShift, w = 0.009 * (0.4 + g);
        if (pen && pen.sheet === s.sheet && clock.cycle - pen.cycle < 1 && x >= pen.x) mark({ kind: 'seg', x: pen.x, y: pen.y, x2: x + drag, y2: y, w, alpha: 0.88, bleed: 0.35, hue: lineHue, light: s.light ? 40 : 68 });
        mark({ kind: 'dab', x, y, r: w * 1.2, alpha: 0.85, bleed: 0.3, hue: lineHue, light: s.light ? 40 : 68 });
        s.pens[key] = { x: x + drag, y, cycle: clock.cycle, sheet: s.sheet };
      } else if (slot === 'field') {
        if (s.t - s.washAt < 0.5) continue; // a chord is several haps at once: one wash
        s.washAt = s.t;
        const y = 0.48 - clamp(((e.note ?? 60) - 48) / 36) * 0.2 + j(0.08);
        const rx = Math.max(0.07, Math.min(0.2, e.dur * perCycle * 1.5)) * s.spread;
        mark({ kind: 'wash', x: x + rx * 0.6, y, rx, ry: 0.26, alpha: (s.light ? 0.3 : 0.2) * (0.6 + 0.6 * g), bleed: 2.5, hue: s.pal.field + s.hueShift, light: e.cutoff !== null ? lerp(s.ink + 22, s.ink, clamp(Math.log(e.cutoff / 200) / Math.log(40))) : s.ink + 12 });
      } else if (slot === 'transition') {
        if (e.dur >= 1) for (let i = 0; i < 26; i++) { const a = rand(s) * TAU, d = rand(s) * 0.11; mark({ kind: 'dab', x: x + Math.cos(a) * d * 0.6, y: 0.5 + Math.sin(a) * d, r: 0.002 + rand(s) * 0.014, alpha: 0.65, bleed: 0.4 }); } // the impact: a burst on the downbeat
      } else if (e.role === 'grain' || slot === 'grain') mark({ kind: 'dab', x: x + j(0.012), y: 0.32 + side + j(0.25), r: 0.004 * (0.5 + g), alpha: 0.45, bleed: 0.15, hue: hue + 30 });
    }
    for (const m of s.marks) if (!m.dry && s.t - m.born >= m.bleed) m.dry = true; // dryness is the state's, not the frame's
  },

  draw(s, ctx, w, h) {
    const P = s.paint, fresh = P.sheet !== s.sheet || P.w !== w || P.h !== h;
    const el = fresh ? 0 : Math.max(0, s.t - P.t); // simulation time this frame deposits
    P.sheet = s.sheet; P.w = w; P.h = h; P.t = s.t;
    ctx.globalCompositeOperation = 'source-over';
    if (fresh) { ctx.fillStyle = hsla(...s.paper); ctx.fillRect(0, 0, w, h); }
    ctx.globalCompositeOperation = s.light ? 'multiply' : 'screen';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const X = (x) => x * w, Y = (y) => y * h, R = (r) => r * h;
    const paintMark = (m, alpha, grow) => {
      const col = hsla(m.hue, s.sat, m.light, alpha);
      if (m.kind === 'dab') {
        const r = R(m.r) * grow;
        if (r < 0.6) { ctx.fillStyle = col; ctx.fillRect(X(m.x) - 0.5, Y(m.y) - 0.5, 1, 1); return; }
        const g = ctx.createRadialGradient(X(m.x), Y(m.y), 0, X(m.x), Y(m.y), r);
        g.addColorStop(0, col); g.addColorStop(0.6, hsla(m.hue, s.sat, m.light, alpha * 0.7)); g.addColorStop(1, hsla(m.hue, s.sat, m.light, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), r, 0, TAU); ctx.fill();
        if (m.tail) { ctx.strokeStyle = hsla(m.hue, s.sat, m.light, alpha * 0.5); ctx.lineWidth = r * 0.7; ctx.beginPath(); ctx.moveTo(X(m.x), Y(m.y)); ctx.lineTo(X(m.x + m.tail), Y(m.y)); ctx.stroke(); }
      } else if (m.kind === 'seg') {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, R(m.w) * grow);
        ctx.beginPath(); ctx.moveTo(X(m.x), Y(m.y)); ctx.lineTo(X(m.x2), Y(m.y2)); ctx.stroke();
      } else if (m.kind === 'wash') {
        const g = ctx.createRadialGradient(X(m.x), Y(m.y), 0, X(m.x), Y(m.y), 1);
        g.addColorStop(0, col); g.addColorStop(1, hsla(m.hue, s.sat, m.light, 0));
        ctx.save(); ctx.translate(X(m.x), Y(m.y)); ctx.scale(X(m.rx) * grow, R(m.ry) * grow); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore();
      }
    };
    for (const m of s.marks) {
      if (fresh) { if (m.dry) paintMark(m, Math.min(0.95, m.alpha * 1.4), 1); continue; } // the sheet again: every dry mark once, at its settled look
      if (m.dry && s.t - m.born - el >= m.bleed) continue; // dried before this frame: it is in the sheet already
      const age = clamp((s.t - m.born) / m.bleed), share = Math.min(1, el / m.bleed) * 1.6; // this frame's share of the mark's ink
      paintMark(m, Math.min(1, m.alpha * share), lerp(0.35, 1, age));
    }
    ctx.globalCompositeOperation = 'source-over';
    if (s.dark > 0.02) { ctx.fillStyle = hsla(...s.paper, 0.15 * s.dark); ctx.fillRect(0, 0, w, h); } // a dropout: the sheet breathes, faintly veiled
  },
};
