// family: (header comment written in Task 2)
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
