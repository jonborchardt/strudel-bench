// family: the song grows one family line, deeper and deeper, and the camera sits on its newest family. Two founders
// stand at the top as busts (never legs); a kick is a birth into the family on screen, a new child growing in under
// the couple, until the couple's room is full; a melody note, once a bar, marries one of that family's grown children to
// someone from outside, and the camera goes down to the new couple (coder's Enter and scroll), so each generation is
// one couple and its children and the families above never change again: the song follows one line in time, not
// every branch. The babies are always in frame: the camera sits on the family with the babies, and a snare (at most
// once every two bars), a riser or a boundary lifts it one generation up the line for two seconds, the babies still at
// the bottom (coder's cursor going back up the file); now and then a boundary lifts it two. The people are limner's
// robots; each child is a new robot in its own clothes with its face's genes (head shape, plating, eye and mouth modes)
// blended from its parents (childOf), so the family's face drifts down the tree and every in-law brings new blood. Age is
// how many generations sit below you: the newest are children, then adults, then rusting, then sepia, like portraits on
// a wall. Dance breaks: a loud section dances all through, a middling one the last two bars of every eight. The lines
// play (lineStyle, shared with the wheel): a hue a generation moved by the bass, brighter with the section's energy, a
// bright wave running down the generations on every kick, the family on screen glowing with the pad.
// Every robot is a cached picture (limner takes ~20 ms to draw one, too slow to draw any frame by frame), moved by the
// music: the family on screen sways with the bar and bobs on a kick, the bass tints the room, the pad glows behind
// them, a dropout dims the room.
// Deterministic: randomness only from the state's own generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, feetY, characterFrom, CASTS, mix } from './limner.mjs';

const ROW = 1.5; // generations apart, in slots (a slot is one bust's width)
export const MAX_PEOPLE = 1000; // a safety cap only: the tree is one line (a couple and its children a generation), so a long song goes deep, not wide
export const BIRTH_GAP = 0.4, WED_AGE = 4; // seconds between births; seconds a child lives before it may marry
const NOISE = 0.04, HEX = /^#[0-9a-f]{6}$/i, FEATURES = ['face', 'eyes', 'nose', 'mouth', 'ears'];
// the genes: the face's structure and what it is made of; clothes, pose and finish are each one's own
const GENES = ['face', 'eyes', 'nose', 'mouth', 'ears', 'neck', 'skin', 'build'];
const CAST = CASTS.robots;

/** Two plain values blended: numbers between (times a little noise), colours mixed, objects key by key, anything else from one side. */
export function blend(a, b, s) {
  if (typeof a === 'number' && typeof b === 'number') return (a + (b - a) * rand(s)) * (1 + (rand(s) - 0.5) * NOISE);
  if (typeof a === 'string' && typeof b === 'string' && HEX.test(a) && HEX.test(b)) return mix(a, b, rand(s));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const v = k in a && k in b ? blend(a[k], b[k], s) : (a[k] ?? b[k]);
      if (v !== undefined) o[k] = v; // a key only one side spells out stays unwritten, so the state stays JSON
    }
    return o;
  }
  return rand(s) < 0.5 ? a : b;
}

/** A child of two characters: a new one of the cast in its own clothes and pose, with the face's genes blended from its
 *  parents, one time in four a whole feature straight from one of them, and one parent's eye light (two lights mixed are mud). */
export function childOf(a, b, s) {
  const c = outsider(s);
  for (const k of GENES) if (a[k] !== undefined && b[k] !== undefined) c[k] = blend(a[k], b[k], s);
  for (const k of FEATURES) if (rand(s) < 0.25) c[k] = structuredClone((rand(s) < 0.5 ? a : b)[k]);
  const light = (rand(s) < 0.5 ? a : b).eyes.iris;
  c.eyes = { ...c.eyes, iris: light }; c.mouth = { ...c.mouth, color: light };
  return c;
}

export const outsider = (s) => characterFrom(CAST, s, 'none', 0.5); // the robots' wardrobe has no hats
export function person(s, char, gen, parents, inlaw) {
  const p = { id: s.people.length, gen, char, parents, partner: -1, union: -1, inlaw, born: s.t, size: parents < 0 ? 1 : 0.2, x: 0, y: 0 };
  s.people.push(p); s.maxGen = Math.max(s.maxGen, gen); return p;
}
/** p marries an outsider; returns the new couple's index. */
export function wed(s, p, room = 2 + Math.floor(rand(s) * 4)) {
  const q = person(s, outsider(s), p.gen, -1, true);
  s.couples.push({ a: p.id, b: q.id, kids: [], room });
  p.partner = q.id; q.partner = p.id; p.union = q.union = s.couples.length - 1;
  return p.union;
}

