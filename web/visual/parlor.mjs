// parlor: the song as the common room of an old folks' home, seen from slightly above. A window on the left (day,
// sunset, night with a moon, or overcast, by the palette), a fireplace on the right with a clock over it whose
// pendulum swings on the beat, a standing lamp, a rug. Every part of the song is a resident, and what a resident does
// comes from the part's job. The rocking chairs are the thing: the kit and the bass sit in them, in a row at the
// front, side on, and each chair is a pendulum tuned to the tempo (a whole rock every two or four beats) that a hit
// from its part shoves along in the direction it is already going, so a steady kick rocks it hard and in time, and
// between hits it rocks on by itself, faintly, because nobody in a rocking chair ever quite stops. The sleepers are
// the pads: an armchair each at the sides, head over to one side, eyes shut, a blanket on the knees, and a held note is a
// breath - the chest rises for as long as the note lasts and falls after - with a z floating up now and then and a
// snort when something loud lands. Everyone else is at the card table at the back or walking the floor: each line
// part is a hand of cards, and a note is a card dealt from whichever seat the note's place in that part's own
// register picks (a line inside one octave still goes round the table), flying to the pile and landing in the pitch
// class's colour; a grain part is a resident with a walking frame shuffling the room one step per hit, turning at the
// walls, standing when the part stops. Who has the floor is measured as in combo (a part playing above its own norm
// is the one to look at): the lamp swings a warm pool onto the floor under them and every other head turns to look.
// A boundary is the clock striking - it flashes, rings, and gives every chair a push and every sleeper a start; a
// riser is the nurse bringing the tea trolley across, cups rattling harder as it closes; an fx impact flicks the
// lights; a dropout is lights out, the window and the fire the only light. Nothing is ever still: the fire flickers
// on the beat, the lamp breathes, the pendulum swings, the chairs rock. Deterministic: randomness only from the
// state's own seeded generator; units are the canvas height; the whole frame is repainted from state every draw.
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf } from './kit.mjs';

const TAU = Math.PI * 2;
const DEFAULT_SLOT = { drums: 'impulse', pitched: 'line', hit: 'grain', bass: 'ground', melody: 'line', pad: 'field', perc: 'grain', sample: 'impulse', fx: 'transition' };
const SAY = { ground: 0.8, line: 1, counter: 0.9, field: 0.5, impulse: 0.45, grain: 0.25, transition: 0.2 }; // how much one hit of each job counts as speaking
const HOLD = 0.55, MARGIN = 1.2; // seconds a challenger must lead by MARGIN before the floor changes hands
const KIND = { ground: 'rocker', impulse: 'rocker', field: 'sleeper', line: 'player', counter: 'player', grain: 'walker', transition: 'nurse' };
const CAP = { rocker: 4, sleeper: 3, player: 4, walker: 3, nurse: 0 };
// how the room sits, per section role: how lively (rock and step sizes), the light, the fire
const SIT = {
  establish: { pace: 0.8, glow: 0.8, fire: 0.6 },
  develop: { pace: 1, glow: 1, fire: 1 },
  climax: { pace: 1.35, glow: 1.2, fire: 1.5 },
  release: { pace: 0.75, glow: 0.85, fire: 0.7 },
  none: { pace: 1, glow: 1, fire: 1 },
};
const WINDOW = { cool: { top: [210, 60, 62], low: [200, 55, 84], moon: 0 }, warm: { top: [255, 50, 45], low: [30, 90, 70], moon: 0 }, dim: { top: [235, 45, 10], low: [240, 35, 20], moon: 1 }, pale: { top: [205, 12, 66], low: [200, 10, 80], moon: 0 } };
const CARDIGANS = [[350, 35, 45], [210, 30, 45], [95, 25, 40], [35, 40, 50], [280, 25, 45], [170, 30, 40], [20, 30, 55], [50, 45, 55]];
const SKINS = [[28, 45, 78], [24, 40, 65], [30, 35, 55], [22, 45, 45]];
const HAIRS = [[0, 0, 92], [0, 0, 72], [35, 20, 82], [0, 0, 50]]; // white, grey, cream, dark grey
const PLAIDS = [[0, 45, 40], [210, 35, 40], [120, 25, 35], [35, 50, 45]];
const TROUSERS = [[220, 15, 28], [30, 20, 35], [0, 0, 45], [200, 10, 60], [340, 20, 40]];
const zScale = (z) => lerp(1.2, 0.62, z), zY = (z) => lerp(0.96, 0.63, z); // a resident's size and floor line by depth (0 the front)
const pc = (n) => (((n % 12) + 12) % 12) * 30; // a note's pitch class as a hue

