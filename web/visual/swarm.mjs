// swarm: the song as collective behaviour. One population of agents on a dark ground, drawn as streaks along their
// motion over a persisting frame, so it reads as a flowing mass (a murmuration), never as dots. Each line part has an
// unseen leader placed by its pitch (height) and pan (side), and a share of the population follows it, so the flock
// streams toward the melody; with no line part the whole population is one flock. The bass is the global force: every
// note is a gust whose direction is the pitch class, a low note weighs the population down, its level is the cohesion
// that pulls the flock together and decays between notes. A kick is a pressure wave shoving the population outward
// from its centre; an impact splits one group against the rest; hats jitter. The pad is the environment: viscosity
// (thicker with its level) and a slow curl wind, and it lights the ground under the flock, brighter with its cutoff.
// Harmony is the relationship between groups: a leader whose note is consonant with the last bass note draws the other
// groups toward it, a dissonant one pushes them away. The world has visitors, things that come in from an edge, cross
// and leave, and the population deals with each: an impact sends a hawk diving through toward the flock (the agents
// flee it), a bass note lets a seed drift in from the side its pitch class points at (the agents are drawn to it and
// eat it away), a pad chord sends a thermal across (a slow ring that lifts and spins what flies into it); each is a
// visible object. A section's role sets the population's manner (establish: loose
// and slow; climax: tight, fast, every group pulled together; release: drifting apart); a boundary moves the
// population's home so the flock migrates across the frame; a riser aligns it into a stream and speeds it up; a
// dropout stills it. Deterministic: randomness only from the state's own seeded generator (kit.mjs); the simulation
// is plain arrays stepped at the host's fixed step, with a cell grid for the neighbourhoods.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, fadeFrame } from './kit.mjs';

const TAU = Math.PI * 2;
const N = 420, RADIUS = 0.08, CELL = 0.08; // agents, the neighbourhood, the grid cell (units: the canvas height)
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
// the population's manner per section role: how tightly it holds, how fast it flies, how much it follows its leaders, how long the frame persists
const MANNER = {
  establish: { cohere: 0.5, speed: 0.7, follow: 0.6, trail: 0.34, glow: 0.7 },
  develop: { cohere: 1, speed: 1, follow: 1, trail: 0.28, glow: 1 },
  climax: { cohere: 1.6, speed: 1.35, follow: 1.4, trail: 0.22, glow: 1.3 },
  release: { cohere: 0.4, speed: 0.75, follow: 0.5, trail: 0.36, glow: 0.8 },
  none: { cohere: 1, speed: 1, follow: 1, trail: 0.28, glow: 1 },
};
const CONSONANT = new Set([0, 3, 4, 5, 7, 8, 9]); // semitones above the bass that sit inside a chord or a fifth