/** The founders, wed: couple 0, focused. */
export function newTree(s) {
  Object.assign(s, { people: [], couples: [], focus: 0, lastBirth: -BIRTH_GAP, maxGen: 0 });
  wed(s, person(s, outsider(s), 0, -1, false));
  layout(s);
}

/** A child for the focused couple, up to its room; when it is full, births wait for a marriage. */
export function birth(s) {
  const c = s.couples[s.focus];
  if (s.people.length >= MAX_PEOPLE || s.t - s.lastBirth < BIRTH_GAP || c.kids.length >= c.room) return false;
  const A = s.people[c.a], B = s.people[c.b];
  c.kids.push(person(s, childOf(A.char, B.char, s), A.gen + 1, s.focus, false).id);
  s.lastBirth = s.t; layout(s);
  return true;
}

/** Once the focused family has had no birth for WED_AGE (it is full, or the kicks have stopped, and every child of it is
 *  grown), one of its children, picked by the generator, marries an outsider, and the focus goes down to the new couple:
 *  the line goes one generation deeper, and the couples above never change again. */
export function marry(s) {
  const c = s.couples[s.focus];
  if (s.people.length >= MAX_PEOPLE || !c.kids.length || s.t - s.lastBirth < WED_AGE) return false;
  // any child, not the eldest: the eldest is always leftmost, and the first grown, so the line would always run down the left
  const p = s.people[c.kids[Math.floor(rand(s) * c.kids.length)]];
  s.focus = wed(s, p); layout(s);
  return true;
}

/** Rows by generation; a married person's block is as wide as their children's blocks (two at least), the children centred under the couple. */
export function layout(s) {
  const memo = new Map(); // the line is deep: without it every level re-walks the whole line below
  const width = (p) => {
    if (p.union < 0) return 1;
    if (!memo.has(p.id)) memo.set(p.id, Math.max(2, s.couples[p.union].kids.reduce((n, k) => n + width(s.people[k]), 0)));
    return memo.get(p.id);
  };
  const place = (p, left) => {
    p.y = p.gen * ROW;
    if (p.union < 0) { p.x = left + 0.5; return; }
    const c = s.couples[p.union], q = s.people[p.partner], mid = left + width(p) / 2;
    p.x = mid - 0.5; q.x = mid + 0.5; q.y = p.y;
    let x = mid - c.kids.reduce((n, k) => n + width(s.people[k]), 0) / 2;
    for (const k of c.kids) { place(s.people[k], x); x += width(s.people[k]); }
  };
  place(s.people[0], 0);
}

const DANCE_LOUD = 0.7, DANCE_SOME = 0.4; // section energies: dancing all through, and dancing the last two bars of every eight
const UP = 2, TWO_UP = 1 / 6; // seconds a look up lasts; the odds a boundary looks two generations up instead of one

/** The box around some people, padded to a bust. */
const boxOf = (ps) => ({ x0: Math.min(...ps.map((p) => p.x)) - 0.6, x1: Math.max(...ps.map((p) => p.x)) + 0.6, y0: Math.min(...ps.map((p) => p.y)) - 0.7, y1: Math.max(...ps.map((p) => p.y)) + 0.8 });
/** The family with the babies: the newest couple once it has children, until then the family the newest couple married out of. */
export const nursery = (s) => { const f = s.couples[s.focus]; if (f.kids.length) return s.focus; const up = s.people[f.a].parents; return up < 0 ? s.focus : up; };
/** What the camera frames `level` generations up: the babies, their parents and the newest in-law always, plus the couples of the line above them. */
export function shotOf(s, level) {
  const n = s.couples[nursery(s)], ids = [n.a, n.b, ...n.kids, ...n.kids.map((k) => s.people[k].partner).filter((q) => q >= 0)];
  for (let i = 0, up = s.people[n.a].parents; i < level && up >= 0; i++, up = s.people[s.couples[up].a].parents) ids.push(s.couples[up].a, s.couples[up].b);
  return boxOf(ids.map((i) => s.people[i]));
}
/** Where the camera wants to be: centre and the height in slots that fits the box at this aspect. */
const aim = (b, aspect) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, span: Math.max(b.y1 - b.y0, (b.x1 - b.x0) / aspect) });

