// rave: the song seen from the stage, over a crowd of sock monkeys. Ninety of them stand in depth: the near ones
// large and low, cut off by the stage lip so only heads and chests show, the far ones small, high and lost in the
// haze. Each is its own toy: a body colour from the sock drawer (pink, purple, brown, grey, teal, mustard, red) with
// its own hue and shade, shaded and outlined so it stands off its neighbours, the red heel low on the face for a mouth,
// eyes sewn one of five ways, light tips on hands and feet, a heart on some chests, stripes or polka dots on some socks,
// a hat on some (a pom beanie, a party cone, a top hat, a sweatband, a cap), sunglasses on some, a glowstick in some,
// and its own way of dancing: a phase against the beat (on it, off it, or between),
// an amplitude, a keenness that decides how early its hands go up. The crowd bobs on the beat (the clock's beat
// phase, so it holds the tempo exactly), harder as the energy rises; a kick makes them jump; hats turn heads. Over
// and behind them the light show: a truss of beams whose colour is a melody note's pitch class and whose aim is its
// pan, a bass note washes the crowd's faces in its pitch class, the pad is the haze the beams show in, an impact
// strobes, a riser fans lasers over the heads, a boundary re-aims every lamp and shifts the colours. Now and then
// (an impact or a boundary in a loud passage) one monkey is lifted and crowd-surfs across on raised hands, feet in
// the air for once, and is set down where it lands. A dropout kills the lights and stills the crowd. The whole frame
// is repainted from state every draw; randomness only from the state's own generator (kit.mjs), draw is pure.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const N = 90, BEAMS = 8, LIP = 0.92; // monkeys, lamps on the truss, where the stage lip starts (units: the canvas height)
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
// the crowd's manner per section role: how hard it bounces, how bright the rig runs, how many hands are up
const MANNER = {
  establish: { bounce: 0.5, rig: 0.5, hands: 0.15 },
  develop: { bounce: 1, rig: 1, hands: 0.35 },
  climax: { bounce: 1.4, rig: 1.4, hands: 0.9 },
  release: { bounce: 0.6, rig: 0.6, hands: 0.2 },
  none: { bounce: 1, rig: 1, hands: 0.35 },
};
const SOCKS = [[340, 60, 62], [275, 40, 50], [25, 35, 32], [220, 8, 50], [175, 40, 42], [45, 55, 50], [5, 55, 45], [200, 45, 58]]; // pink, purple, brown, grey, teal, mustard, red, blue
const TIP = [40, 30, 90], LIPS = [355, 75, 42], HEART = [340, 65, 80]; // the light thread at hands, feet and mouth rim; the red heel; a chest heart
const DOTS = [[-0.5, 1.1], [0.4, 1.5], [-0.2, 2.3], [0.6, 2.8], [-0.6, 3.2], [0.1, 3.7], [-0.45, -0.2], [0.5, 0.05]]; // where a polka-dot sock's dots fall, in head widths from the head centre
const headR = (z) => lerp(0.135, 0.032, z ** 0.8); // head radius by depth (0 nearest)
const headY = (z) => lerp(0.8, 0.5, z ** 0.7); // head centre by depth: near is low, far is up by the horizon
const hop = (p) => Math.max(0, Math.sin(TAU * (p % 1))); // up in the first half of the beat, down in the second

