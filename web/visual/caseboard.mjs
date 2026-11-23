// caseboard: the evidence board of a crime mystery, worked by somebody we never see. A cork board fills the frame and
// the song builds the case on it: a snare pins a new thing up (a suspect's mugshot, a map, a clipping, a sticky note,
// an index card, a snapshot, an evidence bag, a fingerprint card), a melody note runs red yarn from a piece of evidence
// to the suspect it points at (or, when nothing is left to tie, takes the marker to a map or a note: a circle, a route,
// an underline, a question mark, drawn stroke by stroke), the hats are the breeze and the
// handwriting (a gust ripples the papers under their pins, a note fills in a word at a time), the kick thumps the wall
// and swings the lamp, the bass plucks every string, the pad is the air in the room. Like a person, the board is
// worked one thing at a time: now and then a crowded paper is lifted and re-pinned somewhere with more room or nearer
// what it is tied to, and a paper about a dead lead is taken down (nothing ever falls off). The case itself is the long story: every piece of evidence points at one of five
// suspects, more and more of it at the culprit as the song goes on; from half way in the suspects are
// crossed out one by one (their yarn comes down string by string), and in the last bars the marker circles the one
// left, then the stamp lands at the very end. Now and then a boundary changes the light, slowly (a desk lamp, daylight
// through blinds, a fluorescent tube, late amber), and nothing in the room flickers or pulses; the blinds are the one live thing in it (every few bars somebody opens or closes them a little, bumps them so the slats sway, or walks past and a shadow crosses the board); the camera holds the whole board and every four bars leans in a little on the newest
// thing, or back out. A song that loops starts a new case: everything is taken down and the board is worked again. The label on the frame is the song's name (score.name, which the host sets).
// The suspects are limner's people, drawn once each into a cached picture (a face takes limner ~20 ms).
// Deterministic: randomness only from the state's own seeded generator (kit.mjs); draw's texture is a hash.
import { clamp, lerp, decay, ease, hsla, seed, rand, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, characterOf } from './limner.mjs';

const TAU = Math.PI * 2;
export const MAX = 34, SUSPECTS = 5, START = 2; // the board opens with a map and one suspect
const PIN = 0.012; // the pin sits this far under the paper's top edge; an item's x, y is its pin
// kind: width, height (canvas heights), how much the breeze moves it
const KINDS = { map: [0.3, 0.21, 0.2], suspect: [0.105, 0.13, 0.7], snap: [0.115, 0.125, 0.7], note: [0.08, 0.08, 1.4], card: [0.14, 0.088, 0.9], clip: [0.12, 0.165, 1], bag: [0.085, 0.12, 0.6], print: [0.08, 0.1, 0.9], receipt: [0.058, 0.14, 1.3], envelope: [0.14, 0.09, 0.8] };
const EVIDENCE = ['note', 'note', 'note', 'card', 'card', 'clip', 'clip', 'snap', 'snap', 'bag', 'print', 'receipt', 'envelope'];
const WORDS = ['WHO?', 'WHY?', '11:40', 'LIAR', '$$$', '!!', 'ALIBI?', 'CALL', 'KEY', '2 AM']; // what a note says when it says one thing
const WRITTEN = { note: 1, card: 1 };
// the room's light: a multiply tint (h, s, l), how dark the corners go, blinds, where the pool of light sits
const LIGHTS = [
  { h: 38, s: 70, l: 84, dark: 0.6, blinds: 0.18, lx: -0.25, ly: -0.5 }, // desk lamp
  { h: 205, s: 30, l: 90, dark: 0.3, blinds: 0.5, lx: 0.5, ly: -0.3 }, // daylight through blinds
  { h: 150, s: 14, l: 92, dark: 0.35, blinds: 0, lx: 0, ly: -0.7 }, // fluorescent tube
  { h: 26, s: 60, l: 76, dark: 0.75, blinds: 0.3, lx: 0.3, ly: -0.4 }, // late, amber
];
const TEMP = { warm: 0, cool: 1, pale: 2, dim: 3 };
const NOTE_COLS = [[52, 92, 72], [338, 80, 80], [195, 70, 78], [95, 55, 74]];
const PIN_COLS = [[2, 80, 48], [48, 90, 55], [212, 70, 50], [130, 50, 42], [0, 0, 92]];
const YARN = [[358, 82, 46], [4, 88, 54], [350, 70, 34], [12, 80, 48], [342, 75, 50]]; // a few balls of red: crimson, scarlet, maroon, brick, rose
const INK = [[2, 78, 44], [230, 25, 16], [218, 70, 38]]; // marker red, black, biro blue

const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
const smooth = (u) => u * u * (3 - 2 * u);
const byId = (s, id) => s.items.find((i) => i.id === id) ?? null;
const up = (it) => it.st === 'on' || it.st === 'move'; // on the board, pin in or in the hand
const counted = (it) => it.st !== 'off';
const alive = (s) => [...Array(SUSPECTS).keys()].filter((i) => !s.dead.includes(i));

/** How much a paper of w x h pinned at (x, y) would cover the others (padded a little: touching is crowding). */
function crowd(s, x, y, w, h, skip) {
  let c = 0;
  for (const o of s.items) {
    if (o.id === skip || !counted(o)) continue;
    const ox = Math.min(x + w / 2, o.x + o.w / 2) - Math.max(x - w / 2, o.x - o.w / 2) + 0.012, oy = Math.min(y + h, o.y + o.h) - Math.max(y, o.y) + 0.012;
    if (ox > 0 && oy > 0) c += ox * oy * (o.who >= 0 ? 4 : 1);
  }
  return c;
}
/** The best of sixty tries for a paper: least crowded (so papers overlap only when the board is full), and, with `near`, not far from that item. */
function place(s, w, h, skip = null, near = null) {
  let best = null;
  for (let i = 0; i < 60; i++) {
    const x = lerp(-s.bw + w / 2 + 0.01, s.bw - w / 2 - 0.01, rand(s)), y = lerp(-s.bh + 0.03, s.bh - h, rand(s));
    const c = crowd(s, x, y, w, h, skip) + (near ? 0.004 * Math.hypot(x - near.x, y - near.y) : 0);
    if (!best || c < best.c) best = { x, y, c };
  }
  return best;
}

