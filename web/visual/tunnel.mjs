// tunnel: a wall of rings rushing at the camera at the song's tempo. The score sets the identity once (hue band,
// ring weight, round or angular, wobble, how long things persist); the cast says which part does which job, and the
// events animate inside that: a kick throws a bright ring at the camera (it arrives a beat and a half later, on the
// grid) and lurches the wall forward, an impact shocks the camera sideways and dents the wall, hats scatter grain on
// it, the bass sets the tunnel's radius from its note with the inertia of a structure, a melody rides the wall as a
// glowing ribbon (pitch is height, pan is side, the newest note a bright pen), the pad is the fog at the vanishing
// point. A section's role sets the scene (establish: sparse and slow, climax: dense, fast and wide, release: slow and
// warm), energy is speed and glow inside it; a riser narrows and accelerates toward the boundary and resolves there in
// a flash and a burst; a dropout slows the wall and darkens it, leaving the ribbons. Deterministic: randomness only
// from the state's own seeded generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, fadeFrame, ring } from './kit.mjs';

const Z_NEAR = 0.07, Z_FAR = 1; // depth: 1 at the vanishing point, Z_NEAR when a ring leaves the frame
const WALL = 14, SPACING = (Z_FAR - Z_NEAR) / WALL; // wall rings in flight; one passes the camera per beat
const KICK_BEATS = 1.5; // a kick's ring is thrown this many beats from the camera, so it arrives on the grid
const TAU = Math.PI * 2;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' }; // a part outside the cast (plain patterns) by its kind
// the scene per section role: how much of the wall shows, how fast it comes, how bright, how long the frame lingers, the field of view
const SCENE = {
  establish: { wall: 0.55, speed: 0.75, glow: 0.7, trail: 0.06, fov: 0.92, flash: 0.35 },
  develop: { wall: 1, speed: 1, glow: 1, trail: 0, fov: 1, flash: 0.5 },
  climax: { wall: 1.3, speed: 1.3, glow: 1.45, trail: -0.05, fov: 1.18, flash: 1 },
  release: { wall: 0.7, speed: 0.7, glow: 0.8, trail: 0.1, fov: 0.95, flash: 0.35 },
  none: { wall: 1, speed: 1, glow: 1, trail: 0, fov: 1, flash: 0.5 },
};

