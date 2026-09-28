// dish: the song under a microscope. A round petri dish lit from below overflows the frame, the water on it full of
// drifting specks, and every part of the song is a species living in it. Each hit of a part is born a new microbe of
// that species (it swells up from a point, nothing ever pops or dies), until the species reaches its number; after that
// each hit moves the species instead. A common part (hats, a kick) breeds small microbes and many of them; a rare one
// (a pad chord, an fx hit) breeds big ones and few: the size comes from the part's hits per bar (the score's, refined by
// counting), the number from the size, so every species takes about the same share of the dish. Each species has its
// own colour, shape (blob, rod, spiky, star, ring, diatom, tadpole) and way of moving (run-and-tumble, jetting, gliding
// on curves, wiggling behind a flagellum, an amoeba's crawl), drawn from the seed within what its kind suits, and every
// hit of its part is that species' move: a tumble turns, a jet squashes and shoots, a glide flips its curve, a wiggle
// speeds up, a crawl throws a pseudopod; the nucleus lights on each hit. A pitched part's newborn arrives where its note
// (height) and pan (side) say, a drum's around its species' home, so a species reads as a colony. The microbes meet:
// no two overlap (pushed apart to touching, the lighter giving way), a touch between species turns both away and
// lights them, kin nearby draw together and strangers keep a distance. Every hit ripples the water from the microbe
// it made or moved, two crests spreading and fading, and a crest passing a microbe shoves it. The kick is also a
// pressure wave through the water, the bass also the current (its pitch class the direction), the pad also the lamp
// (its level the illumination, its cutoff tungsten or LED). A riser racks the focus, an fx impact flashes the lamp, a
// boundary drops a diffusing stain, a dropout dims the lamp and stills the water. Deterministic: randomness only from
// the state's own seeded generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, ring } from './kit.mjs';

const TAU = Math.PI * 2;
const R = 0.6, DUST = 200; // the dish radius, the specks in the water (units: the canvas height)
const GUESS = { drums: 4, bass: 2, melody: 3, pad: 0.5, fx: 0.1, perc: 4, sample: 2, raw: 2 }, VOICE_GUESS = { bd: 2, sd: 1, cp: 1, rim: 1, hh: 4, oh: 2 }; // hits per bar before any are counted
const SHAPES = { drums: ['blob', 'spiky', 'diatom', 'rod'], bass: ['blob', 'rod', 'ring'], melody: ['tadpole', 'rod', 'star'], pad: ['ring', 'star', 'diatom'], fx: ['star', 'spiky'], perc: ['spiky', 'diatom', 'blob'], sample: ['rod', 'blob'], raw: ['blob'] };
const MOTIONS = { drums: ['jet', 'tumble'], bass: ['crawl', 'glide'], melody: ['wiggle', 'glide'], pad: ['glide', 'crawl'], fx: ['jet', 'crawl'], perc: ['tumble', 'wiggle'], sample: ['tumble', 'jet'], raw: ['tumble'] };
const inDish = (s, x, y, r = 0) => Math.hypot(x - s.cx, y - s.cy) < R - r;
/** A species' microbe radius from its part's hits per bar, and how many of them the dish holds (each species gets about the same area). */
export const sizeOf = (rate, mass = 1) => clamp((0.065 * mass) / (1 + rate) ** 0.65, 0.012, 0.075);
export const capOf = (size) => Math.max(3, Math.round(0.008 / (size * size)));