function newCase(s) {
  s.made = 0; s.dead = []; s.fin = 0; s.stamp = 0; s.culprit = Math.floor(rand(s) * SUSPECTS); s.caseNo = 100 + Math.floor(rand(s) * 900);
}
/** The next thing to go up: the first map, the five suspects among the first ten, a second map, evidence. */
function kindFor(s) {
  const n = s.made++;
  if (n === 0 || n === 11) return ['map', -1];
  const who = [1, 2, 4, 6, 8].indexOf(n);
  return who >= 0 ? ['suspect', who] : [EVIDENCE[Math.floor(rand(s) * EVIDENCE.length)], -1];
}
function addItem(s, st = 'in') {
  const [kind, who] = kindFor(s), size = who >= 0 || kind === 'map' ? 1 : lerp(0.86, 1.18, rand(s)), stretch = kind === 'envelope' ? lerp(0.8, 1.25, rand(s)) : 1, [w, h] = [KINDS[kind][0] * size * stretch, (KINDS[kind][1] * size) / stretch], at = place(s, w, h), live = alive(s);
  const it = {
    id: ++s.ids, kind, w, h, x: at.x, y: at.y, cx: at.x, cy: at.y, fx: at.x, fy: at.y, k: 1, al: st === 'on' ? 1 : 0, st, u: 0,
    rest: (rand(s) - 0.5) * (kind === 'map' ? 0.03 : 0.16), a: 0, va: 0, z: ++s.z,
    sd: Math.floor(rand(s) * 1e6), who, pin: Math.floor(rand(s) * PIN_COLS.length), col: Math.floor(rand(s) * NOTE_COLS.length),
    about: kind === 'map' || who >= 0 ? -1 : rand(s) < 0.25 + 0.5 * s.p && live.includes(s.culprit) ? s.culprit : live[Math.floor(rand(s) * live.length)],
    ink: WRITTEN[kind] ? (st === 'on' ? 1 : 0.15) : 1, char: who >= 0 ? characterOf(s, 'none', 0.3) : null,
  };
  it.a = it.rest;
  s.items.push(it); s.last = it.id;
  return it;
}

/** Red yarn from the newest untied evidence to its suspect's photo; failing that to other evidence about them, or a map. */
function link(s) {
  const tied = new Set(s.yarn.map((y) => y.a));
  const from = s.items.filter((i) => i.st === 'on' && i.about >= 0 && !s.dead.includes(i.about) && !tied.has(i.id)).sort((a, b) => b.z - a.z)[0];
  if (!from) return false;
  const on = s.items.filter((i) => i.st === 'on' && i.id !== from.id);
  const to = on.find((i) => i.who === from.about) ?? on.find((i) => i.about === from.about) ?? on.find((i) => i.kind === 'map');
  if (!to) return false;
  s.yarn.push({ a: from.id, b: to.id, u: 0, al: 1, die: null, pl: 0, ph: rand(s) * TAU, sag: lerp(0.03, 0.1, rand(s)), c: Math.floor(rand(s) * YARN.length) });
  s.last = from.id;
  return true;
}
const untied = (s) => { const tied = new Set(s.yarn.map((y) => y.a)); return s.items.filter((i) => i.st === 'on' && i.about >= 0 && !s.dead.includes(i.about) && !tied.has(i.id)).length; };

/** The marker: a circle or a route on a map, or an underline, a question mark, a tick or a ring on a paper. */
function addMark(s) {
  const on = s.items.filter((i) => i.st === 'on'), maps = on.filter((i) => i.kind === 'map'), rest = on.filter((i) => i.kind !== 'map' && i.kind !== 'suspect');
  const onMap = maps.length && (rand(s) < 0.5 || !rest.length), pool = onMap ? maps : rest;
  if (!pool.length) return false;
  const it = pool[Math.floor(rand(s) * pool.length)], m = { id: it.id, kind: 'circle', x: lerp(0.15, 0.85, rand(s)), y: lerp(0.2, 0.8, rand(s)), x2: 0, y2: 0, r: lerp(0.016, 0.03, rand(s)), ry: 0, turns: 1.12, u: 0, col: 0, sd: Math.floor(rand(s) * 1000) };
  if (onMap) {
    const spots = s.marks.filter((k) => k.id === it.id && k.kind === 'circle');
    if (spots.length >= 2 && rand(s) < 0.45) { const a = spots[Math.floor(rand(s) * spots.length)], b = spots[Math.floor(rand(s) * spots.length)]; if (a !== b) Object.assign(m, { kind: 'route', x: a.x, y: a.y, x2: b.x, y2: b.y }); }
  } else {
    m.kind = ['under', 'under', 'q', 'tick', 'circle'][Math.floor(rand(s) * 5)]; m.col = rand(s) < 0.6 ? 0 : 1 + Math.floor(rand(s) * 2);
    if (m.kind === 'circle') { m.x = 0.5; m.y = 0.5; m.r = it.w * 0.42; m.ry = it.h * 0.42; }
  }
  s.marks.push(m); s.last = it.id;
  return true;
}

/** Cross a suspect out: the one with the least yarn who is not the culprit. Their strings come down one by one. */
function eliminate(s) {
  const photo = (w) => s.items.find((i) => i.who === w && counted(i)), strings = (w) => { const p = photo(w); return p ? s.yarn.filter((y) => y.b === p.id).length : 0; };
  const out = alive(s).filter((w) => w !== s.culprit).sort((a, b) => strings(a) - strings(b))[0];
  if (out === undefined) return;
  s.dead.push(out);
  const p = photo(out); if (!p) return;
  s.marks.push({ id: p.id, kind: 'x', x: 0.5, y: 0.45, x2: 0, y2: 0, r: 0.038, ry: 0, turns: 1, u: 0, col: 0, sd: p.sd % 1000 });
  let n = 0; for (const y of s.yarn) if ((y.b === p.id || byId(s, y.a)?.about === out) && y.die === null) y.die = 0.6 + 0.45 * n++;
  s.last = p.id; focus(s, p, 1.3);
}

function move(s, it, at) { Object.assign(it, { fx: it.cx, fy: it.cy, x: at.x, y: at.y, st: 'move', u: 0, z: ++s.z }); s.last = it.id; }
/** One paper lifted and re-pinned: the most crowded one to where there is room, else a tied one nearer what it is tied to. */
function tidy(s) {
  if (s.items.some((i) => i.st === 'move')) return;
  const on = s.items.filter((i) => i.st === 'on' && i.kind !== 'map');
  let worst = null, wc = 0.0003;
  for (const it of on) { const c = crowd(s, it.x, it.y, it.w, it.h, it.id); if (c > wc) { wc = c; worst = it; } }
  if (worst) { const at = place(s, worst.w, worst.h, worst.id); if (at.c < 0.5 * wc) move(s, worst, at); return; }
  const far = s.yarn.filter((y) => y.die === null).map((y) => [byId(s, y.a), byId(s, y.b)]).filter(([a, b]) => a?.st === 'on' && b && Math.hypot(a.x - b.x, a.y - b.y) > 0.55);
  if (far.length && rand(s) < 0.5) { const [a, b] = far[Math.floor(rand(s) * far.length)], at = place(s, a.w, a.h, a.id, b); if (Math.hypot(at.x - b.x, at.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y)) move(s, a, at); }
}
/** A paper about a suspect already crossed out, with no yarn left on it, comes down. */
function takeDown(s) {
  const it = s.items.find((i) => i.st === 'on' && i.about >= 0 && s.dead.includes(i.about) && !s.yarn.some((y) => y.a === i.id || y.b === i.id));
  if (it) { it.st = 'off'; it.u = 0; }
}
/** Lean in on an item (the whole frame stays on the wall), or back out to the whole board. */
function focus(s, it, z) {
  if (!it) { s.camTo = { x: 0, y: 0, z: 1 }; return; }
  const mx = (s.aspect / 2) * (1 - 1 / z), my = 0.5 * (1 - 1 / z);
  s.camTo = { x: clamp(it.x, -mx, mx), y: clamp(it.y + it.h / 2, -my, my), z };
}

