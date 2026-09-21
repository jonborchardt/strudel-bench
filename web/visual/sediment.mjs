// sediment: the song leaves a rock cross-section behind, and the last frame is the record. Time runs upward: the
// surface rises through the song, each section is a stratum as thick as its share of the song, and what a part does
// lands on the surface as it stands. The bass lays lenses of ground into the layer (the length of the note is the
// width, a low note is darker, denser rock), a kick embeds a clast (a stone; angular songs get sharper stones), an
// impact cracks the surface and scatters chips, hats and percussion are sand, each line part is a mineral vein
// climbing through the rock (pitch is where across the width, a note joins the last, and the vein carves a channel
// as it goes), the pad is haze above the surface that tints the layer it settles into. A boundary closes the stratum
// on the surface as it is; a boundary after a riser, or a big jump in energy, is a fault that offsets everything
// below it; a climax folds every stratum deposited before it (the fold grows over the section, and what the climax
// deposits fills the fold in); a release compacts faster and deposits paler, thinner rock; a dropout leaves a bare
// band under a veil. Nothing is ever undone: the deformation lives in state and is applied at draw time to what was
// there when it happened, so the final still holds both the history and what happened to it. And the rock is alive
// while the song plays: a kick sends a ripple through the strata below it (strongest at the surface, fading with depth),
// a bass note heaves the ground slowly, an impact jolts it, a riser trembles the whole surface; the song starts on a
// basement of older rock, and the sky over the surface is where the moment shows: a hit sprays fragments and dust up
// that fall back, the pad's haze drifts as clouds, and each line part's pen glows at the surface as it writes its vein.
// Deterministic: randomness only from the state's own seeded generator (kit.mjs); the stipple in draw runs its own
// generator from each stratum's seed and never touches the state.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const MARGIN = 0.03, TOP = 0.1, BOTTOM = 0.95, BASE = 0.78, FLOOR = 1.3; // the sheet: deposition runs from BASE up to TOP over a basement of older rock down to BOTTOM, floored under the canvas so a fold never shows paper beneath it
const N = 64; // columns of the surface profile
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
// the deposition per section role: mark size and darkness, how fast the surface compacts flat, how much a stone relieves the surface
const ROLE = {
  establish: { size: 0.85, dark: 0.8, compact: 0.3, relief: 0.8 },
  develop: { size: 1, dark: 1, compact: 0.25, relief: 1 },
  climax: { size: 1.3, dark: 1.25, compact: 0.15, relief: 1.4 },
  release: { size: 0.8, dark: 0.65, compact: 0.7, relief: 0.6 },
  none: { size: 1, dark: 1, compact: 0.25, relief: 1 },
};
const FALLBACK_BARS = 16; // a pattern with no sections fills a sheet in this many cycles
const FOLD_MAX = 0.075; // the folds together never move a point more than this (in height): a second climax adds what is left
const HUES = [0, 18, -24, 36, -12, 48], LIGHTS = [0, -11, 7, -17, 3, -7]; // strata alternate: a hue step and a lightness step per section, so the record reads as rock, not bands of one colour