/** Look up the line `level` generations for a while, the babies still in frame. A snare asks for one, at most once every two bars. */
function lookUp(s, level, clock) {
  if (clock && clock.index === s.upAt[0] && clock.bar - s.upAt[1] < 2) return;
  s.up = level; s.upUntil = s.t + UP;
  if (clock) s.upAt = [clock.index, clock.bar];
}

const SHEET = { w: 400, h: 480 };
const RUST = '#7a4a32', BMP = 64, MAX_RES = 540; // a picture's width in pixels, least and most; a bigger bust gets a bigger one
const stageOf = (s, p) => (s.maxGen === 0 ? 1 : Math.min(3, s.maxGen - p.gen)); // 0 child, 1 adult, 2 rusting, 3 sepia; founders alone are adults
/** The robot as its age shows: rust creeping into the plating from the grandparents up. */
const aged = (c, st) => (st >= 2 ? { ...c, skin: mix(c.skin, RUST, st >= 3 ? 0.5 : 0.3) } : c);
const SEPIA = 'sepia(.85) brightness(.9)';

// Pictures live outside the state (the state stays data, so determinism is untouched), keyed by the world, the tree's
// seed and the person, least recently used dropped past CACHE_BYTES: a module is shared by every world in a page or a
// worker, and a long song or a session of songs would otherwise hold gigabytes.
const CACHE = new Map(); // key -> bitmap, oldest use first
const CACHE_BYTES = 256 * 2 ** 20;
let held = 0;
const bytes = (b) => b.width * b.height * 4;
/** A cached picture by key, marked as just used. */
function cached(key) { const b = CACHE.get(key); if (b) { CACHE.delete(key); CACHE.set(key, b); } return b; }
/** Keep a new picture, dropping the least recently used ones past the budget. */
function keep(key, b) {
  const was = CACHE.get(key); if (was) { held -= bytes(was); CACHE.delete(key); }
  CACHE.set(key, b); held += bytes(b);
  for (const [k, old] of CACHE) { if (held <= CACHE_BYTES) break; CACHE.delete(k); held -= bytes(old); }
}
const BUILDS = 1; // bitmaps made per frame at most (a big one takes limner ~25 ms): a new generation ages two old ones at once, and making them all in one frame stutters
let budget = BUILDS;
/** The picture under `key`: the cached one while it is at least `minW` wide, else (budget allowing) a new one `w` wide,
 *  `aspect` tall over wide, painted by `paint(ctx, width)`; null when there is none yet. Each build is a whole limner
 *  drawing (~20-30 ms), so pictures are only ever made bigger, and only when shown well over their size. */
function picture(key, w, aspect, minW, paint) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const had = cached(key);
  if (had && (had.width >= minW || budget <= 0)) return had;
  if (budget <= 0) return null;
  budget--;
  const res = Math.round(Math.min(MAX_RES, Math.max(BMP, w))), b = new OffscreenCanvas(res, Math.round(res * aspect));
  paint(b.getContext('2d'), res); keep(key, b);
  return b;
}
/** A person's bust for their age, at least about `px` pixels wide: one per look (a child and an adult look the same;
 *  rusting and sepia are one more each); while a new look waits its turn, the one before it. */
function bitmap(s, p, st, px) {
  const look = Math.max(1, st), who = `${s.key}:${p.id}`;
  return picture(`${who}:${look}`, px * 1.25, SHEET.h / SHEET.w, Math.min(MAX_RES, px / 1.25), (c, res) => {
    c.scale(res / SHEET.w, res / SHEET.w); if (look >= 3) c.filter = SEPIA;
    drawOn(c, portraitOps(aged(p.char, look)));
  }) ?? cached(`${who}:${look - 1}`) ?? null;
}

/** One person as a bust `sz` wide (canvas units of the current transform, `px` pixels on screen) with its eyes at the
 *  origin, from a cached picture: limner draws a robot in about 20 ms, so nobody is drawn by it frame by frame. The music
 *  moves the picture: the dance swings and hops it, and when `live` the bar sways it and a kick bobs it. Legs never
 *  show: the picture is the bust sheet. */