export default {
  name: 'swarm',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng), aspect = size.w / size.h;
    const lines = Object.entries(score.cast).filter(([, c]) => c.slot === 'line' || c.slot === 'counter').map(([n]) => n);
    const s = {
      pal, size: { ...size }, aspect,
      bg: [pal.hue, 30, 4],
      weight: lerp(0.7, 1.4, p.mass), jitter: lerp(0.2, 1, p.jitter), spread: lerp(0.8, 1.3, p.spread), motion: lerp(0.7, 1.3, p.motion),
      cps: score.cps,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      groups: lines.length ? lines : ['flock'], // a group per line part, its agents following that part's leader
      leaders: {}, // part -> { x, y, tx, ty, note, hot }
      ax: [], ay: [], avx: [], avy: [], ag: [], // the agents: position, velocity, group index
      home: { x: aspect / 2, y: 0.5, tx: aspect / 2, ty: 0.5 },
      bass: { note: 36, cohere: 0, gust: { x: 0, y: 0 }, weight: 0.5 },
      field: { level: 0, tint: 0.5, phase: 0 },
      manner: { ...MANNER.none }, energy: 0.5, riser: 0, wasRiser: 0, dark: 0, t: 0, section: null, hueShift: 0,
      shove: 0, split: null, // a kick's pressure wave (fades), an impact's split { group, dir, life }
      visitors: [], // what comes in and leaves: { kind: 'hawk' | 'seed' | 'thermal', x, y, vx, vy, r, life, span, w, hue }
    };
    seed(s, rng);
    for (let i = 0; i < N; i++) { const a = rand(s) * TAU, r = 0.1 + rand(s) * 0.4; s.ax.push(s.home.x + Math.cos(a) * r * aspect * 0.6); s.ay.push(s.home.y + Math.sin(a) * r); s.avx.push((rand(s) - 0.5) * 0.2); s.avy.push((rand(s) - 0.5) * 0.2); s.ag.push(i % s.groups.length); }
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = MANNER[role] ?? MANNER.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.manner[k] = ease(s.manner[k], want[k], 1.2, dt);
    if (clock.boundary) { // a migration: a new home across the frame
      s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section;
      s.home.tx = s.aspect * (0.25 + rand(s) * 0.5); s.home.ty = 0.3 + rand(s) * 0.4;
    }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.home.x = ease(s.home.x, s.home.tx + Math.cos(s.t * 0.18 * s.motion) * 0.14 * s.aspect, 0.8, dt); s.home.y = ease(s.home.y, s.home.ty + Math.sin(s.t * 0.23 * s.motion) * 0.12, 0.8, dt); // home itself drifts, so a flock with no leader still flies
    const b = s.bass; b.cohere = decay(b.cohere, 0.7, dt); b.gust.x = decay(b.gust.x, 2.5, dt); b.gust.y = decay(b.gust.y, 2.5, dt);
    s.field.level = decay(s.field.level, 0.4, dt); s.field.phase += dt * 0.15 * s.motion;
    s.shove = decay(s.shove, 6, dt);
    if (s.split) { s.split.life -= dt; if (s.split.life <= 0) s.split = null; }
    for (const v of s.visitors) { // a hawk keeps turning toward the flock's home until it has passed through, then flies on out
      v.x += v.vx * dt; v.y += v.vy * dt; v.life -= dt;
      if (v.kind === 'hawk' && !v.through) { const d = Math.hypot(s.home.x - v.x, s.home.y - v.y); if (d < 0.12) v.through = true; else { const sp = Math.hypot(v.vx, v.vy); v.vx = ease(v.vx, ((s.home.x - v.x) / d) * sp, 1.5, dt); v.vy = ease(v.vy, ((s.home.y - v.y) / d) * sp, 1.5, dt); } }
    }
    s.visitors = s.visitors.filter((v) => v.life > 0 && v.r > 0.002 && v.x > -0.3 && v.x < s.aspect + 0.3 && v.y > -0.3 && v.y < 1.3);
    const enter = (kind, a, speed, r, span, w = 1) => { // a visitor from the edge in direction a from home, aimed across it
      if (s.visitors.length >= 8) return;
      const far = 0.9, x = clamp(s.home.x + Math.cos(a) * far * s.aspect, -0.15, s.aspect + 0.15), y = clamp(s.home.y + Math.sin(a) * far, -0.15, 1.15);
      const d = Math.hypot(s.home.x - x, s.home.y - y) || 1;
      s.visitors.push({ kind, x, y, vx: ((s.home.x - x) / d) * speed, vy: ((s.home.y - y) / d) * speed, r, life: span, span, w, hue: rand(s) * 60, through: false });
    };
    Object.values(s.leaders).forEach((l, k) => {
      l.hot = decay(l.hot, 0.8, dt);
      if (l.hot < 0.25) { const a = s.t * 0.25 * s.motion + k * 2.1; l.tx = s.home.x + Math.cos(a) * 0.3 * s.aspect * s.spread; l.ty = s.home.y + Math.sin(a * 1.3) * 0.28; } // between phrases a leader wanders around home, so the flock keeps flying
      l.x = ease(l.x, l.tx, 4, dt); l.y = ease(l.y, l.ty, 4, dt);
    });
    // the events
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') s.shove = Math.max(s.shove, g);
        else if (e.role === 'impact') { s.split = { group: Math.floor(rand(s) * s.groups.length), dir: rand(s) * TAU, life: 0.25, w: g }; if (!s.visitors.some((v) => v.kind === 'hawk' && v.life > 1)) enter('hawk', rand(s) * TAU, 0.7 + 0.5 * g, 0.03, 4, g); } // one hawk at a time
        else if (e.role === 'grain') for (let i = 0; i < N; i++) { s.avx[i] += (rand(s) - 0.5) * 0.12 * g * s.jitter; s.avy[i] += (rand(s) - 0.5) * 0.12 * g * s.jitter; }
        else s.shove = Math.max(s.shove, 0.4 * g);
      } else if (slot === 'ground') {
        if (e.note !== null) { b.note = e.note; b.weight = 1 - clamp((e.note - 24) / 36); }
        b.cohere = Math.min(1.5, b.cohere + 0.8 * g);
        const a = ((b.note % 12) / 12) * TAU; b.gust.x += Math.cos(a) * 0.35 * g; b.gust.y += Math.sin(a) * 0.35 * g;
        if (!s.visitors.some((v) => v.kind === 'seed' && v.life > v.span * 0.6)) enter('seed', a + Math.PI, 0.12 + 0.08 * g, 0.012 + 0.01 * g, 9, g); // a seed drifts in with the gust, from the side the note points away from
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const name = e.layer ?? slot, l = (s.leaders[name] ??= { x: s.home.x, y: s.home.y, tx: s.home.x, ty: s.home.y, note: e.note, hot: 0 });
        l.tx = s.aspect * clamp(0.15 + 0.7 * e.pan + (rand(s) - 0.5) * 0.1, 0.05, 0.95); l.ty = 0.85 - clamp((e.note - 40) / 50) * 0.7; l.note = e.note; l.hot = 1;
      } else if (slot === 'field') {
        s.field.level = Math.min(1, 0.5 + 0.5 * g);
        if (e.cutoff !== null) s.field.tint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
        if (!s.visitors.some((v) => v.kind === 'thermal')) enter('thermal', rand(s) < 0.5 ? Math.PI : 0, 0.08 * s.motion, (0.16 + 0.1 * g) * s.spread, 14, g); // a thermal crosses from one side, slowly
      } else if (slot === 'transition') {
        if (e.dur >= 1) s.shove = Math.max(s.shove, 1.5);
      } else if (slot === 'grain' || e.role === 'grain') for (let i = 0; i < N; i += 3) { s.avx[i] += (rand(s) - 0.5) * 0.08 * g; s.avy[i] += (rand(s) - 0.5) * 0.08 * g; }
    }
    // the population: boids in a cell grid, plus the song's forces
    const { ax, ay, avx, avy, ag, aspect } = s, m = s.manner;
    const cells = new Map(); const key = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    for (let i = 0; i < N; i++) { const k = key(ax[i], ay[i]); (cells.get(k) ?? cells.set(k, []).get(k)).push(i); }
    const leaderOf = s.groups.map((gname) => s.leaders[gname] ?? null);
    const affinity = s.groups.map((gname) => { const l = s.leaders[gname]; if (!l) return 0; const iv = ((l.note - s.bass.note) % 12 + 12) % 12; return (CONSONANT.has(iv) ? 1 : -1) * l.hot; }); // consonant with the bass: the group draws the others; dissonant: pushes them
    const still = s.dark, drag = lerp(1.2, 3.2, s.field.level), vmax = lerp(0.3, 0.65, s.energy) * m.speed * (1 + 0.6 * s.riser) * (1 - 0.8 * still), vmin = 0.06 * (1 - still);
    const wind = (x, y) => { const p = s.field.phase; return [Math.sin(y * 4.1 + p) * Math.cos(x * 2.3 - p * 0.7), Math.cos(x * 3.7 - p) * Math.sin(y * 2.9 + p * 0.6)]; };
    for (let i = 0; i < N; i++) {
      const x = ax[i], y = ay[i], gi = ag[i];
      let cx = 0, cy = 0, sx = 0, sy = 0, alx = 0, aly = 0, n = 0;
      const cxi = Math.floor(x / CELL), cyi = Math.floor(y / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const bucket = cells.get(`${cxi + dx},${cyi + dy}`); if (!bucket) continue;
        for (const j of bucket) {
          if (j === i) continue;
          const ddx = ax[j] - x, ddy = ay[j] - y, d = Math.hypot(ddx, ddy);
          if (d > RADIUS || d === 0) continue;
          n++; cx += ddx; cy += ddy; alx += avx[j]; aly += avy[j];
          if (d < RADIUS * 0.45) { sx -= ddx / d * (RADIUS * 0.45 - d); sy -= ddy / d * (RADIUS * 0.45 - d); }
        }
      }
      let fx = 0, fy = 0;
      if (n) { fx += (cx / n) * 1.6 * m.cohere * (0.5 + s.bass.cohere) + (alx / n - avx[i]) * (3 + 6 * s.riser) + sx * 40; fy += (cy / n) * 1.6 * m.cohere * (0.5 + s.bass.cohere) + (aly / n - avy[i]) * (3 + 6 * s.riser) + sy * 40; }
      // the leader of this group, and the other groups' leaders by their affinity
      const L = leaderOf[gi];
      if (L) { fx += (L.x - x) * 1.6 * m.follow * (0.3 + L.hot); fy += (L.y - y) * 1.6 * m.follow * (0.3 + L.hot); }
      for (let k = 0; k < leaderOf.length; k++) { const O = leaderOf[k]; if (!O || k === gi || !affinity[k]) continue; const ddx = O.x - x, ddy = O.y - y, d = Math.hypot(ddx, ddy) + 0.05; fx += (ddx / d) * 0.5 * affinity[k]; fy += (ddy / d) * 0.5 * affinity[k]; }
      // home (soft), the bass's weight and gust, the pad's wind, a kick's pressure wave, an impact's split
      fx += (s.home.x - x) * 0.45; fy += (s.home.y - y) * 0.45 + 0.25 * (s.bass.weight - 0.5) * s.weight;
      fx += s.bass.gust.x * 2; fy += s.bass.gust.y * 2;
      const [wx, wy] = wind(x, y); fx += wx * 0.6 * s.field.level; fy += wy * 0.6 * s.field.level;
      if (s.shove > 0.01) { const ddx = x - s.home.x, ddy = y - s.home.y, d = Math.hypot(ddx, ddy) + 0.02; fx += (ddx / d) * 1.3 * s.shove / (1 + d * 4); fy += (ddy / d) * 1.3 * s.shove / (1 + d * 4); }
      if (s.split) { const sign = gi === s.split.group ? 1 : -0.4; fx += Math.cos(s.split.dir) * 2.5 * s.split.w * sign; fy += Math.sin(s.split.dir) * 2.5 * s.split.w * sign; }
      // the visitors: flee a hawk, feed on a seed (and wear it away), ride a thermal
      for (const v of s.visitors) {
        const ddx = x - v.x, ddy = y - v.y, d = Math.hypot(ddx, ddy) + 0.01;
        if (v.kind === 'hawk') { if (d < 0.25) { const f = (1 - d / 0.25) * 2.5 * v.w; fx += (ddx / d) * f; fy += (ddy / d) * f; } }
        else if (v.kind === 'seed') { if (d < 0.4) { fx -= (ddx / d) * 0.9 * v.w * (1 - d / 0.4); fy -= (ddy / d) * 0.9 * v.w * (1 - d / 0.4); } if (d < 0.05) v.r -= 0.0001 * dt; }
        else if (d < v.r) { const f = 1 - d / v.r; fy -= 0.5 * f * v.w; fx += (-ddy / d) * 0.6 * f; fy += (ddx / d) * 0.6 * f; }
      }
      // walls
      if (x < 0.06) fx += (0.06 - x) * 30; if (x > aspect - 0.06) fx -= (x - aspect + 0.06) * 30;
      if (y < 0.06) fy += (0.06 - y) * 30; if (y > 0.94) fy -= (y - 0.94) * 30;
      // integrate with drag and the speed band
      let vx = (avx[i] + fx * dt) * Math.exp(-drag * dt * 0.3), vy = (avy[i] + fy * dt) * Math.exp(-drag * dt * 0.3);
      const v = Math.hypot(vx, vy);
      if (v > vmax) { vx *= vmax / v; vy *= vmax / v; } else if (v < vmin && v > 1e-6) { vx *= vmin / v; vy *= vmin / v; }
      avx[i] = vx; avy[i] = vy; ax[i] = x + vx * dt; ay[i] = y + vy * dt;
    }
  },

  draw(s, ctx, w, h) {
    const { pal, manner } = s, hue = pal.hue + s.hueShift, lit = 1 - 0.5 * s.dark;
    const X = (x) => (x / s.aspect) * w, Y = (y) => y * h, R = (r) => r * h;
    fadeFrame(ctx, w, h, s.bg, clamp(manner.trail + 0.08 * s.riser, 0.08, 0.5));
    // the ground: the pad's light under the population's home, brighter with its cutoff
    if (s.field.level > 0.02) {
      const g = ctx.createRadialGradient(X(s.home.x), Y(s.home.y), 0, X(s.home.x), Y(s.home.y), R(0.7) * s.spread);
      g.addColorStop(0, hsla(pal.field + s.hueShift, pal.sat, lerp(22, 48, s.field.tint), 0.35 * s.field.level * lit)); g.addColorStop(1, hsla(pal.field + s.hueShift, pal.sat, 20, 0));
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // the population: a streak per agent along its velocity, its group's hue, brighter with speed
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const { ax, ay, avx, avy, ag } = s, glow = manner.glow * lerp(0.6, 1, s.energy) * lit;
    for (let i = 0; i < N; i++) {
      const v = Math.hypot(avx[i], avy[i]), gi = ag[i], gh = s.groups.length > 1 ? pal.line + s.hueShift + gi * 40 : hue;
      const len = R(0.01 + 0.04 * v) * s.weight, ux = v > 1e-6 ? avx[i] / v : 1, uy = v > 1e-6 ? avy[i] / v : 0;
      const x = X(ax[i]), y = Y(ay[i]);
      ctx.strokeStyle = hsla(gh, pal.sat, lerp(48, 70, clamp(v / 0.6)), clamp(0.16 + 0.28 * v) * glow); ctx.lineWidth = Math.max(1, R(0.0024) * s.weight);
      ctx.beginPath(); ctx.moveTo(x - ux * len, y - uy * len); ctx.lineTo(x, y); ctx.stroke();
    }
    // the visitors: a hawk a dark wedge along its flight with a thin lit edge, a seed a warm pulsing glow, a thermal a ring of turning dashes with a faint lift inside
    for (const v of s.visitors) {
      const f = Math.sin(Math.PI * clamp(v.life / v.span)) ** 0.5, x = X(v.x), y = Y(v.y);
      if (v.kind === 'hawk') {
        const a = Math.atan2(v.vy, v.vx), L = R(0.07) * (0.7 + 0.5 * v.w), W = R(0.028);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = hsla(s.bg[0], 40, 2, 0.95 * f); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.lineTo(x + Math.cos(a + 2.6) * W, y + Math.sin(a + 2.6) * W); ctx.lineTo(x - Math.cos(a) * L * 0.25, y - Math.sin(a) * L * 0.25); ctx.lineTo(x + Math.cos(a - 2.6) * W, y + Math.sin(a - 2.6) * W); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hsla(hue + 180, 60, 80, 0.6 * f); ctx.lineWidth = Math.max(1, R(0.0015)); ctx.stroke();
      } else if (v.kind === 'seed') {
        ctx.globalCompositeOperation = 'lighter';
        const rr = R(v.r) * (1.5 + 0.3 * Math.sin(s.t * 6)), g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.5);
        g.addColorStop(0, hsla(40 + v.hue, 90, 78, 0.8 * f * lit)); g.addColorStop(0.35, hsla(40 + v.hue, 90, 65, 0.2 * f * lit)); g.addColorStop(1, hsla(40 + v.hue, 90, 60, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr * 2.5, 0, TAU); ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = Math.max(1, R(0.002));
        for (let ring = 0; ring < 3; ring++) {
          const rr = R(v.r) * (0.45 + 0.28 * ring + 0.03 * Math.sin(s.t * 1.5 + ring)), n = 10 + ring * 6, spin = s.t * (0.5 - 0.12 * ring) * s.motion * (ring % 2 ? -1 : 1);
          ctx.strokeStyle = hsla(pal.field + s.hueShift, pal.sat, 60, (0.35 - 0.08 * ring) * f * lit);
          for (let k = 0; k < n; k++) { const a0 = spin + (k / n) * TAU; ctx.beginPath(); ctx.arc(x, y, rr, a0, a0 + TAU / n * 0.45); ctx.stroke(); }
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    if (s.riser > 0.01) { const v = ctx.createRadialGradient(w / 2, h / 2, R(0.4), w / 2, h / 2, Math.hypot(w, h) * 0.55); v.addColorStop(0, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.6 * s.riser})`); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
  },
};