const xs = Array.from({ length: N + 1 }, (_, i) => MARGIN + ((1 - 2 * MARGIN) * i) / N);
const colOf = (x) => clamp(Math.round(((x - MARGIN) / (1 - 2 * MARGIN)) * N), 0, N);
const mul32 = (n) => { let t = (n + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export default {
  name: 'sediment',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const light = p.luminance >= 0.45; // a light sheet takes dark rock; a dark sheet, luminous rock
    const s = {
      pal, size: { ...size }, light,
      paper: light ? [pal.hue + 15, 12, 93] : [pal.hue, 22, 6],
      rock: light ? lerp(74, 54, p.mass) : lerp(24, 38, p.mass), // the strata's lightness, heavier songs darker (or dimmer)
      sat: pal.sat * (light ? 0.34 : 0.4), // rock is dull; the veins and the haze carry the colour
      grain: lerp(0.3, 1, p.jitter), edge: p.edge, weight: lerp(0.7, 1.5, p.mass), spread: lerp(0.7, 1.3, p.spread), stress: lerp(0.6, 1.4, p.edge),
      cps: score.cps, total: score.total,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, sheet: 0, lastCycle: null,
      waves: [], air: [], clouds: [], // the moment: ripples through the rock, fragments in the air, clouds over the surface
      strata: [], marks: [], laminae: [], pens: {}, homes: {}, lastBar: null, // laminae: the surface at every bar; pens: line part -> { x, y, cycle, sheet } where its vein last was; homes: line part -> where across the width it climbs
      surf: new Array(N + 1).fill(0), // relief of the surface per column, up from the deposition line
      folds: [], faults: [], // folds: { amp, ampTo, k, phase, since }; faults: { x, dy, at }
      role: { ...ROLE.none }, energy: 0.5, lastEnergy: 0.5, riser: 0, wasRiser: 0, dark: 0, haze: 0, hazeTo: 0, hazeTint: 0.5, washAt: -1,
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    if (s.lastCycle !== null && clock.cycle < s.lastCycle - 1) { s.sheet++; s.strata = []; s.marks = []; s.laminae = []; s.pens = {}; s.homes = {}; s.lastBar = null; s.surf.fill(0); s.folds = []; s.faults = []; s.waves = []; s.air = []; s.clouds = []; s.washAt = -1; } // the song starts over: a new sheet
    s.lastCycle = clock.cycle;
    const yOf = (c) => BASE - (BASE - TOP) * (s.total > 0 ? c / s.total : (c % FALLBACK_BARS) / FALLBACK_BARS);
    const y0 = yOf(clock.cycle), surface = (i) => y0 - s.surf[i];
    const roleName = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = ROLE[roleName] ?? ROLE.none;
    // a new stratum at the start and at every boundary: the surface as it stands closes the last and floors the next
    if (!s.strata.length || clock.boundary) {
      const profile = xs.map((_, i) => surface(i));
      const last = s.strata[s.strata.length - 1];
      if (last) { last.top = profile; last.until = clock.cycle; }
      const jump = Math.abs(clock.energy - (last ? s.lastEnergy : clock.energy));
      if (last && (s.wasRiser > 0.3 || jump > 0.35)) s.faults.push({ x: 0.15 + rand(s) * 0.7, dy: (rand(s) < 0.5 ? -1 : 1) * (0.012 + 0.045 * clamp(Math.max(s.wasRiser, jump))) * s.stress, at: clock.cycle });
      if (roleName === 'climax') { const left = FOLD_MAX - s.folds.reduce((n, f) => n + f.ampTo, 0); if (left > 0.005) s.folds.push({ amp: 0, ampTo: Math.min(left, (0.025 + 0.045 * clock.energy) * s.stress), k: 1 + rand(s) * 1.6, phase: rand(s) * TAU, since: clock.cycle }); }
      const idx = s.strata.length;
      s.strata.push({ at: clock.cycle, until: null, role: roleName, hue: s.pal.hue + HUES[idx % HUES.length], light: s.rock + (s.light ? 1 : -0.7) * LIGHTS[idx % LIGHTS.length] + (roleName === 'climax' ? (s.light ? -8 : 6) : roleName === 'release' ? (s.light ? 8 : -4) : 0), tint: 0, seed: Math.floor(rand(s) * 2 ** 31), bottom: last ? profile : xs.map(() => FLOOR), top: null });
      s.lastEnergy = clock.energy;
    }
    const cur = s.strata[s.strata.length - 1];
    const barNow = clock.index >= 0 ? clock.index * 1e4 + clock.bar : Math.floor(clock.cycle);
    if (s.lastBar !== null && barNow !== s.lastBar) s.laminae.push({ p: xs.map((_, i) => surface(i)), born: clock.cycle }); // every bar lays a lamina: the surface as it was
    s.lastBar = barNow;
    for (const k of Object.keys(want)) s.role[k] = ease(s.role[k], want[k], 1.5, dt);
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const f of s.folds) f.amp = ease(f.amp, f.ampTo, 0.35, dt); // a fold takes a few bars to grow
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 4, dt);
    s.haze = ease(s.haze, s.hazeTo, 1.5, dt); s.hazeTo = decay(s.hazeTo, 0.3, dt);
    cur.tint = ease(cur.tint, s.haze > 0.3 ? 1 : cur.tint, 0.4, dt); // the haze settles into the layer as its tint
    for (let i = 0; i <= N; i++) s.surf[i] = decay(s.surf[i], s.role.compact, dt) + (s.riser ? (rand(s) - 0.5) * 0.0015 * s.riser : 0); // compaction; a riser shakes the surface
    for (const wv of s.waves) wv.age += dt; s.waves = s.waves.filter((wv) => wv.age < wv.life);
    for (const a of s.air) { a.vy += (a.dust ? 0.15 : 2.4) * dt; a.x += a.vx * dt; a.y += a.vy * dt; a.life -= dt; }
    s.air = s.air.filter((a) => a.life > 0 && (a.dust || a.y < surface(colOf(a.x)) + 0.003)); // a fragment lands, dust dissolves
    for (const c of s.clouds) { c.x += c.vx * dt; c.life -= dt; } s.clouds = s.clouds.filter((c) => c.life > 0);
    for (const pen of Object.values(s.pens)) pen.hot = decay(pen.hot ?? 0, 3, dt);
    const wave = (x, amp, k, life, speed) => { s.waves.push({ x, amp, k, life, speed, age: 0 }); if (s.waves.length > 16) s.waves.shift(); };
    const spray = (x, y, n, up, wide, r, light, hue, dust = false) => { for (let i = 0; i < n; i++) s.air.push({ x: x + (rand(s) - 0.5) * 0.01, y, vx: (rand(s) - 0.5) * wide, vy: -up * (0.4 + rand(s) * 0.8), r: r * (0.5 + rand(s)), life: dust ? 1.2 + rand(s) : 0.7 + rand(s) * 0.7, light, hue, dust }); if (s.air.length > 600) s.air.splice(0, s.air.length - 600); };
    const j = (k) => (rand(s) - 0.5) * k * s.grain;
    const bump = (col, amt, span = 1) => { for (let i = Math.max(0, col - span); i <= Math.min(N, col + span); i++) s.surf[i] = clamp(s.surf[i] + 2.5 * amt * (1 - Math.abs(i - col) / (span + 1)), -0.04, 0.08); };
    const mark = (m) => { s.marks.push({ hue: cur.hue, born: clock.cycle, ...m }); };
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';
      const g = clamp(e.gain * e.velocity, 0, 1.5), size = s.role.size, dark = s.role.dark;
      const across = MARGIN + (1 - 2 * MARGIN) * clamp(0.5 + (e.pan - 0.5) * 1.2 + (rand(s) - 0.5) * 0.9, 0.02, 0.98); // where across the width a hit lands: pan leans it, the rest is chance
      if (slot === 'impulse') {
        if (e.role === 'pulse') {
          const col = colOf(across), r = 0.011 * (0.5 + 0.8 * g) * s.weight * size, n = s.edge > 0.6 ? 4 + Math.floor(rand(s) * 2) : 6 + Math.floor(rand(s) * 3);
          const pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU + j(0.5), rr = r * (0.7 + 0.5 * rand(s)); return [Math.cos(a) * rr * 1.3, Math.sin(a) * rr]; });
          mark({ kind: 'clast', x: across, y: surface(col) - r * 0.3, pts, light: cur.light + (s.light ? -16 : 10) * dark });
          bump(col, r * 0.6 * s.role.relief, 2);
          wave(across, 0.008 * g * s.weight, 5, 1, 1.4); spray(across, surface(col), 3 + Math.floor(rand(s) * 4), 0.45 * g, 0.2, 0.004, cur.light + (s.light ? -16 : 10), cur.hue);
        } else if (e.role === 'impact') {
          const col = colOf(across), y = surface(col), segs = 2 + Math.floor(rand(s) * 4 * g), pts = [];
          let dx = 0, dy = 0;
          for (let i = 0; i < segs; i++) { dx += (rand(s) - 0.5) * 0.02; dy += 0.008 + rand(s) * 0.02 * g; pts.push([dx, dy]); }
          mark({ kind: 'crack', x: across, y, pts, w: 0.0018 * (0.5 + g), light: cur.light + (s.light ? -30 : 20) * dark });
          const chips = 2 + Math.floor(rand(s) * 4);
          for (let i = 0; i < chips; i++) { const r = 0.002 + rand(s) * 0.005 * g, a = rand(s) * Math.PI; mark({ kind: 'clast', x: across + Math.cos(a) * rand(s) * 0.05 * s.spread, y: y - Math.sin(a) * rand(s) * 0.02, pts: [[-r, -r * 0.6], [r * 0.8, -r], [r, r * 0.7], [-r * 0.7, r]], light: cur.light + (s.light ? -20 : 14) * dark }); }
          bump(col, -0.005 * g * s.role.relief, 1); // a crater
          wave(across, 0.014 * g, 8, 0.6, 2.2); spray(across, y, 8 + Math.floor(rand(s) * 8), 0.9 * g, 0.5, 0.003, cur.light + (s.light ? -22 : 14), cur.hue); spray(across, y - 0.01, 3, 0.25, 0.15, 0.025, cur.light + (s.light ? -6 : 8), cur.hue, true);
        } else if (e.role === 'grain') { mark({ kind: 'speck', x: across, y: surface(colOf(across)) + j(0.006), r: 0.0012 + 0.0015 * g * size, light: cur.light + (s.light ? -22 : 16) * dark }); spray(across, surface(colOf(across)), 1, 0.35 * g, 0.1, 0.0025, cur.light + (s.light ? -22 : 16), cur.hue); }
        else mark({ kind: 'clast', x: across, y: surface(colOf(across)), pts: [[-0.005, -0.003], [0.005, -0.004], [0.004, 0.004], [-0.004, 0.003]].map(([a, b]) => [a * g * size, b * g * size]), light: cur.light + (s.light ? -14 : 10) * dark });
      } else if (slot === 'ground') {
        const x = across, col = colOf(x);
        const rx = (0.04 + 0.13 * clamp(e.dur / 2)) * s.spread, ry = (0.003 + 0.007 * g) * s.weight * size;
        const low = 1 - clamp(((e.note ?? 40) - 28) / 36); // a low note is denser, darker rock
        mark({ kind: 'lens', x, y: surface(col), rx, ry, hue: cur.hue - 10, light: cur.light + (s.light ? -(4 + 9 * low) : 3 + 7 * low) * dark, alpha: 0.75 });
        bump(col, ry * 1.2 * s.role.relief, Math.max(1, Math.round(rx * N)));
        wave(x, 0.005 * g * s.weight, 1.4, 1.8, 0.45); // the ground heaves, slowly
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const key = e.layer ?? slot, pen = s.pens[key], w = 0.003 * (0.4 + g) * size;
        const home = (s.homes[key] ??= { x: 0.18 + ((Object.keys(s.homes).length * 0.618 + 0.3) % 1) * 0.64, drift: 0, hue: (slot === 'line' ? s.pal.line : s.pal.line + 45) + Object.keys(s.homes).length * 18 }); // each line part climbs in its own channel across the width
        home.drift = clamp(home.drift + (rand(s) - 0.5) * 0.012, -0.07, 0.07); // the vein wanders as it climbs; the melody's motion is its jag
        const x = MARGIN + (1 - 2 * MARGIN) * clamp(home.x + home.drift + (clamp((e.note - 40) / 50) - 0.5) * 0.04 + (e.pan - 0.5) * 0.03, 0.02, 0.98), col = colOf(x), y = surface(col);
        const hue = home.hue, light = s.light ? 44 : 78;
        if (pen && pen.sheet === s.sheet && clock.cycle - pen.cycle < 1) mark({ kind: 'vein', x: pen.x, y: pen.y, x2: x, y2: y, w, erode: w * 2.5, hue, light, alpha: 0.7 }); // translucent: a dense line builds into a dyke, never a slab
        else mark({ kind: 'vein', x, y, x2: x, y2: y - 0.004, w, erode: w * 2.5, hue, light, alpha: 0.7 });
        s.pens[key] = { x, y, cycle: clock.cycle, sheet: s.sheet, hot: 1, hue, up: 0.03 + 0.08 * clamp((e.note - 40) / 50) };
        bump(col, -0.0008 * g * s.role.relief, 1); // the vein carves a channel, a little at a time
      } else if (slot === 'field') {
        if (s.t - s.washAt < 0.5) continue; // a chord is several haps at once: one breath of haze
        s.washAt = s.t;
        s.hazeTo = Math.min(1, 0.5 + 0.5 * g);
        if (e.cutoff !== null) s.hazeTint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
        s.clouds.push({ x: across, y: y0 - 0.1 - rand(s) * 0.14, rx: (0.07 + 0.1 * rand(s)) * s.spread, ry: 0.025 + 0.02 * rand(s), vx: (rand(s) - 0.5) * 0.03, life: 6, span: 6, tint: s.hazeTint }); if (s.clouds.length > 10) s.clouds.shift();
      } else if (slot === 'transition') {
        if (e.dur >= 1) for (let i = 0; i < 12; i++) { const x = MARGIN + rand(s) * (1 - 2 * MARGIN), r = 0.002 + rand(s) * 0.006; mark({ kind: 'clast', x, y: surface(colOf(x)) - rand(s) * 0.03, pts: [[-r, -r], [r, -r * 0.8], [r * 0.9, r], [-r * 0.8, r * 0.9]], light: cur.light + (s.light ? -18 : 12) }); spray(x, surface(colOf(x)), 2, 0.8, 0.3, 0.004, cur.light + (s.light ? -18 : 12), cur.hue); } // the impact: chips thrown across the surface and into the air
        if (e.dur >= 1) wave(0.5, 0.02, 2.5, 1.3, 1.2);
      } else if (e.role === 'grain' || slot === 'grain') mark({ kind: 'speck', x: across, y: surface(colOf(across)) + j(0.006), r: 0.001 + 0.0012 * g, light: cur.light + (s.light ? -18 : 14) * dark });
    }
  },

  draw(s, ctx, w, h) {
    // ponytail: the whole sheet every frame (a fold moves history), cheap primitives only; cache the settled strata to a layer when a long song's clasts drag the export
    const X = (x) => x * w, Y = (y) => y * h, R = (r) => r * h;
    const yOf = (c) => BASE - (BASE - TOP) * (s.total > 0 ? c / s.total : (c % FALLBACK_BARS) / FALLBACK_BARS);
    const y0 = s.lastCycle === null ? BASE : yOf(s.lastCycle), open = xs.map((_, i) => y0 - s.surf[i]);
    // the moment's motion on any point of the rock: each ripple spreads from its hit and fades with age, distance and depth under the surface; a riser trembles the surface
    const live = (x, y) => {
      const depth = Math.max(0, y - y0); let d = 0;
      for (const wv of s.waves) { const dist = Math.abs(x - wv.x); d += wv.amp * (1 - wv.age / wv.life) * Math.exp(-dist * 2.5 - depth * 6) * Math.sin(dist * wv.k * TAU - wv.age * wv.speed * TAU); }
      if (s.riser > 0.01) d += 0.003 * s.riser * Math.exp(-depth * 8) * Math.sin(x * 12 * TAU + s.t * 30);
      return d;
    };
    const dy = (x, y, born) => { let d = live(x, y); for (const f of s.folds) if (born < f.since) d += f.amp * Math.sin(x * f.k * TAU + f.phase) * clamp((y - TOP) / (BOTTOM - TOP)) ** 0.5; for (const f of s.faults) if (born < f.at && x > f.x) d += f.dy; return y + d; };
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hsla(...s.paper); ctx.fillRect(0, 0, w, h);
    { // the sky over the surface: the pad's tint, deeper with its level and the section's energy, so the top of the sheet is weather, not paper
      const ys = Y(Math.min(...open)), g = ctx.createLinearGradient(0, 0, 0, ys), light = s.light ? lerp(80, 90, s.hazeTint) : lerp(12, 30, s.hazeTint), a = 0.25 + 0.45 * s.haze + 0.2 * s.energy;
      g.addColorStop(0, hsla(s.pal.field + 10, s.pal.sat * 0.5, light, a * 0.5)); g.addColorStop(1, hsla(s.pal.field, s.pal.sat * 0.6, light, a));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, ys);
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the basement: older rock the song deposits on, darker, faulted and folded with everything above it
    ctx.beginPath(); ctx.moveTo(X(xs[0]), Y(FLOOR)); xs.forEach((x) => ctx.lineTo(X(x), Y(dy(x, BASE, -1)))); ctx.lineTo(X(xs[N]), Y(FLOOR)); ctx.closePath();
    ctx.fillStyle = hsla(s.pal.hue - 8, s.sat * 0.8, s.light ? s.rock - 30 : s.rock - 10); ctx.fill();
    { let r = 7; for (let k = 0; k < 500 * s.grain; k++) { r = (r + 0x6d2b79f5) | 0; const u = mul32(r); r = (r + 0x6d2b79f5) | 0; const v = mul32(r); const x = MARGIN + u * (1 - 2 * MARGIN); ctx.fillStyle = hsla(s.pal.hue - 8, s.sat * 0.8, (s.light ? s.rock - 30 : s.rock - 10) + (v > 0.5 ? -10 : 10), 0.4); ctx.fillRect(X(x), Y(dy(x, lerp(BASE, BOTTOM + 0.05, v), -1)), Math.max(1, R(0.0014)), Math.max(1, R(0.0014))); } }
    // the strata, oldest first: each a band from its floor to its top (the open one to the surface), deformed by what happened after it; a stipple gives the rock its grain
    for (const st of s.strata) {
      const top = st.top ?? open, tBorn = st.until ?? Infinity;
      const hue = lerp(st.hue, s.pal.field, 0.5 * st.tint), light = st.light + (s.light ? 4 : 3) * st.tint;
      ctx.beginPath();
      xs.forEach((x, i) => { const y = dy(x, st.bottom[i], st.at); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); });
      for (let i = N; i >= 0; i--) ctx.lineTo(X(xs[i]), Y(dy(xs[i], top[i], tBorn)));
      ctx.closePath();
      ctx.fillStyle = hsla(hue, s.sat, light); ctx.fill();
      const span = Math.max(0, (st.bottom[0] - top[0])), dots = Math.floor(420 * s.grain * clamp(span / 0.3, 0.1, 1));
      let r = st.seed;
      for (let k = 0; k < dots; k++) {
        r = (r + 0x6d2b79f5) | 0; const u = mul32(r); r = (r + 0x6d2b79f5) | 0; const v = mul32(r);
        const x = MARGIN + u * (1 - 2 * MARGIN), i = colOf(x), yb = st.bottom[i], yt = top[i];
        if (yb <= yt) continue;
        const y = lerp(yt, yb, v), born = lerp(tBorn === Infinity ? s.lastCycle ?? st.at : tBorn, st.at, v);
        ctx.fillStyle = hsla(hue, s.sat, light + (v > 0.5 ? -9 : 9) * s.grain, 0.35);
        ctx.fillRect(X(x), Y(dy(x, y, born)), Math.max(1, R(0.0014)), Math.max(1, R(0.0014)));
      }
    }
    // the laminae: a faint line per bar, the surface as it was
    ctx.lineWidth = Math.max(0.5, R(0.0007)); ctx.strokeStyle = hsla(s.paper[0], 15, s.light ? 20 : 85, 0.13);
    for (const l of s.laminae) { ctx.beginPath(); xs.forEach((x, i) => { const y = dy(x, l.p[i], l.born); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); }); ctx.stroke(); }
    // the marks, in the order they landed
    for (const m of s.marks) {
      const col = hsla(m.hue, s.sat, m.light, m.alpha ?? 1);
      if (m.kind === 'clast') {
        ctx.beginPath();
        m.pts.forEach(([px, py], i) => { const x = m.x + px * (h / w), y = dy(m.x, m.y + py, m.born); i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); });
        ctx.closePath(); ctx.fillStyle = col; ctx.fill();
      } else if (m.kind === 'crack') {
        ctx.beginPath(); ctx.moveTo(X(m.x), Y(dy(m.x, m.y, m.born)));
        for (const [px, py] of m.pts) ctx.lineTo(X(m.x + px * (h / w)), Y(dy(m.x, m.y + py, m.born)));
        ctx.lineWidth = Math.max(0.6, R(m.w)); ctx.strokeStyle = col; ctx.stroke();
      } else if (m.kind === 'speck') {
        const r = Math.max(1, R(m.r));
        ctx.fillStyle = col; ctx.fillRect(X(m.x) - r / 2, Y(dy(m.x, m.y, m.born)) - r / 2, r, r);
      } else if (m.kind === 'lens') {
        ctx.save(); ctx.translate(X(m.x), Y(dy(m.x, m.y, m.born))); ctx.scale(X(m.rx), R(m.ry));
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.restore(); ctx.fillStyle = col; ctx.fill();
      } else if (m.kind === 'vein') {
        const a = [X(m.x), Y(dy(m.x, m.y, m.born))], b = [X(m.x2), Y(dy(m.x2, m.y2, m.born))];
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineWidth = Math.max(1, R(m.erode)); ctx.strokeStyle = hsla(...s.paper, 0.1); ctx.stroke(); // the channel it carved
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineWidth = Math.max(0.7, R(m.w)); ctx.strokeStyle = col; ctx.stroke();
      }
    }
    // the faults as thin dark lines from the floor to the surface of their time
    for (const f of s.faults) { ctx.beginPath(); ctx.moveTo(X(f.x), Y(dy(f.x, FLOOR, -1))); ctx.lineTo(X(f.x), Y(dy(f.x, yOf(f.at), -1))); ctx.lineWidth = Math.max(0.6, R(0.0012)); ctx.strokeStyle = hsla(s.paper[0], 20, s.light ? 20 : 70, 0.5); ctx.stroke(); }
    // the sky: fragments and dust in the air, the pad's clouds, each pen's glow at the surface
    for (const a of s.air) {
      const f = clamp(a.life / (a.dust ? 2 : 1.4));
      if (a.dust) { const rr = R(a.r) * (2 - f); const g = ctx.createRadialGradient(X(a.x), Y(a.y), 0, X(a.x), Y(a.y), rr); g.addColorStop(0, hsla(a.hue, s.sat, a.light, 0.35 * f)); g.addColorStop(1, hsla(a.hue, s.sat, a.light, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(a.x), Y(a.y), rr, 0, TAU); ctx.fill(); }
      else { const rr = Math.max(1.5, R(a.r) * 1.6); ctx.fillStyle = hsla(a.hue, s.sat, a.light, 0.5 + 0.5 * f); ctx.fillRect(X(a.x) - rr / 2, Y(a.y) - rr / 2, rr, rr); }
    }
    for (const c of s.clouds) {
      const f = Math.sin(Math.PI * clamp(c.life / c.span)), light = s.light ? lerp(78, 92, c.tint) : lerp(30, 55, c.tint);
      ctx.save(); ctx.translate(X(c.x), Y(c.y)); ctx.scale(X(c.rx) * (1 + 0.3 * (1 - c.life / c.span)), R(c.ry));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, hsla(s.pal.field, s.pal.sat * 0.7, light, 0.35 * f)); g.addColorStop(1, hsla(s.pal.field, s.pal.sat * 0.7, light, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill(); ctx.restore(); // filled inside the transform: the gradient lives in it
    }
    for (const pen of Object.values(s.pens)) {
      if (!(pen.hot > 0.02) || pen.sheet !== s.sheet) continue;
      const px = X(pen.x), py = Y(dy(pen.x, pen.y, Infinity)), col = hsla(pen.hue, 85, s.light ? 50 : 80, pen.hot);
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, R(0.002)); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - R(pen.up) * pen.hot); ctx.stroke(); // the trace being written, up into the sky
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, R(0.004 + 0.008 * pen.hot), 0, TAU); ctx.fill();
    }
    // the haze above the surface: the pad, its brightness the cutoff
    if (s.haze > 0.01) {
      const ys = Y(Math.min(...open)), g = ctx.createLinearGradient(0, ys - R(0.22), 0, ys + R(0.02));
      const hue = s.pal.field, light = s.light ? lerp(70, 88, s.hazeTint) : lerp(30, 55, s.hazeTint);
      g.addColorStop(0, hsla(hue, s.pal.sat, light, 0)); g.addColorStop(1, hsla(hue, s.pal.sat, light, 0.6 * s.haze));
      ctx.fillStyle = g; ctx.fillRect(0, ys - R(0.22), w, R(0.24));
    }
    if (s.dark > 0.02) { ctx.fillStyle = hsla(...s.paper, 0.25 * s.dark); ctx.fillRect(0, 0, w, h); } // a dropout: the sheet veiled
  },
};