export default {
  name: 'tunnel',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const s = {
      pal, size: { ...size },
      sides: p.edge > 0.62 ? 4 + Math.floor(rng() * 3) : p.edge > 0.5 ? 6 + Math.floor(rng() * 2) : 0, // angular songs get polygons
      spin: rng() < 0.5 ? -1 : 1, twist: lerp(0.02, 0.14, p.motion),
      sx: lerp(1, 1.3, p.spread), sy: 1,
      wobble: lerp(0, 0.12, p.jitter), phase: rng() * TAU,
      weight: lerp(0.6, 1.8, p.mass),
      trail: lerp(0.38, 0.13, p.persistence), // the frame fade: high persistence keeps more of the last frame, never so much that everything smears
      cps: score.cps,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      roles: score.sections.map((x) => x.role ?? 'none'),
      t: 0, rings: Array.from({ length: WALL }, (_, i) => ({ z: Z_NEAR + SPACING * (i + 0.5), hot: 0 })),
      kicks: [], grain: [], ribbons: {}, // ribbons: part -> points { a, z, w, hue }
      cam: { x: 0, y: 0, vx: 0, vy: 0 }, pulse: 0, lurch: 0, dent: 0, dentPhase: 0,
      radius: 1, radiusTo: 1, ground: 0,
      fog: 0, fogTo: 0, fogTint: 0.5,
      flash: 0, energy: 0.5, riser: 0, wasRiser: 0, dark: 0, section: null, role: 'none', hueShift: 0, beatPhase: 0, rot: 0,
      scene: { ...SCENE.none }, // eased toward the section's role
    };
    seed(s, rng);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = SCENE[role] ?? SCENE.none;
    // the moment: energy and the scene ease, a boundary flashes (a riser resolving there bursts), the tails set the riser and the dark
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.scene[k] = ease(s.scene[k], want[k], 1.5, dt);
    if (clock.boundary) {
      s.flash = Math.max(s.flash, want.flash * (s.wasRiser > 0.3 ? 1.4 : 1)); s.hueShift = ((clock.index * 37) % 50) - 25; s.section = clock.section; s.role = role;
      if (s.wasRiser > 0.3) { s.pulse = 1; s.lurch = 1; for (let i = 0; i < 40; i++) s.grain.push({ a: rand(s) * TAU, z: 0.3 + rand(s) * 0.5, life: 0.5, w: 1 }); }
    }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 4, dt);
    s.beatPhase = clock.beatPhase;
    // forward motion: one wall ring per beat, by the scene and the energy, faster into a riser, slowed in a dropout; a kick lurches it
    const v = SPACING * s.cps * clock.beats * s.scene.speed * lerp(0.75, 1.35, s.energy) * (1 + 1.4 * s.riser) * (1 - 0.6 * s.dark) + s.lurch * SPACING * 3;
    s.lurch = decay(s.lurch, 12, dt);
    s.rot += s.spin * s.twist * dt * (0.5 + s.energy);
    for (const r of s.rings) { r.z -= v * dt; if (r.z < Z_NEAR) r.z += Z_FAR - Z_NEAR; r.hot = decay(r.hot, 3, dt); }
    for (const k of s.kicks) { k.z -= v * dt; k.hot = decay(k.hot, 0.8, dt); }
    s.kicks = s.kicks.filter((k) => k.z > Z_NEAR);
    for (const g of s.grain) { g.z -= v * dt; g.life -= dt; }
    s.grain = s.grain.filter((g) => g.life > 0 && g.z > Z_NEAR);
    for (const [name, pts] of Object.entries(s.ribbons)) { for (const q of pts) q.z -= v * dt; s.ribbons[name] = pts.filter((q) => q.z > Z_NEAR); }
    // decays and springs
    s.pulse = decay(s.pulse, 9, dt); s.dent = decay(s.dent, 4, dt); s.flash = decay(s.flash, 7, dt); s.ground = decay(s.ground, 2.5, dt);
    const c = s.cam; c.vx += (-c.x * 120 - c.vx * 9) * dt; c.vy += (-c.y * 120 - c.vy * 9) * dt; c.x += c.vx * dt; c.y += c.vy * dt;
    s.radius = ease(s.radius, s.radiusTo, 1.1, dt); // the inertia of a structure: a bar to settle
    s.fog = ease(s.fog, s.fogTo, 1.5, dt); s.fogTo = decay(s.fogTo, 0.35, dt);
    // the events, each by the job its part has in the cast
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';
      const g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') {
          s.pulse = Math.max(s.pulse, 0.9 * g); s.lurch = Math.max(s.lurch, 0.5 * g);
          s.kicks.push({ z: Z_NEAR + SPACING * KICK_BEATS, hot: 1 }); // thrown from a beat and a half out: it arrives on the grid
          const near = s.rings.reduce((a, b) => (a.z < b.z ? a : b)); near.hot = 1;
        } else if (e.role === 'impact') {
          s.dent = Math.max(s.dent, g); s.dentPhase = rand(s) * TAU;
          c.vx += (rand(s) < 0.5 ? -1 : 1) * 2.2 * g; c.vy += (rand(s) - 0.5) * 0.8 * g;
          for (const r of s.rings) if (r.z < 0.4) r.hot = Math.max(r.hot, 0.5 * g); // the near wall lights with the crack
        } else if (e.role === 'grain') { if (s.grain.length < 80) s.grain.push({ a: rand(s) * TAU, z: 0.5 + rand(s) * 0.4, life: 0.28, w: g }); }
        else s.pulse = Math.max(s.pulse, 0.35 * g);
      } else if (slot === 'ground') {
        if (e.note !== null) s.radiusTo = lerp(1.3, 0.8, (e.note - 24) / 36); // a low note widens the tunnel
        s.ground = Math.min(1.2, s.ground + 0.6 * g);
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const a = -Math.PI / 2 + clamp((60 - e.note) / 30, -1, 1) * (Math.PI / 2.3) + (e.pan - 0.5) * 1.1; // pitch up the wall, pan around it
        const pts = (s.ribbons[e.layer ?? slot] ??= []);
        pts.push({ a, z: Z_FAR, w: clamp(0.4 + g, 0.3, 1.6), hue: slot === 'line' ? s.pal.line : s.pal.line + 45, hot: 1 });
        if (pts.length > 120) pts.shift();
      } else if (slot === 'field') {
        s.fogTo = Math.min(1, 0.45 + 0.55 * g);
        if (e.cutoff !== null) s.fogTint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
      } else if (slot === 'transition') {
        if (e.dur >= 1) s.flash = Math.max(s.flash, 0.7); // the impact (a whole cycle long); a riser's eight noise slices a cycle are the clock's business, not hits
      } else if (e.role === 'grain' || slot === 'grain') {
        if (s.grain.length < 80) s.grain.push({ a: rand(s) * TAU, z: 0.5 + rand(s) * 0.4, life: 0.22, w: 0.6 * g });
      }
    }
    for (const pts of Object.values(s.ribbons)) for (const q of pts) q.hot = decay(q.hot, 4, dt);
  },

  draw(s, ctx, w, h) {
    const { pal, scene } = s, lit = 1 - 0.75 * s.dark, glow = scene.glow * lerp(0.55, 1, s.energy);
    const cx = w / 2 + s.cam.x * h * 0.3, cy = h / 2 + s.cam.y * h * 0.3; // an impact's shock: a few percent of the height at its peak
    const R = h * 0.115 * scene.fov * s.radius * (1 + 0.09 * s.pulse) * (1 - 0.3 * s.riser); // the wall's radius at depth 1 (screen radius is R / z)
    const hue = pal.hue + s.hueShift;
    fadeFrame(ctx, w, h, pal.bg, clamp(s.trail + scene.trail + 0.25 * s.riser, 0.08, 0.5));
    ctx.lineJoin = 'round';
    // the field: fog at the vanishing point, its brightness the pad's cutoff, gone in a dropout; soft and wide, never a blob
    if (s.fog > 0.01) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 4.5);
      grad.addColorStop(0, hsla(pal.field + s.hueShift, pal.sat, lerp(24, 60, s.fogTint), 0.26 * s.fog * lit));
      grad.addColorStop(0.45, hsla(pal.field + s.hueShift, pal.sat, lerp(20, 45, s.fogTint), 0.1 * s.fog * lit));
      grad.addColorStop(1, hsla(pal.field + s.hueShift, pal.sat, 20, 0));
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h); // not additive: the trail keeps most of the last frame, and an additive fog would saturate
    }
    // the wall, far to near: the rings, dented by the last impact, wobbling by the song's jitter, lit by the bass; a sparse scene shows fewer
    const shape = (z) => (a) => (R / z) * (1 + s.wobble * Math.sin(3 * a + s.phase + s.t * 0.7) + 0.24 * s.dent * Math.cos(2 * a + s.dentPhase));
    const shown = s.rings.filter((r, i) => i % 2 === 0 || scene.wall > 0.8 || r.hot > 0.1); // every other ring in a sparse scene
    const all = [...shown.map((r) => ({ ...r, kick: false })), ...s.kicks.map((k) => ({ ...k, kick: true }))].sort((a, b) => b.z - a.z);
    ctx.globalCompositeOperation = 'source-over';
    for (const r of all) {
      const near = 1 - r.z, alpha = clamp(near ** 1.3 * (0.45 + 0.55 * glow) * (0.6 + 0.4 * s.ground) * lit) * (r.kick ? 0.55 + 0.45 * r.hot : 1);
      if (alpha < 0.02) continue;
      const lw = h * 0.0025 * s.weight * (0.5 + 2.2 * near) * lerp(1.3, 1, scene.wall) * (1 + 1.8 * r.hot);
      ring(ctx, cx, cy, s.sides, shape(r.z), s.sx, s.sy, s.rot);
      ctx.lineWidth = lw; ctx.strokeStyle = hsla(hue + 18 * r.hot, pal.sat, pal.light + 28 * r.hot, alpha); ctx.stroke();
      if (r.hot > 0.05) { ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = lw * 3; ctx.strokeStyle = hsla(hue + 20, pal.sat, pal.light + 20, 0.2 * r.hot * alpha * glow); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
    }
    // grain: short radial ticks on the wall
    ctx.globalCompositeOperation = 'lighter';
    for (const g of s.grain) {
      const rr = R / g.z, len = h * 0.03 * (1 - g.z) * (0.5 + g.w), a = g.a + s.rot;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rr * s.sx, cy + Math.sin(a) * rr * s.sy); ctx.lineTo(cx + Math.cos(a) * (rr + len) * s.sx, cy + Math.sin(a) * (rr + len) * s.sy);
      ctx.lineWidth = h * 0.003; ctx.strokeStyle = hsla(hue + 30, pal.sat, 85, 0.8 * clamp(g.life / 0.28) * lit * glow); ctx.stroke();
    }
    // the ribbons: each line part as a glowing path on the wall, thin and bright over wide and faint, the newest note a pen; they survive a dropout
    for (const pts of Object.values(s.ribbons)) {
      if (!pts.length) continue;
      const at = (q) => [cx + Math.cos(q.a + s.rot) * (R / q.z) * s.sx, cy + Math.sin(q.a + s.rot) * (R / q.z) * s.sy];
      const last = pts[pts.length - 1], width = h * 0.005 * last.w * lerp(0.7, 1.3, s.energy);
      if (pts.length > 1) for (const [mul, alpha] of [[3.2, 0.16], [1, 0.9]]) {
        ctx.beginPath();
        let [px, py] = at(pts[0]); ctx.moveTo(px, py);
        for (let i = 1; i < pts.length; i++) { const [x, y] = at(pts[i]); ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2); [px, py] = [x, y]; }
        ctx.lineTo(px, py);
        ctx.lineWidth = width * mul; ctx.strokeStyle = hsla(last.hue + s.hueShift, 85, 68, alpha); ctx.stroke();
      }
      const [lx, ly] = at(last); // the pen: a bright dot on the newest note, fading as it is held
      ctx.beginPath(); ctx.arc(lx, ly, width * (1.2 + 1.5 * last.hot), 0, TAU); ctx.fillStyle = hsla(last.hue + s.hueShift, 90, 85, 0.5 + 0.5 * last.hot); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // a riser closes the edges in; a boundary flashes
    if (s.riser > 0.01) { const v = ctx.createRadialGradient(cx, cy, R * 2.5, cx, cy, Math.hypot(w, h) * 0.55); v.addColorStop(0, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.75 * s.riser})`); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h); }
    if (s.flash > 0.01) { ctx.fillStyle = hsla(hue, 40, 92, 0.55 * s.flash); ctx.fillRect(0, 0, w, h); }
  },
};
