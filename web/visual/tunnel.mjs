// tunnel: a wall of rings rushing at the camera at the song's tempo. The score sets the identity once (hue band,
// ring weight, round or angular, wobble, how long things persist); the cast says which part does which job, and the
// events animate inside that: a kick pushes a bright ring in from the far end, an impact shocks the camera sideways
// and dents the wall, hats scatter grain on it, the bass sets the tunnel's radius from its note, a melody rides the
// wall as a glowing ribbon (pitch is height, pan is side), the pad is the fog at the vanishing point. Section energy
// is speed and glow; a riser narrows and accelerates toward the boundary, the boundary flashes, a dropout goes dark
// but for the ribbons. Deterministic: randomness only from the state's own seeded generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, fadeFrame, ring } from './kit.mjs';

const Z_NEAR = 0.07, Z_FAR = 1; // depth: 1 at the vanishing point, Z_NEAR when a ring leaves the frame
const WALL = 14; // wall rings in flight; one passes the camera per beat
const TAU = Math.PI * 2;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' }; // a part outside the cast (plain patterns) by its kind

export default {
  name: 'tunnel',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const s = {
      pal, size: { ...size },
      sides: p.edge > 0.62 ? 4 + Math.floor(rng() * 3) : p.edge > 0.5 ? 6 + Math.floor(rng() * 2) : 0, // angular songs get polygons
      spin: rng() < 0.5 ? -1 : 1, twist: lerp(0.04, 0.4, p.motion),
      sx: lerp(1, 1.3, p.spread), sy: 1,
      wobble: lerp(0, 0.12, p.jitter), phase: rng() * TAU,
      weight: lerp(0.6, 1.8, p.mass),
      trail: lerp(0.34, 0.06, p.persistence), // the frame fade: high persistence keeps more of the last frame
      cps: score.cps,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, rings: Array.from({ length: WALL }, (_, i) => ({ z: Z_NEAR + ((Z_FAR - Z_NEAR) * (i + 0.5)) / WALL, hot: 0 })),
      kicks: [], grain: [], ribbons: {}, // ribbons: part -> points { a, z, w, hue }
      cam: { x: 0, y: 0, vx: 0, vy: 0 }, pulse: 0, dent: 0, dentPhase: 0,
      radius: 1, radiusTo: 1, ground: 0,
      fog: 0, fogTo: 0, fogTint: 0.5,
      flash: 0, energy: 0.5, riser: 0, dark: 0, section: null, hueShift: 0, beatPhase: 0, rot: 0,
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    // the moment: energy eases, a boundary flashes and turns the hue a little, tails set the riser and the dark
    s.energy = ease(s.energy, clock.energy, 2, dt);
    if (clock.boundary) { s.flash = 1; s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section; }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 4, dt);
    s.beatPhase = clock.beatPhase;
    // forward motion: one wall ring per beat, faster with energy and into a riser
    const v = ((Z_FAR - Z_NEAR) / WALL) * s.cps * clock.beats * lerp(0.7, 1.5, s.energy) * (1 + 1.4 * s.riser);
    s.rot += s.spin * s.twist * dt * (0.5 + s.energy);
    for (const r of s.rings) { r.z -= v * dt; if (r.z < Z_NEAR) r.z += Z_FAR - Z_NEAR; r.hot = decay(r.hot, 3, dt); }
    for (const k of s.kicks) { k.z -= v * dt; k.hot = decay(k.hot, 1.2, dt); }
    s.kicks = s.kicks.filter((k) => k.z > Z_NEAR);
    for (const g of s.grain) { g.z -= v * dt; g.life -= dt; }
    s.grain = s.grain.filter((g) => g.life > 0 && g.z > Z_NEAR);
    for (const [name, pts] of Object.entries(s.ribbons)) { for (const q of pts) q.z -= v * dt; s.ribbons[name] = pts.filter((q) => q.z > Z_NEAR); }
    // decays and springs
    s.pulse = decay(s.pulse, 9, dt); s.dent = decay(s.dent, 5, dt); s.flash = decay(s.flash, 6, dt); s.ground = decay(s.ground, 2.5, dt);
    const c = s.cam; c.vx += (-c.x * 90 - c.vx * 10) * dt; c.vy += (-c.y * 90 - c.vy * 10) * dt; c.x += c.vx * dt; c.y += c.vy * dt;
    s.radius = ease(s.radius, s.radiusTo, 3, dt);
    s.fog = ease(s.fog, s.fogTo, 1.5, dt); s.fogTo = decay(s.fogTo, 0.35, dt);
    // the events, each by the job its part has in the cast
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';
      const g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') { s.pulse = Math.max(s.pulse, 0.9 * g); s.kicks.push({ z: Z_FAR, hot: 1 }); const near = s.rings.reduce((a, b) => (a.z < b.z ? a : b)); near.hot = 1; }
        else if (e.role === 'impact') { s.dent = Math.max(s.dent, g); s.dentPhase = rand(s) * TAU; c.vx += (rand(s) < 0.5 ? -1 : 1) * 1.6 * g; c.vy += (rand(s) - 0.5) * 0.6 * g; }
        else if (e.role === 'grain') { if (s.grain.length < 80) s.grain.push({ a: rand(s) * TAU, z: 0.5 + rand(s) * 0.4, life: 0.28, w: g }); }
        else s.pulse = Math.max(s.pulse, 0.35 * g);
      } else if (slot === 'ground') {
        if (e.note !== null) s.radiusTo = lerp(1.28, 0.82, (e.note - 24) / 36); // a low note widens the tunnel
        s.ground = Math.min(1.2, s.ground + 0.6 * g);
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const a = -Math.PI / 2 + clamp((60 - e.note) / 30, -1, 1) * (Math.PI / 2.3) + (e.pan - 0.5) * 1.1; // pitch up the wall, pan around it
        const pts = (s.ribbons[e.layer ?? slot] ??= []);
        pts.push({ a, z: Z_FAR, w: clamp(0.4 + g, 0.3, 1.6), hue: slot === 'line' ? s.pal.line : s.pal.line + 45 });
        if (pts.length > 120) pts.shift();
      } else if (slot === 'field') {
        s.fogTo = Math.min(1, 0.45 + 0.55 * g);
        if (e.cutoff !== null) s.fogTint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
      } else if (slot === 'transition') {
        if (e.role === 'hit' || e.role === 'pulse') s.flash = Math.max(s.flash, 0.7);
      } else if (e.role === 'grain' || slot === 'grain') {
        if (s.grain.length < 80) s.grain.push({ a: rand(s) * TAU, z: 0.5 + rand(s) * 0.4, life: 0.22, w: 0.6 * g });
      }
    }
  },

  draw(s, ctx, w, h) {
    const { pal } = s, lit = 1 - 0.75 * s.dark;
    const cx = w / 2 + s.cam.x * h * 0.22, cy = h / 2 + s.cam.y * h * 0.22; // an impact's shock: a few percent of the height at its peak
    const R = h * 0.115 * s.radius * (1 + 0.09 * s.pulse) * (1 - 0.28 * s.riser); // the wall's radius at depth 1 (screen radius is R / z)
    const hue = pal.hue + s.hueShift;
    fadeFrame(ctx, w, h, pal.bg, s.trail + 0.25 * s.riser);
    ctx.lineJoin = 'round';
    // the field: fog at the vanishing point, its brightness the pad's cutoff, gone in a dropout
    if (s.fog > 0.01) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 3.2);
      grad.addColorStop(0, hsla(pal.field + s.hueShift, pal.sat, lerp(22, 62, s.fogTint), 0.4 * s.fog * lit));
      grad.addColorStop(1, hsla(pal.field + s.hueShift, pal.sat, 20, 0));
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h); // not additive: the trail keeps most of the last frame, and an additive fog would saturate
    }
    // the wall, far to near: the rings, dented by the last impact, wobbling by the song's jitter, lit by the bass
    const shape = (z) => (a) => (R / z) * (1 + s.wobble * Math.sin(3 * a + s.phase + s.t * 0.7) + 0.22 * s.dent * Math.cos(2 * a + s.dentPhase));
    const all = [...s.rings.map((r) => ({ ...r, kick: false })), ...s.kicks.map((k) => ({ ...k, kick: true }))].sort((a, b) => b.z - a.z);
    ctx.globalCompositeOperation = 'source-over';
    for (const r of all) {
      const near = 1 - r.z, alpha = clamp(near ** 1.3 * lerp(0.35, 1, s.energy) * (0.5 + 0.5 * s.ground + 0.5) * lit) * (r.kick ? 0.5 + 0.5 * r.hot : 1);
      if (alpha < 0.02) continue;
      const lw = h * 0.0025 * s.weight * (0.5 + 2.2 * near) * (1 + 1.6 * r.hot);
      ring(ctx, cx, cy, s.sides, shape(r.z), s.sx, s.sy, s.rot);
      ctx.lineWidth = lw; ctx.strokeStyle = hsla(hue + 18 * r.hot, pal.sat, pal.light + 28 * r.hot, alpha); ctx.stroke();
      if (r.hot > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = lw * 3; ctx.strokeStyle = hsla(hue + 20, pal.sat, pal.light + 20, 0.18 * r.hot * alpha); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
    }
    // grain: short radial ticks on the wall
    ctx.globalCompositeOperation = 'lighter';
    for (const g of s.grain) {
      const rr = R / g.z, len = h * 0.03 * (1 - g.z) * (0.5 + g.w), a = g.a + s.rot;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rr * s.sx, cy + Math.sin(a) * rr * s.sy); ctx.lineTo(cx + Math.cos(a) * (rr + len) * s.sx, cy + Math.sin(a) * (rr + len) * s.sy);
      ctx.lineWidth = h * 0.003; ctx.strokeStyle = hsla(hue + 30, pal.sat, 85, 0.8 * (g.life / 0.28) * lit); ctx.stroke();
    }
    // the ribbons: each line part as a glowing path on the wall, thin and bright over wide and faint; they survive a dropout
    for (const pts of Object.values(s.ribbons)) {
      if (pts.length < 2) continue;
      const at = (q) => [cx + Math.cos(q.a + s.rot) * (R / q.z) * s.sx, cy + Math.sin(q.a + s.rot) * (R / q.z) * s.sy];
      for (const [mul, alpha] of [[3.2, 0.16], [1, 0.9]]) {
        ctx.beginPath();
        let [px, py] = at(pts[0]); ctx.moveTo(px, py);
        for (let i = 1; i < pts.length; i++) { const [x, y] = at(pts[i]); ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2); [px, py] = [x, y]; }
        ctx.lineTo(px, py);
        const last = pts[pts.length - 1];
        ctx.lineWidth = h * 0.0045 * last.w * mul * lerp(0.6, 1.3, s.energy); ctx.strokeStyle = hsla(last.hue + s.hueShift, 85, 68, alpha); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // a riser closes the edges in; a boundary flashes
    if (s.riser > 0.01) { const v = ctx.createRadialGradient(cx, cy, R * 2.5, cx, cy, Math.hypot(w, h) * 0.55); v.addColorStop(0, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.75 * s.riser})`); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
    if (s.flash > 0.01) { ctx.fillStyle = hsla(hue, 40, 92, 0.55 * s.flash); ctx.fillRect(0, 0, w, h); }
  },
};