export default {
  name: 'caseboard',

  init(score, rng, size) {
    const aspect = size?.w && size?.h ? size.w / size.h : 16 / 9;
    const s = {
      t: 0, total: score.total ?? 0, name: score.name ?? null, aspect, bw: aspect / 2 - 0.07, bh: 0.42, p: 0,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      items: [], yarn: [], marks: [], ids: 0, z: 0, last: 0, made: 0, dead: [], fin: 0, stamp: 0, stampY: 0.12, culprit: 0, caseNo: 0,
      beatNo: -1, energy: 0.5, dark: 0, riser: 0, air: 0, gust: 0, wind: 0, shake: 0, side: 1,
      slat: 0.04, slatTo: 0.04, bump: 0, pass: 9, // the blinds: how closed (a slat's shadow, of a 0.09 pitch), how hard they sway, where the passing shadow is (9: nobody)
      lamp: { x: 0, v: 0 }, lightTo: TEMP[score.palette?.temperature] ?? 0, li: null,
      cam: { x: 0, y: 0, z: 1 }, camTo: { x: 0, y: 0, z: 1 },
    };
    seed(s, rng);
    s.li = { ...LIGHTS[s.lightTo] };
    newCase(s);
    for (let i = 0; i < START; i++) addItem(s, 'on');
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const p = s.total > 0 ? clamp(clock.cycle / s.total) : clamp(s.t / 180);
    if (p < s.p - 0.5) { // the song came round again: the old case is taken down and a new one starts
      for (const it of s.items) if (it.st !== 'off') { it.st = 'off'; it.u = 0; }
      s.yarn = []; s.marks = []; newCase(s); s.camTo = { x: 0, y: 0, z: 1 };
    }
    s.p = p;
    s.energy = ease(s.energy, clock.energy, 1.5, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    const still = 1 - 0.8 * s.dark, E = s.energy, count = () => s.items.filter(counted).length;
    const itemsT = Math.min(MAX, Math.round(START + (MAX - START) * p ** 0.6)), marksT = Math.round(1 + 16 * p);

    if (clock.boundary && rand(s) < 0.5) s.lightTo = (s.lightTo + 1 + Math.floor(rand(s) * (LIGHTS.length - 1))) % LIGHTS.length; // now and then the light in the room changes, slowly
    const beatNo = (clock.index + 1) * 1e5 + clock.bar * clock.beats + clock.beat;
    if (beatNo !== s.beatNo) { // the work that does not wait for a hit: a song without a snare still builds its case
      const first = s.beatNo < 0; s.beatNo = beatNo;
      const due = p < 0.5 ? 0 : Math.min(SUSPECTS - 1, 1 + Math.floor((p - 0.5) / (0.48 / (SUSPECTS - 1)))); // at .5, .62, .74, .86
      if (!s.fin && !first) {
        if (count() < itemsT - 2) addItem(s);
        if (untied(s) >= 3) link(s);
        if (s.dead.length < due && !s.yarn.some((y) => y.die !== null)) eliminate(s);
        else if (clock.beat === 0) {
          tidy(s); if (clock.bar % 2 && rand(s) < 0.5) takeDown(s);
          if (s.marks.length < marksT - 2) addMark(s);
          if (clock.bar % 4 === 2 && rand(s) < 0.6) { // the window: somebody opens or closes the blinds a little, bumps them, or walks past
            const k = rand(s);
            if (k < 0.4) s.slatTo = lerp(0.015, 0.07, rand(s)); else if (k < 0.75) s.bump = 1; else if (s.pass > 2) s.pass = -2;
          }
          if (clock.bar % 4 === 0) focus(s, rand(s) < 0.4 ? null : byId(s, s.last), lerp(1.12, 1.4, rand(s)));
        }
      }
    }

    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5) * still;
      if (e.role === 'impact') { // a snare pins something up; with the board full it rattles one
        s.shake = Math.min(1, s.shake + 0.1 * g);
        if (!s.fin && count() < itemsT) addItem(s);
        else {
          const on = s.items.filter((i) => i.st === 'on'), it = on[Math.floor(rand(s) * on.length)];
          if (it) it.va += (rand(s) < 0.5 ? -1 : 1) * (1.5 + 2 * E) * g;
        }
      } else if (e.role === 'grain' || (slot === 'grain' && e.note === null)) { // hats: a gust, and a word on the newest note
        s.gust = Math.min(1.5, s.gust + 0.3 * g);
        const on = s.items.filter(up), it = on[Math.floor(rand(s) * on.length)]; if (it) it.va += (rand(s) - 0.5) * 1.2 * g * KINDS[it.kind][2];
        const w = s.items.findLast((i) => i.ink < 1 && up(i)); if (w) w.ink = Math.min(1, w.ink + 0.07);
      } else if (slot === 'ground' || (e.note !== null && e.note < 48 && slot !== 'line' && slot !== 'counter' && slot !== 'field')) { // the bass plucks the yarn
        for (const y of s.yarn) y.pl = Math.min(0.012, y.pl + 0.004 * g);
      } else if (slot === 'field') s.air = Math.min(1, s.air + 0.25 * g);
      else if (slot === 'transition') s.gust = Math.min(1.5, s.gust + 0.6 * g);
      else if (e.note !== null) { // a line: tie something, else mark something; its pitch plucks one string
        if (!s.fin && !link(s) && s.marks.length < marksT) addMark(s);
        if (s.yarn.length) s.yarn[e.note % s.yarn.length].pl = 0.016;
      } else { // a kick, or any other thump: the wall takes it and the lamp swings
        s.side = -s.side; s.lamp.v += 0.08 * g * s.side; s.shake = Math.min(1, s.shake + 0.12 * g);
        const it = byId(s, s.last); if (it && up(it)) it.va += 0.5 * g * s.side;
      }
    }

    // the room
    s.air = decay(s.air, 0.4, dt); s.gust = decay(s.gust, 2.5, dt); s.shake = decay(s.shake, 6, dt);
    s.wind = (0.12 + 0.5 * s.air + 0.8 * s.riser + s.gust) * still;
    s.slat = ease(s.slat, s.slatTo, 0.8, dt); s.bump = decay(s.bump, 0.5, dt); if (s.pass < 3) s.pass += dt * 0.55;
    s.lamp.v += (-5 * s.lamp.x - 0.5 * s.lamp.v) * dt; s.lamp.x += s.lamp.v * dt;
    const L = LIGHTS[s.fin === 2 ? 0 : s.lightTo]; for (const k of Object.keys(s.li)) s.li[k] = ease(s.li[k], L[k], 0.2, dt);
    s.cam.x = ease(s.cam.x, s.camTo.x, 0.9, dt); s.cam.y = ease(s.cam.y, s.camTo.y, 0.9, dt); s.cam.z = ease(s.cam.z, s.camTo.z, 0.9, dt);

    // the papers
    for (const it of s.items) {
      if (it.st === 'in') { it.u = Math.min(1, it.u + dt / 0.45); const e = 1 - (1 - it.u) ** 3; it.cx = it.x; it.cy = it.y + (1 - e) * 0.12; it.k = 1 + (1 - e) * 0.35; it.al = Math.min(1, it.u * 3); if (it.u >= 1) { it.st = 'on'; s.shake = Math.min(1, s.shake + 0.25); it.va += s.side; } }
      else if (it.st === 'move') { it.u = Math.min(1, it.u + dt / 0.8); const e = smooth(it.u); it.cx = lerp(it.fx, it.x, e); it.cy = lerp(it.fy, it.y, e); it.k = 1 + 0.07 * Math.sin(Math.PI * it.u); if (it.u >= 1) { it.st = 'on'; s.shake = Math.min(1, s.shake + 0.15); } }
      else if (it.st === 'off') { it.u = Math.min(1, it.u + dt / 0.5); it.k = 1 + 0.35 * it.u; it.al = 1 - it.u; it.cy = it.y + 0.1 * it.u * it.u; if (it.u >= 1) it.st = 'gone'; }
      else { it.cx = it.x; it.cy = it.y; it.k = 1; it.al = 1; }
      const torque = KINDS[it.kind][2] * s.wind * Math.sin(s.t * (1.3 + (it.sd % 7) * 0.12) + it.sd + it.x * 4);
      it.va += (-60 * (it.a - it.rest) - 5 * it.va + 12 * torque) * dt; it.a += it.va * dt;
    }
    if (s.items.some((i) => i.st === 'gone')) { s.items = s.items.filter((i) => i.st !== 'gone'); s.marks = s.marks.filter((m) => byId(s, m.id)); }
    for (const y of s.yarn) {
      const a = byId(s, y.a), b = byId(s, y.b);
      if (y.die === null && (!a || !b || !up(a) || !up(b))) y.die = 0;
      if (y.die !== null && (y.die -= dt) < 0) y.al -= dt * 2.5;
      y.u = Math.min(1, y.u + dt * 2.5); y.ph += dt * 55; y.pl = decay(y.pl, 3, dt);
    }
    s.yarn = s.yarn.filter((y) => y.al > 0);
    for (const m of s.marks) m.u = Math.min(1, m.u + dt * (m.turns > 2 ? 0.45 : 1.6));

    // the solve: the marker goes round the one left, then the stamp
    if (p >= 0.94 && s.fin === 0) {
      s.fin = 1;
      for (const w of alive(s)) if (w !== s.culprit) eliminate(s);
      const c = s.items.find((i) => i.who === s.culprit && counted(i));
      if (c) { c.z = ++s.z; s.stampY = c.y + c.h / 2 > 0 ? -0.17 : 0.17; s.marks.push({ id: c.id, kind: 'circle', x: 0.5, y: 0.5, x2: 0, y2: 0, r: c.w * 0.43, ry: c.h * 0.43, turns: 2.6, u: 0, col: 0, sd: 7 }); focus(s, c, 1.5); }
    }
    if (p >= 0.98 && s.fin === 1) { s.fin = 2; s.shake = 1; focus(s, null); }
    s.stamp = s.fin === 2 ? Math.min(1, s.stamp + dt * 6) : 0;
  },

  draw(s, ctx, w, h) {
    const U = Math.min(h, w / s.aspect), L = s.li, items = [...s.items].sort((a, b) => a.z - b.z), at = Object.fromEntries(items.map((i) => [i.id, i]));
    const jx = s.shake * 0.006 * Math.sin(s.t * 71), jy = s.shake * 0.006 * Math.cos(s.t * 53);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = 'hsl(200 14% 34%)'; ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2); ctx.scale(U * s.cam.z, U * s.cam.z); ctx.translate(-s.cam.x + jx, -s.cam.y + jy + 0.004 * Math.sin(s.t * 0.3));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    board(ctx, s);
    for (const it of items) paper(ctx, s, it);
    // the yarn, over the papers, pin to pin
    for (let i = 0; i < s.yarn.length; i++) {
      const y = s.yarn[i], a = at[y.a], b = at[y.b]; if (!a || !b) continue;
      const ex = lerp(a.cx, b.cx, y.u), ey = lerp(a.cy, b.cy, y.u), len = Math.hypot(ex - a.cx, ey - a.cy) || 1;
      const vib = y.pl * Math.sin(y.ph) + s.wind * 0.004 * Math.sin(s.t * 2.1 + i), nx = -(ey - a.cy) / len, ny = (ex - a.cx) / len;
      const qx = (a.cx + ex) / 2 + nx * vib * 2, qy = (a.cy + ey) / 2 + y.sag * len * 0.5 + ny * vib * 2;
      const [yh, ys, yl] = YARN[y.c];
      for (const [wd, col] of [[0.0052, [yh, ys, yl * 0.45]], [0.003, [yh, ys, yl]]]) { ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.quadraticCurveTo(qx, qy, ex, ey); ctx.strokeStyle = hsla(...col, y.al); ctx.lineWidth = wd; ctx.stroke(); }
    }
    for (const it of items) if (it.st === 'on') for (const dx of it.kind === 'map' ? [-it.w * 0.42, it.w * 0.42] : [0]) pin(ctx, it.cx + dx * Math.cos(it.rest), it.cy + dx * Math.sin(it.rest), PIN_COLS[it.pin]);
    if (s.stamp > 0.01) stamp(ctx, s);
    // the light: a tint on everything, blinds, a pool that swings with the lamp, the dark
    const R = 3;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hsla(L.h, L.s, L.l); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.rotate(-0.16);
    if (L.blinds > 0.02) { // each slat's shadow sways on its own phase after a bump, so the blind swings like a hanging thing
      ctx.fillStyle = `rgba(6 8 16 / ${0.3 * L.blinds})`;
      for (let i = -14; i < 14; i++) ctx.fillRect(-R, i * 0.09 + 0.004 * Math.sin(s.t * 0.4) + s.bump * 0.014 * Math.sin(s.t * 5 + i * 0.7), 2 * R, s.slat);
    }
    if (s.pass < 2) { ctx.fillStyle = 'rgba(6 8 16 / 0.09)'; for (const wd of [0.5, 0.36, 0.22]) ctx.fillRect(s.pass - wd / 2, -R, wd, 2 * R); } // somebody crosses the light: a soft band, darker toward its middle
    ctx.restore();
    const lx = L.lx + s.lamp.x * 0.2, g = ctx.createRadialGradient(lx, L.ly, 0.2, lx, L.ly, 1.5);
    g.addColorStop(0, 'rgba(8 6 14 / 0)'); g.addColorStop(1, `rgba(8 6 14 / ${clamp(L.dark)})`);
    ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.55 * s.dark})`; ctx.fillRect(-R, -R, 2 * R, 2 * R); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
};

// --- drawing ---
const fill = (ctx, c, a = 1) => { ctx.fillStyle = hsla(...c, a); ctx.fill(); };
const rect = (ctx, x, y, w, h, c, a = 1) => { ctx.fillStyle = hsla(...c, a); ctx.fillRect(x, y, w, h); };
const line = (ctx, pts, c, wd, a = 1) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = hsla(...c, a); ctx.lineWidth = wd; ctx.stroke(); };

function board(ctx, s) {
  const bw = s.bw + 0.03, bh = s.bh + 0.04;
  rect(ctx, -bw - 0.012, -bh - 0.006, 2 * bw + 0.03, 2 * bh + 0.03, [0, 0, 0], 0.3); // its shadow on the wall
  rect(ctx, -bw, -bh, 2 * bw, 2 * bh, [28, 46, 50]);
  for (const lightOnes of [0, 1]) { // the cork's flecks, one path a tone
    ctx.beginPath();
    for (let i = 0; i < 260; i++) if (!(i % 3) === !!lightOnes) ctx.rect(lerp(-bw, bw, hash(i, 1)), lerp(-bh, bh, hash(i, 2)), 0.004 + 0.008 * hash(i, 3), 0.004);
    fill(ctx, lightOnes ? [34, 50, 62] : [24, 50, 40], 0.5);
  }
  ctx.strokeStyle = 'hsl(22 45% 22%)'; ctx.lineWidth = 0.028; ctx.strokeRect(-bw, -bh, 2 * bw, 2 * bh);
  ctx.strokeStyle = 'hsl(26 45% 36%)'; ctx.lineWidth = 0.005; ctx.strokeRect(-bw - 0.008, -bh - 0.008, 2 * bw + 0.016, 2 * bh + 0.016);
  // the case label, taped to the top of the frame
  const label = s.name ? String(s.name).replace(/[-_.]+/g, ' ').toUpperCase() : `CASE ${s.caseNo}`, lw = Math.max(0.15, label.length * 0.0135 + 0.04); // the song is the case
  rect(ctx, -lw / 2, -bh - 0.016, lw, 0.034, [44, 40, 80]);
  text(ctx, label, 0, -bh + 0.002, 0.022, 'monospace', 'hsl(230 25% 16%)');
}
/** Text `size` canvas heights tall: set in a 1000x frame, since a font under a pixel is not a size a canvas keeps. */
function text(ctx, str, x, y, size, face, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  ctx.fillStyle = col; ctx.font = `bold 100px ${face}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, 0, 0);
  ctx.restore();
}

