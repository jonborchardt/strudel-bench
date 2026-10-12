// family: the song grows a family tree, and the camera mostly sits on one family of it. Two founders stand at the top
// as busts; a kick is a birth into the family on screen, a new child popping into the row under the couple; a melody
// note, once a bar, marries the eldest unmarried child to someone from outside, and the camera goes down to the new
// couple (coder's Enter and scroll); a snare looks back up to the parents' family for two seconds, a second snare one
// generation further (coder's cursor going back up the file); a boundary pulls out to the last three generations and
// lands on the newest couple (coder's new tab), and a riser pulls out as it rises. Each child is a blend of its two
// parents (childOf), so the family's face drifts down the tree and every in-law brings new blood. Age is how many
// generations sit below you: the newest are children, then adults, then grey, then sepia, like portraits on a wall.
// The family on screen is played as the faces world plays its face: the bar sways it, a kick grins, hats blink, the
// melody moves the eyes, the bass tints the room, the pad glows behind them, a dropout dims and shuts the eyes.
// Deterministic: randomness only from the state's own generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, characterOf, mix } from './limner.mjs';

export const ROW = 1.5; // generations apart, in slots (a slot is one bust's width)
export const MAX_PEOPLE = 120; // ponytail: a hard cap, a long busy song stops growing; retire the eldest if that shows
const BIRTH_GAP = 0.4, WED_AGE = 4; // seconds between births; seconds a child lives before it may marry
const HEX = /^#[0-9a-f]{6}$/i, FEATURES = ['face', 'eyes', 'nose', 'mouth', 'hair'];

/** Two plain values blended: numbers between (times a little noise), colours mixed, objects key by key, anything else from one side. */
export function blend(a, b, s, noise = 0.04) {
  if (typeof a === 'number' && typeof b === 'number') return (a + (b - a) * rand(s)) * (1 + (rand(s) - 0.5) * noise);
  if (typeof a === 'string' && typeof b === 'string' && HEX.test(a) && HEX.test(b)) return mix(a, b, rand(s));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const v = k in a && k in b ? blend(a[k], b[k], s, noise) : (a[k] ?? b[k]);
      if (v !== undefined) o[k] = v; // a key only one side spells out stays unwritten, so the state stays JSON
    }
    return o;
  }
  return rand(s) < 0.5 ? a : b;
}

/** A child of two characters: a blend, and one time in four a whole feature straight from one parent. */
export function childOf(a, b, s) {
  const c = blend(a, b, s);
  for (const k of FEATURES) if (rand(s) < 0.25) c[k] = structuredClone((rand(s) < 0.5 ? a : b)[k]);
  return { ...c, hat: { style: 'none' } };
}

const outsider = (s) => ({ ...characterOf(s, 'none', 0.5), hat: { style: 'none' } });
function person(s, char, gen, parents, inlaw) {
  const p = { id: s.people.length, gen, char, parents, partner: -1, union: -1, inlaw, born: s.t, size: parents < 0 ? 1 : 0.2, x: 0, y: 0 };
  s.people.push(p); s.maxGen = Math.max(s.maxGen, gen); return p;
}
/** p marries an outsider; returns the new couple's index. */
function wed(s, p) {
  const q = person(s, outsider(s), p.gen, -1, true);
  s.couples.push({ a: p.id, b: q.id, kids: [], room: 2 + Math.floor(rand(s) * 4) });
  p.partner = q.id; q.partner = p.id; p.union = q.union = s.couples.length - 1;
  return p.union;
}

/** The founders, wed: couple 0, focused. */
export function newTree(s) {
  Object.assign(s, { people: [], couples: [], focus: 0, lastBirth: -BIRTH_GAP, maxGen: 0 });
  wed(s, person(s, outsider(s), 0, -1, false));
  layout(s);
}

/** A child for the focused couple, or the youngest couple that still has room. */
export function birth(s) {
  if (s.people.length >= MAX_PEOPLE || s.t - s.lastBirth < BIRTH_GAP) return false;
  const f = s.couples[s.focus], ci = f.kids.length < f.room ? s.focus : s.couples.findLastIndex((c) => c.kids.length < c.room);
  if (ci < 0) return false;
  const c = s.couples[ci], A = s.people[c.a], B = s.people[c.b];
  c.kids.push(person(s, childOf(A.char, B.char, s), A.gen + 1, ci, false).id);
  s.lastBirth = s.t; layout(s);
  return true;
}

/** The oldest unmarried blood child old enough marries an outsider; the new couple takes the focus. */
export function marry(s) {
  if (s.people.length >= MAX_PEOPLE) return false;
  const p = s.people.filter((q) => !q.inlaw && q.partner < 0 && s.t - q.born >= WED_AGE).sort((x, y) => x.gen - y.gen || x.id - y.id)[0];
  if (!p) return false;
  s.focus = wed(s, p); layout(s);
  return true;
}