export function bust(ctx, s, p, sz, px, lit, live = false) {
  const side = p.id % 2 ? 1 : -1, swing = s.dance * side * Math.sin(s.beat * Math.PI), hop = s.dance * Math.abs(Math.sin(s.beat * Math.PI));
  const sc = sz / SHEET.w, bh = sz * SHEET.h / SHEET.w, top = -eyeY(p.char) * sc;
  ctx.save(); ctx.translate(0.14 * sz * swing, -0.18 * sz * hop - (live ? 0.06 * sz * s.bob : 0));
  ctx.rotate(0.24 * swing + (live ? 0.05 * s.sway : 0)); ctx.globalAlpha = lit;
  const b = bitmap(s, p, stageOf(s, p), px / Math.max(p.size, 0.2)); // sized for them grown: a growing child is not rebuilt at every step
  if (b) ctx.drawImage(b, -sz / 2, top, sz, bh);
  else if (typeof OffscreenCanvas === 'undefined') { ctx.fillStyle = p.char.skin; ctx.fillRect(-sz / 4, top + bh * 0.2, sz / 2, bh / 2); } // no OffscreenCanvas (Node): a placeholder
  ctx.restore();
}

const FIG = { x: -90, w: 580, h: 1284 }; // limner's whole-figure frame (renderFigure): 90 either side of the sheet, 1284 tall to the shoes
/** The poses a standing robot can strike, each a picture of its own (a pose is a limner drawing, ~20 ms, so a robot
 *  gets a handful made once and the music picks among them): the head and the arms. */
export const POSES = [
  {}, // standing
  { headTilt: -0.3, headX: -14 }, // head over to its right
  { headTilt: 0.3, headX: 14 }, // and to its left
  { headY: 16, headTilt: 0.05 }, // a nod
  { props: ['handsUp'], headY: -8 }, // hands up
  { props: ['reachRight'], headTilt: 0.12, headX: 8, turn: 0.35 }, // pointing out
];
/** A small whole number from a person's id, the same every frame: what makes one robot's dance its own. */
const own = (p, n) => ((p.id * 2654435761) >>> 0) % n;
/** The pose a robot strikes now, from the music and its own nature: a snare throws its hands up or points (which, is its
 *  own), a dance break swings its head side to side on the beat (in its own phase) and now and then throws an arm, a kick
 *  nods it, the melody turns its head toward the side it plays from. */
export function poseOf(s, p) {
  const k = own(p, 4);
  if (s.pulse > 0.4) return k % 2 ? 4 : 5;
  if (s.dance > 0.5) { const b = Math.floor(s.beat + k / 2); return b % 4 === 3 && k > 1 ? 4 + (k % 2) : 1 + (b % 2); }
  if (s.bob > 0.6) return 3;
  if (Math.abs(s.lookX) > 0.35) return s.lookX < 0 ? 1 : 2;
  return 0;
}
/** One person standing whole, `hgt` tall (canvas units) with their feet at the origin, in pose `pose` (POSES), from its
 *  own cached picture: a pose not made yet shows the standing one until its turn in the frame's budget. Each robot sways
 *  and hops in its own phase and by its own amount, so a line of them does not move as one. */
export function figure(ctx, s, p, hgt, lit, pose = 0) {
  const ph = own(p, 7) / 7 * Math.PI, amp = 0.6 + own(p, 5) * 0.15, beat = s.beat * Math.PI + ph;
  const swing = amp * s.dance * Math.sin(beat), hop = amp * s.dance * Math.abs(Math.sin(beat)), wd = hgt * FIG.w / FIG.h;
  ctx.save(); ctx.translate(0, -0.06 * hgt * hop - 0.03 * hgt * s.bob); ctx.rotate(0.08 * swing + 0.03 * s.sway * (own(p, 2) ? 1 : -1)); ctx.globalAlpha = lit;
  const look = Math.max(1, stageOf(s, p)), key = (n) => `${s.key}:${p.id}:figure:${look}:${n}`;
  const b = picture(key(pose), wd * 1.25, FIG.h / FIG.w, Math.min(MAX_RES, wd / 1.25), (c, res) => {
    const a = aged(p.char, look), { props, ...head } = POSES[pose], posed = { ...a, pose: { ...a.pose, ...head }, ...(props ? { props: [...(a.props ?? []), ...props] } : {}) };
    c.scale(res / FIG.w, res / FIG.w); c.translate(-FIG.x, FIG.h - feetY(posed)); // the shoes on the bottom edge
    drawOn(c, portraitOps(posed));
  }) ?? cached(key(0)) ?? null; // a pose not made yet: standing
  if (b) ctx.drawImage(b, -wd / 2, -hgt, wd, hgt);
  else if (typeof OffscreenCanvas === 'undefined') { ctx.fillStyle = p.char.skin; ctx.fillRect(-wd / 4, -hgt, wd / 2, hgt); }
  ctx.restore();
}