function pin(ctx, x, y, c) {
  ctx.beginPath(); ctx.arc(x + 0.003, y + 0.004, 0.0065, 0, TAU); fill(ctx, [0, 0, 0], 0.3);
  ctx.beginPath(); ctx.arc(x, y, 0.0065, 0, TAU); fill(ctx, c);
  ctx.beginPath(); ctx.arc(x - 0.002, y - 0.002, 0.002, 0, TAU); fill(ctx, [0, 0, 100], 0.7);
}

/** Handwriting: rows of wavy words, as many of them as the ink has got to. */
function scribble(ctx, x0, y0, x1, rows, gap, ink, sd, col) {
  const words = [];
  for (let r = 0; r < rows; r++) for (let x = x0, k = 0; x < x1 - 0.008; k++) { const len = Math.min(x1 - x, (0.2 + 0.4 * hash(sd + r, k)) * (x1 - x0)); words.push([x, y0 + r * gap, len]); x += len + 0.008; }
  const n = Math.floor(ink * words.length + 1e-6);
  ctx.beginPath(); // one path for the whole note
  for (let i = 0; i < n; i++) { const [x, y, len] = words[i]; for (let j = 0; j < 7; j++) { const px = x + (len * j) / 6, py = y + (j % 2 ? -1 : 1) * gap * 0.16 * (0.5 + hash(sd + i, j)); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); } }
  ctx.strokeStyle = hsla(...col); ctx.lineWidth = 0.0016; ctx.stroke();
}