export default {
  name: 'rave',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng), aspect = size.w / size.h;
    const s = {
      pal, size: { ...size }, aspect,
      bg: [pal.hue, 30, 3],
      weight: lerp(0.8, 1.3, p.mass), jitter: lerp(0.3, 1, p.jitter), motion: lerp(0.7, 1.3, p.motion),
      cps: score.cps,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      manner: { ...MANNER.none }, energy: 0.5, riser: 0, dark: 0, t: 0, hueShift: 0, beatPhase: 0, hands: 0.2, flash: 0, strobe: 0,
      monkeys: [], // far to near: { x, z, body: [h, s, l], hat, shades, glow, heart, ring, phase, amp, keen, jump, tilt, tiltTo, sway }
      beams: [], // the truss: { x, hue, angle, angleTo, on, phase, speed }
      wash: { level: 0, hue: pal.field }, haze: { level: 0, tint: 0.5 }, lasers: 0,
      surfer: null, // { i, x, z, dir, rise, life, span, up }
    };
    seed(s, rng);
    for (let i = 0; i < N; i++) {
      const sock = SOCKS[Math.floor(rand(s) * SOCKS.length)], z = rand(s) ** 0.55;
      s.monkeys.push({
        x: -0.1 + rand(s) * (aspect + 0.2), z, body: [sock[0] + (rand(s) - 0.5) * 28, sock[1] + (rand(s) - 0.5) * 20, sock[2] + (rand(s) - 0.5) * 22],
        hat: rand(s) < 0.45 ? 1 + Math.floor(rand(s) * 5) : 0, hatHue: Math.floor(rand(s) * 360), eyes: Math.floor(rand(s) * 5), shades: rand(s) < 0.2,
        glow: rand(s) < 0.35 ? Math.floor(rand(s) * 360) : -1, heart: rand(s) < 0.35, stripes: rand(s) < 0.35, dots: rand(s) < 0.3,
        phase: [0, 0.5, 0.25, 0][Math.floor(rand(s) * 4)] + (rand(s) - 0.5) * 0.08, amp: 0.6 + rand(s) * 0.7, keen: rand(s),
        jump: 0, tilt: 0, tiltTo: 0, sway: rand(s) * TAU,
      });
    }
    // Mook: the light pink one, always at the front and near the middle: plain sock, small dark eyes, no hat, no glasses, first to put her hands up
    Object.assign(s.monkeys[0], { name: 'mook', z: 0, x: aspect * (0.42 + rand(s) * 0.16), body: [342, 58, 72], shades: false, eyes: 0, hat: 0, heart: false, dots: false, stripes: false, keen: 0.02, amp: 1.2 });
    s.monkeys.sort((a, b) => b.z - a.z); // painter's order: far first
    for (let k = 0; k < BEAMS; k++) s.beams.push({ x: ((k + 0.5) / BEAMS) * aspect, hue: pal.line + k * 45, angle: 0, angleTo: (rand(s) - 0.5) * 1.2, on: 0, phase: rand(s) * TAU, speed: 0.3 + rand(s) * 0.4 });
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = MANNER[role] ?? MANNER.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.manner[k] = ease(s.manner[k], want[k], 1.2, dt);
    s.beatPhase = clock.beatPhase;
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.lasers = ease(s.lasers, s.riser > 0 ? 1 : 0, 3, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.hands = ease(s.hands, Math.max(s.manner.hands, s.riser), 1.5, dt);
    s.flash = decay(s.flash, 4, dt); s.strobe = decay(s.strobe, 10, dt);
    s.wash.level = decay(s.wash.level, 1.2, dt); s.haze.level = decay(s.haze.level, 0.4, dt);
    const lift = (m, by) => { m.jump = Math.min(1.5, m.jump + by); };
    const surf = () => { // one monkey from the middle rows is lifted; it crosses the crowd and is set down where it lands
      if (s.surfer) return;
      const mid = s.monkeys.map((m, i) => i).filter((i) => s.monkeys[i].z > 0.25 && s.monkeys[i].z < 0.7 && s.monkeys[i].x > 0.35 && s.monkeys[i].x < s.aspect - 0.35);
      if (!mid.length) return;
      const i = mid[Math.floor(rand(s) * mid.length)], m = s.monkeys[i];
      s.surfer = { i, x: m.x, z: m.z, dir: m.x > s.aspect / 2 ? -1 : 1, rise: 0, life: 0, span: 5 + rand(s) * 3, up: true };
    };
    for (const b of s.beams) { // a lit lamp holds its aim; an idle one sweeps (before the boundary and the events, which light lamps this step)
      b.on = ease(b.on, 0.12 + 0.3 * s.manner.rig * s.energy, 1.5, dt); // never quite dark: the rig idles between notes
      const idle = Math.sin(s.t * b.speed * s.motion + b.phase) * 0.5 * (1 - clamp(b.on * 2));
      b.angle = ease(b.angle, b.angleTo + idle, 3, dt);
    }
    if (clock.boundary) {
      s.hueShift = ((clock.index * 53) % 120) - 60; s.flash = 1;
      for (const b of s.beams) { b.angleTo = (rand(s) - 0.5) * 1.4; b.hue = s.pal.line + s.hueShift + rand(s) * 90; b.on = 1; }
      for (const m of s.monkeys) lift(m, 0.4 * rand(s));
      if (s.energy > 0.5 && rand(s) < 0.5) surf();
    }
    for (const m of s.monkeys) { m.jump = decay(m.jump, 5, dt); m.tiltTo = decay(m.tiltTo, 2, dt); m.tilt = ease(m.tilt, m.tiltTo, 6, dt); }
    const S = s.surfer;
    if (S) {
      S.life += dt; S.rise = ease(S.rise, S.up ? 1 : 0, 3, dt);
      if (S.up) { S.x += S.dir * 0.12 * s.aspect * dt * (0.7 + 0.6 * s.energy); if (S.life > S.span || S.x < 0.15 || S.x > s.aspect - 0.15 || s.dark > 0.5) S.up = false; }
      s.monkeys[S.i].x = S.x;
      if (!S.up && S.rise < 0.02) s.surfer = null;
    }
    // the events
    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'pulse') { for (const m of s.monkeys) if (rand(s) < 0.7) lift(m, 0.5 * g * m.amp); s.flash = Math.max(s.flash, 0.25 * g); for (const b of s.beams) b.on = Math.min(1, b.on + 0.2 * g); }
        else if (e.role === 'impact') { s.strobe = Math.max(s.strobe, g); for (const m of s.monkeys) lift(m, 0.3 * g); if (s.energy > 0.45 && rand(s) < 0.35) surf(); }
        else if (e.role === 'grain') { for (let k = 0; k < 6; k++) { const m = s.monkeys[Math.floor(rand(s) * N)]; m.tiltTo = (rand(s) - 0.5) * 0.5 * g * s.jitter; } }
        else for (const m of s.monkeys) if (rand(s) < 0.3) lift(m, 0.3 * g);
      } else if (slot === 'ground') {
        if (e.note !== null) s.wash.hue = ((e.note % 12) + 12) % 12 * 30 + s.hueShift;
        s.wash.level = Math.min(1, s.wash.level + 0.7 * g);
        for (const m of s.monkeys) if (m.z > 0.6 && rand(s) < 0.4) lift(m, 0.2 * g); // the back rows feel the bass
      } else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        const b = s.beams[(((e.note % 12) + 12) % 12 * 5 + (slot === 'counter' ? 3 : 0)) % BEAMS];
        b.hue = ((e.note % 12) + 12) % 12 * 30 + s.hueShift + (slot === 'counter' ? 180 : 0); b.angleTo = (e.pan - 0.5) * 1.6; b.on = 1;
      } else if (slot === 'field') {
        s.haze.level = Math.min(1, 0.5 + 0.5 * g);
        if (e.cutoff !== null) s.haze.tint = clamp(Math.log(e.cutoff / 200) / Math.log(40));
      } else if (slot === 'transition') {
        if (e.dur >= 1) s.strobe = Math.max(s.strobe, 1);
      } else if (slot === 'grain' || e.role === 'grain') { const m = s.monkeys[Math.floor(rand(s) * N)]; m.tiltTo = (rand(s) - 0.5) * 0.4 * g; }
    }
  },

  draw(s, ctx, w, h) {
    const { pal, aspect } = s, lit = 1 - 0.85 * s.dark, rig = s.manner.rig * lit;
    const X = (x) => (x / aspect) * w, Y = (y) => y * h, R = (r) => r * h;
    ctx.globalCompositeOperation = 'source-over';
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, hsla(s.bg[0] + s.hueShift, 30, 2)); bg.addColorStop(1, hsla(s.bg[0] + s.hueShift, 25, 9));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // the haze the pad puts in the air: a glow around the rig, brighter and paler with the pad's cutoff
    if (s.haze.level > 0.02) {
      const g = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, R(1.1));
      g.addColorStop(0, hsla(pal.field + s.hueShift, pal.sat, lerp(25, 55, s.haze.tint), 0.35 * s.haze.level * lit)); g.addColorStop(1, hsla(pal.field + s.hueShift, pal.sat, 20, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // the truss and its beams: a wedge from each lamp, aimed by its angle, its colour the note's, dying away down the frame
    ctx.globalCompositeOperation = 'lighter';
    for (const b of s.beams) {
      const on = b.on * rig; if (on < 0.01) continue;
      const x0 = X(b.x), y0 = R(0.03), L = R(1.4), dx = Math.sin(b.angle) * L, dy = Math.cos(b.angle) * L, half = R(0.04 + 0.16 * s.haze.level + 0.05 * on);
      const g = ctx.createLinearGradient(x0, y0, x0 + dx, y0 + dy);
      g.addColorStop(0, hsla(b.hue, 90, 70, 0.55 * on)); g.addColorStop(0.5, hsla(b.hue, 90, 60, 0.18 * on)); g.addColorStop(1, hsla(b.hue, 90, 60, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + dx + Math.cos(b.angle) * half, y0 + dy - Math.sin(b.angle) * half); ctx.lineTo(x0 + dx - Math.cos(b.angle) * half, y0 + dy + Math.sin(b.angle) * half); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hsla(b.hue, 80, 85, on); ctx.beginPath(); ctx.arc(x0, y0, R(0.012), 0, TAU); ctx.fill();
    }
    // lasers on a riser: thin lines fanned from the truss centre, sweeping faster as the riser closes
    if (s.lasers > 0.02) {
      ctx.lineWidth = Math.max(1, R(0.0025));
      for (let k = 0; k < 12; k++) {
        const a = Math.sin(s.t * (1.5 + 3 * s.riser) + k * 0.7) * 0.9, L = R(1.3);
        ctx.strokeStyle = hsla(k % 2 ? 120 : pal.line + s.hueShift, 100, 60, 0.6 * s.lasers * lit);
        ctx.beginPath(); ctx.moveTo(w / 2, R(0.03)); ctx.lineTo(w / 2 + Math.sin(a) * L, R(0.03) + Math.cos(a) * L); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hsla(0, 0, 8); ctx.fillRect(0, R(0.02), w, R(0.02)); // the truss
    // the crowd, far to near; the far rows fade into the dark
    const bounce = s.manner.bounce * lerp(0.5, 1.2, s.energy) * lit, S = s.surfer;
    for (let i = 0; i < s.monkeys.length; i++) {
      const m = s.monkeys[i], fade = m.z ** 1.5 * 0.6, r = R(headR(m.z));
      const tone = ([hh, ss, ll]) => hsla(hh, ss * (1 - fade), lerp(ll, 6, fade));
      if (S && S.i === i) { surfer(ctx, m, X(S.x), Y(headY(m.z)) - r * (2.2 * S.rise), r, s, tone, S); continue; }
      const under = S && S.up && Math.abs(m.x - S.x) < 0.3 && Math.abs(m.z - S.z) < 0.25;
      const up = under || m.keen < s.hands, y = Y(headY(m.z)) - (hop(s.beatPhase + m.phase) * m.amp * bounce * 0.5 + m.jump * 0.9) * r;
      monkey(ctx, m, X(m.x), y, r, s, tone, up ? 'up' : 'stand');
    }
    // the wash the bass throws on the faces, from the stage up into the crowd
    if (s.wash.level > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, R(1)); g.addColorStop(0, hsla(s.wash.hue, 80, 55, 0.3 * s.wash.level * lit)); g.addColorStop(1, hsla(s.wash.hue, 80, 55, 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (s.strobe > 0.02 || s.flash > 0.02) { ctx.fillStyle = hsla(pal.hue + s.hueShift, 20, 96, clamp(0.7 * s.strobe + 0.25 * s.flash) * lit); ctx.fillRect(0, 0, w, h); }
    // the stage lip: what hides the feet
    const lip = ctx.createLinearGradient(0, Y(LIP), 0, h); lip.addColorStop(0, hsla(s.bg[0], 20, 14)); lip.addColorStop(1, hsla(s.bg[0], 20, 4));
    ctx.fillStyle = lip; ctx.fillRect(0, Y(LIP), w, h - Y(LIP));
    ctx.fillStyle = hsla(s.wash.hue, 50, 40, 0.5 * lit + 0.3 * s.wash.level); ctx.fillRect(0, Y(LIP), w, Math.max(1, R(0.004)));
    if (s.dark > 0.02) { ctx.fillStyle = `rgba(0 0 0 / ${0.6 * s.dark})`; ctx.fillRect(0, 0, w, h); }
  },
};


/**
/** The crowd surfer: the same monkey rolled onto its back, carried on a row of open hands, feet kicking in the air. */
function surfer(ctx, m, cx, cy, r, s, tone, S) {
  const roll = Math.sin(s.t * 2.5) * 0.15 * S.rise;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-S.dir * (Math.PI / 2) * S.rise + roll);
  monkey(ctx, { ...m, tilt: 0 }, 0, 0, r, s, tone, 'surf');
  ctx.restore();
  ctx.fillStyle = tone(TIP); // the hands under it
  for (let k = -2; k <= 2; k++) { const lift = Math.sin(s.t * 5 + k) * 0.15 * r; ctx.beginPath(); ctx.arc(cx + S.dir * k * 1.1 * r, cy + 1.6 * r * S.rise + lift, 0.3 * r, 0, TAU); ctx.fill(); }
}

/**
 * One sock monkey as the toys are made, head centre (cx, cy), head half-width r: the head a rounded block sitting
 * straight on a tube body the same width, round ear discs, two small dark eyes set high (some ringed in light
 * thread), the big red heel low on the face for a mouth with its light rim, a heart on some chests, long thin
 * limbs ending in light tips. Legs first, then body and arms in the pose (`stand`: hanging, `up`: raised with open
 * hands and a glowstick in some, `surf`: out to the sides, legs kicking), then the head with its face, tilted. What a
 * nearer monkey or the stage lip hides is painted over; what shows is a whole body.
 */
function monkey(ctx, m, cx, cy, r, s, tone, pose) {
  const [bh, bs, bl] = m.body, body = tone(m.body), tip = tone(TIP), lips = tone(LIPS), dark = tone([bh, bs, bl - 22]);
  const shade = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, tone([bh, bs, bl + 12])); g.addColorStop(1, tone([bh, bs + 6, bl - 14])); return g; }; // lit from the stage, front and left
  const limb = (x0, y0, x1, y1, wdt) => { // a limb in the body's colour, ringed in light thread on a striped sock
    ctx.strokeStyle = body; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (m.stripes) { ctx.globalAlpha = 0.22; ctx.strokeStyle = tip; ctx.lineCap = 'butt'; ctx.setLineDash([0.08 * r, 0.3 * r]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'round'; ctx.globalAlpha = 1; } // faint rings of the knit
  };
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) { // long legs from the body's foot, light tips
    const kick = pose === 'surf' ? Math.sin(s.t * 6 + side) * 0.3 * r : 0;
    limb(cx + side * 0.45 * r, cy + 3.7 * r, cx + side * 0.8 * r + kick, cy + 6.6 * r, 0.42 * r);
    ctx.fillStyle = tip; ctx.beginPath(); ctx.arc(cx + side * 0.8 * r + kick, cy + 6.6 * r, 0.28 * r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = shade(cx - r, cy, cx + r, cy + 4 * r); ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, 0.03 * r);
  ctx.beginPath(); ctx.roundRect(cx - 0.95 * r, cy + 0.5 * r, 1.9 * r, 3.5 * r, 0.9 * r); ctx.fill(); ctx.stroke(); // the body: a tube as wide as the head, shaded, outlined
  if (m.dots) { ctx.globalAlpha = 0.22; ctx.fillStyle = tip; for (const [dx, dy] of DOTS) { ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, 0.07 * r, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; } // a polka-dot sock, faint and small
  if (m.heart) { const hy = cy + 2 * r, hr = 0.22 * r; ctx.fillStyle = tone(HEART); ctx.beginPath(); ctx.arc(cx - hr, hy, hr, Math.PI, 0); ctx.arc(cx + hr, hy, hr, Math.PI, 0); ctx.lineTo(cx, hy + 1.9 * hr); ctx.closePath(); ctx.fill(); }
  const sway = Math.sin(s.t * 3 + m.sway) * 0.25 * r;
  ctx.lineWidth = 0.38 * r;
  for (const side of [-1, 1]) { // arms by the pose
    const [hx, hy] = pose === 'up' ? [cx + side * 1.5 * r + sway, cy - 1.7 * r] : pose === 'surf' ? [cx + side * 2.4 * r, cy + 0.6 * r] : [cx + side * 1.25 * r + sway * 0.3, cy + 3.4 * r];
    limb(cx + side * 0.85 * r, cy + 1.1 * r, hx, hy, 0.38 * r);
    ctx.fillStyle = tip; ctx.beginPath(); ctx.arc(hx, hy, 0.26 * r, 0, TAU); ctx.fill();
    if (pose === 'up' && m.glow >= 0 && side === 1) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = hsla(m.glow, 100, 65, 0.9); ctx.lineWidth = 0.14 * r; ctx.beginPath(); ctx.moveTo(hx - 0.2 * r, hy); ctx.lineTo(hx + 0.5 * r, hy - 0.8 * r); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 0.38 * r; }
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(m.tilt);
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, 0.03 * r);
  for (const side of [-1, 1]) { ctx.fillStyle = body; ctx.beginPath(); ctx.arc(side * 1.1 * r, -0.15 * r, 0.36 * r, 0, TAU); ctx.fill(); ctx.stroke(); } // ear discs
  ctx.fillStyle = shade(-r, -1.2 * r, 0.6 * r, r); ctx.beginPath(); ctx.roundRect(-r, -1.15 * r, 2 * r, 2.1 * r, 0.75 * r); ctx.fill(); ctx.stroke(); // the head, a rounded block, shaded, outlined
  if (m.dots) { ctx.globalAlpha = 0.22; ctx.fillStyle = tip; for (const [dx, dy] of [[-0.62, -0.9], [0.66, -0.82], [0.72, 0.1]]) { ctx.beginPath(); ctx.arc(dx * r, dy * r, 0.06 * r, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; } // dots on the head, clear of the face, faint and small
  ctx.fillStyle = 'rgba(255 255 255 / .09)'; ctx.beginPath(); ctx.ellipse(-0.3 * r, -0.6 * r, 0.5 * r, 0.25 * r, -0.4, 0, TAU); ctx.fill(); // a sheen
  ctx.fillStyle = tip; ctx.beginPath(); ctx.ellipse(0, 0.42 * r, 0.7 * r, 0.36 * r, 0, 0, TAU); ctx.fill(); // the mouth's light rim
  ctx.fillStyle = lips; ctx.beginPath(); ctx.ellipse(0, 0.42 * r, 0.6 * r, 0.27 * r, 0, 0, TAU); ctx.fill(); // the red heel
  ctx.strokeStyle = 'rgba(0 0 0 / .35)'; ctx.lineWidth = Math.max(1, 0.05 * r); ctx.beginPath(); ctx.moveTo(-0.45 * r, 0.42 * r); ctx.quadraticCurveTo(0, 0.55 * r, 0.45 * r, 0.42 * r); ctx.stroke(); // the seam
  if (m.shades) { ctx.fillStyle = 'rgba(0 0 0 / .85)'; ctx.fillRect(-0.72 * r, -0.62 * r, 1.44 * r, 0.32 * r); ctx.fillStyle = 'rgba(255 255 255 / .25)'; ctx.fillRect(-0.62 * r, -0.58 * r, 0.4 * r, 0.08 * r); }
  else for (const side of [-1, 1]) { // small eyes set high, sewn five ways: buttons, buttons ringed in light thread, a stitched cross, a sleepy arc, a coloured button
    const ex = side * 0.45 * r, ey = -0.48 * r;
    ctx.fillStyle = 'rgba(0 0 0 / .85)'; ctx.strokeStyle = 'rgba(0 0 0 / .85)'; ctx.lineWidth = Math.max(1, 0.07 * r); ctx.lineCap = 'round';
    if (m.eyes === 1) { ctx.fillStyle = tip; ctx.beginPath(); ctx.arc(ex, ey, 0.17 * r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0 0 0 / .85)'; }
    if (m.eyes === 2) { ctx.beginPath(); ctx.moveTo(ex - 0.12 * r, ey - 0.12 * r); ctx.lineTo(ex + 0.12 * r, ey + 0.12 * r); ctx.moveTo(ex + 0.12 * r, ey - 0.12 * r); ctx.lineTo(ex - 0.12 * r, ey + 0.12 * r); ctx.stroke(); }
    else if (m.eyes === 3) { ctx.beginPath(); ctx.arc(ex, ey - 0.04 * r, 0.14 * r, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    else if (m.eyes === 4) { ctx.fillStyle = hsla(m.hatHue + 120, 55, 45); ctx.beginPath(); ctx.arc(ex, ey, 0.14 * r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0 0 0 / .85)'; ctx.beginPath(); ctx.arc(ex, ey, 0.06 * r, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(ex, ey, 0.1 * r, 0, TAU); ctx.fill(); }
  }
  if (m.hat) { // the hats: a pom beanie, a party cone, a top hat, a sweatband, a cap
    const hue = m.hatHue, hc = tone([hue, 60, 48]), hd = tone([hue, 60, 34]);
    ctx.fillStyle = hc;
    if (m.hat === 1) { ctx.beginPath(); ctx.moveTo(-0.85 * r, -0.95 * r); ctx.quadraticCurveTo(-0.2 * r, -2.2 * r, 0.05 * r, -1.9 * r); ctx.quadraticCurveTo(0.5 * r, -1.75 * r, 0.85 * r, -0.95 * r); ctx.closePath(); ctx.fill(); ctx.fillStyle = tip; ctx.beginPath(); ctx.arc(0.05 * r, -1.9 * r, 0.2 * r, 0, TAU); ctx.fill(); ctx.fillRect(-0.9 * r, -1.1 * r, 1.8 * r, 0.18 * r); }
    else if (m.hat === 2) { ctx.beginPath(); ctx.moveTo(-0.55 * r, -1 * r); ctx.lineTo(0, -2.3 * r); ctx.lineTo(0.55 * r, -1 * r); ctx.closePath(); ctx.fill(); ctx.strokeStyle = tip; ctx.lineWidth = 0.08 * r; ctx.beginPath(); ctx.moveTo(-0.35 * r, -1.45 * r); ctx.lineTo(0.35 * r, -1.45 * r); ctx.stroke(); ctx.fillStyle = tip; ctx.beginPath(); ctx.arc(0, -2.3 * r, 0.12 * r, 0, TAU); ctx.fill(); }
    else if (m.hat === 3) { ctx.fillStyle = hd; ctx.fillRect(-1.15 * r, -1.1 * r, 2.3 * r, 0.16 * r); ctx.fillRect(-0.75 * r, -2.2 * r, 1.5 * r, 1.15 * r); ctx.fillStyle = hc; ctx.fillRect(-0.75 * r, -1.35 * r, 1.5 * r, 0.2 * r); }
    else if (m.hat === 4) { ctx.fillRect(-1 * r, -1 * r, 2 * r, 0.24 * r); ctx.fillStyle = tip; ctx.fillRect(-1 * r, -0.92 * r, 2 * r, 0.06 * r); }
    else { ctx.beginPath(); ctx.arc(0, -0.95 * r, 0.95 * r, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.fillStyle = hd; ctx.fillRect(-0.2 * r, -1.05 * r, 1.4 * r, 0.16 * r); }
  }
  ctx.restore();
}
