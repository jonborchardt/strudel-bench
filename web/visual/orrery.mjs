// orrery: the song as one celestial system, seen from a fixed place. The bass is the central mass: its note the gravity
// (a low note heavier, so every orbit tightens and quickens; a high note lighter, so they loosen), its level the
// mass's glow, decaying between notes. Each line part is a body on an elliptical orbit whose size is its pitch (a
// higher note further out), eased so a new note drifts the body to a new orbit rather than jumping it, with an
// ephemeris trail behind it; its pan tilts and turns the plane of its orbit. The constellation is what sounds: every
// pitched event places a star by its pitch class around the compass and its octave outward, consecutive stars link,
// so a chord is a polygon and a phrase a line, fading over a bar. A kick flares the mass and pulses every orbit, an
// impact is a meteor crossing the system, hats are dust on the orbits. The pad is the nebula behind everything, its
// hue by cutoff, breathing with its level. A section's role is the system's state (establish: sparse, slow; climax:
// the bodies pulled into conjunction, fast and bright; release: the system expands and slows); a boundary rearranges
// the planes; a riser quickens the orbits and brightens the trails; a dropout stops them and leaves the nebula.
// Deterministic: randomness only from the state's own seeded generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, fadeFrame } from './kit.mjs';

const TAU = Math.PI * 2;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
// the system per section role: how far out the orbits sit, how fast they run, the glow, how hard the bodies are pulled into conjunction, the frame's persistence
const STATE = {
  establish: { scale: 0.85, speed: 0.75, glow: 0.7, align: 0, trail: 0.32 },
  develop: { scale: 1, speed: 1, glow: 1, align: 0, trail: 0.26 },
  climax: { scale: 0.9, speed: 1.35, glow: 1.3, align: 1, trail: 0.2 },
  release: { scale: 1.3, speed: 0.7, glow: 0.8, align: 0, trail: 0.3 },
  none: { scale: 1, speed: 1, glow: 1, align: 0, trail: 0.26 },
};

/** A body's place on its orbit: the ellipse by its semi-major axis and eccentricity, turned and tilted into its plane; units of the height around the centre. */
function placeOf(b, scale) {
  const r = (b.a * scale * (1 - b.e * b.e)) / (1 + b.e * Math.cos(b.theta));
  const x = r * Math.cos(b.theta), y = r * Math.sin(b.theta) * b.tilt;
  return [x * Math.cos(b.rot) - y * Math.sin(b.rot), x * Math.sin(b.rot) + y * Math.cos(b.rot)];
}