/** One paper in its own frame: the pin at the origin. */
function paper(ctx, s, it) {
  // a pinned paper does not swing: it stays at its angle and the wind lifts its free end (`a - rest` is that lift: the
  // sheet shears and foreshortens away from the pin, which stays put, and its shadow opens under it)
  const { w, h, sd } = it, X = (f) => -w / 2 + f * w, Y = (f) => -PIN + f * h, lift = it.a - it.rest, so = 0.005 + (it.k - 1) * 0.12 + Math.min(0.012, Math.abs(lift) * 0.05);
  ctx.save(); ctx.translate(it.cx, it.cy); ctx.scale(it.k, it.k); ctx.rotate(it.rest); ctx.transform(1, 0, lift * 0.3, 1 - Math.min(0.1, Math.abs(lift) * 0.45), 0, 0); ctx.globalAlpha = it.al;
  rect(ctx, X(0) + so, Y(0) + so * 1.4, w, h, [0, 0, 0], 0.3);
  const R = (x0, y0, x1, y1, c, a) => rect(ctx, X(x0), Y(y0), (x1 - x0) * w, (y1 - y0) * h, c, a), dark = [230, 20, 18];
  if (it.kind === 'note') {
    R(0, 0, 1, 1, NOTE_COLS[it.col]); R(0, 0, 1, 0.14, [0, 0, 0], 0.06);
    if (sd % 3 === 0) { const word = WORDS[sd % WORDS.length]; if (it.ink >= 0.5) text(ctx, word, X(0.5), Y(0.56), Math.min(h * 0.42, (w * 1.35) / word.length), 'cursive', hsla(...INK[sd % 2 ? 0 : 1])); }
    else scribble(ctx, X(0.12), Y(0.34), X(0.9), 4, h * 0.16, it.ink, sd, INK[1 + sd % 2]);
  }
  else if (it.kind === 'card') {
    const v = sd % 3;
    R(0, 0, 1, 1, v === 0 ? [48, 30, 93] : v === 1 ? [38, 50, 74] : [54, 85, 80]);
    if (v === 0) R(0, 0.2, 1, 0.215, [0, 70, 60], 0.7);
    if (v !== 1) for (let i = 1; i < 5; i++) R(0, 0.2 + i * 0.16, 1, 0.207 + i * 0.16, [205, 50, 65], 0.5);
    if (v === 2) R(0.12, 0, 0.127, 1, [0, 70, 60], 0.7);
    scribble(ctx, X(v === 2 ? 0.16 : 0.06), Y(0.31), X(0.94), 4, h * 0.16, it.ink, sd, INK[1 + sd % 2]);
  } else if (it.kind === 'receipt') {
    R(0, 0, 1, 1, [50, 8, 95]); R(0.2, 0.05, 0.8, 0.09, dark, 0.8);
    for (let i = 0; i < 8; i++) { const y = 0.16 + i * 0.075; R(0.1, y, 0.3 + 0.3 * hash(sd, i), y + 0.018, dark, 0.5); R(0.72, y, 0.9, y + 0.018, dark, 0.5); }
    R(0.1, 0.78, 0.9, 0.785, dark, 0.4); R(0.1, 0.83, 0.4, 0.86, dark, 0.85); R(0.62, 0.83, 0.9, 0.86, dark, 0.85);
  } else if (it.kind === 'envelope') { // four papers, three flaps, an address or a window, one stamp or two, sometimes a word across it
    const v = sd % 4, flap = (sd >> 2) % 3, win = (sd >> 4) % 3 === 0, paperCol = [[38, 32, 82], [0, 0, 95], [205, 35, 84], [30, 45, 68]][v];
    R(0, 0, 1, 1, paperCol);
    if (v === 1) for (let i = 0; i < 14; i++) { R(i / 14, 0, (i + 0.5) / 14, 0.07, i % 2 ? [2, 70, 50] : [215, 60, 45]); R(i / 14, 0.93, (i + 0.5) / 14, 1, i % 2 ? [215, 60, 45] : [2, 70, 50]); } // airmail
    const edge = [paperCol[0], paperCol[1], paperCol[2] - 22];
    if (flap === 0) line(ctx, [[X(0), Y(0)], [X(0.5), Y(0.55)], [X(1), Y(0)]], edge, 0.0016);
    else if (flap === 1) line(ctx, [[X(0), Y(0.3)], [X(1), Y(0.3)]], edge, 0.0016);
    else { line(ctx, [[X(0), Y(0)], [X(0.5), Y(0.34)], [X(1), Y(0)]], edge, 0.0016); line(ctx, [[X(0), Y(1)], [X(0.5), Y(0.5)], [X(1), Y(1)]], edge, 0.0012); }
    for (let i = 0; i <= (sd >> 6) % 2; i++) R(0.8 - i * 0.15, 0.1, 0.93 - i * 0.15, 0.36, [[2, 60, 50], [212, 50, 45], [130, 40, 40], [45, 80, 50]][(sd + i) % 4]);
    ctx.strokeStyle = hsla(...dark, 0.5); ctx.lineWidth = 0.0014; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X(0.72), Y(0.24), h * (0.1 + 0.04 * i), 0, TAU); ctx.stroke(); }
    if (win) { R(0.12, 0.55, 0.6, 0.85, [200, 20, 96]); scribble(ctx, X(0.16), Y(0.66), X(0.56), 2, h * 0.1, 1, sd, INK[1]); }
    else scribble(ctx, X(0.3), Y(0.62), X(0.72), 2 + (sd >> 7) % 2, h * 0.12, 1, sd, INK[1 + sd % 2]);
    if ((sd >> 8) % 3 === 0) { ctx.save(); ctx.translate(X(0.3), Y(0.3)); ctx.rotate(-0.2); text(ctx, ['URGENT', 'PRIVATE', 'RETURN', 'OPENED'][(sd >> 10) % 4], 0, 0, h * 0.17, 'Impact, sans-serif', 'hsl(2 75% 45% / 0.8)'); ctx.restore(); }
  }
  else if (it.kind === 'clip') {
    const v = sd % 3, two = (sd >> 2) % 2;
    R(0, 0, 1, 1, [[44, 22, 84], [36, 26, 76], [52, 14, 90]][(sd >> 3) % 3]); R(0.07, 0.06, 0.93, 0.13, dark); if (two) R(0.07, 0.15, 0.7, 0.2, dark);
    const body = (x0, x1, y0, n, k) => { for (let r = 0; r < n; r++) { const y = y0 + r * 0.044; R(x0, y, x0 + (x1 - x0) * (0.6 + 0.4 * hash(sd + k, r)), y + 0.014, dark, 0.55); } };
    const photo = (x0, y0, x1, y1) => { R(x0, y0, x1, y1, [40, 8, 45]); R(lerp(x0, x1, 0.12), lerp(y0, y1, 0.35), lerp(x0, x1, 0.5), y1, [40, 8, 30]); R(lerp(x0, x1, 0.5), lerp(y0, y1, 0.2), lerp(x0, x1, 0.9), y1, [40, 8, 36]); };
    if (v === 0) { photo(0.07, 0.25, 0.52, 0.5); body(0.07, 0.5, 0.55, 9, 0); body(0.57, 0.93, 0.26, 16, 1); }
    else if (v === 1) { photo(0.07, 0.25, 0.93, 0.56); body(0.07, 0.47, 0.6, 8, 0); body(0.53, 0.93, 0.6, 8, 1); }
    else for (let c = 0; c < 3; c++) body(0.07 + c * 0.3, 0.33 + c * 0.3, 0.26, 16, c);
  } else if (it.kind === 'map') map(ctx, it, X, Y, R);
  else if (it.kind === 'bag') {
    R(0, 0, 1, 1, [200, 30, 88], 0.6); ctx.strokeStyle = 'hsl(200 20% 70%)'; ctx.lineWidth = 0.002; ctx.strokeRect(X(0), Y(0), w, h);
    R(0, 0, 1, 0.16, [2, 75, 46]); R(0.1, 0.22, 0.9, 0.42, [0, 0, 97]); R(0.15, 0.28, 0.6, 0.3, dark, 0.6); R(0.15, 0.35, 0.75, 0.37, dark, 0.6);
    const cx = X(0.5), cy = Y(0.7), o = sd % 4, brass = [42, 60, 48];
    if (o === 0) { ctx.beginPath(); ctx.arc(cx - 0.012, cy, 0.011, 0, TAU); ctx.strokeStyle = hsla(...brass); ctx.lineWidth = 0.005; ctx.stroke(); line(ctx, [[cx, cy], [cx + 0.03, cy], [cx + 0.03, cy + 0.008]], brass, 0.005); line(ctx, [[cx + 0.02, cy], [cx + 0.02, cy + 0.008]], brass, 0.004); } // a key
    else if (o === 1) { rect(ctx, cx - 0.006, cy - 0.016, 0.012, 0.03, brass); rect(ctx, cx - 0.007, cy + 0.012, 0.014, 0.004, [42, 50, 34]); } // a casing
    else if (o === 2) { ctx.beginPath(); ctx.arc(cx, cy, 0.012, 0, TAU); ctx.strokeStyle = hsla(48, 80, 58); ctx.lineWidth = 0.004; ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - 0.014, 0.005, 0, TAU); fill(ctx, [190, 70, 75]); } // a ring
    else { rect(ctx, cx - 0.016, cy - 0.012, 0.032, 0.026, [355, 65, 38]); rect(ctx, cx - 0.016, cy + 0.006, 0.032, 0.004, [40, 30, 20]); } // a matchbook
  } else if (it.kind === 'print') {
    R(0, 0, 1, 1, [50, 15, 95]); R(0.1, 0.8, 0.9, 0.82, dark, 0.5); R(0.1, 0.88, 0.6, 0.9, dark, 0.5);
    ctx.strokeStyle = hsla(...dark, 0.75); ctx.lineWidth = 0.0016;
    for (let i = 1; i <= 7; i++) { ctx.beginPath(); ctx.ellipse(X(0.5) + (hash(sd, i) - 0.5) * 0.004, Y(0.42) + i * 0.0012, i * 0.0042, i * 0.0052, 0.2, Math.PI * (0.9 + 0.3 * hash(sd, i + 9)), Math.PI * (2.2 + 0.4 * hash(sd, i + 20))); ctx.stroke(); }
  } else { // a polaroid: a suspect's mugshot, or a snapshot of somewhere
    R(0, 0, 1, 1, [45, 15, 94]);
    const px = X(0.08), py = Y(0.07), pw = w * 0.84, ph = h * 0.7;
    if (it.kind === 'suspect') {
      const img = mugshot(it);
      if (img) ctx.drawImage(img, px, py, pw, ph);
      else { rect(ctx, px, py, pw, ph, [210, 14, 62]); ctx.beginPath(); ctx.ellipse(X(0.5), py + ph * 0.42, pw * 0.2, ph * 0.26, 0, 0, TAU); fill(ctx, [25, 30, 40]); rect(ctx, px + pw * 0.15, py + ph * 0.75, pw * 0.7, ph * 0.25, [25, 20, 25]); } // no OffscreenCanvas (Node): a placeholder
      scribble(ctx, X(0.2), Y(0.89), X(0.8), 1, 0.01, 1, sd, INK[1]);
    } else {
      scene(ctx, sd, px, py, pw, ph);
    }
  }
  for (const m of s.marks) if (m.id === it.id) mark(ctx, m, X(m.x), Y(m.y), X(m.x2), Y(m.y2), [X(0), Y(0), w, h]);
  ctx.restore();
}

