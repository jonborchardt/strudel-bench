// growth: the song grows one organism, and the last frame is the organism. It is rooted at the bottom and grows tip by
// tip as the song plays, never all at once: a kick is a growth impulse (every living tip extends), an impact is a
// branching (a share of the tips fork; the fork is symmetric when the melody is consonant with the last bass note and
// one-sided when it is not), hats sprout leaves on the wood, the bass thickens the trunk, grows the roots down and
// sends a pulse of sap up through the branches, each line part is the light the tips bend toward (its pitch the
// height, its pan the side), the pad is the sky and the wind (the whole organism sways, more with the pad's level, its
// cutoff the light of the sky). A section's role is the growth phase (establish: roots and trunk, slow; develop:
// branching; climax: blossoms open at every tip; release: leaves fall); a boundary turns the light; a riser hurries the
// growth; a dropout stills the wind. Thickness follows the pipe model: every new segment thickens its ancestors, so the
// trunk carries the canopy's weight. Deterministic: randomness only from the state's own generator (kit.mjs); the sway
// is applied at draw time from the simulation clock, so the wood itself never moves.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const MAX_SEG = 1400, MAX_LEAF = 500, MAX_BLOOM = 240, MAX_ROOT = 80, GROUND = 0.88;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
const PHASE = {
  establish: { grow: 0.6, fork: 0.15, bloom: 0, fall: 0, roots: 1 },
  develop: { grow: 1, fork: 0.35, bloom: 0, fall: 0, roots: 0.4 },
  climax: { grow: 1.2, fork: 0.5, bloom: 1, fall: 0, roots: 0.2 },
  release: { grow: 0.4, fork: 0.1, bloom: 0.2, fall: 1, roots: 0.3 },
  none: { grow: 1, fork: 0.3, bloom: 0.2, fall: 0, roots: 0.5 },
};
const CONSONANT = new Set([0, 3, 4, 5, 7, 8, 9]);