/** What the music does to everyone, whatever the layout: the sway, the dance breaks, the faces' twitches decaying, the riser and the dark. */
export function feel(s, dt, clock) {
  s.energy = ease(s.energy, clock.energy, 2, dt);
  s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
  s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
  s.sway = Math.sin(((clock.bar % 2) + clock.barPhase) * Math.PI) * lerp(0.15, 1, s.energy);
  // a dance break: a loud section dances all through, a middling one the last two bars of every eight; everyone bounces on the beat
  s.dance = ease(s.dance ?? 0, clock.energy >= DANCE_LOUD || (clock.energy >= DANCE_SOME && clock.bar % 8 >= 6) ? 1 : 0, 4, dt);
  s.beat = (clock.beat ?? 0) + (clock.beatPhase ?? 0);
  s.bob = decay(s.bob, 6, dt); s.flash = decay(s.flash, 5, dt); s.glow = decay(s.glow, 0.5, dt);
  s.lookX = ease(s.lookX, 0, 0.6, dt); s.hueShift = ease(s.hueShift, s.hueTo, 2, dt);
}

/** The events, read the same way by every layout; `on.kick()`, `on.snare()` and `on.note()` are what the layout makes of a birth, a look up and a wedding. */
export function listen(s, events, on) {
  for (const e of events) {
    const slot = s.slotOf?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
    if (slot === 'impulse') {
      if (e.role === 'impact') on.snare();
      else if (e.role !== 'grain') { s.kickT = s.t; on.kick(); s.bob = Math.max(s.bob, g); } // a hat or a shaker is the dance's own beat, nothing more
    } else if (slot === 'ground') { if (e.note !== null) s.hueTo = ((e.note % 12) / 12) * 80 - 40; }
    else if (slot === 'line' || slot === 'counter') {
      if (e.note === null) continue;
      s.lookX = (e.pan - 0.5) * 2; // which way a standing robot turns its head (poseOf)
      if (slot === 'line') on.note();
    } else if (slot === 'field') s.glow = Math.min(1, 0.5 + 0.5 * g);
    else if (slot === 'transition') { if (e.dur >= 1) s.flash = 1; }
  }
}

/** The state every layout starts from: the palette, the cast's slots, the music's dials, and `key`, which names this
 *  world's tree for the picture cache (two worlds over one score grow different children from the same seed). */
export function baseState(score, rng, size, world) {
  const s = {
    pal: paletteOf(score, rng), aspect: size.w / size.h, t: 0,
    slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
    up: 0, upUntil: -1, upAt: [-1, -9], wedBar: -1, kickT: -9, riser: 0, dark: 0, energy: 0.5,
    sway: 0, dance: 0, beat: 0, bob: 0, lookX: 0, glow: 0, flash: 0, hueShift: 0, hueTo: 0,
  };
  seed(s, rng); s.key = `${world}:${s.rnd}`;
  return s;
}