/** A snapshot's picture, one of four places by its seed: a skyline at night, a car in the street, a house at dusk, a bridge. */
function scene(ctx, sd, px, py, pw, ph) {
  const v = (sd >> 1) % 4, P = (fx, fy, fw, fh, c, a) => rect(ctx, px + fx * pw, py + fy * ph, fw * pw, fh * ph, c, a), disc = (fx, fy, r, c) => { ctx.beginPath(); ctx.arc(px + fx * pw, py + fy * ph, r * pw, 0, TAU); fill(ctx, c); };
  if (v === 0) {
    P(0, 0, 1, 1, [215, 30, 30 + 25 * hash(sd, 1)]); disc(0.2 + 0.6 * hash(sd, 2), 0.25, 0.07, [50, 60, 85]);
    for (let i = 0; i < 5; i++) { const bh = 0.25 + 0.4 * hash(sd, i + 3); P(i / 5, 1 - bh, 0.204, bh, [220, 20, 12 + 8 * hash(sd, i + 9)]); if (hash(sd, i + 20) < 0.6) P((i + 0.35) / 5, 1 - bh * 0.7, 0.05, 0.06, [48, 85, 65]); }
    P(0, 0.9, 1, 0.1, [220, 15, 8]);
  } else if (v === 1) {
    P(0, 0, 1, 0.62, [200, 40, 72]); P(0, 0.62, 1, 0.38, [30, 8, 38]); P(0, 0.4, 0.3, 0.22, [25, 20, 55]); P(0.62, 0.3, 0.38, 0.32, [15, 25, 48]); P(0.1, 0.8, 0.2, 0.03, [50, 20, 85]); P(0.5, 0.8, 0.2, 0.03, [50, 20, 85]);
    const hue = 360 * hash(sd, 4); P(0.26, 0.52, 0.46, 0.14, [hue, 55, 40]); P(0.36, 0.42, 0.24, 0.11, [hue, 55, 32]); P(0.4, 0.44, 0.16, 0.07, [200, 30, 80]); disc(0.36, 0.67, 0.045, [0, 0, 10]); disc(0.62, 0.67, 0.045, [0, 0, 10]);
  } else if (v === 2) {
    P(0, 0, 1, 0.7, [18, 55, 62]); P(0, 0, 1, 0.3, [260, 30, 45], 0.6); P(0, 0.7, 1, 0.3, [110, 25, 22]);
    P(0.28, 0.4, 0.46, 0.36, [30, 15, 30]); ctx.beginPath(); ctx.moveTo(px + 0.22 * pw, py + 0.4 * ph); ctx.lineTo(px + 0.51 * pw, py + 0.18 * ph); ctx.lineTo(px + 0.8 * pw, py + 0.4 * ph); fill(ctx, [10, 25, 20]);
    P(0.46, 0.56, 0.1, 0.2, [20, 30, 15]); P(0.6, 0.48, 0.09, 0.1, [48, 90, 68]); P(0.33, 0.48, 0.09, 0.1, [30, 15, 18]); P(0.05, 0.5, 0.03, 0.22, [25, 30, 18]); disc(0.065, 0.44, 0.09, [120, 30, 20]);
  } else {
    P(0, 0, 1, 0.6, [205, 18, 60]); P(0, 0.6, 1, 0.4, [205, 35, 32]); P(0, 0.5, 1, 0.035, [0, 0, 15]);
    for (const x of [0.25, 0.72]) { P(x, 0.16, 0.035, 0.6, [0, 0, 15]); line(ctx, [[px + (x - 0.25) * pw, py + 0.5 * ph], [px + (x + 0.017) * pw, py + 0.17 * ph], [px + (x + 0.28) * pw, py + 0.5 * ph]], [0, 0, 15], 0.0016); }
    for (let i = 0; i < 4; i++) P(0.1 + 0.22 * i + 0.1 * hash(sd, i), 0.7 + 0.07 * i, 0.16, 0.012, [205, 30, 60], 0.7);
  }
}

