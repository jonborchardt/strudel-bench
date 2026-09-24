// combo: the song as a small band sitting in a ring, and at every moment one of them has the floor. Each player is a
// seat on an ellipse seen from slightly above (the near seats large and low, the far ones small and high), and its body
// is the instrument itself, an object that is played and rings: strings that are plucked and wobble in a standing wave
// (the bass has three thick slow ones, a melody four to six quick ones), a membrane that is struck and ripples from the
// point of the strike, a column of air that swells and breathes for the length of the note, a stack of bars that are
// hit one at a time, a cluster that rattles - and a cluster that turns out to be playing notes is restrung as an
// instrument the first time one arrives, since a hand-written piano reaches a world as a bare part. Nothing plots a note against time - there is no time axis anywhere in a
// body - so a note is never a point on a graph: it picks the string or bar it falls on (by where it sits in that
// player's own register, so a line inside one octave uses the whole instrument), sets how hard it rings and how fast it
// wobbles, and rings for as long as the note lasts before it fades. Nothing is ever a still object: a player that is
// waiting still breathes - the strings sway, the bars ride a slow wave, the air moves in the column, the drum head is
// slack, the cluster settles - faintly while it is playing and fully once it has stopped. The instrument a player gets comes from its job, and how many strings it has, how tall, how
// taut, how tilted, from the part itself, so two melodies are two different instruments and not one drawn twice.
// Who has the floor is measured, not declared: every part's recent weighted onsets are compared against its own
// long-run level, so a part playing above its own norm is soloing and a part playing under it is comping; the leader
// has to hold the lead to take the seat, so a single loud hit never steals it. The floor-holder swells, brightens and
// leans in; everyone else draws back, dims, leans toward it and takes on some of its colour. Nothing is wired to
// anything: what binds them is the ground they share, which every hit runs out across as a flat ring, so two players
// playing together is two rings crossing. Nobody sits still either - each drifts around its place at its own two
// speeds, further out when the band is loose, and a player whose part does not sound in a section is not on stage for
// it: it fades out over about a second and walks back on when its part comes in, the others spacing themselves evenly
// again around whoever is left and walking to the room that opens up, so half a band is never half an empty ring. Trading fours needs no special case: if the parts alternate, so does the
// floor. The centre displays nothing - it is the lit ground itself, breathing with the beat. A section's role is how the band sits
// (establish: the ring wide and slow, climax: tight, everyone forward, release: loosening and dimming); a boundary
// hands the floor over with a light going round the ring; a riser tightens it; a dropout pulls every body back.
// Deterministic: randomness only from the state's own seeded generator.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, fadeFrame } from './kit.mjs';

const TAU = Math.PI * 2;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
const SAY = { ground: 0.8, line: 1, counter: 0.9, field: 0.5, impulse: 0.45, grain: 0.25, transition: 0.2 }; // how much one hit of each job counts as speaking: a ride cymbal is not a solo
const HOLD = 0.55; // seconds a challenger must lead by MARGIN before the floor changes hands
const MARGIN = 1.2;
// the instrument each job is played on, and the range its build varies over: strings are plucked and wobble, a membrane
// is struck and ripples, a column of air swells, bars are hit one at a time, a cluster rattles, an aura only flares.
const BUILD = {
  ground: { form: 'strings', n: [3, 4], ring: [0.45, 0.7], tall: [1.15, 1.35], thick: 2.1 },
  line: { form: 'strings', n: [4, 6], ring: [1, 1.5], tall: [0.85, 1.1], thick: 1 },
  counter: { form: 'bars', n: [4, 6], ring: [0.8, 1.2], tall: [0.8, 1], thick: 1 },
  field: { form: 'column', n: [3, 4], ring: [0.3, 0.5], tall: [1, 1.25], thick: 1.4 },
  impulse: { form: 'membrane', n: [1, 1], ring: [1, 1], tall: [0.9, 1.1], thick: 1.3 },
  grain: { form: 'cluster', n: [5, 9], ring: [1, 1], tall: [0.7, 0.9], thick: 1 },
  transition: { form: 'aura', n: [1, 1], ring: [1, 1], tall: [1, 1], thick: 1 },
};
// how the band sits, per section role: the ring's size, how fast the light goes round, the glow, how far the compers turn toward the soloist, the frame's persistence
const SIT = {
  establish: { ring: 1.12, speed: 0.8, glow: 0.72, lean: 0.5, trail: 0.3 },
  develop: { ring: 1, speed: 1, glow: 1, lean: 0.8, trail: 0.24 },
  climax: { ring: 0.86, speed: 1.2, glow: 1.35, lean: 1, trail: 0.18 },
  release: { ring: 1.16, speed: 0.75, glow: 0.8, lean: 0.4, trail: 0.3 },
  none: { ring: 1, speed: 1, glow: 1, lean: 0.8, trail: 0.24 },
};

