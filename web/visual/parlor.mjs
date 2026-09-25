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
    };
    seed(s, rng);
    for (const name of Object.keys(score.cast)) partFor(s, name, score.cast[name].slot);
    if (!s.residents.some((r) => r.kind === 'rocker')) resident(s, 'rocker', null); // a home always has someone rocking, and someone asleep
    if (!s.residents.some((r) => r.kind === 'sleeper')) resident(s, 'sleeper', null);
    arrange(s);
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
      if (!r) continue;
      if (r.kind === 'rocker') { // shoved along the way it is going: a steady part rocks it hard and in time
        const push = e.role === 'pulse' ? 1.5 : e.role === 'grain' ? 0.4 : 1;
        r.w = clamp(r.w + Math.sign(r.w || r.dir) * push * g * s.sit.pace, -3, 3);
        r.nod = Math.min(1, r.nod + 0.5 * g);
        if (r.cat && e.role !== 'grain') r.tail = 1;
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
        if (Math.abs(r.a) > 0.34) { r.a = Math.sign(r.a) * 0.34; r.w *= -0.3; } // the runner's end: it will not tip
        r.nod = decay(r.nod, 3, dt); r.tail = decay(r.tail, 2.5, dt);
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
    ctx.fillStyle = hsla(120, 15, night ? 30 : 55, 0.85); ctx.beginPath(); ctx.ellipse(lerp(wx0, wx1, 0.3), wy1, R(0.06), R(0.06 + 0.005 * Math.sin(s.t * 0.7 * s.motion)), 0, Math.PI, TAU); ctx.fill(); // a tree beyond the glass, in the breeze
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
    const things = s.residents.map((r) => ({ z: r.z, r }));
    if (s.table) things.push({ z: s.table.z, table: true });
    if (s.nurse.on > 0.02) things.push({ z: 0.5, nurse: true });
    things.sort((a, b) => b.z - a.z);
    for (const th of things) {
      if (th.table) { table(ctx, s, X, R, lit); continue; }
      if (th.nurse) { nurse(ctx, s, X, R, lit); continue; }
      const r = th.r; if (r.kind === 'player') continue;
      const U = R((r.kind === 'rocker' ? 0.36 : 0.3) * zScale(r.z)), x = X(r.x), y = R(zY(r.z)); // the rocking chairs are the thing: a size up
      const dim = lerp(1, 0.55, r.z) * lit, tone = ([hh, ss, ll], a = 1) => hsla(hh + s.hueShift * 0.3, ss, ll * dim, a);
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0 0 0 / 0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, U * 0.7, U * 0.12, 0, 0, TAU); ctx.fill();
      if (r.kind === 'rocker') rocker(ctx, r, U, s, tone);
      else if (r.kind === 'sleeper') sleeper(ctx, r, U, s, tone);
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

/** A head with its hair, glasses and face, at (x, y) with radius r, tilted, eyes open or shut; `dir` 0 faces the camera, ±1 a side view. */
function head(ctx, x, y, r, c, tone, tilt, eyes, dir = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
  ctx.fillStyle = tone(c.skin); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = tone(c.skin, 0.6); ctx.lineWidth = Math.max(1, r * 0.05); ctx.stroke();
  ctx.fillStyle = tone(c.hair);
  if (c.hairStyle === 0) { ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.04, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); } // a white cap of hair
  else if (c.hairStyle === 1) { ctx.beginPath(); ctx.arc(-r * 0.85, 0, r * 0.3, 0, TAU); ctx.arc(r * 0.85, 0, r * 0.3, 0, TAU); ctx.fill(); ctx.fillStyle = tone([0, 0, 100], 0.25); ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.5, r * 0.22, 0, TAU); ctx.fill(); } // bald, tufts at the sides, a shine
  else if (c.hairStyle === 2) { ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 1.05, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); ctx.beginPath(); ctx.arc(-dir * r * 0.5, -r * 0.95, r * 0.42, 0, TAU); ctx.fill(); } // a bun
  else { ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 1.02, Math.PI * 1.1, Math.PI * 1.9); ctx.fill(); ctx.fillRect(-r * 1.02, -r * 0.4, r * 0.25, r * 0.5); ctx.fillRect(r * 0.77, -r * 0.4, r * 0.25, r * 0.5); } // short and grey, over the ears
  const fx = dir * r * 0.3, ink = tone([0, 0, 15]);
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.08);
  if (eyes) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(fx - r * 0.32, -r * 0.1, r * 0.09, 0, TAU); ctx.arc(fx + r * 0.32, -r * 0.1, r * 0.09, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(fx - r * 0.45, -r * 0.08); ctx.lineTo(fx - r * 0.2, -r * 0.05); ctx.moveTo(fx + r * 0.2, -r * 0.05); ctx.lineTo(fx + r * 0.45, -r * 0.08); ctx.stroke(); }
  if (c.glasses) { ctx.strokeStyle = tone([0, 0, 25], 0.9); ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath(); ctx.arc(fx - r * 0.34, -r * 0.1, r * 0.27, 0, TAU); ctx.moveTo(fx + r * 0.61, -r * 0.1); ctx.arc(fx + r * 0.34, -r * 0.1, r * 0.27, 0, TAU); ctx.moveTo(fx - r * 0.07, -r * 0.1); ctx.lineTo(fx + r * 0.07, -r * 0.1); ctx.stroke(); }
  if (dir) { ctx.strokeStyle = tone(c.skin, 0.9); ctx.lineWidth = Math.max(1, r * 0.08); ctx.beginPath(); ctx.moveTo(dir * r * 0.9, r * 0.05); ctx.lineTo(dir * r * 1.1, r * 0.25); ctx.stroke(); }
  ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, r * 0.06); ctx.beginPath();
  if (eyes) ctx.arc(fx, r * 0.35, r * 0.28, Math.PI * 0.15, Math.PI * 0.85); else ctx.ellipse(fx, r * 0.45, r * 0.12, r * 0.09, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** A rocking chair side on, the whole thing rotated about the runner by its rock angle, with its resident and maybe a cat. */
function rocker(ctx, r, U, s, tone) {
  const d = r.dir, wood = tone([28, 45, 32]), c = r.c;
  ctx.save(); ctx.translate(0, -U * 0.08); ctx.rotate(r.a * d); ctx.translate(0, U * 0.08);
  ctx.strokeStyle = wood; ctx.lineWidth = Math.max(1, U * 0.05);
  ctx.beginPath(); ctx.moveTo(-U * 0.6, -U * 0.07); ctx.quadraticCurveTo(0, U * 0.12, U * 0.6, -U * 0.07); ctx.stroke(); // the runner
  ctx.beginPath(); ctx.moveTo(-U * 0.32, -U * 0.04); ctx.lineTo(-U * 0.32, -U * 0.5); ctx.moveTo(U * 0.32, -U * 0.04); ctx.lineTo(U * 0.32, -U * 0.5); ctx.stroke(); // legs
  ctx.fillStyle = wood; ctx.fillRect(-U * 0.4, -U * 0.55, U * 0.8, U * 0.07); // the seat
  ctx.lineWidth = Math.max(1, U * 0.045); // the back, leaning away from the way it faces, with its slats and the armrest
  ctx.beginPath(); ctx.moveTo(-d * U * 0.38, -U * 0.5); ctx.lineTo(-d * U * 0.52, -U * 1.25); ctx.moveTo(-d * U * 0.52, -U * 1.25); ctx.lineTo(-d * U * 0.2, -U * 1.25); ctx.stroke();
  ctx.lineWidth = Math.max(1, U * 0.025); ctx.beginPath(); ctx.moveTo(-d * U * 0.3, -U * 0.5); ctx.lineTo(-d * U * 0.42, -U * 1.2); ctx.moveTo(-d * U * 0.24, -U * 0.5); ctx.lineTo(-d * U * 0.33, -U * 1.2); ctx.stroke();
  // the resident: legs out to the front, a blanket on the knees, the body against the back, an arm on the rest, a head that nods
  const skin = tone(c.skin);
  ctx.strokeStyle = tone([230, 15, 30]); ctx.lineWidth = Math.max(1, U * 0.13);
  ctx.beginPath(); ctx.moveTo(-d * U * 0.1, -U * 0.6); ctx.lineTo(d * U * 0.35, -U * 0.58); ctx.lineTo(d * U * 0.4, -U * 0.1); ctx.stroke();
  ctx.fillStyle = tone([25, 30, 35]); ctx.beginPath(); ctx.ellipse(d * U * 0.42, -U * 0.05, U * 0.14, U * 0.06, 0, 0, TAU); ctx.fill(); // a slipper
  ctx.fillStyle = tone(c.cardigan); ctx.beginPath(); ctx.moveTo(-d * U * 0.3, -U * 0.55); ctx.lineTo(d * U * 0.12, -U * 0.55); ctx.lineTo(d * U * 0.08, -U * 1.05); ctx.lineTo(-d * U * 0.42, -U * 1.1); ctx.closePath(); ctx.fill();
  if (c.blanket) { ctx.fillStyle = tone(c.plaid); ctx.beginPath(); ctx.moveTo(-d * U * 0.15, -U * 0.66); ctx.lineTo(d * U * 0.42, -U * 0.64); ctx.lineTo(d * U * 0.38, -U * 0.35); ctx.lineTo(-d * U * 0.05, -U * 0.4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = tone(c.plaid, 0.5); ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(d * U * (0.0 + k * 0.14), -U * 0.65); ctx.lineTo(d * U * (0.02 + k * 0.13), -U * 0.38); ctx.stroke(); } }
  ctx.strokeStyle = wood; ctx.lineWidth = Math.max(1, U * 0.04); ctx.beginPath(); ctx.moveTo(-d * U * 0.45, -U * 0.85); ctx.lineTo(d * U * 0.3, -U * 0.85); ctx.moveTo(d * U * 0.3, -U * 0.85); ctx.lineTo(d * U * 0.3, -U * 0.55); ctx.stroke(); // the armrest
  ctx.strokeStyle = tone(c.cardigan); ctx.lineWidth = Math.max(1, U * 0.1); ctx.beginPath(); ctx.moveTo(-d * U * 0.2, -U * 0.95); ctx.lineTo(d * U * 0.2, -U * 0.86); ctx.stroke(); // the arm on it
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(d * U * 0.24, -U * 0.86, U * 0.06, 0, TAU); ctx.fill();
  if (r.cat) { // a cat on the lap, its tail flicking when the chair is shoved
    ctx.fillStyle = tone(r.cat); ctx.beginPath(); ctx.ellipse(d * U * 0.15, -U * 0.75, U * 0.2, U * 0.1, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(d * U * 0.34, -U * 0.82, U * 0.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(d * U * 0.28, -U * 0.87); ctx.lineTo(d * U * 0.3, -U * 0.95); ctx.lineTo(d * U * 0.34, -U * 0.88); ctx.moveTo(d * U * 0.36, -U * 0.88); ctx.lineTo(d * U * 0.4, -U * 0.95); ctx.lineTo(d * U * 0.41, -U * 0.86); ctx.fill();
    ctx.strokeStyle = tone(r.cat); ctx.lineWidth = Math.max(1, U * 0.04); ctx.beginPath(); ctx.moveTo(-d * U * 0.05, -U * 0.74); ctx.quadraticCurveTo(-d * U * 0.25, -U * (0.7 + 0.3 * r.tail), -d * U * 0.2, -U * (0.55 + 0.35 * r.tail)); ctx.stroke();
  }
  head(ctx, -d * U * 0.12, -U * 1.2, U * 0.16, c, tone, d * (0.08 * r.nod - 0.05 + 0.03 * Math.sin(s.t * 0.7 * s.motion + r.ph)), true, d);
  ctx.restore();
}

/** An armchair facing the room with a resident asleep in it: head over, eyes shut, the chest with the breath, z's rising. */
function sleeper(ctx, r, U, s, tone) {
  const c = r.c, chair = tone(c.chair), chairD = tone([c.chair[0], c.chair[1], c.chair[2] - 12]);
  ctx.fillStyle = chairD; ctx.beginPath(); ctx.roundRect(-U * 0.5, -U * 1.3, U, U * 0.85, U * 0.12); ctx.fill(); // the back
  ctx.fillStyle = chair; ctx.fillRect(-U * 0.6, -U * 0.62, U * 1.2, U * 0.62); // the base
  const breath = 0.04 * r.chest + 0.015 * Math.sin(s.t * 1.4 * s.motion + r.ph) * (0.4 + 0.6 * r.rest), lift = -U * 0.3 * r.snort;
  ctx.save(); ctx.translate(0, -U * 0.6); ctx.scale(1, 1 + breath); // the body breathes from the hips
  ctx.fillStyle = tone(c.cardigan); ctx.beginPath(); ctx.roundRect(-U * 0.32, -U * 0.55, U * 0.64, U * 0.6, U * 0.1); ctx.fill();
  ctx.restore();
  ctx.fillStyle = tone(c.plaid); ctx.beginPath(); ctx.roundRect(-U * 0.42, -U * 0.62, U * 0.84, U * 0.32, U * 0.05); ctx.fill(); // the blanket on the knees
  ctx.strokeStyle = tone(c.plaid, 0.45); ctx.lineWidth = 1; for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * U * 0.16, -U * 0.62); ctx.lineTo(k * U * 0.16, -U * 0.3); ctx.moveTo(-U * 0.42, -U * (0.5 + k * 0.05)); ctx.lineTo(U * 0.42, -U * (0.5 + k * 0.05)); ctx.stroke(); }
  ctx.fillStyle = chairD; ctx.fillRect(-U * 0.62, -U * 0.9, U * 0.16, U * 0.9); ctx.fillRect(U * 0.46, -U * 0.9, U * 0.16, U * 0.9); // the arms
  ctx.fillStyle = tone(c.skin); ctx.beginPath(); ctx.arc(-U * 0.5, -U * 0.9, U * 0.07, 0, TAU); ctx.arc(U * 0.5, -U * 0.9, U * 0.07, 0, TAU); ctx.fill(); // hands on the arms
  head(ctx, r.side * U * 0.06, -U * 1.12 - U * breath * 4 + lift, U * 0.17, c, tone, r.side * (0.42 - 0.35 * r.snort) + 0.02 * Math.sin(s.t * 0.5 + r.ph), r.snort > 0.4, 0);
  ctx.fillStyle = tone([0, 0, 100], 0.9); ctx.font = `${Math.round(U * 0.22)}px sans-serif`;
  for (const z of r.zs) { ctx.globalAlpha = clamp(z.a); ctx.fillText('z', r.side * U * 0.3 + z.x * U * 3, -U * 1.3 + z.y * U * 3); }
  ctx.globalAlpha = 1;
}

/** A resident behind a walking frame, stooped over it, one step per hit. */
function walker(ctx, r, U, s, tone) {
  const c = r.c, step = r.bob * r.foot * U * 0.1, sway = Math.sin(s.t * 0.9 * s.motion + r.ph) * 0.02 * r.rest;
  ctx.save(); ctx.translate(0, -U * 0.08 * r.bob); ctx.rotate(sway);
  ctx.strokeStyle = tone([230, 15, 30]); ctx.lineWidth = Math.max(1, U * 0.11); // legs, stepping
  ctx.beginPath(); ctx.moveTo(-U * 0.1, -U * 0.6); ctx.lineTo(-U * 0.14 + step, -U * 0.05); ctx.moveTo(U * 0.1, -U * 0.6); ctx.lineTo(U * 0.14 - step, -U * 0.05); ctx.stroke();
  ctx.fillStyle = tone([25, 30, 35]); ctx.beginPath(); ctx.ellipse(-U * 0.14 + step, -U * 0.02, U * 0.11, U * 0.05, 0, 0, TAU); ctx.ellipse(U * 0.14 - step, -U * 0.02, U * 0.11, U * 0.05, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(0, -U * 0.62); ctx.rotate(r.dir * 0.22); // stooped forward over the frame
  ctx.fillStyle = tone(c.cardigan); ctx.beginPath(); ctx.roundRect(-U * 0.28, -U * 0.55, U * 0.56, U * 0.6, U * 0.1); ctx.fill();
  head(ctx, 0, -U * 0.7, U * 0.16, c, tone, r.turn * 0.15 + 0.15 * r.dir, true, r.dir);
  ctx.strokeStyle = tone(c.cardigan); ctx.lineWidth = Math.max(1, U * 0.1); ctx.beginPath(); ctx.moveTo(-U * 0.22, -U * 0.4); ctx.lineTo(r.dir * U * 0.2 - U * 0.18, -U * 0.05); ctx.moveTo(U * 0.22, -U * 0.4); ctx.lineTo(r.dir * U * 0.2 + U * 0.18, -U * 0.05); ctx.stroke(); // arms down to the handles
  ctx.restore();
  const fx = r.dir * U * 0.25, metal = tone([210, 10, 75]);
  ctx.strokeStyle = metal; ctx.lineWidth = Math.max(1, U * 0.04); // the frame: two uprights, the top bar, a brace, wheels at the front
  ctx.beginPath(); ctx.moveTo(fx - U * 0.22, 0); ctx.lineTo(fx - U * 0.22, -U * 0.75); ctx.lineTo(fx + U * 0.22, -U * 0.75); ctx.lineTo(fx + U * 0.22, 0); ctx.moveTo(fx - U * 0.22, -U * 0.4); ctx.lineTo(fx + U * 0.22, -U * 0.4); ctx.stroke();
  ctx.fillStyle = tone([0, 0, 20]); ctx.beginPath(); ctx.arc(fx - U * 0.22, 0, U * 0.04, 0, TAU); ctx.arc(fx + U * 0.22, 0, U * 0.04, 0, TAU); ctx.fill();
  ctx.restore();
}

/** The card table and its players: the back two seen over it, the front two from behind, a card flying from a seat to the pile on each note. */
function table(ctx, s, X, R, lit) {
  const T = s.table, U = R(0.3 * zScale(T.z)), x = X(T.x), y = R(zY(T.z)), dim = lerp(1, 0.6, T.z) * lit;
  const tone = ([hh, ss, ll], a = 1) => hsla(hh + s.hueShift * 0.3, ss, ll * dim, a);
  const SEAT = [[-0.7, -0.55, 1], [0.7, -0.55, 1], [-0.85, 0.3, 0], [0.85, 0.3, 0]]; // where each seat is (in U) and whether it is behind the table
  ctx.save(); ctx.translate(x, y);
  const player = (k) => {
    const seat = T.seats[k], [sx, sy, back] = SEAT[k], c = seat.c, r = seat.res !== null ? s.residents[seat.res] : null;
    if (!r) { ctx.fillStyle = tone([28, 40, 28]); ctx.fillRect(sx * U - U * 0.22, sy * U - U * 0.9, U * 0.44, U * 0.5); return; } // an empty chair
    ctx.fillStyle = tone([28, 40, 28]); ctx.fillRect(sx * U - U * 0.25, sy * U - U * 0.95, U * 0.5, U * 0.55);
    ctx.fillStyle = tone(c.cardigan); ctx.beginPath(); ctx.roundRect(sx * U - U * 0.28, sy * U - U * 0.9, U * 0.56, U * 0.6, U * 0.1); ctx.fill();
    const reach = seat.reach, ax = sx * U * (1 - 0.65 * reach), ay = sy * U * (1 - 0.6 * reach) - U * 0.55;
    ctx.strokeStyle = tone(c.cardigan); ctx.lineWidth = Math.max(1, U * 0.09); ctx.beginPath(); ctx.moveTo(sx * U - Math.sign(sx) * U * 0.15, sy * U - U * 0.7); ctx.lineTo(ax, ay); ctx.stroke();
    ctx.fillStyle = tone(c.skin); ctx.beginPath(); ctx.arc(ax, ay, U * 0.06, 0, TAU); ctx.fill();
    head(ctx, sx * U, sy * U - U * 1.05, U * 0.15, c, tone, r.turn * 0.2 + (back ? 0 : 0.1 * Math.sign(sx)) + 0.03 * Math.sin(s.t * 0.6 + r.ph), back, back ? 0 : 0);
    if (!back) { ctx.fillStyle = tone(c.hair); ctx.beginPath(); ctx.arc(sx * U, sy * U - U * 1.05, U * 0.15, 0, TAU); ctx.fill(); } // from behind: the back of the head
  };
  player(0); player(1);
  ctx.fillStyle = tone([28, 40, 26]); ctx.fillRect(-U * 0.75, -U * 0.4, U * 0.09, U * 0.42); ctx.fillRect(U * 0.66, -U * 0.4, U * 0.09, U * 0.42); // legs
  ctx.fillStyle = tone([28, 45, 34]); ctx.beginPath(); ctx.ellipse(0, -U * 0.4, U * 1.05, U * 0.42, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = tone([130, 40, 28]); ctx.beginPath(); ctx.ellipse(0, -U * 0.42, U * 0.95, U * 0.36, 0, 0, TAU); ctx.fill(); // the baize
  for (const c of T.cards) { // dealt: it flies from the hand to the pile, spinning as it goes, and lies where it landed
    const [sx, sy] = SEAT[c.seat], f = 1 - (1 - c.f) ** 3, cx = lerp(sx * U * 0.5, c.tx * U, f), cy = lerp(sy * U * 0.5 - U * 0.45, c.ty * U - U * 0.42 - Math.sin(f * Math.PI) * U * 0.2, f);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(c.rot * f); ctx.scale(1, 0.55);
    ctx.fillStyle = tone([45, 20, 92]); ctx.beginPath(); ctx.roundRect(-U * 0.09, -U * 0.13, U * 0.18, U * 0.26, U * 0.02); ctx.fill();
    ctx.fillStyle = hsla(c.hue, 75, 50 * dim); ctx.beginPath(); ctx.arc(0, 0, U * 0.05 * (0.7 + 0.3 * c.g), 0, TAU); ctx.fill();
    ctx.restore();
  }
  player(2); player(3);
  ctx.restore();
}

/** The nurse with the tea trolley, cups rattling with the riser. */
function nurse(ctx, s, X, R, lit) {
  const N = s.nurse, U = R(0.3 * zScale(0.5)), x = X(N.x), y = R(zY(0.5)), dim = 0.8 * lit;
  const tone = ([hh, ss, ll], a = 1) => hsla(hh, ss, ll * dim, a * N.on);
  ctx.save(); ctx.translate(x, y);
  const walk = Math.sin(s.t * 6) * 0.08;
  ctx.strokeStyle = tone([0, 0, 92]); ctx.lineWidth = Math.max(1, U * 0.11); ctx.beginPath(); ctx.moveTo(-U * 0.08, -U * 0.7); ctx.lineTo(-U * 0.1 + walk * U, 0); ctx.moveTo(U * 0.08, -U * 0.7); ctx.lineTo(U * 0.1 - walk * U, 0); ctx.stroke();
  ctx.fillStyle = tone([200, 45, 60]); ctx.beginPath(); ctx.moveTo(-U * 0.3, -U * 0.6); ctx.lineTo(U * 0.3, -U * 0.6); ctx.lineTo(U * 0.22, -U * 1.35); ctx.lineTo(-U * 0.22, -U * 1.35); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tone([0, 0, 96]); ctx.fillRect(-U * 0.18, -U * 1.3, U * 0.36, U * 0.2); // the apron bib
  const c = { skin: SKINS[0], hair: [25, 45, 35], hairStyle: 2, glasses: false };
  head(ctx, 0, -U * 1.5, U * 0.15, c, tone, -0.05, true, -1);
  ctx.fillStyle = tone([0, 0, 98]); ctx.fillRect(-U * 0.12, -U * 1.72, U * 0.24, U * 0.08); // the cap
  ctx.strokeStyle = tone([200, 45, 60]); ctx.lineWidth = Math.max(1, U * 0.09); ctx.beginPath(); ctx.moveTo(-U * 0.2, -U * 1.15); ctx.lineTo(-U * 0.62, -U * 0.85); ctx.stroke(); // the arm to the trolley
  ctx.translate(-U * 1.05, 0); // the trolley ahead of her
  const shake = N.rattle * Math.sin(s.t * 40) * U * 0.02;
  ctx.strokeStyle = tone([210, 10, 70]); ctx.lineWidth = Math.max(1, U * 0.04);
  ctx.beginPath(); ctx.moveTo(-U * 0.4, 0); ctx.lineTo(-U * 0.4, -U * 0.9); ctx.moveTo(U * 0.4, 0); ctx.lineTo(U * 0.4, -U * 0.9); ctx.stroke();
  ctx.fillStyle = tone([210, 10, 70]); ctx.fillRect(-U * 0.45, -U * 0.9, U * 0.9, U * 0.05); ctx.fillRect(-U * 0.45, -U * 0.5, U * 0.9, U * 0.05);
  ctx.fillStyle = tone([0, 0, 20]); ctx.beginPath(); ctx.arc(-U * 0.4, 0, U * 0.05, 0, TAU); ctx.arc(U * 0.4, 0, U * 0.05, 0, TAU); ctx.fill();
  for (let k = 0; k < 4; k++) { ctx.fillStyle = tone([45, 20, 95]); ctx.beginPath(); ctx.arc(-U * 0.3 + k * U * 0.2 + shake * (k % 2 ? 1 : -1), -U * 0.96, U * 0.05, 0, TAU); ctx.fill(); }
  ctx.fillStyle = tone([210, 10, 85]); ctx.beginPath(); ctx.roundRect(-U * 0.2, -U * 0.72, U * 0.3, U * 0.18, U * 0.04); ctx.fill(); // the pot
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
  glasses: rand(s) < 0.5, blanket: rand(s) < 0.6, plaid: PLAIDS[Math.floor(rand(s) * PLAIDS.length)],
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
  if (kind === 'rocker') Object.assign(r, { a: 0, w: 0, nod: 0, period: rand(s) < 0.6 ? 2 : 4, cat: n === 0 && rand(s) < 0.6 ? [[25, 30, 40], [0, 0, 85], [30, 40, 20]][Math.floor(rand(s) * 3)] : null, tail: 0 });
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
  const row = [[0.3, 0.14], [0.7, 0.19], [0.3, 0.72], [0.7, 0.72]]; // two at the front, either side of the table; a third and fourth in a back row by the window and the fire
  by.rocker.forEach((r, i, all) => { [r.x, r.z] = [A * row[i][0], row[i][1]]; r.dir = all.length === 1 ? 1 : r.x < A / 2 ? 1 : -1; });
  by.sleeper.forEach((r, i) => { [r.x, r.z] = [[A * 0.09, 0.62], [A * 0.91, 0.62], [A * 0.5, 0.92]][i]; r.side = i === 1 ? -1 : 1; });
  by.walker.forEach((r, i) => { if (!r.placed) { r.x = A * (0.3 + 0.4 * ((i * 0.37 + 0.2) % 1)); r.to = r.x; r.placed = true; } r.z = 0.42 + i * 0.07; });
  by.player.forEach((r) => { r.x = s.table.x; r.z = s.table.z; });
}