function map(ctx, it, X, Y, R) {
  const sd = it.sd;
  R(0, 0, 1, 1, [48, 34, 84]);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(X(0.15 + 0.7 * hash(sd, i)), Y(0.2 + 0.6 * hash(sd, i + 5)), it.w * 0.09, it.h * 0.1, hash(sd, i + 8), 0, TAU); fill(ctx, [100, 30, 68], 0.8); } // parks
  line(ctx, Array.from({ length: 13 }, (_, j) => [X(j / 12), Y(0.5 + 0.3 * Math.sin(j * 0.55 + sd) + 0.05 * Math.sin(j * 1.9))]), [200, 50, 66], 0.011); // the river
  for (let i = 0; i < 7; i++) { // roads: a warped grid
    const f = (i + 0.5 + 0.5 * (hash(sd, i + 30) - 0.5)) / 7, k = hash(sd, i + 40) - 0.5, wd = i % 3 ? 0.0022 : 0.0045;
    line(ctx, [[X(f), Y(0)], [X(f + 0.08 * k), Y(0.5)], [X(f - 0.05 * k), Y(1)]], [40, 10, 99], wd);
    if (i < 5) { const g = (i + 0.5) / 5; line(ctx, [[X(0), Y(g)], [X(0.5), Y(g + 0.1 * k)], [X(1), Y(g - 0.06 * k)]], [40, 10, 99], wd); }
  }
  for (const f of [1 / 3, 2 / 3]) R(f, 0, f + 0.004, 1, [40, 20, 50], 0.3); // the folds
  R(0, 0.5, 1, 0.504, [40, 20, 50], 0.3);
}