/** Rows by generation; a married person's block is as wide as their children's blocks (two at least), the children centred under the couple. */
export function layout(s) {
  const width = (p) => (p.union < 0 ? 1 : Math.max(2, s.couples[p.union].kids.reduce((n, k) => n + width(s.people[k]), 0)));
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

const BACK = 2, WIDE = 2; // seconds a snare's look back and a boundary's wide shot last

/** The box around some people, padded to a bust. */
const boxOf = (ps) => ({ x0: Math.min(...ps.map((p) => p.x)) - 0.6, x1: Math.max(...ps.map((p) => p.x)) + 0.6, y0: Math.min(...ps.map((p) => p.y)) - 0.7, y1: Math.max(...ps.map((p) => p.y)) + 0.8 });
const familyBox = (s, ci) => { const c = s.couples[ci]; return boxOf([c.a, c.b, ...c.kids].map((i) => s.people[i])); };
const wideBox = (s) => boxOf(s.people.filter((p) => p.gen >= s.maxGen - 2));
/** Where the camera wants to be: centre and the height in slots that fits the box at this aspect. */
const aim = (b, aspect) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, span: Math.max(b.y1 - b.y0, (b.x1 - b.x0) / aspect) });

function lookBack(s) {
  if (s.t - s.lastBack < 0.15) return; // two snares in a step are one look
  const from = s.t < s.backUntil ? s.back : s.focus, up = s.people[s.couples[from].a].parents;
  s.back = up >= 0 ? up : Math.floor(rand(s) * s.couples.length);
  s.backUntil = s.t + BACK; s.lastBack = s.t;
}

export default {
  name: 'family',

  init(score, rng, size) {
    const s = {
      pal: paletteOf(score, rng), aspect: size.w / size.h, t: 0,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      back: 0, backUntil: -1, lastBack: -1, wideUntil: -1, wedBar: -1, riser: 0, dark: 0, energy: 0.5,
      sway: 0, bob: 0, grin: 0, blink: 0, lastBlink: -9, look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, glow: 0, flash: 0, hueShift: 0, hueTo: 0,
    };
    seed(s, rng); s.key = s.rnd;
    newTree(s);
    s.cam = aim(familyBox(s, 0), s.aspect);
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    s.energy = ease(s.energy, clock.energy, 2, dt);
    if (clock.boundary) { s.wideUntil = s.t + WIDE; s.focus = s.couples.length - 1; }
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.sway = Math.sin(((clock.bar % 2) + clock.barPhase) * Math.PI) * lerp(0.15, 1, s.energy);
    s.bob = decay(s.bob, 6, dt); s.grin = decay(s.grin, 4, dt); s.blink = decay(s.blink, 20, dt); s.flash = decay(s.flash, 5, dt); s.glow = decay(s.glow, 0.5, dt);
    s.look.x = ease(s.look.x, s.lookTo.x, 9, dt); s.look.y = ease(s.look.y, s.lookTo.y, 9, dt);
    s.lookTo.x = ease(s.lookTo.x, 0, 0.6, dt); s.lookTo.y = ease(s.lookTo.y, 0, 0.6, dt); s.hueShift = ease(s.hueShift, s.hueTo, 2, dt);
    for (const e of events) {
      const slot = s.slotOf?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'impact') lookBack(s);
        else if (e.role === 'grain') { if (s.t - s.lastBlink > 2.5) { s.blink = 1; s.lastBlink = s.t; } }
        else { birth(s); s.bob = Math.max(s.bob, g); s.grin = Math.max(s.grin, g); }
      } else if (slot === 'ground') { if (e.note !== null) s.hueTo = ((e.note % 12) / 12) * 80 - 40; }
      else if (slot === 'line' || slot === 'counter') {
        if (e.note === null) continue;
        s.lookTo = { x: (e.pan - 0.5) * 2, y: 1 - 2 * clamp((e.note - 48) / 36) };
        if (slot === 'line' && clock.bar !== s.wedBar && marry(s)) s.wedBar = clock.bar;
      } else if (slot === 'field') s.glow = Math.min(1, 0.5 + 0.5 * g);
      else if (slot === 'transition') { if (e.dur >= 1) s.flash = 1; }
      else if (s.t - s.lastBlink > 2.5) { s.blink = 1; s.lastBlink = s.t; }
    }
    for (const p of s.people) p.size = ease(p.size, s.maxGen - p.gen === 0 && p.gen > 0 ? 0.7 : 1, 2, dt);
    const near = aim(familyBox(s, s.t < s.backUntil ? s.back : s.focus), s.aspect), far = aim(wideBox(s), s.aspect);
    const w = Math.max(s.t < s.wideUntil ? 1 : 0, s.riser);
    for (const k of ['x', 'y', 'span']) s.cam[k] = ease(s.cam[k], lerp(near[k], far[k], w), 2.5, dt);
  },

  draw(s, ctx, w, h) {
    ctx.fillStyle = hsla(s.pal.hue + s.hueShift, s.pal.sat * 0.5, lerp(9, 22, s.energy) * (1 - 0.55 * s.dark)); ctx.fillRect(0, 0, w, h);
  },
};