export default {
  name: 'dish',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng), aspect = size.w / size.h;
    const rates = {}; // part -> hits per bar, the most it plays in any section
    for (const sec of score.sections) for (const [n, part] of Object.entries(sec.parts ?? {})) rates[n] = Math.max(rates[n] ?? 0, part.onsets);
    const s = {
      pal, size: { ...size }, aspect, cx: aspect / 2, cy: 0.5,
      jitter: lerp(0.5, 1.5, p.jitter), motion: lerp(0.6, 1.4, p.motion), mass: lerp(0.8, 1.2, p.mass),
      rates, kindOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.kind])),
      species: {}, microbes: [], dust: [], ripples: [], nsp: 0, // ripples: { x, y, r, v, life, span, w }, one per hit, spreading and fading
      current: { a: 0, str: 0 }, lamp: { level: 0.3, warm: 0.5 },
      pulse: 0, flash: 0, riser: 0, dark: 0, energy: 0.5, stain: { x: aspect / 2, y: 0.5, r: 0, hue: 0, a: 0 }, hueShift: 0, hueTo: 0,
      t: 0, section: null,
    };
    seed(s, rng);
    for (let i = 0; i < DUST; i++) { const a = rand(s) * TAU, d = Math.sqrt(rand(s)) * R; s.dust.push({ x: s.cx + Math.cos(a) * d, y: s.cy + Math.sin(a) * d, ph: rand(s) * TAU }); }
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    if (clock.boundary) { // a drop of stain lands somewhere on the dish and diffuses out
      s.section = clock.section; const a = rand(s) * TAU, d = rand(s) * R * 0.6;
      s.stain = { x: s.cx + Math.cos(a) * d, y: s.cy + Math.sin(a) * d, r: 0.02, hue: ((clock.index * 47) % 60) - 30, a: 1 };
      s.hueTo = s.stain.hue;
    }
    s.stain.r += dt * 0.08 * s.motion; s.stain.a = decay(s.stain.a, 0.12, dt); s.hueShift = ease(s.hueShift, s.hueTo, 0.3, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.pulse = decay(s.pulse, 3, dt); s.flash = decay(s.flash, 5, dt);
    s.current.str = decay(s.current.str, 0.8, dt); s.lamp.level = decay(s.lamp.level, 0.3, dt);
    const bars = clock.cycle; // song cycles: bars, near enough, for a rate
    // the events: each a birth (or, at the species' number, its move), plus what the kick, bass and pad do to the water
    for (const e of events) {
      const kind = s.kindOf[e.layer] ?? e.kind ?? 'raw', key = kind === 'drums' ? `${e.layer ?? 'drums'}:${e.voice ?? 'x'}` : (e.layer ?? kind), g = clamp(e.gain * e.velocity, 0, 1.5);
      const sp = s.species[key] ??= newSpecies(s, key, kind, e);
      sp.n++; if (sp.t0 === null) sp.t0 = bars;
      const counted = sp.n / Math.max(1, bars - sp.t0), w = clamp((bars - sp.t0) / 8); // the counted rate takes over from the guess within eight bars
      sp.size = sizeOf(lerp(sp.guess, counted, w), s.mass); sp.cap = capOf(sp.size);
      let at = null, k = 0; // where the hit ripples the water: the newborn, else one member of the species by lot
      if (sp.count < sp.cap) { at = born(s, sp, e); sp.count++; }
      const newborn = !!at;
      for (const m of s.microbes) if (m.sp === key) { move(s, m, sp, g); if (!newborn && rand(s) * ++k < 1) at = m; }
      if (s.ripples.length >= 48) s.ripples.shift();
      s.ripples.push({ x: at.x, y: at.y, r: sp.size, v: 0.2 + 0.12 * g, life: 0, span: 1.2 + 0.6 * g, w: clamp(g) });
      if (kind === 'fx') { if (e.dur >= 1) s.flash = 1; }
      else if (e.role === 'pulse' || (kind === 'drums' && e.voice === 'bd')) s.pulse = Math.max(s.pulse, g);
      else if (kind === 'bass') { if (e.note !== null) s.current.a = ((e.note % 12) / 12) * TAU; s.current.str = Math.min(1.2, s.current.str + 0.6 * g); }
      else if (kind === 'pad') { s.lamp.level = Math.min(1, 0.5 + 0.5 * g); if (e.cutoff !== null) s.lamp.warm = 1 - clamp(Math.log(e.cutoff / 200) / Math.log(40)); }
    }
    // the water: the current, a kick's wave, the walls; each microbe its species' way of moving
    const still = s.dark, vm = s.motion * (1 - 0.9 * still);
    const flow = (x, y) => [Math.cos(s.current.a) * s.current.str * 0.06, Math.sin(s.current.a) * s.current.str * 0.06];
    for (const rp of s.ripples) { rp.r += rp.v * dt; rp.life += dt; }
    s.ripples = s.ripples.filter((rp) => rp.life < rp.span);
    for (const m of s.microbes) {
      const sp = s.species[m.sp];
      m.age += dt; m.r = ease(m.r, sp.size * m.scale, m.age < 1.5 ? 2.5 : 0.5, dt); // born from a point, then following the species' size as it settles
      m.rc = m.r * (sp.shape === 'rod' || sp.shape === 'tadpole' ? 1.8 : 1); // its reach for contact: a rod is long
      m.squash = decay(m.squash, 5, dt); m.flash = decay(m.flash, 3, dt); m.ph += dt * (0.6 + 0.4 * s.energy); m.run -= dt;
      let ax = 0, ay = 0, speed = 0;
      if (sp.motion === 'tumble') { if (m.run <= 0) { m.a = rand(s) * TAU; m.run = 1 + rand(s) * 2.5; } speed = 0.05; }
      else if (sp.motion === 'jet') { speed = 0.015; m.a += Math.sin(m.ph * 0.7) * 0.4 * dt; }
      else if (sp.motion === 'glide') { m.a += m.turn * dt; speed = 0.035; }
      else if (sp.motion === 'wiggle') { m.a += Math.sin(m.ph * 3) * 1.2 * dt + m.turn * 0.3 * dt; speed = 0.04; }
      else { speed = 0.012; if (m.run <= 0) { m.a = rand(s) * TAU; m.run = 3 + rand(s) * 4; } } // crawl: a slow amoeba, changing its mind now and then
      speed *= vm * (1 + 0.5 * s.energy) * (0.012 / Math.max(0.012, sp.size)) ** 0.3; // the small are quick, the big slow
      ax += Math.cos(m.a) * speed * 6; ay += Math.sin(m.a) * speed * 6;
      ax += (rand(s) - 0.5) * 0.15 * s.jitter * (1 - still); ay += (rand(s) - 0.5) * 0.15 * s.jitter * (1 - still);
      const [wx, wy] = flow(m.x, m.y); ax += wx * 3; ay += wy * 3;
      const dx = m.x - s.cx, dy = m.y - s.cy, d = Math.hypot(dx, dy) + 0.02, out = d / R; // the meniscus: the water is deepest in the middle
      ax -= (dx / d) * out * out * 0.3; ay -= (dy / d) * out * out * 0.3;
      if (s.pulse > 0.02) { ax += (dx / d) * 0.5 * s.pulse; ay += (dy / d) * 0.5 * s.pulse; }
      for (const rp of s.ripples) { const rx = m.x - rp.x, ry = m.y - rp.y, rd = Math.hypot(rx, ry) + 1e-4; if (Math.abs(rd - rp.r) < 0.03) { const k = rp.w * (1 - rp.life / rp.span) * 0.6; ax += (rx / rd) * k; ay += (ry / rd) * k; } } // a ripple's front passing it gives it a shove
      m.vx = (m.vx + ax * dt) * Math.exp(-2.5 * dt); m.vy = (m.vy + ay * dt) * Math.exp(-2.5 * dt);
      const v = Math.hypot(m.vx, m.vy), vmax = 0.25 * vm + 0.3 * m.squash; if (v > vmax) { m.vx *= vmax / v; m.vy *= vmax / v; }
      m.x += m.vx * dt; m.y += m.vy * dt;
    }
    // contact: every pair within reach, through a grid of the dish. No two overlap (pushed apart to touching, the lighter giving way); a touch between species turns both away and lights them; kin nearby draw together, strangers keep a distance
    const CELL = 0.16, cells = new Map(), keyOf = (x, y) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    s.microbes.forEach((m, i) => { const k = keyOf(m.x, m.y); (cells.get(k) ?? cells.set(k, []).get(k)).push(i); });
    for (let i = 0; i < s.microbes.length; i++) {
      const m = s.microbes[i], cxi = Math.floor(m.x / CELL), cyi = Math.floor(m.y / CELL);
      for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
        const bucket = cells.get(`${cxi + gx},${cyi + gy}`); if (!bucket) continue;
        for (const j of bucket) {
          if (j <= i) continue;
          const o = s.microbes[j], ox = o.x - m.x, oy = o.y - m.y, d = Math.hypot(ox, oy) + 1e-5, reach = m.rc + o.rc, same = m.sp === o.sp, nx = ox / d, ny = oy / d;
          if (d < reach) {
            const gap = reach - d, wm = o.r / (m.r + o.r + 1e-6);
            m.x -= nx * gap * wm; m.y -= ny * gap * wm; o.x += nx * gap * (1 - wm); o.y += ny * gap * (1 - wm);
            const vn = (o.vx - m.vx) * nx + (o.vy - m.vy) * ny; if (vn < 0) { m.vx += nx * vn * wm; m.vy += ny * vn * wm; o.vx -= nx * vn * (1 - wm); o.vy -= ny * vn * (1 - wm); }
            if (!same) { m.a = Math.atan2(-ny, -nx) + (rand(s) - 0.5) * 0.6; o.a = Math.atan2(ny, nx) + (rand(s) - 0.5) * 0.6; m.flash = Math.max(m.flash, 0.35); o.flash = Math.max(o.flash, 0.35); }
          } else if (d < reach * 2.5) {
            const f = (same ? 0.05 : -0.07) * (1 - d / (reach * 2.5)) * dt;
            m.vx += nx * f; m.vy += ny * f; o.vx -= nx * f; o.vy -= ny * f;
          }
        }
      }
    }
    for (const m of s.microbes) { // the dish wall: nothing passes
      const ex = m.x - s.cx, ey = m.y - s.cy, ed = Math.hypot(ex, ey);
      if (ed > R - m.r) { m.x = s.cx + (ex / ed) * (R - m.r); m.y = s.cy + (ey / ed) * (R - m.r); const vn = (m.vx * ex + m.vy * ey) / ed; if (vn > 0) { m.vx -= (ex / ed) * vn; m.vy -= (ey / ed) * vn; } m.a = Math.atan2(-ey, -ex) + (rand(s) - 0.5); }
    }
    for (const du of s.dust) { const [wx, wy] = flow(du.x, du.y); du.ph += dt; du.x += (wx * 1.5 + Math.sin(du.ph * 1.3) * 0.004) * dt; du.y += (wy * 1.5 + Math.cos(du.ph * 0.9) * 0.004) * dt; if (!inDish(s, du.x, du.y, 0.01)) { const a = Math.atan2(du.y - s.cy, du.x - s.cx); du.x = s.cx - Math.cos(a) * R * 0.9; du.y = s.cy - Math.sin(a) * R * 0.9; } } // the water: specks on the flow, one leaving at the rim comes back in on the far side
  },

  draw(s, ctx, w, h) {
    const { pal, lamp } = s, hue = pal.hue + s.hueShift, lit = 1 - 0.6 * s.dark, glow = lerp(0.35, 1, lamp.level) * lit + s.flash;
    const X = (x) => (x / s.aspect) * w, Y = (y) => y * h, S = (r) => r * h;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hsla(hue, 18, 4); ctx.fillRect(0, 0, w, h); // the bench
    ctx.save();
    const zoom = 1 + 0.3 * s.riser; ctx.translate(X(s.cx), Y(s.cy)); ctx.scale(zoom, zoom); ctx.translate(-X(s.cx), -Y(s.cy)); // the focus rack
    // the dish: agar lit from below in the lamp's colour (tungsten or LED, a neutral white between), a rim, the pressure wave, the stain, the water's specks
    const lampHue = lamp.warm > 0.5 ? 40 : 205, lampSat = Math.abs(lamp.warm - 0.5) * 70, cx = X(s.cx), cy = Y(s.cy), r = S(R);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, hsla(lampHue, lampSat, lerp(10, 36, glow))); g.addColorStop(0.85, hsla(lampHue, lampSat, lerp(7, 26, glow))); g.addColorStop(1, hsla(lampHue, lampSat, lerp(12, 42, glow)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    if (s.stain.a > 0.01) { const sg = ctx.createRadialGradient(X(s.stain.x), Y(s.stain.y), 0, X(s.stain.x), Y(s.stain.y), S(s.stain.r)); sg.addColorStop(0, hsla(hue + 120, 60, 40, 0.5 * s.stain.a * lit)); sg.addColorStop(1, hsla(hue + 120, 60, 40, 0)); ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h); ctx.restore(); }
    if (s.pulse > 0.02) { ctx.strokeStyle = hsla(lampHue, lampSat, 85, 0.5 * s.pulse * lit); ctx.lineWidth = Math.max(1, S(0.006)); ctx.beginPath(); ctx.arc(cx, cy, r * (1 - s.pulse * 0.9), 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = hsla(lampHue, lampSat, lerp(30, 70, glow), 0.9); ctx.lineWidth = Math.max(1, S(0.008)); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = hsla(lampHue, lampSat, 90, 0.25 * glow); ctx.lineWidth = Math.max(1, S(0.002)); ctx.beginPath(); ctx.arc(cx, cy, r * 0.965, 0, TAU); ctx.stroke();
    ctx.fillStyle = hsla(lampHue, lampSat, 85, 0.35 * glow);
    for (const du of s.dust) { const k = Math.max(1, S(0.0022)); ctx.fillRect(X(du.x) - k / 2, Y(du.y) - k / 2, k, k); }
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); // the ripples: two crests per hit spreading out and fading, inside the dish
    for (const rp of s.ripples) { const f = (1 - rp.life / rp.span) * rp.w; ctx.lineWidth = Math.max(1, S(0.005) * f + 1); ctx.strokeStyle = hsla(lampHue, lampSat, 95, 0.8 * f * glow); ctx.beginPath(); ctx.arc(X(rp.x), Y(rp.y), S(rp.r), 0, TAU); ctx.stroke(); ctx.lineWidth = Math.max(1, S(0.0025)); ctx.strokeStyle = hsla(lampHue, lampSat, 95, 0.4 * f * glow); ctx.beginPath(); ctx.arc(X(rp.x), Y(rp.y), S(rp.r) * 0.84, 0, TAU); ctx.stroke(); }
    ctx.restore();
    // the microbes, smallest first so the big sit over the crowd: each its species' shape and colour, a nucleus lit by its part's hits
    ctx.lineCap = 'round';
    for (const m of [...s.microbes].sort((a, b) => a.r - b.r)) {
      const sp = s.species[m.sp], x = X(m.x), y = Y(m.y), rr = S(m.r), sh = sp.hue + s.hueShift, a = clamp(m.age / 1.5), lum = lerp(sp.light, 90, m.flash);
      if (rr < 0.5) continue;
      const sx = 1 + 0.3 * m.squash, sy = 1 - 0.3 * m.squash;
      const wob = (t) => 1 + 0.05 * Math.sin(3 * t + m.ph) + 0.03 * Math.sin(5 * t - m.ph * 1.7);
      const shape = sp.shape === 'spiky' ? (t) => rr * (0.85 + 0.25 * Math.abs(Math.sin(4.5 * t + m.ph * 0.2))) : sp.shape === 'star' ? (t) => rr * (0.75 + 0.3 * Math.cos(5 * (t - m.a))) : sp.shape === 'diatom' ? () => rr : (t) => rr * wob(t);
      const stretch = sp.shape === 'rod' || sp.shape === 'tadpole' ? 2.1 : 1, sides = sp.shape === 'diatom' ? sp.sides : rr < 6 ? 12 : 32; // few segments on a small one
      if (sp.shape === 'tadpole') { // a flagellum waving behind the heading
        ctx.strokeStyle = hsla(sh, sp.sat, lum, 0.7 * a * lit); ctx.lineWidth = Math.max(1, S(0.0018)); ctx.beginPath();
        for (let k = 0; k <= 8; k++) { const t = k / 8, L = rr * (stretch + 2.5 * t), side = Math.sin(m.ph * 6 - t * 7) * rr * 0.5 * t; const px = x - Math.cos(m.a) * L - Math.sin(m.a) * side, py = y - Math.sin(m.a) * L + Math.cos(m.a) * side; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
      ring(ctx, x, y, sides, shape, stretch * sx, sy, m.a);
      if (sp.shape === 'ring') { ctx.strokeStyle = hsla(sh, sp.sat, lum, 0.7 * a * lit); ctx.lineWidth = Math.max(1, rr * 0.35); ctx.stroke(); }
      else {
        ctx.fillStyle = hsla(sh, sp.sat, sp.light, 0.13 * a * glow); ctx.fill();
        ctx.strokeStyle = hsla(sh, sp.sat, lum, 0.85 * a * lit); ctx.lineWidth = Math.max(1, S(0.003) * s.mass); ctx.stroke();
      }
      if (sp.shape === 'diatom') { ctx.strokeStyle = hsla(sh, sp.sat, lum, 0.4 * a * lit); ctx.lineWidth = 1; for (let k = 1; k < sides; k++) { const t = m.a + (k / sides) * TAU; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t) * rr * 0.9, y + Math.sin(t) * rr * 0.9); ctx.stroke(); } }
      if (rr > 2 && sp.shape !== 'ring') { const nr = rr * 0.3, nx = x + Math.cos(m.a) * rr * 0.25 * stretch, ny = y + Math.sin(m.a) * rr * 0.25; ctx.fillStyle = hsla(sh + 20, sp.sat, lerp(60, 95, m.flash), (0.45 + 0.5 * m.flash) * a * glow); ctx.beginPath(); ctx.arc(nx, ny, nr, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    if (s.flash > 0.01) { ctx.fillStyle = `rgba(255 250 235 / ${0.5 * s.flash})`; ctx.fillRect(0, 0, w, h); }
    if (s.riser > 0.01) { const v = ctx.createRadialGradient(w / 2, h / 2, S(0.35), w / 2, h / 2, Math.hypot(w, h) * 0.55); v.addColorStop(0, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.6 * s.riser})`); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
  },
};

/** A part's species: its colour, shape, motion and home drawn from the seed within what its kind suits; its size from the part's rate, guessed until counted. */
function newSpecies(s, key, kind, e) {
  const i = s.nsp++, pick = (list) => list[Math.floor(rand(s) * list.length)];
  const guess = s.rates[e.layer] !== undefined ? (kind === 'drums' ? s.rates[e.layer] * (VOICE_GUESS[e.voice] ?? 2) / 8 : s.rates[e.layer]) : kind === 'drums' ? VOICE_GUESS[e.voice] ?? 2 : GUESS[kind] ?? 2;
  const a = rand(s) * TAU, d = rand(s) * R * 0.5, size = sizeOf(guess, s.mass);
  return { key, kind, hue: s.pal.hue + i * 137.5 + (rand(s) - 0.5) * 20, sat: 30 + rand(s) * 45, light: 55 + rand(s) * 20, shape: pick(SHAPES[kind] ?? SHAPES.raw), motion: pick(MOTIONS[kind] ?? MOTIONS.raw), sides: 4 + Math.floor(rand(s) * 3), home: { x: s.cx + Math.cos(a) * d, y: s.cy + Math.sin(a) * d }, guess, n: 0, t0: null, size, cap: capOf(size), count: 0 };
}
/** A newborn of the species, where its note and pan say (a pitched part) or around the species' home; it grows from a point. */
function born(s, sp, e) {
  let x, y;
  if (e.note !== null) { x = s.cx + (e.pan - 0.5) * 2 * R * 0.7 + (rand(s) - 0.5) * 0.1; y = s.cy + (0.5 - clamp((e.note - 40) / 50)) * 2 * R * 0.7 + (rand(s) - 0.5) * 0.1; }
  else { const a = rand(s) * TAU, d = Math.sqrt(rand(s)) * R * 0.35; x = sp.home.x + Math.cos(a) * d; y = sp.home.y + Math.sin(a) * d; }
  if (!inDish(s, x, y, 0.05)) { const a = Math.atan2(y - s.cy, x - s.cx); x = s.cx + Math.cos(a) * R * 0.9; y = s.cy + Math.sin(a) * R * 0.9; }
  const m = { sp: sp.key, x, y, vx: 0, vy: 0, a: rand(s) * TAU, r: 0, rc: 0, scale: 0.8 + rand(s) * 0.4, ph: rand(s) * TAU, age: 0, squash: 0, flash: 0, run: rand(s) * 2, turn: (rand(s) < 0.5 ? -1 : 1) * (0.15 + rand(s) * 0.3) }; // a glide's turn: wide arcs, never a circle on the spot
  s.microbes.push(m);
  return m;
}
/** The species' move on a hit of its part, with the hit's strength `g`. */
function move(s, m, sp, g) {
  m.flash = 1;
  if (sp.motion === 'tumble') { m.a = rand(s) * TAU; m.run = 1 + rand(s) * 2.5; m.vx += Math.cos(m.a) * 0.15 * g; m.vy += Math.sin(m.a) * 0.15 * g; }
  else if (sp.motion === 'jet') { m.squash = Math.max(m.squash, g); m.vx += Math.cos(m.a) * 0.3 * g; m.vy += Math.sin(m.a) * 0.3 * g; }
  else if (sp.motion === 'glide') { m.turn = -m.turn; m.vx += Math.cos(m.a) * 0.08 * g; m.vy += Math.sin(m.a) * 0.08 * g; }
  else if (sp.motion === 'wiggle') { m.vx += Math.cos(m.a) * 0.2 * g; m.vy += Math.sin(m.a) * 0.2 * g; }
  else { m.a = rand(s) * TAU; m.squash = Math.max(m.squash, 0.5 * g); m.vx += Math.cos(m.a) * 0.06 * g; m.vy += Math.sin(m.a) * 0.06 * g; }
}