/** The pad's light: a soft pool at (x, y) of radius r, brighter with the pad. */
export function glow(ctx, s, x, y, r, base, lit) {
  const gl = ctx.createRadialGradient(x, y, 0, x, y, r);
  gl.addColorStop(0, hsla(s.pal.field, 60, 60, (base + 0.3 * s.glow) * lit)); gl.addColorStop(1, hsla(s.pal.field, 60, 50, 0));
  ctx.fillStyle = gl; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

const WAVE = 14; // how fast a kick's wave runs through the generations, in generations a second
/** How a couple's lines look: each generation its own hue round the palette's line colour, moved by the bass; brighter
 *  with the section's energy; lit up as a kick's wave passes their generation (out from the founders); glowing with the
 *  pad when they are the family on screen (`own`). `unit` is one pixel in the current transform's units. */
export function lineStyle(ctx, s, gen, own, unit, lit) {
  const fade = Math.exp(-(s.t - s.kickT) * 1.2), hit = fade * Math.exp(-(((gen + 0.5 - (s.t - s.kickT) * WAVE) / 0.7) ** 2)), g = own ? s.glow : 0;
  ctx.strokeStyle = hsla(s.pal.line + gen * 23 + s.hueShift, 45 + 40 * hit, 48 + 18 * s.energy + 30 * hit + 15 * g, (0.35 + 0.3 * s.energy + 0.35 * Math.max(hit, g)) * lit);
  ctx.lineWidth = (1.4 + 3 * hit + 2 * g) * unit; ctx.lineCap = 'round';
}

/** The room: the background lit by the section, tinted by the bass. */
export function room(s, ctx, w, h, lit) {
  budget = BUILDS; // a new frame: the picture budget starts again
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = hsla(s.pal.hue + s.hueShift, s.pal.sat * 0.5, lerp(9, 22, s.energy) * lit); ctx.fillRect(0, 0, w, h);
}

export default {
  name: 'family',

  init(score, rng, size) {
    const s = baseState(score, rng, size, 'family');
    newTree(s);
    s.cam = aim(shotOf(s, 0), s.aspect);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    if (clock.boundary) lookUp(s, rand(s) < TWO_UP ? 2 : 1);
    feel(s, dt, clock);
    listen(s, events, { kick: () => birth(s), snare: () => lookUp(s, 1, clock), note: () => { if (clock.bar !== s.wedBar && marry(s)) s.wedBar = clock.bar; } });
    for (const p of s.people) p.size = ease(p.size, s.maxGen - p.gen === 0 && p.gen > 0 ? 0.7 : 1, 2, dt);
    // the babies are always in frame: the shot is the nursery, or it plus one or (seldom) two generations of the line above; a riser rises one
    const level = s.t < s.upUntil ? s.up : 0, near = aim(shotOf(s, level), s.aspect), far = aim(shotOf(s, Math.max(level, 1)), s.aspect);
    for (const k of ['x', 'y', 'span']) s.cam[k] = ease(s.cam[k], lerp(near[k], far[k], s.riser), 2.5, dt);
    // the ease never leaves a baby out: if the nursery would overhang the frame, the frame opens to it at once
    const b = shotOf(s, 0), c = s.cam;
    c.span = Math.max(c.span, 2 * Math.max(c.y - b.y0, b.y1 - c.y, (c.x - b.x0) / s.aspect, (b.x1 - c.x) / s.aspect));
  },

  draw(s, ctx, w, h) {
    const lit = 1 - 0.55 * s.dark, k = h / s.cam.span;
    const X = (x) => w / 2 + (x - s.cam.x) * k, Y = (y) => h / 2 + (y - s.cam.y) * k;
    room(s, ctx, w, h, lit);
    // the pad's glow behind the family on screen
    const f = s.couples[nursery(s)], fa = s.people[f.a];
    glow(ctx, s, X(fa.x + 0.5), Y(fa.y + 0.4), 2 * k, 0.05, lit);
    // the lines: partners joined at the shoulder, a drop to a bar over the children, a stem to each, playing (lineStyle)
    const fi = nursery(s);
    for (let ci = 0; ci < s.couples.length; ci++) {
      const c = s.couples[ci], A = s.people[c.a], B = s.people[c.b], sy = Y(A.y + 0.45), m = (A.x + B.x) / 2;
      lineStyle(ctx, s, A.gen, ci === fi, Math.max(0.7, 0.016 * k), lit);
      ctx.beginPath(); ctx.moveTo(X(A.x), sy); ctx.lineTo(X(B.x), sy);
      if (c.kids.length) {
        const kx = c.kids.map((i) => s.people[i].x), bar = Y(A.y + ROW - 0.75), mid = X(m);
        ctx.moveTo(mid, sy); ctx.lineTo(mid, bar); ctx.moveTo(X(Math.min(m, ...kx)), bar); ctx.lineTo(X(Math.max(m, ...kx)), bar); // the bar reaches the drop: a lone married child stands half a slot off it
        for (const i of c.kids) { const q = s.people[i]; ctx.moveTo(X(q.x), bar); ctx.lineTo(X(q.x), Y(q.y - 0.45 * q.size)); } // to the child's own head: a small one sits lower (scaled about its eyes); the bust covers the overshoot
      }
      ctx.stroke();
    }
    // the people: a bust a slot wide, eyes a little above its row line
    const live = new Set([f.a, f.b, ...f.kids]); // the family on screen sways and bobs
    for (const p of s.people) {
      const sz = k * p.size, sx = X(p.x), sy = Y(p.y) - 0.15 * sz;
      if (sx < -sz || sx > w + sz || sy < -sz * 1.5 || sy > h + sz) continue;
      ctx.save(); ctx.translate(sx, sy); bust(ctx, s, p, sz, sz, lit, live.has(p.id)); ctx.restore();
    }
    if (s.flash > 0.01) { ctx.fillStyle = `rgba(255 250 235 / ${0.5 * s.flash})`; ctx.fillRect(0, 0, w, h); }
  },
};