export default {
  name: 'parlor',

  init(score, rng, size) {
    const p = score.palette, pal = paletteOf(score, rng), aspect = size.w / size.h;
    const s = {
      pal, size: { ...size }, aspect, temp: WINDOW[p.temperature] ? p.temperature : 'cool',
      weight: lerp(0.8, 1.3, p.mass), jitter: lerp(0.3, 1, p.jitter), motion: lerp(0.7, 1.3, p.motion),
      cps: score.cps,
      roles: score.sections.map((x) => x.role ?? 'none'),
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      t: 0, beats: 0, energy: 0.5, sit: { ...SIT.none }, riser: 0, dark: 0, flash: 0, beat: 0, lastBeat: -1, hueShift: 0, chime: 0,
      parts: {}, order: [], floor: null, lead: null, leadFor: 0, spot: { x: aspect / 2, on: 0 }, // who is speaking, and the lamp's pool under them
      residents: [], table: null, nurse: { x: aspect + 0.4, on: 0, rattle: 0 },
      cat: null, // { fur, chair, mode, x, z, target, dir, walk, flick, startle, timer }: the home's cat, on a lap or crossing the floor to another
      outside: { passers: [], clouds: [], next: 3 }, // what goes by the window: { kind, u, v, dir, speed, ph, life }
    };
    seed(s, rng);
    for (const name of Object.keys(score.cast)) partFor(s, name, score.cast[name].slot);
    if (!s.residents.some((r) => r.kind === 'rocker')) resident(s, 'rocker', null); // a home always has someone rocking, and someone asleep
    if (!s.residents.some((r) => r.kind === 'sleeper')) resident(s, 'sleeper', null);
    arrange(s);
    const chair = s.residents.findIndex((r) => r.kind === 'rocker');
    s.cat = { fur: [[25, 30, 40], [0, 0, 85], [30, 40, 20], [30, 60, 55]][Math.floor(rand(s) * 4)], chair, mode: 'sit', x: 0, z: 0, target: chair, dir: 1, walk: 0, flick: 0, startle: 0, timer: 8 + rand(s) * 12 };
    for (let k = 0; k < 3; k++) s.outside.clouds.push({ u: rand(s) * 1.4 - 0.2, v: 0.08 + rand(s) * 0.3, size: 0.6 + rand(s) * 0.8, speed: 0.012 + rand(s) * 0.015 });
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const role = clock.index >= 0 ? s.roles[clock.index] ?? 'none' : 'none', want = SIT[role] ?? SIT.none;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    for (const k of Object.keys(want)) s.sit[k] = ease(s.sit[k], want[k], 1.2, dt);
    s.beats = clock.bar * clock.beats + clock.beat + clock.beatPhase; // beats into the section: what the pendulum and the chairs keep time to
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.flash = decay(s.flash, 6, dt); s.chime = decay(s.chime, 1.2, dt);
    if (clock.beat !== s.lastBeat) { s.lastBeat = clock.beat; s.beat = 1; }
    s.beat = decay(s.beat, 6, dt);
    if (clock.boundary) { // the clock strikes: everyone starts
      s.chime = 1; s.flash = Math.max(s.flash, 0.3); s.hueShift = ((clock.index * 37) % 30) - 15;
      for (const r of s.residents) { if (r.kind === 'rocker') r.w += (rand(s) - 0.5) * 2; else if (r.kind === 'sleeper') r.snort = 1; else if (r.kind === 'walker') r.dir = rand(s) < 0.5 ? -r.dir : r.dir; }
      passer(s, 'bus'); // and the bus goes by
    }
    // the nurse: across with the trolley over the riser, and off again after
    s.nurse.on = ease(s.nurse.on, s.riser > 0 ? 1 : 0, 3, dt);
    if (s.riser > 0) { s.nurse.x = lerp(s.aspect + 0.4, -0.5, s.riser); s.nurse.rattle = s.riser; } else { s.nurse.rattle = decay(s.nurse.rattle, 3, dt); }

    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain';
      const name = e.layer ?? slot, q = partFor(s, name, slot), g = clamp(e.gain * e.velocity, 0, 1.5);
      q.fast = Math.min(6, q.fast + g * (SAY[slot] ?? 0.3));
      if (e.note !== null) seen(q, pitch(e.note));
      const r = q.res === null ? null : s.residents[q.res];
      if (slot === 'transition') { if (e.dur >= 1) s.flash = Math.max(s.flash, 1); continue; }
      if ((slot === 'grain' || e.role === 'grain') && s.outside.passers.filter((p) => p.kind === 'bird').length < 6 && rand(s) < 0.35) passer(s, 'bird'); // a hat lifts a bird off the tree
      if (!r) continue;
      if (r.kind === 'rocker') { // shoved along the way it is going: a steady part rocks it hard and in time; the resident taps a foot, nods, and knits a stitch
        const push = e.role === 'pulse' ? 1.5 : e.role === 'grain' ? 0.4 : 1;
        r.w = clamp(r.w + Math.sign(r.w || r.dir) * push * g * s.sit.pace, -3, 3);
        r.nod = Math.min(1, r.nod + 0.7 * g); r.tap = 1;
        if (r.c.knits) r.knitTo = -r.knitTo;
        if (s.cat && s.cat.chair === q.res) { if (e.role !== 'grain') s.cat.flick = 1; if (g > 1.15 && e.role === 'impact') s.cat.startle = 1; }
      } else if (r.kind === 'sleeper') { // a held note is a breath; a loud one, a snort
        r.hold = clamp(e.dur, 0.3, 6); r.age = 0;
        if (g > 1.15) r.snort = 1;
        if (r.zs.length < 5) r.zs.push({ x: 0, y: 0, a: 1, ph: rand(s) * TAU });
      } else if (r.kind === 'player') { // a card dealt from the seat the note's place in this part's register picks
        const where = e.note === null ? rand(s) : place(q, pitch(e.note)), k = Math.min(3, Math.floor(where * 3.999));
        const T = s.table, seat = T.seats[k];
        seat.reach = 1; seat.hueAt = e.note === null ? seat.hue : pc(e.note);
        T.cards.push({ seat: k, hue: seat.hueAt, f: 0, tx: (rand(s) - 0.5) * 0.5, ty: (rand(s) - 0.5) * 0.3, rot: (rand(s) - 0.5) * 1.2, g });
        if (T.cards.length > 18) T.cards.shift();
      } else if (r.kind === 'walker') { // one step per hit; at a wall, turn
        r.to += r.dir * 0.035 * g * s.sit.pace;
        if (r.to > s.aspect * 0.88) { r.dir = -1; r.to = s.aspect * 0.88; } else if (r.to < s.aspect * 0.12) { r.dir = 1; r.to = s.aspect * 0.12; }
        r.bob = 1; r.foot = -r.foot;
      }
    }

    // who is speaking: each part's recent weighted onsets against its own long-run level
    let best = null, bestSay = 0;
    for (const name of s.order) {
      const q = s.parts[name];
      q.fast = decay(q.fast, 1.4, dt);
      q.slow = ease(q.slow, q.fast, 0.12, dt);
      q.say = q.fast * lerp(0.45, 1.5, clamp(q.fast / (q.slow * 2 + 0.05)));
      q.lo = ease(q.lo, q.mid - 0.03, 0.06, dt); q.hi = ease(q.hi, q.mid + 0.03, 0.06, dt);
      if (q.say > bestSay) { bestSay = q.say; best = name; }
    }
    const held = s.floor ? s.parts[s.floor].say : 0;
    if (best && best !== s.floor && bestSay > held * MARGIN + 0.02) {
      s.leadFor = s.lead === best ? s.leadFor + dt : 0; s.lead = best;
      if (s.leadFor >= HOLD || s.floor === null) { s.floor = best; s.leadFor = 0; }
    } else { s.lead = s.floor; s.leadFor = 0; }
    const lit = s.floor !== null && s.parts[s.floor].res !== null ? s.residents[s.parts[s.floor].res] : null;
    s.spot.on = ease(s.spot.on, lit ? clamp(0.3 + 0.4 * bestSay) : 0, 2, dt);
    if (lit) s.spot.x = ease(s.spot.x, lit.kind === 'player' ? s.table.x : lit.x, 1.5, dt);

    // the room goes on: chairs rock, sleepers breathe, cards fly, walkers shuffle, heads turn to whoever is speaking
    const bps = s.cps * Math.max(1, clock.beats);
    for (const r of s.residents) {
      const q = r.part ? s.parts[r.part] : null, quiet = !q || q.fast < 0.05;
      r.rest = ease(r.rest, quiet ? 1 : 0, 0.7, dt);
      r.turn = ease(r.turn, lit && lit !== r && s.spot.on > 0.1 ? clamp((s.spot.x - r.x) * 1.5, -1, 1) : 0, 1.5, dt);
      if (r.kind === 'rocker') { // a damped pendulum tuned to the tempo, with a faint drive at that tempo so it never stops
        const om = TAU * bps / r.period, D = 1.6;
        const drive = 0.05 * D * om * Math.sin(TAU * (s.beats / r.period + r.ph)) * (0.3 + 0.7 * r.rest);
        r.w += (-om * om * r.a - D * r.w + drive) * dt;
        r.a += r.w * dt;
        if (Math.abs(r.a) > 0.22) { r.a = Math.sign(r.a) * 0.22; r.w *= -0.3; } // the runner's end: it will not tip
        r.nod = decay(r.nod, 3, dt); r.tap = decay(r.tap, 5, dt); r.knit = ease(r.knit, r.knitTo, 10, dt);
      } else if (r.kind === 'sleeper') {
        r.age += dt;
        r.chest = ease(r.chest, r.age < r.hold ? 1 : 0, r.age < r.hold ? 2.5 : 1.2, dt);
        r.snort = decay(r.snort, 3, dt);
        r.zt += dt; if (r.zt > r.zEvery && r.zs.length < 5) { r.zt = 0; r.zEvery = 2 + rand(s) * 3; r.zs.push({ x: 0, y: 0, a: 1, ph: rand(s) * TAU }); }
        for (const z of r.zs) { z.y -= dt * 0.35; z.x += dt * 0.12 + Math.sin(s.t * 2 + z.ph) * 0.002; z.a -= dt * 0.35; }
        r.zs = r.zs.filter((z) => z.a > 0);
      } else if (r.kind === 'walker') {
        r.x = ease(r.x, r.to, 7, dt); r.bob = decay(r.bob, 5, dt);
        if (quiet && r.rest > 0.9 && rand(s) < 0.15 * dt) { r.to += r.dir * 0.01; } // stood still a while: a shuffle of its own
      }
    }
    if (s.table) for (const seat of s.table.seats) seat.reach = decay(seat.reach, 3.5, dt);
    if (s.table) for (const c of s.table.cards) c.f = Math.min(1, c.f + dt * 4);
    // the cat: on a lap most of the time, and now and then down, across the floor and up onto another
    const C = s.cat;
    if (C) {
      C.flick = decay(C.flick, 2.5, dt); C.startle = decay(C.startle, 2, dt); C.timer -= dt;
      if (C.mode === 'sit' && C.timer < 0) {
        const laps = s.residents.map((r, i) => i).filter((i) => i !== C.chair && (s.residents[i].kind === 'rocker' || s.residents[i].kind === 'sleeper'));
        if (laps.length) { const from = s.residents[C.chair]; C.target = laps[Math.floor(rand(s) * laps.length)]; C.mode = 'walk'; C.x = from.x + (from.kind === 'rocker' ? from.dir * 0.12 : 0); C.z = from.z; C.chair = null; }
        C.timer = 14 + rand(s) * 20;
      }
      if (C.mode === 'walk') {
        const to = s.residents[C.target], tx = to.x + (to.kind === 'rocker' ? to.dir * 0.12 : 0), dx = tx - C.x, dz = to.z - C.z, d = Math.hypot(dx, dz * 0.6), sp = 0.28 * dt;
        if (d < sp) { C.mode = 'sit'; C.chair = C.target; } else { C.x += (dx / d) * sp; C.z += (dz / d) * sp; C.walk += dt * 9; C.dir = dx < 0 ? -1 : 1; }
      }
    }
    // outside the window: clouds always, and something going by every few seconds
    const O = s.outside;
    for (const c of O.clouds) { c.u += c.speed * dt * s.motion; if (c.u > 1.3) c.u = -0.3; }
    O.next -= dt;
    if (O.next < 0) { O.next = 3 + rand(s) * 7; const pool = s.temp === 'dim' ? ['car', 'bat', 'bat', 'star', 'star', 'dog', 'fox'] : ['car', 'car', 'bike', 'dog', 'jogger', 'balloon', 'plane', 'deer', 'bird']; passer(s, pool[Math.floor(rand(s) * pool.length)]); }
    for (const p of O.passers) {
      p.u += p.dir * p.speed * dt; p.life += dt;
      if (p.kind === 'bird') { p.v -= dt * (0.12 + 0.1 * Math.sin(p.ph)); p.u += Math.sin(s.t * 3 + p.ph) * 0.02 * dt; }
      else if (p.kind === 'bat') { p.v += Math.sin(s.t * 7 + p.ph) * 0.25 * dt; }
      else if (p.kind === 'star') { p.v += dt * 0.5; }
      else if (p.kind === 'balloon') { p.v -= dt * 0.01; }
    }
    O.passers = O.passers.filter((p) => p.u > -0.4 && p.u < 1.4 && p.v > -0.3 && (p.kind !== 'star' || p.life < 0.8));
  },

  draw(s, ctx, w, h) {
    const { pal, aspect } = s, night = s.temp === 'dim', lit = 1 - 0.75 * s.dark, glow = s.sit.glow * lit;
    const X = (x) => (x / aspect) * w, R = (u) => u * h, hue = pal.hue + s.hueShift;
    const room = (l, a = 1) => hsla(hue, 18, (night ? l * 0.45 : l) * lerp(0.6, 1, glow), a);
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the wall, the wainscot, the floor and the rug
    const wall = ctx.createLinearGradient(0, 0, 0, R(0.56)); wall.addColorStop(0, room(48)); wall.addColorStop(1, room(58));
    ctx.fillStyle = wall; ctx.fillRect(0, 0, w, R(0.56));
    ctx.fillStyle = room(34); ctx.fillRect(0, R(0.46), w, R(0.1)); ctx.fillStyle = room(62, 0.5); ctx.fillRect(0, R(0.455), w, R(0.008));
    const floor = ctx.createLinearGradient(0, R(0.56), 0, h); floor.addColorStop(0, hsla(hue + 10, 30, night ? 12 : 30)); floor.addColorStop(1, hsla(hue + 10, 32, night ? 8 : 24));
    ctx.fillStyle = floor; ctx.fillRect(0, R(0.56), w, h - R(0.56));
    ctx.strokeStyle = hsla(hue + 10, 25, night ? 6 : 20, 0.5); ctx.lineWidth = Math.max(1, R(0.002));
    for (let k = 0; k < 9; k++) { const y = R(0.56 + 0.44 * ((k + 1) / 10) ** 1.4); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = hsla(hue + 170, 35, night ? 14 : 34, 0.9); ctx.beginPath(); ctx.ellipse(w / 2, R(0.8), R(0.5) * aspect * 0.5, R(0.17), 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = hsla(hue + 170, 35, night ? 20 : 48, 0.8); ctx.lineWidth = Math.max(1, R(0.006)); ctx.beginPath(); ctx.ellipse(w / 2, R(0.8), R(0.5) * aspect * 0.5 - R(0.02), R(0.15), 0, 0, TAU); ctx.stroke();
    // the window: the weather outside by the palette, a moon at night, curtains
    const wk = WINDOW[s.temp], wx0 = X(aspect * 0.1), wx1 = X(aspect * 0.34), wy0 = R(0.07), wy1 = R(0.4);
    const sky = ctx.createLinearGradient(0, wy0, 0, wy1); sky.addColorStop(0, hsla(...wk.top)); sky.addColorStop(1, hsla(...wk.low));
    ctx.fillStyle = sky; ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    if (wk.moon) { ctx.fillStyle = hsla(50, 20, 90); ctx.beginPath(); ctx.arc(lerp(wx0, wx1, 0.7), lerp(wy0, wy1, 0.3), R(0.03), 0, TAU); ctx.fill(); for (let k = 0; k < 7; k++) { ctx.fillStyle = hsla(50, 20, 90, 0.5 + 0.5 * Math.sin(s.t * 2 + k)); ctx.fillRect(lerp(wx0, wx1, (k * 0.37) % 1), lerp(wy0, wy1, (k * 0.61) % 0.7), 2, 2); } }
    else { ctx.fillStyle = hsla(48, 90, 92, 0.9); ctx.beginPath(); ctx.arc(lerp(wx0, wx1, 0.72), lerp(wy0, wy1, s.temp === 'warm' ? 0.72 : 0.28), R(0.035), 0, TAU); ctx.fill(); }
    ctx.save(); ctx.beginPath(); ctx.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); ctx.clip(); // what goes on outside stays behind the glass
    const wu = (u) => lerp(wx0, wx1, u), wv = (v) => lerp(wy0, wy1, v), WS = (wy1 - wy0) * 0.1;
    for (const c of s.outside.clouds) { ctx.fillStyle = hsla(0, 0, night ? 30 : 100, night ? 0.5 : 0.85); for (const [dx, dy, rr] of [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.25, 0.75], [0.3, -0.35, 0.6]]) { ctx.beginPath(); ctx.arc(wu(c.u) + dx * WS * c.size, wv(c.v) + dy * WS * c.size, rr * WS * c.size, 0, TAU); ctx.fill(); } }
    ctx.fillStyle = hsla(100, 30, night ? 12 : 42); ctx.fillRect(wx0, wv(0.72), wx1 - wx0, wy1 - wv(0.72)); // the lawn, the lane and the hedge beyond the glass
    ctx.fillStyle = hsla(0, 0, night ? 16 : 45); ctx.fillRect(wx0, wv(0.83), wx1 - wx0, wv(0.94) - wv(0.83));
    ctx.fillStyle = hsla(0, 0, night ? 30 : 80, 0.7); for (let k = 0; k < 8; k++) ctx.fillRect(wu(k / 8 + 0.02), wv(0.885), (wx1 - wx0) * 0.06, Math.max(1, WS * 0.06));
    ctx.fillStyle = hsla(120, 15, night ? 30 : 55, 0.85); ctx.beginPath(); ctx.ellipse(wu(0.3), wy1, R(0.06), R(0.06 + 0.005 * Math.sin(s.t * 0.7 * s.motion)), 0, Math.PI, TAU); ctx.fill(); // a tree beyond the glass, in the breeze
    for (const p of s.outside.passers) goer(ctx, p, wu(p.u), wv(p.v), WS, s, night);
    ctx.restore();
    ctx.strokeStyle = room(22); ctx.lineWidth = Math.max(1, R(0.012)); ctx.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.beginPath(); ctx.moveTo((wx0 + wx1) / 2, wy0); ctx.lineTo((wx0 + wx1) / 2, wy1); ctx.moveTo(wx0, (wy0 + wy1) / 2); ctx.lineTo(wx1, (wy0 + wy1) / 2); ctx.stroke();
    ctx.fillStyle = hsla(hue + 160, 30, night ? 18 : 40); ctx.fillRect(wx0 - R(0.05), wy0 - R(0.03), R(0.06), wy1 - wy0 + R(0.06)); ctx.fillRect(wx1 - R(0.01), wy0 - R(0.03), R(0.06), wy1 - wy0 + R(0.06));
    // the fireplace, its fire on the beat, and the clock over it with a pendulum keeping the beat
    const fx0 = X(aspect * 0.7), fx1 = X(aspect * 0.88), fy0 = R(0.26), fy1 = R(0.46);
    ctx.fillStyle = room(28); ctx.fillRect(fx0 - R(0.03), fy0 - R(0.02), fx1 - fx0 + R(0.06), fy1 - fy0 + R(0.02));
    ctx.fillStyle = room(70); ctx.fillRect(fx0 - R(0.045), fy0 - R(0.035), fx1 - fx0 + R(0.09), R(0.02));
    ctx.fillStyle = hsla(20, 30, 6); ctx.fillRect(fx0, fy0 + R(0.02), fx1 - fx0, fy1 - fy0 - R(0.02));
    ctx.globalCompositeOperation = 'lighter';
    const fire = s.sit.fire * (0.6 + 0.5 * s.beat + 0.3 * s.energy) * (1 - 0.3 * s.dark);
    for (let k = 0; k < 6; k++) {
      const fx = lerp(fx0, fx1, 0.2 + 0.6 * ((k + 0.5) / 6)), lick = 0.6 + 0.4 * Math.sin(s.t * (7 + k * 1.3) + k * 2.1) + 0.5 * s.beat;
      const fh = R(0.05 + 0.07 * lick) * fire, fw = R(0.02);
      const g = ctx.createLinearGradient(0, fy1, 0, fy1 - fh); g.addColorStop(0, hsla(30, 100, 60, 0.9 * fire)); g.addColorStop(0.6, hsla(20, 100, 50, 0.5 * fire)); g.addColorStop(1, hsla(10, 100, 45, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx - fw, fy1); ctx.quadraticCurveTo(fx - fw * 0.4, fy1 - fh * 0.5, fx + Math.sin(s.t * 5 + k) * fw * 0.5, fy1 - fh); ctx.quadraticCurveTo(fx + fw * 0.6, fy1 - fh * 0.4, fx + fw, fy1); ctx.fill();
    }
    const fg = ctx.createRadialGradient((fx0 + fx1) / 2, fy1, 0, (fx0 + fx1) / 2, fy1, R(0.5)); fg.addColorStop(0, hsla(25, 90, 55, 0.22 * fire)); fg.addColorStop(1, hsla(25, 90, 55, 0));
    ctx.fillStyle = fg; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    const cx = (fx0 + fx1) / 2, cy = R(0.13), cr = R(0.05);
    ctx.fillStyle = room(24); ctx.fillRect(cx - cr * 1.15, cy - cr * 1.15, cr * 2.3, cr * 3.6);
    ctx.fillStyle = hsla(45, 30, lerp(88, 100, s.chime)); ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
    ctx.strokeStyle = room(20); ctx.lineWidth = Math.max(1, R(0.004));
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(s.t * 0.02) * cr * 0.5, cy - Math.cos(s.t * 0.02) * cr * 0.5); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(s.t * 0.25) * cr * 0.75, cy - Math.cos(s.t * 0.25) * cr * 0.75); ctx.stroke();
    const pa = 0.4 * Math.sin(TAU * s.beats / 2);
    ctx.strokeStyle = hsla(45, 40, 60); ctx.lineWidth = Math.max(1, R(0.005)); ctx.beginPath(); ctx.moveTo(cx, cy + cr); ctx.lineTo(cx + Math.sin(pa) * cr * 1.6, cy + cr + Math.cos(pa) * cr * 1.6); ctx.stroke();
    ctx.fillStyle = hsla(45, 50, 68); ctx.beginPath(); ctx.arc(cx + Math.sin(pa) * cr * 1.6, cy + cr + Math.cos(pa) * cr * 1.6, cr * 0.28, 0, TAU); ctx.fill();
    if (s.chime > 0.02) { ctx.strokeStyle = hsla(45, 60, 80, 0.6 * s.chime); ctx.lineWidth = Math.max(1, R(0.003)); for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(cx, cy, cr * (1.2 + k * 0.5 * (1.3 - s.chime)), 0, TAU); ctx.stroke(); } }
    // a picture on the wall between, and the standing lamp by the left armchair
    ctx.fillStyle = room(22); ctx.fillRect(X(aspect * 0.46), R(0.12), R(0.14), R(0.11)); ctx.fillStyle = hsla(hue + 190, 30, 55); ctx.fillRect(X(aspect * 0.46) + R(0.012), R(0.132), R(0.116), R(0.086));
    ctx.fillStyle = hsla(100, 25, 40); ctx.beginPath(); ctx.ellipse(X(aspect * 0.46) + R(0.07), R(0.2), R(0.05), R(0.018), 0, 0, TAU); ctx.fill();
    const lx = X(aspect * 0.045), ly = R(0.5);
    ctx.strokeStyle = room(20); ctx.lineWidth = Math.max(1, R(0.006)); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, R(0.3)); ctx.stroke();
    ctx.fillStyle = hsla(45, 50, lerp(50, 88, glow * (0.8 + 0.2 * s.beat))); ctx.beginPath(); ctx.moveTo(lx - R(0.04), R(0.3)); ctx.lineTo(lx + R(0.04), R(0.3)); ctx.lineTo(lx + R(0.025), R(0.23)); ctx.lineTo(lx - R(0.025), R(0.23)); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(lx, R(0.3), 0, lx, R(0.3), R(0.45)); lg.addColorStop(0, hsla(45, 70, 60, 0.25 * glow * (0.85 + 0.15 * s.beat))); lg.addColorStop(1, hsla(45, 70, 60, 0));
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    if (s.spot.on > 0.02) { // the lamp's pool on the floor under whoever has the floor
      const sx = X(s.spot.x), sy = R(0.86);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R(0.3)); sg.addColorStop(0, hsla(45, 80, 65, 0.35 * s.spot.on * lit)); sg.addColorStop(1, hsla(45, 80, 65, 0));
      ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.4); ctx.translate(-sx, -sy); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, R(0.3), 0, TAU); ctx.fill(); ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the residents, far to near; the table's back seats before it, its front seats after
    const things = s.residents.map((r, i) => ({ z: r.z, r, i }));
    if (s.table) things.push({ z: s.table.z, table: true });
    if (s.nurse.on > 0.02) things.push({ z: 0.5, nurse: true });
    if (s.cat && s.cat.mode === 'walk') things.push({ z: s.cat.z, cat: true });
    things.sort((a, b) => b.z - a.z);
    const toneAt = (z) => { const dim = lerp(1, 0.55, z) * lit; return ([hh, ss, ll], a = 1) => hsla(hh + s.hueShift * 0.3, ss, ll * dim, a); };
    for (const th of things) {
      if (th.table) { table(ctx, s, X, R, lit); continue; }
      if (th.nurse) { nurse(ctx, s, X, R, lit); continue; }
      if (th.cat) { ctx.save(); ctx.translate(X(s.cat.x), R(zY(s.cat.z))); catWalking(ctx, s.cat, R(0.3 * zScale(s.cat.z)), s, toneAt(s.cat.z)); ctx.restore(); continue; }
      const r = th.r; if (r.kind === 'player') continue;
      const U = R(0.3 * zScale(r.z)), x = X(r.x), y = R(zY(r.z)), tone = toneAt(r.z);
      const cat = s.cat && s.cat.mode === 'sit' && s.cat.chair === th.i ? s.cat : null;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0 0 0 / 0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, U * 0.7, U * 0.12, 0, 0, TAU); ctx.fill();
      if (r.kind === 'rocker') rocker(ctx, r, U, s, tone, cat);
      else if (r.kind === 'sleeper') sleeper(ctx, r, U, s, tone, cat);
      else walker(ctx, r, U, s, tone);
      ctx.restore();
    }
    if (s.flash > 0.02) { ctx.fillStyle = hsla(45, 30, 96, 0.5 * s.flash * lit); ctx.fillRect(0, 0, w, h); }
    if (s.dark > 0.02) { ctx.fillStyle = `rgba(0 0 0 / ${0.55 * s.dark})`; ctx.fillRect(0, 0, w, h); }
    const v = ctx.createRadialGradient(w / 2, h / 2, R(0.45), w / 2, h / 2, Math.hypot(w, h) * 0.6);
    v.addColorStop(0, 'rgba(0 0 0 / 0)'); v.addColorStop(1, `rgba(0 0 0 / ${0.35 + 0.2 * s.riser})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  },
};

// Every resident is a whole body, legs included, even where a chair or a table hides them: an outlined, shaded torso
// with the cardigan's collar and buttons, two arms ending in hands, two legs of thigh and shin ending in slippers or
// shoes, a neck, and a head with ears, brows, a nose, cheeks and the lines of age. The outline is thin and ink-dark so
// each figure stands off the room; the light comes from the lamp side, so every torso is lighter on the left.
const INK = [20, 20, 12];
/** A limb: a polyline of joints, outlined, in the cloth's or the skin's colour. */
function limb(ctx, pts, wdt, fill, tone, ol) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [col, w] of [[tone(INK, 0.9), wdt + 2 * ol], [fill, wdt]]) {
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, w); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
}
/** An outlined ellipse: a hand, a slipper, an ear, a bun. */
function blob(ctx, x, y, rx, ry, fill, tone, ol, rot = 0) {
  ctx.fillStyle = fill; ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, ol);
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); ctx.stroke();
}
/** A torso from two hip points to two shoulder points, shaded from the lamp side, with the shirt at the collar and buttons down the front; `open` how much of the front shows (0 from behind), `face` shifts the front toward the way a profile faces. */
function torso(ctx, hl, hr, sl, sr, c, tone, ol, open = 1, face = 0) {
  const g = ctx.createLinearGradient(Math.min(sl[0], hl[0]), 0, Math.max(sr[0], hr[0]), 0), [h, s, l] = c.cardigan;
  g.addColorStop(0, tone([h, s, l + 9])); g.addColorStop(1, tone([h, s + 4, l - 11]));
  ctx.fillStyle = g; ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, ol);
  ctx.beginPath(); ctx.moveTo(hl[0], hl[1]); ctx.lineTo(hr[0], hr[1]);
  ctx.quadraticCurveTo(sr[0] + (sr[0] - hr[0]) * 0.35, (hr[1] + sr[1]) / 2, sr[0], sr[1]);
  ctx.quadraticCurveTo((sl[0] + sr[0]) / 2, Math.min(sl[1], sr[1]) - ol * 3, sl[0], sl[1]);
  ctx.quadraticCurveTo(sl[0] + (sl[0] - hl[0]) * 0.35, (hl[1] + sl[1]) / 2, hl[0], hl[1]);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (open > 0) {
    const w = Math.abs(sr[0] - sl[0]), mx = (sl[0] + sr[0]) / 2 + face * w * 0.22, my = (sl[1] + sr[1]) / 2, bh = (hl[1] + hr[1]) / 2;
    ctx.fillStyle = tone(c.shirt); ctx.strokeStyle = tone(INK, 0.7); ctx.lineWidth = Math.max(1, ol * 0.7);
    ctx.beginPath(); ctx.moveTo(mx - w * 0.2 * open, my + ol); ctx.lineTo(mx + w * 0.2 * open, my + ol); ctx.lineTo(mx, my + w * 0.3 * open); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = tone(INK, 0.55);
    for (let k = 0; k < 3; k++) { const y = lerp(my + w * 0.36, bh - w * 0.1, k / 2); ctx.beginPath(); ctx.arc(mx, y, ol * 0.9, 0, TAU); ctx.fill(); }
  }
}
/** A neck from the collar up into the head. */
const neck = (ctx, x, y, r, c, tone, ol) => limb(ctx, [[x, y], [x, y - r * 0.9]], r * 0.55, tone(c.skin), tone, ol);

/** A head at (x, y), radius r, tilted, eyes open or shut; `dir` 0 faces the camera, ±1 a profile facing that way. Ears, hair, brows, nose, cheeks, crow's feet, glasses. */
function head(ctx, x, y, r, c, tone, tilt, eyes, dir = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  const ol = r * 0.07, ink = tone(INK, 0.9), skin = tone(c.skin), [sh, ss, sl] = c.skin;
  const ear = (x, y, sd) => { // an ear: a small oval tucked into the head, low, with its fold inside, so it never reads as a lens
    blob(ctx, x, y, r * 0.13, r * 0.19, skin, tone, ol * 0.8);
    ctx.strokeStyle = tone([sh, ss + 5, sl - 18], 0.8); ctx.lineWidth = Math.max(1, ol * 0.7); ctx.beginPath(); ctx.arc(x + sd * r * 0.03, y, r * 0.1, sd > 0 ? -Math.PI * 0.45 : Math.PI * 0.55, sd > 0 ? Math.PI * 0.45 : Math.PI * 1.45); ctx.stroke();
  };
  if (dir) ear(-dir * r * 0.66, r * 0.16, -dir); // the ear this side of the profile
  else { ear(-r * 0.92, r * 0.14, -1); ear(r * 0.92, r * 0.14, 1); }
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.2); g.addColorStop(0, tone([sh, ss, sl + 7])); g.addColorStop(1, tone([sh, ss + 5, sl - 9]));
  ctx.fillStyle = g; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, ol);
  ctx.beginPath();
  if (dir) { // a profile: round at the back, the forehead, the nose, the lip and a chin at the front
    ctx.moveTo(0, -r);
    ctx.arc(0, 0.05 * r, r, -Math.PI / 2, Math.PI / 2, dir > 0);
    ctx.quadraticCurveTo(dir * r * 0.5, r * 1.05, dir * r * 0.62, r * 0.85);
    ctx.quadraticCurveTo(dir * r * 0.9, r * 0.7, dir * r * 0.78, r * 0.45);
    ctx.lineTo(dir * r * 0.86, r * 0.3); ctx.lineTo(dir * r * 1.12, r * 0.18); ctx.lineTo(dir * r * 0.9, -r * 0.08);
    ctx.quadraticCurveTo(dir * r * 0.95, -r * 0.65, 0, -r);
  } else ctx.ellipse(0, r * 0.06, r * 0.96, r * 1.06, 0, 0, TAU);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // hair, outlined too
  ctx.fillStyle = tone(c.hair); ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, ol * 0.8);
  if (c.hairStyle === 0) { ctx.beginPath(); ctx.arc(0, -r * 0.02, r * 1.02, Math.PI * 1.13, Math.PI * 1.87); ctx.closePath(); ctx.fill(); ctx.stroke(); } // a white cap, the fringe well above the brows
  else if (c.hairStyle === 1) { // bald: tufts over the ears and a shine on the crown
    if (dir) blob(ctx, -dir * r * 0.78, -r * 0.12, r * 0.3, r * 0.26, tone(c.hair), tone, ol * 0.8); // in profile only the one at the back shows: never a tuft on the face
    else { blob(ctx, -r * 0.9, -r * 0.05, r * 0.24, r * 0.24, tone(c.hair), tone, ol * 0.8); blob(ctx, r * 0.9, -r * 0.05, r * 0.24, r * 0.24, tone(c.hair), tone, ol * 0.8); }
    ctx.fillStyle = tone([0, 0, 100], 0.28); ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.55, r * 0.26, r * 0.14, -0.5, 0, TAU); ctx.fill();
  } else if (c.hairStyle === 2) { // parted, with a bun behind
    blob(ctx, dir ? -dir * r * 0.55 : r * 0.62, -r * 0.82, r * 0.4, r * 0.36, tone(c.hair), tone, ol * 0.8);
    ctx.beginPath(); ctx.arc(0, -r * 0.08, r * 1.02, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = tone([c.hair[0], c.hair[1], c.hair[2] - 30], 0.5); ctx.beginPath(); ctx.moveTo(dir * r * 0.15, -r * 1.05); ctx.lineTo(dir * r * 0.3, -r * 0.6); ctx.stroke();
  } else { // short and grey, down over the ears
    ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 1.0, Math.PI * 1.08, Math.PI * 1.92); ctx.lineTo(r * 0.95, r * 0.15); ctx.lineTo(r * 0.76, r * 0.15); ctx.lineTo(r * 0.74, -r * 0.42); ctx.lineTo(-r * 0.74, -r * 0.42); ctx.lineTo(-r * 0.76, r * 0.15); ctx.lineTo(-r * 0.95, r * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // the face: the eyes sit toward the way a profile looks
  const fx = dir * r * 0.32, ex = dir ? [fx + dir * r * 0.15] : [-r * 0.34, r * 0.34], ey = -r * 0.02;
  ctx.lineCap = 'round';
  for (const x of ex) {
    ctx.strokeStyle = tone([c.hair[0], c.hair[1], Math.min(60, c.hair[2])], 0.9); ctx.lineWidth = Math.max(1, r * 0.09); // a brow
    ctx.beginPath(); ctx.arc(x, ey - r * 0.02, r * 0.22, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    if (eyes) {
      ctx.fillStyle = tone([0, 0, 97]); ctx.beginPath(); ctx.ellipse(x, ey, r * 0.17, r * 0.12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + dir * r * 0.04, ey + r * 0.01, r * 0.075, 0, TAU); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.05); ctx.beginPath(); ctx.arc(x, ey + r * 0.03, r * 0.17, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); // the lid
    } else { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.arc(x, ey - r * 0.08, r * 0.16, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
    ctx.strokeStyle = tone(INK, 0.35); ctx.lineWidth = Math.max(1, r * 0.04); // the lines of age: under the eye and at its corner
    ctx.beginPath(); ctx.arc(x, ey + r * 0.12, r * 0.16, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    const cxs = dir ? dir * (x + r * 0.2) : Math.sign(x) * (Math.abs(x) + r * 0.2), sgn = dir || Math.sign(x);
    ctx.beginPath(); ctx.moveTo(sgn * Math.abs(cxs), ey); ctx.lineTo(sgn * (Math.abs(cxs) + r * 0.12), ey - r * 0.08); ctx.moveTo(sgn * Math.abs(cxs), ey + r * 0.04); ctx.lineTo(sgn * (Math.abs(cxs) + r * 0.12), ey + r * 0.1); ctx.stroke();
  }
  if (!dir) { ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.05); ctx.beginPath(); ctx.arc(0, r * 0.26, r * 0.14, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); } // the nose, seen from the front
  ctx.fillStyle = tone([5, 70, 70], 0.22); // the cheeks
  for (const x of dir ? [fx + dir * r * 0.1] : [-r * 0.52, r * 0.52]) { ctx.beginPath(); ctx.ellipse(x, r * 0.36, r * 0.2, r * 0.13, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); // the mouth: a smile, or open in sleep
  if (eyes) { ctx.arc(fx, r * 0.46, r * 0.26, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); ctx.lineWidth = Math.max(1, r * 0.035); ctx.beginPath(); ctx.moveTo(fx - r * 0.3, r * 0.52); ctx.lineTo(fx - r * 0.24, r * 0.62); ctx.moveTo(fx + r * 0.3, r * 0.52); ctx.lineTo(fx + r * 0.24, r * 0.62); ctx.stroke(); }
  else { ctx.fillStyle = tone([5, 50, 30]); ctx.ellipse(fx, r * 0.54, r * 0.11, r * 0.09, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  if (c.glasses) { // round lenses centred on the eyes, a bridge over the nose, arms back to the top of the ears
    ctx.strokeStyle = tone([0, 0, 22], 0.9); ctx.lineWidth = Math.max(1, r * 0.06);
    for (const x of ex) { ctx.beginPath(); ctx.ellipse(x, ey, r * 0.23, r * 0.21, 0, 0, TAU); ctx.stroke(); }
    ctx.beginPath();
    if (dir) { ctx.moveTo(ex[0] - dir * r * 0.23, ey - r * 0.04); ctx.lineTo(-dir * r * 0.62, ey + r * 0.02); }
    else { ctx.moveTo(-r * 0.11, ey - r * 0.03); ctx.quadraticCurveTo(0, ey - r * 0.12, r * 0.11, ey - r * 0.03); ctx.moveTo(-r * 0.57, ey - r * 0.04); ctx.lineTo(-r * 0.92, ey - r * 0.12); ctx.moveTo(r * 0.57, ey - r * 0.04); ctx.lineTo(r * 0.92, ey - r * 0.12); }
    ctx.stroke();
  }
  ctx.restore();
}

/** A rocking chair side on, the whole thing rotated about the runner by its rock angle, with its resident sat back in it, feet out in front, and maybe a cat. */
function rocker(ctx, r, U, s, tone, cat = null) {
  const d = r.dir, wood = tone([28, 45, 32]), woodD = tone([28, 45, 22]), c = r.c, ol = U * 0.025;
  ctx.save(); ctx.translate(0, -U * 0.08); ctx.rotate(r.a * d); ctx.translate(0, U * 0.08);
  ctx.strokeStyle = woodD; ctx.lineWidth = Math.max(1, U * 0.05);
  ctx.beginPath(); ctx.moveTo(-U * 0.6, -U * 0.07); ctx.quadraticCurveTo(0, U * 0.12, U * 0.6, -U * 0.07); ctx.stroke(); // the runner
  ctx.beginPath(); ctx.moveTo(-U * 0.32, -U * 0.04); ctx.lineTo(-U * 0.32, -U * 0.5); ctx.moveTo(U * 0.32, -U * 0.04); ctx.lineTo(U * 0.32, -U * 0.5); ctx.stroke(); // legs
  ctx.strokeStyle = wood; ctx.lineWidth = Math.max(1, U * 0.045); // the back, leaning away from the way it faces, with its slats
  ctx.beginPath(); ctx.moveTo(-d * U * 0.38, -U * 0.5); ctx.lineTo(-d * U * 0.54, -U * 1.4); ctx.lineTo(-d * U * 0.22, -U * 1.4); ctx.stroke();
  ctx.lineWidth = Math.max(1, U * 0.025); ctx.beginPath(); ctx.moveTo(-d * U * 0.3, -U * 0.5); ctx.lineTo(-d * U * 0.44, -U * 1.34); ctx.moveTo(-d * U * 0.24, -U * 0.5); ctx.lineTo(-d * U * 0.35, -U * 1.34); ctx.stroke();
  // the resident, sat back against it: hips on the seat, thighs out level, shins down to the slippers
  const hip = [-d * U * 0.14, -U * 0.6], sh = [-d * U * 0.34, -U * 1.16];
  const leg = (near) => { // the far leg a little behind and darker
    const o = near ? 0 : d * U * 0.05, k = near ? 1 : 0.8, t = ([h, ss, l], a) => tone([h, ss, l * k], a);
    const tap = near ? r.tap : 0; // the near foot taps: the toe lifts on every hit
    limb(ctx, [[hip[0] - o, hip[1]], [d * U * 0.36 - o, -U * 0.6], [d * U * 0.4 - o, -U * 0.14]], U * 0.12, t(c.trousers), t, ol);
    blob(ctx, d * U * 0.46 - o, -U * (0.08 + 0.05 * tap), U * 0.13, U * 0.06, t(c.shoes), t, ol, d * (0.15 - 0.45 * tap));
  };
  leg(false);
  limb(ctx, [[sh[0] - d * U * 0.02, sh[1] + U * 0.1], [-d * U * 0.05, -U * 0.8], [d * U * 0.14, -U * 0.72]], U * 0.11, tone([c.cardigan[0], c.cardigan[1], c.cardigan[2] * 0.8]), tone, ol); // the far arm, down to the lap
  ctx.fillStyle = wood; ctx.fillRect(-U * 0.4, -U * 0.55, U * 0.8, U * 0.07); // the seat
  torso(ctx, [hip[0] - d * U * 0.18, hip[1]], [hip[0] + d * U * 0.2, hip[1] - U * 0.02], [sh[0] - d * U * 0.16, sh[1]], [sh[0] + d * U * 0.2, sh[1] - U * 0.02], c, tone, ol, 0.7, d);
  leg(true);
  if (c.blanket) { // a blanket over the knees, hanging down the front of the shins
    ctx.fillStyle = tone(c.plaid); ctx.strokeStyle = tone(INK, 0.8); ctx.lineWidth = Math.max(1, ol);
    ctx.beginPath(); ctx.moveTo(-d * U * 0.08, -U * 0.7); ctx.lineTo(d * U * 0.46, -U * 0.7); ctx.quadraticCurveTo(d * U * 0.56, -U * 0.55, d * U * 0.5, -U * 0.3); ctx.lineTo(d * U * 0.28, -U * 0.32); ctx.lineTo(d * U * 0.06, -U * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = tone(INK, 0.3); ctx.lineWidth = Math.max(1, ol * 0.6);
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(d * U * (0.06 + k * 0.13), -U * 0.7); ctx.lineTo(d * U * (0.16 + k * 0.12), -U * 0.36); ctx.stroke(); }
  }
  if (cat) catOnLap(ctx, cat, d, U, s, tone, r.rest);
  else if (c.knits) { // knitting: two needles that cross the other way on every hit, a ball of wool on the seat
    const k = r.knit * 0.35, nx = d * U * 0.14, ny = -U * 0.78, len = U * 0.3;
    ctx.strokeStyle = tone([0, 0, 82]); ctx.lineWidth = Math.max(1, U * 0.02); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(nx - Math.cos(0.5 + k) * len * 0.3, ny + Math.sin(0.5 + k) * len * 0.3); ctx.lineTo(nx + Math.cos(0.5 + k) * len, ny - Math.sin(0.5 + k) * len);
    ctx.moveTo(nx + Math.cos(0.5 - k) * len * 0.3, ny + Math.sin(0.5 - k) * len * 0.3); ctx.lineTo(nx - Math.cos(0.5 - k) * len, ny - Math.sin(0.5 - k) * len); ctx.stroke();
    blob(ctx, -d * U * 0.28, -U * 0.62, U * 0.07, U * 0.06, tone(c.plaid), tone, ol * 0.7);
    ctx.strokeStyle = tone(c.plaid); ctx.lineWidth = Math.max(1, ol * 0.6); ctx.beginPath(); ctx.moveTo(-d * U * 0.28, -U * 0.66); ctx.quadraticCurveTo(-d * U * 0.05, -U * 0.7, nx, ny); ctx.stroke(); // the wool up to the needles
    blob(ctx, nx - d * U * 0.06, ny + U * 0.02, U * 0.065, U * 0.05, tone(c.skin), tone, ol); blob(ctx, nx + d * U * 0.07, ny + U * 0.03, U * 0.065, U * 0.05, tone(c.skin), tone, ol); // both hands at the work
  }
  ctx.strokeStyle = wood; ctx.lineWidth = Math.max(1, U * 0.04); ctx.beginPath(); ctx.moveTo(-d * U * 0.47, -U * 0.9); ctx.lineTo(d * U * 0.3, -U * 0.9); ctx.lineTo(d * U * 0.3, -U * 0.55); ctx.stroke(); // the armrest
  if (c.knits && !cat) limb(ctx, [[sh[0] + d * U * 0.1, sh[1] + U * 0.08], [-d * U * 0.06, -U * 0.86], [d * U * 0.18, -U * 0.76]], U * 0.11, tone(c.cardigan), tone, ol); // the near arm, in to the knitting
  else {
    limb(ctx, [[sh[0] + d * U * 0.1, sh[1] + U * 0.08], [-d * U * 0.04, -U * 0.9], [d * U * 0.24, -U * 0.92]], U * 0.11, tone(c.cardigan), tone, ol); // the near arm, along the rest
    blob(ctx, d * U * 0.3, -U * 0.94, U * 0.075, U * 0.055, tone(c.skin), tone, ol, d * 0.3); // the hand on it
  }
  neck(ctx, sh[0] + d * U * 0.05, sh[1] - U * 0.02, U * 0.16, c, tone, ol);
  head(ctx, sh[0] + d * U * 0.1, -U * 1.37, U * 0.165, c, tone, d * (0.08 * r.nod - 0.04 + 0.03 * Math.sin(s.t * 0.7 * s.motion + r.ph)), true, d);
  ctx.restore();
}

/** An armchair facing the room with a resident asleep in it: legs to the floor, head over to one side, eyes shut, the chest with the breath, z's rising. */
function sleeper(ctx, r, U, s, tone, cat = null) {
  const c = r.c, chair = tone(c.chair), chairD = tone([c.chair[0], c.chair[1], c.chair[2] - 12]), ol = U * 0.025, ink = tone(INK, 0.9);
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, ol);
  ctx.fillStyle = chairD; ctx.beginPath(); ctx.roundRect(-U * 0.5, -U * 1.32, U, U * 0.85, U * 0.12); ctx.fill(); ctx.stroke(); // the back
  ctx.fillStyle = chair; ctx.beginPath(); ctx.rect(-U * 0.6, -U * 0.62, U * 1.2, U * 0.62); ctx.fill(); ctx.stroke(); // the base
  const breath = 0.04 * r.chest + 0.015 * Math.sin(s.t * 1.4 * s.motion + r.ph) * (0.4 + 0.6 * r.rest), lift = -U * 0.3 * r.snort;
  for (const sd of [-1, 1]) { // the legs: thighs toward us, shins down to the slippers on the floor
    limb(ctx, [[sd * U * 0.14, -U * 0.62], [sd * U * 0.24, -U * 0.4], [sd * U * 0.26, -U * 0.06]], U * 0.16, tone(c.trousers), tone, ol);
    blob(ctx, sd * U * 0.27, -U * 0.03, U * 0.11, U * 0.07, tone(c.shoes), tone, ol);
  }
  ctx.save(); ctx.translate(0, -U * 0.62); ctx.scale(1, 1 + breath); // the body breathes from the hips
  torso(ctx, [-U * 0.28, 0], [U * 0.28, 0], [-U * 0.36 + r.side * U * 0.03, -U * 0.5 + r.side * U * 0.03], [U * 0.36 + r.side * U * 0.03, -U * 0.5 - r.side * U * 0.03], c, tone, ol, 1);
  ctx.restore();
  ctx.fillStyle = tone(c.plaid); ctx.strokeStyle = tone(INK, 0.8); ctx.lineWidth = Math.max(1, ol); // the blanket over the knees
  ctx.beginPath(); ctx.moveTo(-U * 0.4, -U * 0.66); ctx.lineTo(U * 0.4, -U * 0.66); ctx.lineTo(U * 0.46, -U * 0.3); ctx.lineTo(-U * 0.46, -U * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = tone(INK, 0.3); ctx.lineWidth = Math.max(1, ol * 0.6);
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * U * 0.16, -U * 0.66); ctx.lineTo(k * U * 0.18, -U * 0.3); ctx.moveTo(-U * 0.42, -U * (0.5 + k * 0.06)); ctx.lineTo(U * 0.42, -U * (0.5 + k * 0.06)); ctx.stroke(); }
  if (cat) catCurled(ctx, cat, U, s, tone);
  ctx.fillStyle = chairD; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, ol); // the chair's arms
  ctx.beginPath(); ctx.roundRect(-U * 0.64, -U * 0.92, U * 0.18, U * 0.92, U * 0.05); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(U * 0.46, -U * 0.92, U * 0.18, U * 0.92, U * 0.05); ctx.fill(); ctx.stroke();
  for (const sd of [-1, 1]) { // the arms, down along the body to the hands on the chair's arms
    limb(ctx, [[sd * U * 0.32, -U * 1.05], [sd * U * 0.5, -U * 0.86], [sd * U * 0.54, -U * 0.94]], U * 0.12, tone(c.cardigan), tone, ol);
    blob(ctx, sd * U * 0.55, -U * 0.96, U * 0.08, U * 0.055, tone(c.skin), tone, ol);
  }
  neck(ctx, r.side * U * 0.03, -U * 1.1 + lift, U * 0.17, c, tone, ol);
  head(ctx, r.side * U * 0.08, -U * 1.27 - U * breath * 4 + lift, U * 0.175, c, tone, r.side * (0.42 - 0.35 * r.snort) + 0.02 * Math.sin(s.t * 0.5 + r.ph), r.snort > 0.4, 0);
  ctx.fillStyle = tone([0, 0, 100], 0.9); ctx.font = `${Math.round(U * 0.22)}px sans-serif`;
  for (const z of r.zs) { ctx.globalAlpha = clamp(z.a); ctx.fillText('z', r.side * U * 0.3 + z.x * U * 3, -U * 1.4 + z.y * U * 3); }
  ctx.globalAlpha = 1;
}

/** A resident behind a walking frame, stooped over it, one step per hit: legs stepping, arms down to the handles. */
function walker(ctx, r, U, s, tone) {
  const c = r.c, step = r.bob * r.foot * U * 0.12, sway = Math.sin(s.t * 0.9 * s.motion + r.ph) * 0.02 * r.rest, ol = U * 0.025;
  ctx.save(); ctx.translate(0, -U * 0.06 * r.bob); ctx.rotate(sway);
  const hip = [0, -U * 1.0];
  for (const sd of [-1, 1]) { // legs from the hips, one forward and one back while stepping
    const fwd = sd * step;
    limb(ctx, [[sd * U * 0.1, hip[1]], [sd * U * 0.12 + fwd * 0.6, -U * 0.52], [sd * U * 0.14 + fwd, -U * 0.06]], U * 0.15, tone(c.trousers), tone, ol);
    blob(ctx, sd * U * 0.15 + fwd + r.dir * U * 0.04, -U * 0.03, U * 0.12, U * 0.06, tone(c.shoes), tone, ol);
  }
  if (c.skirt) { ctx.fillStyle = tone(c.trousers); ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, ol); ctx.beginPath(); ctx.moveTo(-U * 0.24, hip[1]); ctx.lineTo(U * 0.24, hip[1]); ctx.lineTo(U * 0.34, -U * 0.5); ctx.lineTo(-U * 0.34, -U * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(r.dir * 0.24); // stooped forward over the frame
  torso(ctx, [-U * 0.24, 0], [U * 0.24, 0], [-U * 0.32, -U * 0.55], [U * 0.32, -U * 0.55], c, tone, ol, 0.9, r.dir * 0.5);
  neck(ctx, 0, -U * 0.56, U * 0.16, c, tone, ol);
  head(ctx, r.dir * U * 0.04, -U * 0.72, U * 0.16, c, tone, r.turn * 0.15 + 0.12 * r.dir, true, r.dir);
  ctx.restore();
  const fx = r.dir * U * 0.28, metal = tone([210, 10, 75]);
  for (const sd of [-1, 1]) { // the arms, from the shoulders down to the handles
    limb(ctx, [[sd * U * 0.28 + r.dir * U * 0.12, -U * 1.45], [sd * U * 0.3 + r.dir * U * 0.2, -U * 1.1], [fx + sd * U * 0.22, -U * 0.78]], U * 0.11, tone(c.cardigan), tone, ol);
    blob(ctx, fx + sd * U * 0.22, -U * 0.77, U * 0.07, U * 0.055, tone(c.skin), tone, ol);
  }
  ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, U * 0.04 + 2 * ol); // the frame: two uprights, the top bar, a brace, wheels at the front
  const frame = () => { ctx.beginPath(); ctx.moveTo(fx - U * 0.22, 0); ctx.lineTo(fx - U * 0.22, -U * 0.75); ctx.lineTo(fx + U * 0.22, -U * 0.75); ctx.lineTo(fx + U * 0.22, 0); ctx.moveTo(fx - U * 0.22, -U * 0.4); ctx.lineTo(fx + U * 0.22, -U * 0.4); ctx.stroke(); };
  frame(); ctx.strokeStyle = metal; ctx.lineWidth = Math.max(1, U * 0.04); frame();
  blob(ctx, fx - U * 0.22, 0, U * 0.045, U * 0.045, tone([0, 0, 20]), tone, ol); blob(ctx, fx + U * 0.22, 0, U * 0.045, U * 0.045, tone([0, 0, 20]), tone, ol);
  ctx.restore();
}

/** The card table and its players: the back two seen over it, the front two from behind, every one a whole body on a chair, a card flying from a seat to the pile on each note. */
function table(ctx, s, X, R, lit) {
  const T = s.table, U = R(0.3 * zScale(T.z)), x = X(T.x), y = R(zY(T.z)), dim = lerp(1, 0.6, T.z) * lit, ol = U * 0.025;
  const tone = ([hh, ss, ll], a = 1) => hsla(hh + s.hueShift * 0.3, ss, ll * dim, a);
  const SEAT = [[-0.7, -0.55, 1], [0.7, -0.55, 1], [-0.85, 0.3, 0], [0.85, 0.3, 0]]; // where each seat is (in U) and whether it is behind the table
  const wood = tone([28, 40, 28]);
  ctx.save(); ctx.translate(x, y);
  const player = (k) => {
    const seat = T.seats[k], [sx, sy, back] = SEAT[k], c = seat.c, r = seat.res !== null ? s.residents[seat.res] : null;
    const ox = sx * U, oy = sy * U; // the seat's floor point
    ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, ol);
    if (back || !r) { ctx.fillStyle = wood; ctx.beginPath(); ctx.rect(ox - U * 0.25, oy - U * 1.0, U * 0.5, U * 0.5); ctx.fill(); ctx.stroke(); } // the chair back, behind a facing player or on an empty chair
    if (!r) { ctx.fillStyle = wood; ctx.fillRect(ox - U * 0.22, oy - U * 0.5, U * 0.06, U * 0.5); ctx.fillRect(ox + U * 0.16, oy - U * 0.5, U * 0.06, U * 0.5); return; }
    const toward = -Math.sign(sx); // which way the table centre is
    for (const sd of [-1, 1]) { // legs under the chair, feet on the floor
      limb(ctx, [[ox + sd * U * 0.12, oy - U * 0.55], [ox + sd * U * 0.2 + toward * U * 0.1, oy - U * 0.35], [ox + sd * U * 0.2 + toward * U * 0.14, oy - U * 0.05]], U * 0.14, tone(c.trousers), tone, ol);
      blob(ctx, ox + sd * U * 0.2 + toward * U * 0.18, oy - U * 0.03, U * 0.1, U * 0.06, tone(c.shoes), tone, ol);
    }
    if (c.skirt) { ctx.fillStyle = tone(c.trousers); ctx.beginPath(); ctx.moveTo(ox - U * 0.28, oy - U * 0.55); ctx.lineTo(ox + U * 0.28, oy - U * 0.55); ctx.lineTo(ox + U * 0.34, oy - U * 0.3); ctx.lineTo(ox - U * 0.34, oy - U * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = wood; ctx.fillRect(ox - U * 0.3, oy - U * 0.58, U * 0.6, U * 0.06); // the seat
    torso(ctx, [ox - U * 0.26, oy - U * 0.56], [ox + U * 0.26, oy - U * 0.56], [ox - U * 0.34, oy - U * 1.08], [ox + U * 0.34, oy - U * 1.08], c, tone, ol, back ? 1 : 0, toward * 0.3);
    if (!back) { ctx.fillStyle = wood; ctx.beginPath(); ctx.rect(ox - U * 0.28, oy - U * 0.95, U * 0.56, U * 0.42); ctx.fill(); ctx.stroke(); } // from behind: the chair back over the body
    const reach = seat.reach, ax = ox * (1 - 0.7 * reach) + toward * U * 0.35, ay = lerp(oy - U * 0.72, -U * 0.5, reach); // the near hand: on the table's edge, out to the pile when dealing
    limb(ctx, [[ox + toward * U * 0.3, oy - U * 1.0], [ox + toward * U * 0.45, oy - U * 0.8], [ax, ay]], U * 0.11, tone(c.cardigan), tone, ol);
    blob(ctx, ax, ay, U * 0.07, U * 0.05, tone(c.skin), tone, ol);
    limb(ctx, [[ox - toward * U * 0.3, oy - U * 1.0], [ox - toward * U * 0.42, oy - U * 0.72], [ox - toward * U * 0.2, oy - U * 0.6]], U * 0.11, tone(c.cardigan), tone, ol); // the other, in the lap
    blob(ctx, ox - toward * U * 0.16, oy - U * 0.6, U * 0.07, U * 0.05, tone(c.skin), tone, ol);
    neck(ctx, ox, oy - U * 1.08, U * 0.15, c, tone, ol);
    if (back) head(ctx, ox, oy - U * 1.23, U * 0.15, c, tone, r.turn * 0.2 + 0.03 * Math.sin(s.t * 0.6 + r.ph), true, 0);
    else { // from behind: the back of the head, the ears either side
      blob(ctx, ox - U * 0.14, oy - U * 1.2, U * 0.03, U * 0.04, tone(c.skin), tone, ol); blob(ctx, ox + U * 0.14, oy - U * 1.2, U * 0.03, U * 0.04, tone(c.skin), tone, ol);
      blob(ctx, ox, oy - U * 1.23, U * 0.145, U * 0.16, tone(c.skin), tone, ol);
      if (c.hairStyle !== 1) blob(ctx, ox, oy - U * 1.26, U * 0.145, U * 0.14, tone(c.hair), tone, ol);
      else blob(ctx, ox, oy - U * 1.16, U * 0.15, U * 0.05, tone(c.hair), tone, ol);
      if (c.hairStyle === 2) blob(ctx, ox, oy - U * 1.28, U * 0.06, U * 0.06, tone(c.hair), tone, ol);
    }
  };
  player(0); player(1);
  ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, ol);
  ctx.fillStyle = tone([28, 40, 26]); ctx.fillRect(-U * 0.75, -U * 0.4, U * 0.09, U * 0.42); ctx.fillRect(U * 0.66, -U * 0.4, U * 0.09, U * 0.42); // legs
  ctx.fillStyle = tone([28, 45, 34]); ctx.beginPath(); ctx.ellipse(0, -U * 0.4, U * 1.05, U * 0.42, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = tone([130, 40, 28]); ctx.beginPath(); ctx.ellipse(0, -U * 0.42, U * 0.95, U * 0.36, 0, 0, TAU); ctx.fill(); // the baize
  for (const c of T.cards) { // dealt: it flies from the hand to the pile, spinning as it goes, and lies where it landed
    const [sx, sy] = SEAT[c.seat], f = 1 - (1 - c.f) ** 3, cx = lerp(sx * U * 0.5, c.tx * U, f), cy = lerp(sy * U * 0.5 - U * 0.45, c.ty * U - U * 0.42 - Math.sin(f * Math.PI) * U * 0.2, f);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.rot * f); ctx.scale(1, 0.55);
    ctx.fillStyle = tone([45, 20, 92]); ctx.strokeStyle = tone(INK, 0.7); ctx.lineWidth = Math.max(1, ol * 0.6); ctx.beginPath(); ctx.roundRect(-U * 0.09, -U * 0.13, U * 0.18, U * 0.26, U * 0.02); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hsla(c.hue, 75, 50 * dim); ctx.beginPath(); ctx.arc(0, 0, U * 0.05 * (0.7 + 0.3 * c.g), 0, TAU); ctx.fill();
    ctx.restore();
  }
  player(2); player(3);
  ctx.restore();
}

/** The nurse with the tea trolley: a whole figure walking, in a tunic and cap, cups rattling with the riser. */
function nurse(ctx, s, X, R, lit) {
  const N = s.nurse, U = R(0.3 * zScale(0.5)), x = X(N.x), y = R(zY(0.5)), dim = 0.8 * lit, ol = U * 0.025;
  const tone = ([hh, ss, ll], a = 1) => hsla(hh, ss, ll * dim, a * N.on);
  const c = { skin: SKINS[0], hair: [25, 45, 35], hairStyle: 2, glasses: false, cardigan: [200, 45, 60], shirt: [0, 0, 96], trousers: [0, 0, 92], shoes: [0, 0, 96] };
  ctx.save(); ctx.translate(x, y);
  const walk = Math.sin(s.t * 6) * U * 0.14, hip = [0, -U * 1.05];
  for (const sd of [-1, 1]) {
    limb(ctx, [[sd * U * 0.08, hip[1]], [sd * U * 0.08 + sd * walk * 0.5, -U * 0.55], [sd * U * 0.1 + sd * walk, -U * 0.06]], U * 0.14, tone(c.trousers), tone, ol);
    blob(ctx, sd * U * 0.1 + sd * walk - U * 0.04, -U * 0.03, U * 0.11, U * 0.06, tone(c.shoes), tone, ol);
  }
  ctx.fillStyle = tone(c.cardigan); ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, ol); // the tunic's skirt
  ctx.beginPath(); ctx.moveTo(-U * 0.24, hip[1]); ctx.lineTo(U * 0.24, hip[1]); ctx.lineTo(U * 0.32, -U * 0.55); ctx.lineTo(-U * 0.32, -U * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
  torso(ctx, [-U * 0.24, hip[1]], [U * 0.24, hip[1]], [-U * 0.3, -U * 1.6], [U * 0.3, -U * 1.6], c, tone, ol, 0.8, -0.5);
  ctx.fillStyle = tone([0, 0, 96]); ctx.beginPath(); ctx.rect(-U * 0.16, -U * 1.5, U * 0.32, U * 0.55); ctx.fill(); ctx.stroke(); // the apron
  limb(ctx, [[U * 0.26, -U * 1.5], [U * 0.36, -U * 1.15], [U * 0.2, -U * 0.95]], U * 0.1, tone(c.cardigan), tone, ol); blob(ctx, U * 0.18, -U * 0.94, U * 0.06, U * 0.05, tone(c.skin), tone, ol); // the far arm, at her side
  neck(ctx, 0, -U * 1.6, U * 0.15, c, tone, ol);
  head(ctx, -U * 0.03, -U * 1.76, U * 0.15, c, tone, -0.05, true, -1);
  ctx.fillStyle = tone([0, 0, 98]); ctx.beginPath(); ctx.rect(-U * 0.14, -U * 1.98, U * 0.26, U * 0.08); ctx.fill(); ctx.stroke(); // the cap
  limb(ctx, [[-U * 0.26, -U * 1.5], [-U * 0.5, -U * 1.2], [-U * 0.66, -U * 0.92]], U * 0.1, tone(c.cardigan), tone, ol); blob(ctx, -U * 0.68, -U * 0.91, U * 0.06, U * 0.05, tone(c.skin), tone, ol); // the near arm, to the trolley
  ctx.translate(-U * 1.1, 0); // the trolley ahead of her
  const shake = N.rattle * Math.sin(s.t * 40) * U * 0.02, metal = tone([210, 10, 70]);
  ctx.strokeStyle = metal; ctx.lineWidth = Math.max(1, U * 0.04);
  ctx.beginPath(); ctx.moveTo(-U * 0.4, 0); ctx.lineTo(-U * 0.4, -U * 0.9); ctx.moveTo(U * 0.4, 0); ctx.lineTo(U * 0.4, -U * 0.9); ctx.stroke();
  ctx.fillStyle = metal; ctx.fillRect(-U * 0.45, -U * 0.9, U * 0.9, U * 0.05); ctx.fillRect(-U * 0.45, -U * 0.5, U * 0.9, U * 0.05);
  blob(ctx, -U * 0.4, 0, U * 0.05, U * 0.05, tone([0, 0, 20]), tone, ol); blob(ctx, U * 0.4, 0, U * 0.05, U * 0.05, tone([0, 0, 20]), tone, ol);
  for (let k = 0; k < 4; k++) blob(ctx, -U * 0.3 + k * U * 0.2 + shake * (k % 2 ? 1 : -1), -U * 0.96, U * 0.05, U * 0.045, tone([45, 20, 95]), tone, ol * 0.7);
  ctx.fillStyle = tone([210, 10, 85]); ctx.strokeStyle = tone(INK, 0.8); ctx.beginPath(); ctx.roundRect(-U * 0.2, -U * 0.72, U * 0.3, U * 0.18, U * 0.04); ctx.fill(); ctx.stroke(); // the pot
  ctx.restore();
}

/** The cat's head, ears, eyes and whiskers at (x, y) facing `d`, radius r: ears back and eyes wide when startled, eyes shut when the lap has gone quiet. */
function catHead(ctx, x, y, r, d, fur, tone, ol, startle, asleep) {
  ctx.save(); ctx.translate(x, y);
  const back = 0.9 * startle; // the ears flatten
  ctx.fillStyle = fur; ctx.strokeStyle = tone(INK, 0.9); ctx.lineWidth = Math.max(1, ol);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * r * 0.75, -r * 0.4); ctx.lineTo(sd * r * (0.85 - 0.6 * back) - d * r * 0.3 * back, -r * (1.35 - 0.9 * back)); ctx.lineTo(sd * r * 0.2, -r * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
  const ex = d * r * 0.25;
  if (asleep && startle < 0.3) { ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.arc(ex - r * 0.3, 0, r * 0.18, Math.PI * 0.15, Math.PI * 0.85); ctx.moveTo(ex + r * 0.48, 0); ctx.arc(ex + r * 0.3, 0, r * 0.18, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
  else { ctx.fillStyle = tone([80, 70, 60]); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex + sd * r * 0.3, -r * 0.05, r * (0.2 + 0.08 * startle), r * (0.16 + 0.1 * startle), 0, 0, TAU); ctx.fill(); } ctx.fillStyle = tone(INK); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(ex + sd * r * 0.3, -r * 0.05, r * (0.06 + 0.1 * startle), r * 0.15, 0, 0, TAU); ctx.fill(); } }
  ctx.fillStyle = tone([350, 60, 70]); ctx.beginPath(); ctx.moveTo(ex - r * 0.1, r * 0.22); ctx.lineTo(ex + r * 0.1, r * 0.22); ctx.lineTo(ex, r * 0.34); ctx.closePath(); ctx.fill(); // the nose
  ctx.strokeStyle = tone([0, 0, 95], 0.8); ctx.lineWidth = Math.max(1, r * 0.05); ctx.beginPath(); // whiskers
  for (const sd of [-1, 1]) for (const k of [-0.15, 0, 0.15]) { ctx.moveTo(ex + sd * r * 0.2, r * 0.3); ctx.lineTo(ex + sd * r * 1.1, r * (0.2 + k * 2)); }
  ctx.stroke();
  ctx.restore();
}
/** The cat on a rocking chair's lap, side on: the tail always swaying and flicking on a hit, the back arching when startled, asleep once the chair's part has gone quiet. */
function catOnLap(ctx, cat, d, U, s, tone, rest) {
  const fur = tone(cat.fur), ol = U * 0.02, sway = 0.5 + 0.5 * Math.sin(s.t * 1.3 * s.motion + 0.7), up = 0.15 + 0.35 * sway + 0.55 * cat.flick, arch = cat.startle;
  const bx = d * U * 0.16, by = -U * 0.78;
  limb(ctx, [[bx - d * U * 0.18, by + U * 0.02], [bx - d * U * 0.36, by - U * (0.02 + 0.28 * up)], [bx - d * U * (0.3 + 0.1 * up), by - U * (0.25 * up + 0.32 * up * up)]], U * 0.05, fur, tone, ol * 0.7); // the tail
  blob(ctx, bx, by - U * 0.06 * arch, U * 0.23, U * (0.1 + 0.05 * arch + 0.008 * Math.sin(s.t * 1.8)), fur, tone, ol);
  for (const k of [-0.08, 0.1]) blob(ctx, bx + d * U * k, by + U * 0.07, U * 0.05, U * 0.03, fur, tone, ol * 0.7); // paws tucked under
  catHead(ctx, bx + d * U * 0.24, by - U * (0.09 + 0.05 * arch) + Math.sin(s.t * 0.9) * U * 0.006, U * 0.085, d, fur, tone, ol, arch, rest > 0.7);
}
/** The cat crossing the floor, side on: four legs walking, the tail up and swinging. */
function catWalking(ctx, cat, U, s, tone) {
  const fur = tone(cat.fur), ol = U * 0.02, d = cat.dir, w = cat.walk;
  ctx.fillStyle = 'rgba(0 0 0 / 0.2)'; ctx.beginPath(); ctx.ellipse(0, 0, U * 0.3, U * 0.05, 0, 0, TAU); ctx.fill();
  for (const [k, ph] of [[-0.16, 0], [0.14, Math.PI], [-0.1, Math.PI], [0.2, 0]]) { // back and front pairs, each pair opposite
    const sw = Math.sin(w + ph) * U * 0.07, lift = Math.max(0, Math.cos(w + ph)) * U * 0.04;
    limb(ctx, [[d * U * k, -U * 0.16], [d * U * k + sw, -U * 0.02 - lift]], U * 0.05, fur, tone, ol * 0.7);
  }
  blob(ctx, 0, -U * 0.17, U * 0.24, U * 0.09, fur, tone, ol);
  limb(ctx, [[-d * U * 0.2, -U * 0.19], [-d * U * 0.3, -U * 0.34], [-d * U * (0.26 + 0.06 * Math.sin(w * 0.5)), -U * 0.48]], U * 0.05, fur, tone, ol * 0.7); // the tail up
  catHead(ctx, d * U * 0.3, -U * 0.27 + Math.sin(w) * U * 0.01, U * 0.085, d, fur, tone, ol, cat.startle, false);
}
/** The cat curled on a sleeper's lap, seen from the front: a loaf with the tail wrapped round, breathing. */
function catCurled(ctx, cat, U, s, tone) {
  const fur = tone(cat.fur), ol = U * 0.02, br = 1 + 0.03 * Math.sin(s.t * 1.6);
  blob(ctx, 0, -U * 0.5, U * 0.3, U * 0.13 * br, fur, tone, ol);
  limb(ctx, [[-U * 0.26, -U * 0.42], [0, -U * 0.36 + Math.sin(s.t * 1.1) * U * 0.01], [U * 0.22, -U * 0.4]], U * 0.05, fur, tone, ol * 0.7); // the tail round the front
  catHead(ctx, U * 0.2, -U * 0.58, U * 0.08, 0, fur, tone, ol, cat.startle, true);
}

/** Something sets off past the window: its lane, its way and its pace by what it is. */
function passer(s, kind) {
  const O = s.outside, dir = rand(s) < 0.5 ? -1 : 1;
  const lane = { car: 0.885, bus: 0.88, bike: 0.89, dog: 0.8, jogger: 0.8, deer: 0.77, fox: 0.8, balloon: 0.35, plane: 0.12, bat: 0.3, star: 0.05, bird: 0.86 }[kind] ?? 0.85;
  const speed = { car: 0.35, bus: 0.22, bike: 0.18, dog: 0.05, jogger: 0.12, deer: 0.09, fox: 0.13, balloon: 0.02, plane: 0.5, bat: 0.25, star: 0.9, bird: 0.18 }[kind] ?? 0.1;
  const u = kind === 'bird' ? 0.3 : kind === 'star' ? 0.1 + rand(s) * 0.5 : dir > 0 ? -0.3 : 1.3;
  O.passers.push({ kind, u, v: lane, dir: kind === 'star' ? 1 : dir, speed: speed * (0.8 + 0.4 * rand(s)), ph: rand(s) * TAU, life: 0 });
  if (O.passers.length > 14) O.passers.shift();
}
/** One thing going by, drawn at (x, y) in the window, scale S (a tenth of the window's height), facing p.dir. */
function goer(ctx, p, x, y, S, s, night) {
  const d = p.dir, col = (h, sa, l, a = 1) => hsla(h, sa, night ? l * 0.45 : l, a), ink = col(0, 0, 12, 0.9), t = s.t;
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, S * 0.08);
  const wheel = (wx, wy, r) => { ctx.fillStyle = col(0, 0, 15); ctx.beginPath(); ctx.arc(wx, wy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = col(0, 0, 70); ctx.lineWidth = Math.max(1, r * 0.3); ctx.beginPath(); ctx.arc(wx, wy, r * 0.45, 0, TAU); ctx.stroke(); ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, S * 0.08); };
  const walker = (h, bob, arms) => { // a small walking figure: legs swinging, a body, a head
    const sw = Math.sin(t * 6 + p.ph) * S * 0.3;
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, S * 0.18); ctx.beginPath(); ctx.moveTo(0, -S * 0.9); ctx.lineTo(sw, 0); ctx.moveTo(0, -S * 0.9); ctx.lineTo(-sw, 0); ctx.stroke();
    ctx.fillStyle = col(h, 45, 45); ctx.beginPath(); ctx.roundRect(-S * 0.3, -S * 1.8 - bob, S * 0.6, S * 0.95, S * 0.15); ctx.fill(); ctx.stroke();
    ctx.lineWidth = Math.max(1, S * 0.14); ctx.beginPath(); ctx.moveTo(0, -S * 1.6 - bob); ctx.lineTo(d * S * 0.5, -S * (arms ? 1.7 : 1.1) - bob); ctx.stroke();
    ctx.fillStyle = col(28, 45, 75); ctx.beginPath(); ctx.arc(0, -S * 2.1 - bob, S * 0.3, 0, TAU); ctx.fill(); ctx.stroke();
  };
  if (p.kind === 'car' || p.kind === 'bus') {
    const L = p.kind === 'bus' ? S * 3.6 : S * 2.2, H = p.kind === 'bus' ? S * 1.4 : S * 0.7, hue = (p.ph * 57) % 360;
    ctx.fillStyle = col(hue, 55, 50); ctx.beginPath(); ctx.roundRect(-L / 2, -H - S * 0.35, L, H, S * 0.2); ctx.fill(); ctx.stroke();
    if (p.kind === 'car') { ctx.beginPath(); ctx.roundRect(-L * 0.25, -H - S * 0.9, L * 0.5, S * 0.6, S * 0.2); ctx.fill(); ctx.stroke(); ctx.fillStyle = col(200, 40, 80); ctx.fillRect(-L * 0.2, -H - S * 0.82, L * 0.4, S * 0.4); }
    else { ctx.fillStyle = col(200, 40, 82); for (let k = 0; k < 4; k++) ctx.fillRect(-L / 2 + S * 0.25 + k * L * 0.23, -H - S * 0.2, L * 0.17, S * 0.55); }
    wheel(-L * 0.3, -S * 0.3, S * 0.32); wheel(L * 0.3, -S * 0.3, S * 0.32);
    if (night) { ctx.fillStyle = hsla(50, 90, 85, 0.9); ctx.beginPath(); ctx.arc(d * L / 2, -S * 0.6, S * 0.14, 0, TAU); ctx.fill(); ctx.fillStyle = hsla(0, 90, 55, 0.9); ctx.beginPath(); ctx.arc(-d * L / 2, -S * 0.6, S * 0.12, 0, TAU); ctx.fill(); }
  } else if (p.kind === 'bike') {
    wheel(-S * 0.6, -S * 0.4, S * 0.4); wheel(S * 0.6, -S * 0.4, S * 0.4);
    ctx.strokeStyle = col(0, 60, 45); ctx.lineWidth = Math.max(1, S * 0.1); ctx.beginPath(); ctx.moveTo(-S * 0.6, -S * 0.4); ctx.lineTo(0, -S * 1.1); ctx.lineTo(S * 0.6, -S * 0.4); ctx.lineTo(d * S * 0.1, -S * 0.5); ctx.lineTo(0, -S * 1.1); ctx.stroke();
    const ped = t * 8 + p.ph; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, S * 0.15); ctx.beginPath(); ctx.moveTo(-d * S * 0.1, -S * 1.3); ctx.lineTo(Math.cos(ped) * S * 0.25, -S * 0.5 + Math.sin(ped) * S * 0.25); ctx.moveTo(-d * S * 0.1, -S * 1.3); ctx.lineTo(-Math.cos(ped) * S * 0.25, -S * 0.5 - Math.sin(ped) * S * 0.25); ctx.stroke();
    ctx.fillStyle = col(200, 50, 50); ctx.beginPath(); ctx.moveTo(-d * S * 0.35, -S * 1.3); ctx.lineTo(d * S * 0.25, -S * 1.9); ctx.lineTo(d * S * 0.55, -S * 1.85); ctx.lineTo(d * S * 0.1, -S * 1.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col(28, 45, 75); ctx.beginPath(); ctx.arc(d * S * 0.45, -S * 2.15, S * 0.28, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col(50, 80, 55); ctx.beginPath(); ctx.arc(d * S * 0.45, -S * 2.2, S * 0.32, Math.PI, TAU); ctx.fill(); // the helmet
  } else if (p.kind === 'dog') {
    walker((p.ph * 90) % 360, 0, false);
    const dx = d * S * 1.5, sw = Math.sin(t * 9 + p.ph) * S * 0.15; // the dog out in front on its lead, tail going
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, S * 0.06); ctx.beginPath(); ctx.moveTo(d * S * 0.5, -S * 1.1); ctx.lineTo(dx - d * S * 0.2, -S * 0.6); ctx.stroke();
    ctx.lineWidth = Math.max(1, S * 0.12); ctx.beginPath(); for (const k of [-0.3, 0.3]) { ctx.moveTo(dx + d * S * k, -S * 0.45); ctx.lineTo(dx + d * S * k + sw * (k > 0 ? 1 : -1), 0); } ctx.stroke();
    ctx.fillStyle = col(30, 45, 45); ctx.beginPath(); ctx.ellipse(dx, -S * 0.5, S * 0.55, S * 0.28, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(dx + d * S * 0.6, -S * 0.75, S * 0.22, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = Math.max(1, S * 0.1); ctx.beginPath(); ctx.moveTo(dx - d * S * 0.5, -S * 0.6); ctx.lineTo(dx - d * S * 0.75, -S * (1 + 0.2 * Math.sin(t * 14))); ctx.stroke();
  } else if (p.kind === 'jogger') walker(120, Math.abs(Math.sin(t * 6 + p.ph)) * S * 0.2, true);
  else if (p.kind === 'deer' || p.kind === 'fox') {
    const fox = p.kind === 'fox', fur = fox ? col(22, 75, 50) : col(28, 40, 45), sw = Math.sin(t * 7 + p.ph) * S * 0.2, L = fox ? S * 0.5 : S * 1.1;
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, S * 0.14); ctx.beginPath(); for (const k of [-0.4, -0.25, 0.25, 0.4]) { ctx.moveTo(d * S * k * (fox ? 1.2 : 1), -L * 0.6); ctx.lineTo(d * S * k + sw * Math.sign(k), 0); } ctx.stroke();
    ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -L * 0.7, S * (fox ? 0.6 : 0.8), S * (fox ? 0.25 : 0.4), 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (fox) { ctx.beginPath(); ctx.ellipse(-d * S * 0.75, -L * 0.75, S * 0.45, S * 0.2, -d * 0.4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = col(0, 0, 95); ctx.beginPath(); ctx.arc(-d * S * 1.1, -L * 0.95, S * 0.1, 0, TAU); ctx.fill(); }
    else { ctx.lineWidth = Math.max(1, S * 0.22); ctx.strokeStyle = fur; ctx.beginPath(); ctx.moveTo(d * S * 0.6, -L * 0.8); ctx.lineTo(d * S * 0.9, -L * 1.5); ctx.stroke(); }
    ctx.fillStyle = fur; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, S * 0.08); ctx.beginPath(); ctx.ellipse(d * S * (fox ? 0.7 : 1), -L * (fox ? 0.85 : 1.55), S * 0.25, S * 0.18, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); if (fox) { ctx.moveTo(d * S * 0.6, -L * 1.0); ctx.lineTo(d * S * 0.55, -L * 1.35); ctx.lineTo(d * S * 0.75, -L * 1.05); } else for (const k of [-0.1, 0.1]) { ctx.moveTo(d * S * (1 + k), -L * 1.7); ctx.lineTo(d * S * (1 + k * 3), -L * 2.1); ctx.lineTo(d * S * (1 + k * 5), -L * 1.95); }
    fox ? (ctx.fill(), ctx.stroke()) : ctx.stroke();
  } else if (p.kind === 'balloon') {
    const hue = (p.ph * 80) % 360, bob = Math.sin(t * 0.8 + p.ph) * S * 0.1;
    for (const [a0, a1, hh] of [[0, Math.PI / 2, hue], [Math.PI / 2, Math.PI, hue + 60], [Math.PI, Math.PI * 1.5, hue], [Math.PI * 1.5, TAU, hue + 60]]) { ctx.fillStyle = col(hh, 70, 55); ctx.beginPath(); ctx.moveTo(0, bob); ctx.arc(0, bob, S * 0.9, a0, a1); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, bob, S * 0.9, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(1, S * 0.05); ctx.beginPath(); ctx.moveTo(-S * 0.4, S * 0.8 + bob); ctx.lineTo(-S * 0.2, S * 1.5 + bob); ctx.moveTo(S * 0.4, S * 0.8 + bob); ctx.lineTo(S * 0.2, S * 1.5 + bob); ctx.stroke();
    ctx.fillStyle = col(30, 50, 40); ctx.fillRect(-S * 0.25, S * 1.5 + bob, S * 0.5, S * 0.35); ctx.strokeRect(-S * 0.25, S * 1.5 + bob, S * 0.5, S * 0.35);
  } else if (p.kind === 'plane') {
    ctx.fillStyle = col(0, 0, 88); ctx.beginPath(); ctx.ellipse(0, 0, S * 1.2, S * 0.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-d * S * 0.2, 0); ctx.lineTo(-d * S * 0.9, S * 0.55); ctx.lineTo(-d * S * 0.4, S * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); // a wing
    ctx.beginPath(); ctx.moveTo(-d * S * 0.9, 0); ctx.lineTo(-d * S * 1.25, -S * 0.55); ctx.lineTo(-d * S * 0.8, -S * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke(); // the tail fin
    if (Math.sin(t * 9) > 0.6) { ctx.fillStyle = hsla(0, 90, 60); ctx.beginPath(); ctx.arc(-d * S * 1.2, -S * 0.5, S * 0.1, 0, TAU); ctx.fill(); }
  } else if (p.kind === 'bird' || p.kind === 'bat') {
    const flap = Math.sin(t * (p.kind === 'bat' ? 22 : 12) + p.ph) * S * 0.45, W = S * 0.7;
    ctx.strokeStyle = p.kind === 'bat' ? col(0, 0, 10) : col(0, 0, 25); ctx.lineWidth = Math.max(1, S * 0.1);
    ctx.beginPath(); ctx.moveTo(-W, -flap); ctx.quadraticCurveTo(-W * 0.5, flap * 0.3, 0, 0); ctx.quadraticCurveTo(W * 0.5, flap * 0.3, W, -flap); ctx.stroke();
    if (p.kind === 'bat') { ctx.fillStyle = col(0, 0, 10); ctx.beginPath(); ctx.moveTo(-W, -flap); ctx.lineTo(-W * 0.6, flap * 0.4); ctx.lineTo(-W * 0.3, flap * 0.1); ctx.lineTo(0, flap * 0.5); ctx.lineTo(W * 0.3, flap * 0.1); ctx.lineTo(W * 0.6, flap * 0.4); ctx.lineTo(W, -flap); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); }
  } else if (p.kind === 'star') {
    ctx.strokeStyle = hsla(50, 40, 95, clamp(1 - p.life / 0.8)); ctx.lineWidth = Math.max(1, S * 0.08); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-S * 2.2, -S * 1.2); ctx.stroke();
  }
  ctx.restore();
}

/** midi note to 0..1 over 36 (C2) .. 84 (C6). */
const pitch = (n) => clamp((n - 36) / 48);
const seen = (q, v) => { q.lo = Math.min(q.lo, v); q.hi = Math.max(q.hi, v); q.mid = v; };
const place = (q, v) => clamp((v - q.lo) / Math.max(0.12, q.hi - q.lo));

/** A character: skin, hair, cardigan, glasses, blanket, from the song's own generator, so every resident is a different one. */
const character = (s) => ({
  skin: SKINS[Math.floor(rand(s) * SKINS.length)], hair: HAIRS[Math.floor(rand(s) * HAIRS.length)], hairStyle: Math.floor(rand(s) * 4),
  cardigan: CARDIGANS[Math.floor(rand(s) * CARDIGANS.length)].map((v, i) => v + (rand(s) - 0.5) * (i ? 10 : 24)),
  glasses: rand(s) < 0.5, blanket: rand(s) < 0.6, knits: rand(s) < 0.45, plaid: PLAIDS[Math.floor(rand(s) * PLAIDS.length)],
  shirt: [[0, 0, 96], [45, 40, 92], [205, 45, 88], [340, 30, 90]][Math.floor(rand(s) * 4)], trousers: TROUSERS[Math.floor(rand(s) * TROUSERS.length)], skirt: rand(s) < 0.4, shoes: [[25, 30, 35], [0, 0, 15], [350, 40, 45], [30, 25, 60]][Math.floor(rand(s) * 4)],
  chair: [[25, 35, 40], [350, 30, 38], [210, 25, 40], [95, 20, 36]][Math.floor(rand(s) * 4)],
});

/** The part's record, made on first sight: who it is (its resident, by the kind its job gets, null when that kind's chairs are all taken) and how much it has been saying. */
function partFor(s, name, slot) {
  let q = s.parts[name];
  if (q) return q;
  q = { slot, res: resident(s, KIND[slot] ?? 'walker', name), fast: 0, slow: 0, say: 0, lo: 0.45, hi: 0.55, mid: 0.5 };
  s.parts[name] = q; s.order.push(name);
  return q;
}

/** A resident of a kind for a part: null when the home has no more of that kind of chair. A player takes a seat at the table (made on the first). */
function resident(s, kind, part) {
  const n = s.residents.filter((r) => r.kind === kind).length;
  if (n >= CAP[kind]) return null;
  const c = character(s), i = s.residents.length;
  const r = { kind, part, c, x: s.aspect / 2, z: 0.5, dir: 1, ph: rand(s) * TAU, rest: 1, turn: 0 };
  if (kind === 'rocker') Object.assign(r, { a: 0, w: 0, nod: 0, tap: 0, knit: 1, knitTo: 1, period: rand(s) < 0.6 ? 2 : 4 });
  else if (kind === 'sleeper') Object.assign(r, { hold: 0, age: 9, chest: 0, snort: 0, zs: [], zt: rand(s) * 2, zEvery: 2 + rand(s) * 3, side: rand(s) < 0.5 ? -1 : 1 });
  else if (kind === 'walker') Object.assign(r, { to: 0, bob: 0, foot: 1, dir: rand(s) < 0.5 ? -1 : 1 });
  else if (kind === 'player') {
    if (!s.table) s.table = { x: s.aspect * 0.5, z: 0.78, seats: [0, 1, 2, 3].map(() => ({ res: null, c: character(s), reach: 0, hue: 0, hueAt: 0 })), cards: [] };
    const seat = s.table.seats[n]; seat.res = i; seat.c = c;
  }
  s.residents.push(r);
  arrange(s);
  return i;
}

/** Where everyone sits: rocking chairs in a row at the front facing in, armchairs at the sides, the table at the back, walkers on the floor between. */
function arrange(s) {
  const A = s.aspect, by = { rocker: [], sleeper: [], walker: [], player: [] };
  for (const r of s.residents) by[r.kind].push(r);
  const row = [[[0.3, 0.16]], [[0.25, 0.16], [0.75, 0.2]], [[0.17, 0.16], [0.5, 0.24], [0.83, 0.2]], [[0.13, 0.16], [0.38, 0.24], [0.62, 0.22], [0.87, 0.18]]][by.rocker.length - 1] ?? []; // one row across the front, nobody behind anybody
  by.rocker.forEach((r, i, all) => { [r.x, r.z] = [A * row[i][0], row[i][1]]; r.dir = all.length === 1 ? 1 : r.x < A / 2 ? 1 : -1; });
  by.sleeper.forEach((r, i) => { [r.x, r.z] = [[A * 0.09, 0.62], [A * 0.91, 0.62], [A * 0.5, 0.92]][i]; r.side = i === 1 ? -1 : 1; });
  if (s.table) s.table.x = A * (by.rocker.length === 3 ? 0.68 : 0.5); // off to the side when a chair sits in the middle
  by.walker.forEach((r, i) => { if (!r.placed) { r.x = A * (0.3 + 0.4 * ((i * 0.37 + 0.2) % 1)); r.to = r.x; r.placed = true; } r.z = 0.42 + i * 0.07; });
  by.player.forEach((r) => { r.x = s.table.x; r.z = s.table.z; });
}

// the figure drawing, shared with cabaret.mjs (the same residents on a stage)
export { INK, limb, blob, torso, neck, head, character };