/** Where a seat sits on the ring, in height units around the centre, and how near it is: z runs -1 at the back to 1 at the front. */
const placeOf = (seat, ring) => {
  const z = Math.sin(seat.angle);
  return { x: Math.cos(seat.angle) * ring, y: z * 0.52 * ring, z, scale: lerp(0.68, 1.3, (z + 1) / 2) };
};

export default {
  name: 'combo',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng);
    const s = {
      pal, size: { ...size }, bg: [pal.hue, 30, 4],
      weight: lerp(0.7, 1.5, p.mass), jitter: lerp(0, 1, p.jitter), spread: lerp(0.85, 1.2, p.spread), motion: lerp(0.7, 1.3, p.motion),
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      playsIn: Object.fromEntries(Object.keys(score.cast).map((n) => [n, score.sections.map((x) => ((x.parts?.[n]?.onsets ?? 0) > 0 ? 1 : 0))])), // a player is on stage only in the sections its part sounds in
      t: 0, seats: {}, order: [],
      floor: null, lead: null, leadFor: 0, // the floor and the challenger: a lead has to be held before the seat changes hands
      waves: [], // what everyone is playing, crossing the ground they share: { from, r, hot }
      beat: 0, sweep: 0, sweepAt: 0, // the beat's breath and the boundary's hand-over
      sit: { ...SIT.none }, energy: 0.5, riser: 0, wasRiser: 0, dark: 0, hueShift: 0, lastBeat: -1,
    };
    seed(s, rng);
    for (const name of Object.keys(score.cast)) seatFor(s, name, score.cast[name].slot);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = SIT[role] ?? SIT.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.sit[k] = ease(s.sit[k], want[k], 1.2, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.wasRiser = s.riser > 0 ? s.riser : decay(s.wasRiser, 2, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    if (clock.boundary) { s.sweep = 1; s.sweepAt = -Math.PI / 2; s.hueShift = ((clock.index * 41) % 50) - 25; } // the floor is handed over: a light goes round the ring
    if (s.sweep > 0) { s.sweepAt += dt * TAU * 0.9 * s.sit.speed; s.sweep = decay(s.sweep, 1.1, dt); }
    if (clock.beat !== s.lastBeat) { s.lastBeat = clock.beat; s.beat = 1; }
    s.beat = decay(s.beat, 6, dt);

    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';
      const name = e.layer ?? slot, q = seatFor(s, name, slot), g = clamp(e.gain * e.velocity, 0, 1.5);
      q.fast = Math.min(6, q.fast + g * (SAY[slot] ?? 0.3));
      q.hot = Math.min(1.6, q.hot + 0.5 * g);
      if (e.note !== null) { if (q.form === 'cluster') restring(s, q); seen(q, pitch(e.note)); }
      const where = e.note === null ? 0.5 : place(q, pitch(e.note)); // which string, bar or arc the note falls on, inside this player's own register
      if (q.form === 'membrane') { // struck: a ripple from where it was hit, the role saying where
        const rr = e.role === 'pulse' ? 0.1 : e.role === 'impact' ? 0.42 : 0.7, a = e.role === 'pulse' ? 0 : rand(s) * TAU;
        q.ripples.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.55, r: 0.02, hot: e.role === 'grain' ? 0.5 * g : g, w: e.role === 'impact' ? 1.5 : 1 });
        if (q.ripples.length > 14) q.ripples.shift();
        q.shove = Math.min(1.4, q.shove + 0.6 * g);
      } else if (q.form === 'cluster') {
        for (const d of q.dots) d.v = Math.min(1.5, d.v + 0.6 * g * (0.4 + rand(s)));
      } else if (q.form === 'aura') {
        if (e.dur >= 1) { s.sweep = Math.max(s.sweep, 1); s.sweepAt = -Math.PI / 2; }
        q.shove = Math.min(1.6, q.shove + 0.5 + 0.5 * g);
      } else { // strings, bars and the column: the note rings the element it falls on
        const k = Math.min(q.els.length - 1, Math.max(0, Math.round(where * (q.els.length - 1))));
        const el = q.els[k];
        el.amp = Math.min(1.5, el.amp + g);
        el.freq = lerp(5, 17, where) * q.ring; // a higher note is a tighter string: it rings faster
        el.hot = 1; el.age = 0; el.hold = clamp(e.dur, 0.25, 4); // a long note goes on sounding: the string is still ringing while it lasts
        if (q.form === 'column' && e.cutoff !== null) q.tint = clamp(Math.log(Math.max(20, e.cutoff) / 200) / Math.log(40));
      }
      // and it runs out across the ground they all stand on: where two players' rings cross, they are playing together
      if ((SAY[slot] ?? 0) >= 0.4 && s.t - q.lastWave > 0.22) { q.lastWave = s.t; s.waves.push({ from: name, r: 0.02, hot: clamp(g) * (name === s.floor ? 1 : 0.7) }); if (s.waves.length > 24) s.waves.shift(); }
    }

    // who is speaking: each part's recent weighted onsets against its own long-run level, so a part playing above its
    // own norm is soloing and one playing under it is comping. A part with no norm yet (the first bars) leans quiet.
    let best = null, bestSay = 0;
    for (const name of s.order) {
      const q = s.seats[name];
      q.fast = decay(q.fast, 1.4, dt);
      q.slow = ease(q.slow, q.fast, 0.12, dt);
      q.say = q.fast * lerp(0.45, 1.5, clamp(q.fast / (q.slow * 2 + 0.05)));
      if (q.say > bestSay) { bestSay = q.say; best = name; }
    }
    const held = s.floor ? s.seats[s.floor].say : 0;
    if (best && best !== s.floor && bestSay > held * MARGIN + 0.02) {
      s.leadFor = s.lead === best ? s.leadFor + dt : 0; s.lead = best;
      if (s.leadFor >= HOLD || s.floor === null) { s.floor = best; s.leadFor = 0; }
    } else { s.lead = s.floor; s.leadFor = 0; }

    // the band closes up around whoever is on stage: the players left in a section space themselves evenly again and
    // walk to their new places, so a section that drops half the parts is not half an empty ring
    const on = s.order.filter((n) => s.seats[n].here > 0.5);
    const m = on.length;
    if (m) on.forEach((n, i) => { s.seats[n].want = -Math.PI / 2 + (i / m) * TAU + s.seats[n].jit * s.jitter * (TAU / (m * 3)); });
    for (const n of s.order) {
      const q = s.seats[n], d = Math.atan2(Math.sin(q.want - q.base), Math.cos(q.want - q.base)); // the short way round, never the long one
      q.base += d * (1 - Math.exp(-0.6 * dt));
    }

    // the instruments ring on, and the bodies swell, draw back and shift in their seats
    const lit = s.floor ? s.seats[s.floor] : null;
    for (const name of s.order) {
      const q = s.seats[name], mine = name === s.floor;
      q.here = ease(q.here, clock.index >= 0 ? s.playsIn[name]?.[clock.index] ?? 1 : 1, 1.1, dt); // walks on when its part enters the section, and off when it drops out
      q.rest = ease(q.rest, q.fast > 0.05 ? 0 : 1, 0.7, dt); // waiting, not gone: what the idle breath is scaled by
      q.idle = 0.3 + 0.7 * q.rest; // how much of the idle breath shows: some of it always, all of it once the player has stopped
      q.hot = decay(q.hot, 2.4, dt);
      q.sw = ease(q.sw, mine ? 1 : clamp(0.1 + 0.35 * q.say), 2.2, dt);
      q.lean = ease(q.lean, mine ? 0 : s.sit.lean * clamp(0.3 + 0.5 * q.say), 1.6, dt);
      // nobody sits still: each player drifts around its place at its own two speeds, further out when the band is loose
      const wob = Math.sin(s.t * 0.23 * s.motion + q.ph1) * 0.62 + Math.sin(s.t * 0.41 * s.motion + q.ph2) * 0.38;
      const step = Math.sin(s.t * 0.17 * s.motion + q.ph2) * 0.5 + Math.sin(s.t * 0.29 * s.motion + q.ph1) * 0.5;
      q.angle = q.base + wob * 0.16 * lerp(1.2, 0.6, s.energy);
      q.near = 1 + step * 0.09 * lerp(1.2, 0.7, s.energy);
      q.hueAt = ease(q.hueAt, mine || !lit ? q.hue : lerp(q.hue, lit.hue, 0.3), 0.5, dt); // comping, a player takes on some of the soloist's colour
      q.shove = decay(q.shove, 3, dt);
      q.lo = ease(q.lo, q.mid - 0.03, 0.06, dt); q.hi = ease(q.hi, q.mid + 0.03, 0.06, dt); // the register relaxes back, so one old leap does not use up the instrument for ever
      for (const el of q.els) {
        el.phase += el.freq * dt * TAU * (q.form === 'column' ? 0.25 : 1);
        el.amp = decay(el.amp, el.age < el.hold ? 0.35 : q.form === 'bars' ? 2.6 : 1.5, dt); // while the note lasts it barely fades; after it, it rings off
        el.age += dt; el.hot = decay(el.hot, 3, dt);
      }
      for (const r of q.ripples) { r.r += dt * (0.7 + 0.5 * r.w); r.hot = decay(r.hot, 2.6, dt); }
      q.ripples = q.ripples.filter((r) => r.hot > 0.03 && r.r < 1.3);
      for (const d of q.dots) { // shaken hard when played, and always settling and shifting when not
        d.v = decay(d.v, 5, dt);
        d.px = d.x + Math.sin(s.t * 26 + d.ph) * 0.05 * d.v + Math.sin(s.t * 0.9 * s.motion + d.ph) * 0.05 * q.idle;
        d.py = d.y + Math.cos(s.t * 31 + d.ph) * 0.04 * d.v + Math.cos(s.t * 0.7 * s.motion + d.ph) * 0.04 * q.idle;
      }
    }
    for (const u of s.waves) { u.r += dt * 0.85; u.hot = decay(u.hot, 1.5, dt); }
    s.waves = s.waves.filter((u) => u.hot > 0.04 && u.r < 2.2);
  },

  draw(s, ctx, w, h) {
    const { pal, sit } = s, hue = pal.hue + s.hueShift, lit = 1 - 0.65 * s.dark;
    const glow = sit.glow * lerp(0.65, 1.15, s.energy) * lit * (1 + 0.3 * s.riser);
    const R = (u) => u * h, cx = w / 2, cy = h * 0.53;
    const ringX = Math.min(R(0.50) * s.spread * sit.ring * (1 - 0.08 * s.riser), w * 0.34), ringY = ringX * 0.52;
    fadeFrame(ctx, w, h, s.bg, clamp(sit.trail + 0.08 * s.riser, 0.1, 0.45));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const at = (q) => { const p = placeOf(q, q.near); return { x: cx + p.x * ringX, y: cy + p.y * ringX, z: p.z, scale: p.scale }; };
    // the room the band sits in: never a bare frame, and it breathes with the beat
    const room = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.6);
    room.addColorStop(0, hsla(hue, pal.sat, lerp(10, 17, clamp(0.3 * s.energy + 0.4 * s.beat)), 0.55 * lit));
    room.addColorStop(0.55, hsla(hue - 10, pal.sat, 7, 0.4 * lit));
    room.addColorStop(1, hsla(hue - 20, pal.sat, 3, 0));
    ctx.fillStyle = room; ctx.fillRect(0, 0, w, h);
    // the ground the band sits on: a lit pool, breathing with the beat, displaying nothing
    const stage = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringX * 1.15);
    stage.addColorStop(0, hsla(hue, pal.sat, lerp(14, 26, clamp(0.35 * s.energy + 0.5 * s.beat)), 0.55 * lit));
    stage.addColorStop(1, hsla(hue, pal.sat, 8, 0));
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.52); ctx.fillStyle = stage; ctx.beginPath(); ctx.arc(0, 0, ringX * 1.15, 0, TAU); ctx.fill(); ctx.restore();
    ctx.globalCompositeOperation = 'lighter';

    // what each player is doing, running out across the ground they share: where two rings cross, they are together
    const floor = s.floor ? at(s.seats[s.floor]) : { x: cx, y: cy };
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.52); ctx.translate(-cx, -cy); // the waves lie flat on the ground, in its perspective
    for (const u of s.waves) {
      const q = s.seats[u.from]; if (!q) continue;
      const p = placeOf(q, q.near), x = cx + p.x * ringX, y = cy + (p.y / 0.52) * ringX;
      ctx.strokeStyle = hsla(q.hueAt + s.hueShift, pal.sat - 20, 72, 0.4 * u.hot * clamp(1.1 - u.r / 2.2) * lit);
      ctx.lineWidth = Math.max(1, R(0.0022) * s.weight);
      ctx.beginPath(); ctx.arc(x, y, u.r * ringX * 0.85, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // the players, back to front: each one the instrument it is played on, ringing
    for (const name of [...s.order].sort((a, b) => Math.sin(s.seats[a].angle) - Math.sin(s.seats[b].angle))) {
      const q = s.seats[name], p = at(q);
      if (q.here < 0.02) continue; // its part does not sound in this section: off stage
      const sc = p.scale * (1.3 + 0.5 * q.sw) * lerp(0.7, 1, q.here), col = (a, l = 70) => hsla(q.hueAt + s.hueShift, 78, l, a * q.here * lit);
      const pull = q.lean * 0.12, bx = lerp(p.x, floor.x, pull), by = lerp(p.y, floor.y, pull); // a comper turns and leans toward whoever has the floor
      const U = (u) => R(u) * sc, bright = glow * (0.45 + 0.75 * q.sw), tall = q.tall;
      const halo = ctx.createRadialGradient(bx, by, 0, bx, by, U(0.075));
      halo.addColorStop(0, col(0.17 * bright, 60)); halo.addColorStop(1, col(0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(bx, by, U(0.075), 0, TAU); ctx.fill();
      const wide = U(0.075) * q.wide, top = -U(0.07) * tall, bot = U(0.055) * tall;
      // every instrument is held facing the middle, so the band plays inward at each other and not square to the
      // camera; as a player drifts around the ring its instrument turns with it, the way a body turns when it moves
      const facing = Math.atan2(cy - by, cx - bx) + Math.PI / 2;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(facing);
      if (q.form === 'strings') { // plucked: each string bows in a standing wave whose amplitude decays and whose frequency is its note
        const n = q.els.length;
        for (let i = 0; i < n; i++) {
          const el = q.els[i], x = lerp(-wide, wide, n === 1 ? 0.5 : i / (n - 1));
          const breath = Math.sin(s.t * (0.42 + 0.09 * i) * s.motion + q.ph1 + i) * U(0.005) * q.idle; // never dead: a waiting string still sways
          const swing = el.amp * Math.sin(el.phase) * U(0.03) + breath;
          ctx.strokeStyle = col((0.35 + 0.6 * clamp(el.amp)) * bright, 62 + 26 * clamp(el.hot));
          ctx.lineWidth = Math.max(1, U(0.0035) * q.thick * s.weight);
          ctx.beginPath(); ctx.moveTo(x, top);
          for (let t = 1; t <= 8; t++) { const f = t / 8; ctx.lineTo(x + swing * Math.sin(Math.PI * f), lerp(top, bot, f)); }
          ctx.stroke();
        }
      } else if (q.form === 'bars') { // hit one at a time: the struck bar lights, jumps and settles
        const n = q.els.length;
        for (let i = 0; i < n; i++) {
          const el = q.els[i], y = lerp(bot, top, n === 1 ? 0.5 : i / (n - 1));
          const jump = el.amp * Math.sin(el.phase) * U(0.012) + Math.sin(s.t * 0.62 * s.motion + q.ph2 + i * 0.8) * U(0.004) * q.idle, ww = wide * lerp(1, 0.62, i / Math.max(1, n - 1));
          ctx.fillStyle = col((0.22 + 0.7 * clamp(el.amp)) * bright, 55 + 30 * clamp(el.hot));
          ctx.fillRect(-ww, y + jump, 2 * ww, Math.max(1.5, U(0.009) * q.thick));
        }
      } else if (q.form === 'column') { // air: nested arcs that swell for the length of the note and breathe between
        const n = q.els.length;
        for (let i = 0; i < n; i++) {
          const el = q.els[i], f = (i + 1) / n;
          const open = clamp(el.amp) * (0.6 + 0.4 * Math.sin(el.phase)) + 0.16 * (0.5 + 0.5 * Math.sin(s.t * 0.5 * s.motion + q.ph1 + i)) * q.idle; // air moves even when nothing is blown through it
          ctx.strokeStyle = col((0.14 + 0.5 * open) * bright, lerp(42, 76, q.tint));
          ctx.lineWidth = Math.max(1, U(0.006) * q.thick * s.weight);
          ctx.beginPath(); ctx.ellipse(0, 0, wide * f * (1 + 0.16 * open), U(0.05) * tall * f * (1 + 0.3 * open), 0, 0, TAU); ctx.stroke();
        }
      } else if (q.form === 'membrane') { // struck: the head, and a ripple crossing it from where the stick landed
        ctx.strokeStyle = col((0.3 + 0.5 * clamp(q.shove)) * bright, 58 + 24 * clamp(q.shove));
        ctx.lineWidth = Math.max(1, U(0.005) * q.thick * s.weight);
        const skin = 1 + 0.035 * Math.sin(s.t * 0.55 * s.motion + q.ph1) * q.idle; // the head is slack and breathing between hits
        ctx.beginPath(); ctx.ellipse(0, U(0.01) * q.shove, wide * skin, U(0.045) * tall * skin, 0, 0, TAU); ctx.stroke();
        for (const r of q.ripples) {
          ctx.strokeStyle = col(0.75 * r.hot * bright, 80);
          ctx.lineWidth = Math.max(1, U(0.0035) * r.w * s.weight);
          ctx.beginPath(); ctx.ellipse(r.x * wide, r.y * U(0.045) * tall, r.r * wide, r.r * U(0.045) * tall, 0, 0, TAU); ctx.stroke();
        }
      } else if (q.form === 'cluster') { // rattled: a handful of grains that jump when they are shaken
        for (const d of q.dots) {
          ctx.fillStyle = col(0.3 + 0.65 * clamp(d.v), 68 + 22 * clamp(d.v));
          ctx.beginPath(); ctx.arc(d.px * wide, d.py * U(0.06) * tall, U(0.004 + 0.004 * clamp(d.v)) * s.weight, 0, TAU); ctx.fill();
        }
      } else { // an aura: nothing is played here, it only flares
        ctx.strokeStyle = col(0.25 * (0.3 + q.shove) * bright, 72);
        ctx.lineWidth = Math.max(1, U(0.003) * s.weight);
        const puff = 1 + 0.4 * q.shove + 0.08 * Math.sin(s.t * 0.45 * s.motion + q.ph2) * q.idle;
        ctx.beginPath(); ctx.ellipse(0, 0, wide * puff, U(0.05) * tall * puff, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      if (name === s.floor) { // the ground lights under whoever is speaking
        const lp = ctx.createRadialGradient(bx, by + U(0.075), 0, bx, by + U(0.075), U(0.13));
        lp.addColorStop(0, col(0.3 * glow, 62)); lp.addColorStop(1, col(0));
        ctx.save(); ctx.translate(bx, by + U(0.075)); ctx.scale(1, 0.3); ctx.fillStyle = lp; ctx.beginPath(); ctx.arc(0, 0, U(0.13), 0, TAU); ctx.fill(); ctx.restore();
      }
    }

    // the hand-over: a light going round the ring at a boundary
    if (s.sweep > 0.02) {
      ctx.strokeStyle = hsla(hue + 60, pal.sat, 88, 0.7 * s.sweep * lit); ctx.lineWidth = Math.max(1, R(0.004));
      ctx.beginPath(); ctx.ellipse(cx, cy, ringX, ringY, 0, s.sweepAt - 0.5, s.sweepAt); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (s.riser > 0.01 || s.dark > 0.01) {
      const v = ctx.createRadialGradient(cx, cy, R(0.3), cx, cy, Math.hypot(w, h) * 0.55);
      v.addColorStop(0, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.55 * Math.max(s.riser, s.dark)})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    }
  },
};

/** A cluster that turns out to be playing notes is no rattle: it is restrung as an instrument, once, the first time a note arrives. */
function restring(s, q) {
  const b = BUILD.line, n = b.n[0] + Math.round(rand(s) * (b.n[1] - b.n[0]));
  q.form = 'strings'; q.thick = b.thick; q.dots = [];
  q.els = strings(n, q.ring);
}
/** n elements (strings, bars or arcs) at rest, each tuned a little higher than the last */
const strings = (n, ring) => Array.from({ length: n }, (_, i) => ({ amp: 0, phase: i * 0.7, freq: lerp(6, 13, i / Math.max(1, n - 1)) * ring, hot: 0, hold: 0, age: 9 }));

/** midi note to 0..1 over the range a body could reach: 36 (C2) at the bottom, 84 (C6) at the top. */
const pitch = (n) => clamp((n - 36) / 48);
/** A note this player has now used: its own register, which its instrument is played over. */
const seen = (q, v) => { q.lo = Math.min(q.lo, v); q.hi = Math.max(q.hi, v); q.mid = v; };
/** Where a note falls on this player's own instrument: 0 the lowest string it has used lately, 1 the highest. */
const place = (q, v) => clamp((v - q.lo) / Math.max(0.12, q.hi - q.lo));

/** The seat for a part, made on first sight: its instrument from its job, its build from the song's own generator, so two parts doing the same job are two different instruments. Every new player re-spaces the ring. */
function seatFor(s, name, slot) {
  let q = s.seats[name];
  if (q) return q;
  const b = BUILD[slot] ?? BUILD.grain, r = rand(s), r2 = rand(s), r3 = rand(s);
  const n = b.n[0] + Math.round(r * (b.n[1] - b.n[0])), ring = lerp(b.ring[0], b.ring[1], r2);
  q = {
    slot, form: b.form, angle: 0, jit: (rand(s) - 0.5) * 0.5,
    hue: slot === 'ground' ? s.pal.hue + 20 : slot === 'impulse' ? s.pal.hue - 25 : slot === 'field' ? s.pal.field : s.pal.line + s.order.length * 24,
    ring, tall: lerp(b.tall[0], b.tall[1], r3), wide: lerp(0.8, 1.15, r2), thick: b.thick,
    base: 0, want: 0, near: 1, ph1: rand(s) * TAU, ph2: rand(s) * TAU, // base: where it stands now, want: where the band has room for it; near/ph: the drift around that, nobody sits still
    fast: 0, slow: 0, say: 0, hot: 0, sw: 0.1, lean: 0, shove: 0, lastWave: -9, here: 0, rest: 1, idle: 1,
    lo: 0.45, hi: 0.55, mid: 0.5, tint: 0.5, // lo/hi/mid: the register this player has actually used lately, what its instrument is played over
    els: b.form === 'membrane' || b.form === 'aura' ? [] : strings(n, ring),
    ripples: [],
    dots: b.form === 'cluster' ? Array.from({ length: n }, () => { const x = (rand(s) - 0.5) * 1.5, y = (rand(s) - 0.5) * 1.2; return { x, y, px: x, py: y, ph: rand(s) * TAU, v: 0 }; }) : [],
  };
  q.hueAt = q.hue;
  s.seats[name] = q; s.order.push(name);
  const m = s.order.length;
  s.order.forEach((k, i) => { const seat = s.seats[k]; seat.base = -Math.PI / 2 + (i / m) * TAU + seat.jit * s.jitter * (TAU / (m * 3)); seat.want = seat.base; seat.angle = seat.base; });
  return q;
}