export default {
  name: 'orrery',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const s = {
      pal, size: { ...size },
      bg: [pal.hue, 35, 3],
      weight: lerp(0.7, 1.4, p.mass), jitter: lerp(0, 1, p.jitter), spread: lerp(0.8, 1.25, p.spread), motion: lerp(0.7, 1.3, p.motion),
      cps: score.cps,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0,
      mass: { m: 1, glow: 0, note: 36, flare: 0 }, // the bass
      bodies: {}, order: [], // line part -> { a, aTo, e, tilt, tiltTo, rot, rotTo, theta, hot, hue, trail: [[x, y]] }
      stars: [], // the constellation: { x, y, hot, link }
      meteors: [], dust: [], flares: [],
      nebula: { level: 0, tint: 0.5, x: 0, y: 0, phase: 0 },
      state: { ...STATE.none }, energy: 0.5, riser: 0, wasRiser: 0, dark: 0, section: null, hueShift: 0, alignAngle: 0, lastStar: {}, starBar: -1, // lastStar: part -> the star its next one links to, within the bar
    };
    seed(s, rng);
    s.nebula.x = (rng() - 0.5) * 0.4; s.nebula.y = (rng() - 0.5) * 0.3;
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = STATE[role] ?? STATE.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.state[k] = ease(s.state[k], want[k], 1.2, dt);
    if (clock.boundary) { // a rearrangement: every plane turns and tilts anew, the conjunction line moves
      s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section; s.alignAngle = rand(s) * TAU;
      for (const b of Object.values(s.bodies)) { b.rotTo = rand(s) * TAU; b.tiltTo = 0.35 + rand(s) * 0.6; }
      if (s.wasRiser > 0.3) s.flares.push({ r: 0.05, hot: 1.2 });
    }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    const M = s.mass; M.glow = decay(M.glow, 0.8, dt); M.flare = decay(M.flare, 6, dt);
    s.nebula.level = decay(s.nebula.level, 0.35, dt); s.nebula.phase += dt * 0.1 * s.motion;
    for (const f of s.flares) { f.r += dt * 1.2; f.hot = decay(f.hot, 3, dt); } s.flares = s.flares.filter((f) => f.hot > 0.03);
    for (const m of s.meteors) { m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt; } s.meteors = s.meteors.filter((m) => m.life > 0);
    for (const d of s.dust) d.life -= dt; s.dust = s.dust.filter((d) => d.life > 0);
    for (const st of s.stars) st.hot = decay(st.hot, 0.9 * s.cps * clock.beats / 4, dt); s.stars = s.stars.filter((st) => st.hot > 0.02); // a bar to fade
    const barNow = clock.index * 1e4 + clock.bar; // a bar of a section, not a bar number: a new section's first bar is new too
    if (barNow !== s.starBar) { s.starBar = barNow; s.lastStar = {}; } // a new bar starts a new figure
    // the orbits: Kepler's cadence, a heavier mass and a tighter orbit faster; two bars round at the reference orbit; into a riser faster, in a dropout still; a climax pulls the bodies toward one angle
    const omegaOf = (b) => (TAU * s.cps / 2) * Math.sqrt(M.m) * (0.3 / Math.max(0.08, b.a * s.state.scale)) ** 1.5 * s.state.speed * (1 + 0.8 * s.riser) * (1 - s.dark) * (1 + 0.5 * M.flare);
    const mean = s.order.length ? s.order.reduce((n, name) => n + omegaOf(s.bodies[name]), 0) / s.order.length : 0;
    s.alignAngle += mean * s.state.align * dt; // in conjunction the line itself sweeps round at the system's mean cadence, so the bodies line up and keep moving
    for (const name of s.order) {
      const b = s.bodies[name];
      b.a = ease(b.a, b.aTo, 1.2, dt); b.rot = ease(b.rot, b.rotTo, 1, dt); b.tilt = ease(b.tilt, b.tiltTo, 1, dt); b.hot = decay(b.hot, 1.5, dt);
      const omega = omegaOf(b), al = s.state.align;
      const d = Math.atan2(Math.sin(s.alignAngle - b.theta), Math.cos(s.alignAngle - b.theta)); // the shortest way round to the conjunction line
      b.theta += (omega * (1 - 0.85 * al) + mean * 0.85 * al + d * 3 * al) * dt;
      const [x, y] = placeOf(b, s.state.scale);
      b.trail.push([x, y]); if (b.trail.length > 90) b.trail.shift();
    }
    const body = (name, hue) => { if (!s.bodies[name]) { s.bodies[name] = { a: 0.3, aTo: 0.3, e: 0.1 + rand(s) * 0.4 * s.jitter, tilt: 0.6, tiltTo: 0.35 + rand(s) * 0.6, rot: 0, rotTo: rand(s) * TAU, theta: rand(s) * TAU, hot: 0, hue, trail: [] }; s.order.push(name); } return s.bodies[name]; };
    const star = (part, note, g) => { // by pitch class around the compass, by octave outward; linked to the part's last star of this bar, so a chord is a polygon and a phrase a line
      const a = ((note % 12) / 12) * TAU - Math.PI / 2, r = 0.12 + 0.07 * clamp((note - 36) / 12, 0, 5) * s.spread, last = s.lastStar[part];
      const st = { x: Math.cos(a) * r, y: Math.sin(a) * r, hot: 0.6 + 0.4 * g, link: last ? [last.x, last.y] : null };
      s.stars.push(st); if (s.stars.length > 48) s.stars.shift(); s.lastStar[part] = st;
    };
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') { M.flare = Math.max(M.flare, g); s.flares.push({ r: 0.04, hot: 0.8 * g }); }
        else if (e.role === 'impact') { const a = rand(s) * TAU, r = 0.75 * s.spread, sp = 1.2 + 0.6 * g; s.meteors.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, vx: -Math.cos(a + (rand(s) - 0.5) * 0.6) * sp, vy: -Math.sin(a + (rand(s) - 0.5) * 0.6) * sp * 0.7, life: 1.1, w: g }); }
        else if (e.role === 'grain') { const b = s.order.length ? s.bodies[s.order[Math.floor(rand(s) * s.order.length)]] : null; if (b && s.dust.length < 120) { const q = { ...b, theta: b.theta - rand(s) * 1.2 }; const [x, y] = placeOf(q, s.state.scale); s.dust.push({ x, y, life: 0.35, w: g }); } }
        else M.flare = Math.max(M.flare, 0.4 * g);
      } else if (slot === 'ground') {
        if (e.note !== null) { M.note = e.note; M.m = lerp(1.5, 0.6, clamp((e.note - 24) / 36)); star(e.layer ?? 'ground', e.note, g * 0.6); }
        M.glow = Math.min(1.5, M.glow + 0.7 * g);
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const name = e.layer ?? slot, b = body(name, (slot === 'line' ? s.pal.line : s.pal.line + 45) + s.order.length * 22);
        b.aTo = lerp(0.14, 0.44, clamp((e.note - 40) / 50)) * s.spread; b.hot = 1;
        b.rotTo += (e.pan - 0.5) * 0.4; b.tiltTo = clamp(b.tiltTo + (e.pan - 0.5) * 0.1, 0.3, 1);
        star(name, e.note, g);
      } else if (slot === 'field') {
        s.nebula.level = Math.min(1, 0.5 + 0.5 * g);
        if (e.cutoff !== null) s.nebula.tint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
        if (e.note !== null) star(e.layer ?? 'field', e.note, 0.4 * g);
      } else if (slot === 'transition') {
        if (e.dur >= 1) { M.flare = Math.max(M.flare, 1.5); s.flares.push({ r: 0.04, hot: 1.5 }); }
      } else if (slot === 'grain' || e.role === 'grain') { if (e.note !== null) star(e.layer ?? 'grain', e.note, 0.3 * g); }
    }
  },

  draw(s, ctx, w, h) {
    const { pal, state } = s, hue = pal.hue + s.hueShift, lit = 1 - 0.6 * s.dark, glow = state.glow * lerp(0.6, 1, s.energy) * lit;
    const cx = w / 2, cy = h / 2, R = (r) => r * h, P = ([x, y]) => [cx + R(x), cy + R(y)];
    fadeFrame(ctx, w, h, s.bg, clamp(state.trail + 0.1 * s.riser, 0.08, 0.4));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the nebula: soft clouds behind the system, drifting
    if (s.nebula.level > 0.02) {
      const nb = s.nebula, light = lerp(18, 40, nb.tint);
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        const px = cx + R(nb.x + Math.sin(nb.phase + i * 2.1) * 0.25 * s.spread), py = cy + R(nb.y + Math.cos(nb.phase * 0.8 + i * 1.7) * 0.15), rr = R(0.35 + 0.1 * i) * s.spread;
        const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
        g.addColorStop(0, hsla(pal.field + s.hueShift + i * 12, pal.sat, light, 0.16 * nb.level * lit)); g.addColorStop(1, hsla(pal.field + s.hueShift, pal.sat, light, 0));
        ctx.fillStyle = g; ctx.fillRect(px - rr, py - rr, 2 * rr, 2 * rr);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    // the constellation: stars where notes sound, linked in the order they came within the bar
    for (const st of s.stars) {
      const [x, y] = P([st.x, st.y]);
      if (st.link) { const [lx, ly] = P(st.link); ctx.strokeStyle = hsla(hue + 60, 40, 80, 0.28 * st.hot * lit); ctx.lineWidth = Math.max(1, R(0.0012)); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke(); }
      ctx.fillStyle = hsla(hue + 60, 30, 90, 0.9 * st.hot * lit); ctx.beginPath(); ctx.arc(x, y, R(0.003 + 0.004 * st.hot), 0, TAU); ctx.fill();
    }
    // the orbits (faint), the trails, the bodies
    for (const name of s.order) {
      const b = s.bodies[name], col = (a, l = 70) => hsla(b.hue + s.hueShift, 80, l, a);
      ctx.strokeStyle = col(0.1 * lit); ctx.lineWidth = Math.max(1, R(0.001));
      ctx.beginPath(); for (let i = 0; i <= 72; i++) { const [x, y] = P(placeOf({ ...b, theta: (i / 72) * TAU }, state.scale)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      if (b.trail.length > 1) {
        for (let i = 1; i < b.trail.length; i++) { const f = i / b.trail.length, [ax, ay] = P(b.trail[i - 1]), [bx, by] = P(b.trail[i]); ctx.strokeStyle = col(0.6 * f * f * glow, 65); ctx.lineWidth = Math.max(1, R(0.0025) * f * (0.6 + b.hot)); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
      }
      const [x, y] = P(placeOf(b, state.scale)), r = R(0.007 + 0.006 * b.hot) * s.weight;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, col(0.5 * glow, 80)); g.addColorStop(1, col(0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = col(0.95 * lit, 85 + 10 * b.hot); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    // dust on the orbits, meteors across the system
    for (const d of s.dust) { const [x, y] = P([d.x, d.y]); ctx.fillStyle = hsla(hue + 30, pal.sat, 85, 0.8 * clamp(d.life / 0.35) * lit); ctx.fillRect(x - 1, y - 1, Math.max(1.5, R(0.002)), Math.max(1.5, R(0.002))); }
    for (const m of s.meteors) { const [x, y] = P([m.x, m.y]), [tx, ty] = P([m.x - m.vx * 0.12, m.y - m.vy * 0.12]); ctx.strokeStyle = hsla(hue + 40, 70, 88, 0.9 * clamp(m.life / 0.5) * lit); ctx.lineWidth = Math.max(1, R(0.003) * m.w); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke(); }
    // the central mass: its glow the bass, its size the gravity, a kick's flare rings out from it
    const M = s.mass, mr = R(0.028 * (0.7 + 0.5 * M.m) * (1 + 0.25 * M.flare)) * s.weight;
    const mg = ctx.createRadialGradient(cx, cy, 0, cx, cy, mr * 4); mg.addColorStop(0, hsla(hue, pal.sat, 65, (0.15 + 0.25 * clamp(M.glow)) * lit)); mg.addColorStop(1, hsla(hue, pal.sat, 60, 0));
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(cx, cy, mr * 4, 0, TAU); ctx.fill();
    for (const f of s.flares) { ctx.strokeStyle = hsla(hue + 20, pal.sat, 80, 0.6 * f.hot * lit); ctx.lineWidth = Math.max(1, R(0.003)); ctx.beginPath(); ctx.ellipse(cx, cy, R(f.r), R(f.r) * 0.75, 0, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hsla(hue, pal.sat, lerp(55, 92, clamp(M.glow)), lit); ctx.beginPath(); ctx.arc(cx, cy, mr, 0, TAU); ctx.fill();
    if (s.riser > 0.01) { const v = ctx.createRadialGradient(cx, cy, R(0.45), cx, cy, Math.hypot(w, h) * 0.55); v.addColorStop(0, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.6 * s.riser})`); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
  },
};