export default {
  name: 'growth',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng), aspect = size.w / size.h;
    const s = {
      pal, size: { ...size }, aspect,
      sky: [pal.hue, 25, 8], wood: pal.hue + 15, leaf: pal.field, bloom: pal.line,
      weight: lerp(0.7, 1.5, p.mass), jitter: lerp(0.15, 1, p.jitter), spread: lerp(0.8, 1.25, p.spread), motion: lerp(0.6, 1.4, p.motion),
      cps: score.cps,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0,
      segs: [{ x: aspect / 2, y: GROUND, a: -Math.PI / 2, l: 0.05, d: 0, p: -1, th: 1, tip: true, hot: 0 }], // the wood: base point, angle, length, depth, parent, thickness, a living tip?
      roots: [{ x: aspect / 2, y: GROUND, a: Math.PI / 2, l: 0.03, p: -1 }],
      leaves: [], blooms: [], falling: [], sap: [],
      light: { x: aspect / 2, y: 0.25, tx: aspect / 2, ty: 0.25, hot: 0 },
      bassNote: 36, melNote: 48,
      wind: { level: 0, tint: 0.5 },
      phase: { ...PHASE.none }, energy: 0.5, riser: 0, dark: 0, section: null, hueShift: 0, trunk: 0,
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = PHASE[role] ?? PHASE.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.phase[k] = ease(s.phase[k], want[k], 1.2, dt);
    if (clock.boundary) { s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section; s.light.tx = s.aspect * (0.25 + rand(s) * 0.5); }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    const L = s.light; L.x = ease(L.x, L.tx, 2, dt); L.y = ease(L.y, L.ty, 2, dt); L.hot = decay(L.hot, 1, dt);
    s.wind.level = decay(s.wind.level, 0.3, dt); s.trunk = decay(s.trunk, 1.5, dt);
    for (const sp of s.sap) { sp.d += dt * 6 * s.motion; sp.hot = decay(sp.hot, 1.2, dt); } s.sap = s.sap.filter((sp) => sp.hot > 0.05);
    for (const sg of s.segs) sg.hot = decay(sg.hot, 3, dt);
    for (const b of s.blooms) b.r = ease(b.r, b.rTo, 2, dt);
    for (const f of s.falling) { f.vy += 0.3 * dt; f.vx = ease(f.vx, Math.sin(s.t * 1.3 + f.y * 5) * 0.15 * (0.3 + s.wind.level), 1, dt); f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 2; f.life -= dt; }
    s.falling = s.falling.filter((f) => f.life > 0 && f.y < GROUND + 0.02);
    if (s.phase.fall > 0.3 && s.leaves.length > 40 && rand(s) < s.phase.fall * dt * 4) { const i = Math.floor(rand(s) * s.leaves.length), lf = s.leaves.splice(i, 1)[0], [x, y] = endOf(s, lf.seg, lf.at); s.falling.push({ x, y, vx: 0, vy: 0, rot: rand(s) * TAU, r: lf.r, life: 6 }); } // a release: leaves let go
    const tipEnd = (sg) => [sg.x + Math.cos(sg.a) * sg.l, sg.y + Math.sin(sg.a) * sg.l];
    const thicken = (i) => { for (let k = s.segs[i].p; k >= 0; k = s.segs[k].p) s.segs[k].th += 0.12; };
    const grow = (sg, i, g, turn) => { // a new segment from this tip, bent a little toward the light and by the turn asked, shorter with depth; a tip at the top of the frame stops
      if (s.segs.length >= MAX_SEG) return null;
      const [x, y] = tipEnd(sg), toLight = Math.atan2(L.y - y, L.x - x);
      if (y < 0.07 || x < 0.03 || x > s.aspect - 0.03) { sg.tip = false; return null; }
      let a = sg.a + turn + (rand(s) - 0.5) * 0.8 * s.jitter;
      const diff = Math.atan2(Math.sin(toLight - a), Math.cos(toLight - a)); a += diff * 0.12 * (0.2 + L.hot);
      if (Math.sin(a) > 0.3) a = a > Math.PI / 2 ? Math.PI - 0.3 : 0.3; // never straight down through the ground
      const child = { x, y, a, l: (0.03 + 0.025 * g) * (1 / (1 + sg.d * 0.12)) * s.spread, d: sg.d + 1, p: i, th: 1, tip: true, hot: 1 };
      s.segs.push(child); sg.tip = false; thicken(s.segs.length - 1);
      return child;
    };
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') { // a growth impulse: every living tip extends (a share of them, by the phase); in the climax, blossoms open at the tips
          const tips = s.segs.map((sg, i) => [sg, i]).filter(([sg]) => sg.tip), share = clamp(s.phase.grow * (0.4 + 0.5 * g) * (1 + s.riser));
          for (const [sg, i] of tips) if (rand(s) < share) grow(sg, i, g, 0);
          if (s.phase.bloom > 0.3) for (const [sg] of tips) if (s.blooms.length < MAX_BLOOM && rand(s) < 0.2 * s.phase.bloom) { const [x, y] = tipEnd(sg); s.blooms.push({ x, y, r: 0, rTo: (0.005 + 0.007 * g) * s.spread, hue: s.bloom + s.hueShift + (rand(s) - 0.5) * 30 }); }
        } else if (e.role === 'impact') { // a branching: a share of the tips fork; symmetric when consonant, one-sided when not
          const tips = s.segs.map((sg, i) => [sg, i]).filter(([sg]) => sg.tip), iv = ((s.melNote - s.bassNote) % 12 + 12) % 12, sym = CONSONANT.has(iv);
          for (const [sg, i] of tips) if (rand(s) < s.phase.fork * (0.5 + 0.5 * g)) { const spread = 0.35 + rand(s) * 0.4; const c = grow(sg, i, g, sym ? -spread : -spread * 0.2); if (c) { sg.tip = true; const c2 = grow(sg, i, g, sym ? spread : spread * 1.3); if (!c2) sg.tip = false; } }
        } else if (e.role === 'grain') { // leaves on the wood, out on the younger branches
          if (s.leaves.length < MAX_LEAF && s.segs.length > 3) { const i = 1 + Math.floor(rand(s) * (s.segs.length - 1)); if (s.segs[i].d >= 2) s.leaves.push({ seg: i, at: rand(s), side: rand(s) < 0.5 ? -1 : 1, r: (0.006 + 0.006 * g) * s.spread, hue: s.leaf + s.hueShift + (rand(s) - 0.5) * 20 }); }
        } else { const tips = s.segs.map((sg, i) => [sg, i]).filter(([sg]) => sg.tip); for (const [sg, i] of tips) if (rand(s) < 0.2 * g) grow(sg, i, g, 0); }
      } else if (slot === 'ground') { // the bass: the trunk thickens, a root grows, sap climbs
        if (e.note !== null) s.bassNote = e.note;
        s.trunk = Math.min(1.5, s.trunk + 0.6 * g); s.segs[0].th += 0.2 * g;
        s.sap.push({ d: 0, hot: 1 });
        if (s.roots.length < MAX_ROOT && rand(s) < s.phase.roots) { const parent = Math.floor(rand(s) * s.roots.length), r = s.roots[parent], x = r.x + Math.cos(r.a) * r.l, y = r.y + Math.sin(r.a) * r.l; s.roots.push({ x, y, a: clamp(r.a + (rand(s) - 0.5) * 1.2, 0.4, Math.PI - 0.4), l: 0.02 + 0.03 * rand(s), p: parent }); }
      } else if (slot === 'line' || slot === 'counter') { // the light the tips bend toward
        if (e.note === null) continue;
        s.melNote = e.note;
        L.tx = s.aspect * clamp(0.15 + 0.7 * e.pan, 0.05, 0.95); L.ty = 0.1 + 0.5 * (1 - clamp((e.note - 40) / 50)); L.hot = 1;
      } else if (slot === 'field') {
        s.wind.level = Math.min(1, 0.5 + 0.5 * g);
        if (e.cutoff !== null) s.wind.tint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
      } else if (slot === 'transition') {
        if (e.dur >= 1) { const tips = s.segs.map((sg, i) => [sg, i]).filter(([sg]) => sg.tip); for (const [sg, i] of tips) grow(sg, i, 1, 0); }
      } else if (slot === 'grain' || e.role === 'grain') { if (s.leaves.length < MAX_LEAF && s.segs.length > 3) { const i = 1 + Math.floor(rand(s) * (s.segs.length - 1)); if (s.segs[i].d >= 2) s.leaves.push({ seg: i, at: rand(s), side: rand(s) < 0.5 ? -1 : 1, r: 0.005 * s.spread, hue: s.leaf + s.hueShift }); } }
    }
  },

  draw(s, ctx, w, h) {
    const { pal } = s, lit = 1 - 0.5 * s.dark;
    const X = (x) => (x / s.aspect) * w, Y = (y) => y * h, R = (r) => r * h;
    const sway = (x, y) => x + Math.sin(s.t * 0.9 * s.motion + y * 4) * (GROUND - y) * 0.04 * (0.25 + s.wind.level) * (1 - s.dark) + Math.sin(s.t * 2.3 + x * 3) * (GROUND - y) * 0.008 * s.wind.level; // the wind: more the higher, more with the pad
    // the sky, by the pad's light; the ground
    const sky = ctx.createLinearGradient(0, 0, 0, Y(GROUND));
    sky.addColorStop(0, hsla(s.sky[0] + s.hueShift, 30, lerp(6, 18, s.wind.tint), 1)); sky.addColorStop(1, hsla(pal.field + s.hueShift, 35, lerp(10, 30, s.wind.tint) * (0.6 + 0.4 * s.energy), 1));
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hsla(s.wood - 10, 25, 9); ctx.fillRect(0, Y(GROUND), w, h - Y(GROUND));
    // the light: where the tips bend toward
    if (s.light.hot > 0.02) { const g = ctx.createRadialGradient(X(s.light.x), Y(s.light.y), 0, X(s.light.x), Y(s.light.y), R(0.25)); g.addColorStop(0, hsla(s.bloom + s.hueShift, 70, 75, 0.25 * s.light.hot * lit)); g.addColorStop(1, hsla(s.bloom, 70, 75, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, Y(GROUND)); }
    ctx.lineCap = 'round';
    // the roots, still, under the ground
    ctx.strokeStyle = hsla(s.wood, 30, 28, 0.8); ctx.lineWidth = Math.max(1, R(0.004) * s.weight);
    for (const r of s.roots) { ctx.beginPath(); ctx.moveTo(X(r.x), Y(r.y)); ctx.lineTo(X(r.x + Math.cos(r.a) * r.l), Y(r.y + Math.sin(r.a) * r.l)); ctx.stroke(); }
    // the wood: every segment a tapered stroke, swaying, its thickness the pipe model's, lit by a sap pulse passing its depth and by its own youth
    for (const sg of s.segs) {
      const x1 = sway(sg.x, sg.y), y1 = sg.y, x2 = sway(sg.x + Math.cos(sg.a) * sg.l, sg.y + Math.sin(sg.a) * sg.l), y2 = sg.y + Math.sin(sg.a) * sg.l;
      let sap = 0; for (const sp of s.sap) sap = Math.max(sap, sp.hot * clamp(1 - Math.abs(sp.d - sg.d) / 2));
      const th = R(0.0016 * Math.sqrt(sg.th) * s.weight * (sg.d === 0 ? 1 + 0.3 * s.trunk : 1));
      ctx.strokeStyle = hsla(s.wood + s.hueShift, 35 + 20 * sap, lerp(30, 48, clamp(1 - sg.d / 14)) + 25 * sap + 15 * sg.hot, lit); ctx.lineWidth = Math.max(1, th);
      ctx.beginPath(); ctx.moveTo(X(x1), Y(y1)); ctx.lineTo(X(x2), Y(y2)); ctx.stroke();
    }
    // the leaves on their segments, the blossoms at the tips, the leaves falling
    for (const lf of s.leaves) { const [x, y] = endOf(s, lf.seg, lf.at), sg = s.segs[lf.seg], sx = sway(x, y); ctx.fillStyle = hsla(lf.hue, 55, 45, 0.9 * lit); ctx.save(); ctx.translate(X(sx), Y(y)); ctx.rotate(sg.a + lf.side * 0.9); ctx.beginPath(); ctx.ellipse(R(lf.r) * 1.2, 0, R(lf.r) * 1.6, R(lf.r) * 0.7, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const b of s.blooms) { const sx = sway(b.x, b.y), r = R(b.r); ctx.fillStyle = hsla(b.hue, 80, 72, 0.75 * lit); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ctx.beginPath(); ctx.ellipse(X(sx) + Math.cos(a) * r * 0.7, Y(b.y) + Math.sin(a) * r * 0.7, r * 0.6, r * 0.35, a, 0, TAU); ctx.fill(); } ctx.fillStyle = hsla(b.hue + 30, 90, 85, lit); ctx.beginPath(); ctx.arc(X(sx), Y(b.y), r * 0.3, 0, TAU); ctx.fill(); } // five petals and a heart
    for (const f of s.falling) { ctx.fillStyle = hsla(s.leaf + s.hueShift + 20, 50, 42, 0.9 * clamp(f.life / 2) * lit); ctx.save(); ctx.translate(X(f.x), Y(f.y)); ctx.rotate(f.rot); ctx.beginPath(); ctx.ellipse(0, 0, R(f.r) * 1.6, R(f.r) * 0.7, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    if (s.riser > 0.01) { ctx.fillStyle = hsla(s.bloom, 60, 90, 0.08 * s.riser); ctx.fillRect(0, 0, w, h); }
  },
};

/** A point along a segment, `at` in 0..1 from its base. */
function endOf(s, i, at) { const sg = s.segs[i]; return [sg.x + Math.cos(sg.a) * sg.l * at, sg.y + Math.sin(sg.a) * sg.l * at]; }