/** A marker stroke as polylines, in the paper's frame; `u` of the points are down (the pen itself is never drawn).
 *  The ink is clipped to the paper (`edge`): a marker writes on the sheet, never on the cork. */
function mark(ctx, m, x, y, x2, y2, edge) {
  const r = m.r, P = [], wob = (i) => (hash(m.sd, i) - 0.5) * r * 0.12;
  if (m.kind === 'circle') { const n = Math.round(36 * m.turns); P.push(Array.from({ length: n + 1 }, (_, i) => { const t = i / n, a = m.sd + t * TAU * m.turns, rr = r * (0.92 + 0.1 * t + 0.05 * Math.sin(3 * a)); return [x + Math.cos(a) * rr, y + Math.sin(a) * rr * (m.ry ? m.ry / r : 0.86)]; })); }
  else if (m.kind === 'x') for (const d of [1, -1]) P.push(Array.from({ length: 6 }, (_, i) => [x + d * r * (i / 2.5 - 1) + wob(i), y + r * 1.25 * (i / 2.5 - 1)]));
  else if (m.kind === 'under') for (const d of [0, 1]) P.push(Array.from({ length: 9 }, (_, i) => [x + r * 1.6 * (d ? 1 - i / 4 : i / 4 - 1), y + d * r * 0.25 + wob(i + d * 9)]));
  else if (m.kind === 'q') { P.push([...Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (-1 + (1.5 * i) / 9); return [x + Math.cos(a) * r * 0.6, y - r * 0.6 + Math.sin(a) * r * 0.6]; }), [x, y + r * 0.45]]); P.push([[x, y + r * 0.9], [x + r * 0.05, y + r * 0.95]]); }
  else if (m.kind === 'tick') P.push([[x - r, y], [x - r * 0.4, y + r * 0.7], [x - r * 0.1, y + r * 0.2], [x + r * 1.1, y - r]]);
  else { const a = Math.atan2(y2 - y, x2 - x); P.push(Array.from({ length: 12 }, (_, i) => [lerp(x, x2, i / 11) + wob(i) * 0.5, lerp(y, y2, i / 11) + wob(i + 12) * 0.5])); P.push([[x2 - Math.cos(a - 0.5) * r * 0.6, y2 - Math.sin(a - 0.5) * r * 0.6], [x2, y2], [x2 - Math.cos(a + 0.5) * r * 0.6, y2 - Math.sin(a + 0.5) * r * 0.6]]); }
  let left = Math.floor(m.u * P.reduce((n, p) => n + p.length, 0));
  ctx.save(); ctx.beginPath(); ctx.rect(...edge); ctx.clip();
  for (const p of P) { const k = Math.min(left, p.length); left -= k; if (k > 1) line(ctx, p.slice(0, k), INK[m.col], m.turns > 2 ? 0.005 : 0.0032, 0.9); }
  ctx.restore();
}

function stamp(ctx, s) {
  const k = lerp(2.6, 1, s.stamp ** 0.5), wd = 0.56, ht = 0.13;
  ctx.save(); ctx.translate(0, s.stampY); ctx.rotate(-0.13); ctx.scale(k, k); ctx.globalAlpha = 0.88 * s.stamp;
  ctx.strokeStyle = ctx.fillStyle = 'hsl(2 78% 42%)'; ctx.lineWidth = 0.012; ctx.strokeRect(-wd / 2, -ht / 2, wd, ht); ctx.lineWidth = 0.003; ctx.strokeRect(-wd / 2 + 0.012, -ht / 2 + 0.012, wd - 0.024, ht - 0.024);
  text(ctx, 'CASE CLOSED', 0, 0.006, 0.085, 'Impact, Haettenschweiler, sans-serif', 'hsl(2 78% 42%)');
  ctx.restore();
}

// a suspect's mugshot is the same picture every frame: limner draws it once (hat to collar, on the height chart) and
// it is stamped after. A pure function of the character, so a cache outside the state, not memory of the world.
const MUGS = new Map(), BMP = 224;
function mugshot(it) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const key = `${it.sd}:${it.id}:${it.char.skin}`;
  let img = MUGS.get(key);
  if (!img) {
    if (MUGS.size > 24) MUGS.clear();
    img = new OffscreenCanvas(BMP, Math.round(BMP * (0.7 * it.h) / (0.84 * it.w))); const c = img.getContext('2d'), H = img.height;
    c.fillStyle = 'hsl(210 14% 70%)'; c.fillRect(0, 0, BMP, H);
    c.fillStyle = 'hsl(210 14% 52%)'; for (let y = H * 0.1; y < H; y += H * 0.13) c.fillRect(0, y, BMP, 2);
    const k = (H / 480) * (480 / 330);
    c.translate(BMP / 2, H * 0.44); c.scale(k, k); c.translate(-200, -eyeY(it.char));
    drawOn(c, portraitOps({ ...it.char, mouth: { ...it.char.mouth, smile: -0.1 } }));
    MUGS.set(key, img);
  }
  return img;
}
