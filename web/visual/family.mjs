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
// a wall. Dance breaks: a loud section dances all through, a middling one the last two bars of every eight.
// The family on screen is played as the faces world plays its face: the bar sways it, a kick grins, hats blink, the
// melody moves the eyes, the bass tints the room, the pad glows behind them, a dropout dims and shuts the eyes.
// Deterministic: randomness only from the state's own generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, characterFrom, CASTS, mix } from './limner.mjs';

export const ROW = 1.5; // generations apart, in slots (a slot is one bust's width)
export const MAX_PEOPLE = 1000; // a safety cap only: the tree is one line (a couple and its children a generation), so a long song goes deep, not wide
export const BIRTH_GAP = 0.4, WED_AGE = 4; // seconds between births; seconds a child lives before it may marry
const HEX = /^#[0-9a-f]{6}$/i, FEATURES = ['face', 'eyes', 'nose', 'mouth', 'ears'];
// the genes: the face's structure and what it is made of; clothes, pose and finish are each one's own
const GENES = ['face', 'eyes', 'nose', 'mouth', 'ears', 'neck', 'skin', 'build'];
const CAST = CASTS.robots;

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

export const outsider = (s) => ({ ...characterFrom(CAST, s, 'none', 0.5), hat: { style: 'none' } });
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

/** Once the focused family is complete (full, or no birth for WED_AGE), one of its children, picked by the generator, marries an outsider, and the focus goes down to the new couple: the line goes one generation deeper, and the couples above never change again. */
export function marry(s) {
  const c = s.couples[s.focus];
  if (s.people.length >= MAX_PEOPLE || !c.kids.length || (c.kids.length < c.room && s.t - s.lastBirth < WED_AGE)) return false;
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
export function lookUp(s, level, clock) {
  if (clock && clock.index === s.upAt[0] && clock.bar - s.upAt[1] < 2) return;
  s.up = level; s.upUntil = s.t + UP;
  if (clock) s.upAt = [clock.index, clock.bar];
}

const SHEET = { w: 400, h: 480 };
export const LIVE = 0.22; // a bust taller than this share of the frame is drawn live and played; smaller ones come from the cache
const RUST = '#7a4a32', BMP = 240; // the cache's width in pixels: LIVE of a 1080p frame, so a cached bust is never stretched there
export const stageOf = (s, p) => (s.maxGen === 0 ? 1 : Math.min(3, s.maxGen - p.gen)); // 0 child, 1 adult, 2 rusting, 3 sepia; founders alone are adults
/** The robot as its age shows: rust creeping into the plating from the grandparents up. */
const aged = (c, st) => (st >= 2 ? { ...c, skin: mix(c.skin, RUST, st >= 3 ? 0.5 : 0.3) } : c);
const SEPIA = 'sepia(.85) brightness(.9)';

// ponytail: bitmaps outside the state (the state stays data, so determinism is untouched); cleared wholesale at 600, an LRU if a wall of trees ever thrashes it
const CACHE = new Map();
function bitmap(s, p, st) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const key = `${s.key}:${p.id}:${st}`;
  let b = CACHE.get(key);
  if (b) return b;
  if (CACHE.size > 600) CACHE.clear();
  b = new OffscreenCanvas(BMP, Math.round(BMP * SHEET.h / SHEET.w));
  const c = b.getContext('2d'); c.scale(BMP / SHEET.w, BMP / SHEET.w); if (st >= 3) c.filter = SEPIA;
  drawOn(c, portraitOps(aged(p.char, st)));
  CACHE.set(key, b);
  return b;
}

/** One person as a bust `sz` wide (canvas units of the current transform) with its eyes at the origin, dancing with the
 *  state, played (blinks, looks, smiles, sways) when `live`, from the cache otherwise. Legs never show: the sheet is clipped. */
export function bust(ctx, s, p, sz, live, lit) {
  const side = p.id % 2 ? 1 : -1, swing = s.dance * side * Math.sin(s.beat * Math.PI), hop = s.dance * Math.abs(Math.sin(s.beat * Math.PI));
  const sc = sz / SHEET.w, st = stageOf(s, p);
  ctx.save(); ctx.translate(0.14 * sz * swing, -0.18 * sz * hop);
  if (live) {
    const c = aged(p.char, st), played = { ...c,
      pose: { ...c.pose, headX: s.sway * 10 + 30 * swing, headY: (c.pose?.headY ?? 0) - 8 * s.bob - 14 * hop, headTilt: (c.pose?.headTilt ?? 0) + s.sway * 0.06 + 0.28 * swing, bodyX: (c.pose?.bodyX ?? 0) - 14 * swing, bodyTilt: (c.pose?.bodyTilt ?? 0) - 0.12 * swing },
      eyes: { ...c.eyes, openness: c.eyes.openness * (1 - s.blink) * (1 - 0.85 * s.dark) + 0.02, look: { x: s.look.x, y: s.look.y } },
      mouth: { ...c.mouth, smile: lerp(-0.1, 0.4, s.energy) + 0.35 * s.grin } };
    if (st >= 3) ctx.filter = SEPIA;
    ctx.scale(sc, sc); ctx.translate(-SHEET.w / 2, -eyeY(c));
    ctx.beginPath(); ctx.rect(0, 0, SHEET.w, SHEET.h); ctx.clip(); // a bust, cut where the cached ones are: the figure goes on to the feet
    drawOn(ctx, portraitOps(played), lit);
  } else {
    const b = bitmap(s, p, st), bh = sz * SHEET.h / SHEET.w, top = -eyeY(p.char) * sc;
    ctx.rotate(0.24 * swing); ctx.globalAlpha = lit;
    if (b) ctx.drawImage(b, -sz / 2, top, sz, bh);
    else { ctx.fillStyle = p.char.skin; ctx.fillRect(-sz / 4, top + bh * 0.2, sz / 2, bh / 2); } // no OffscreenCanvas (Node): a placeholder
  }
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
  s.bob = decay(s.bob, 6, dt); s.grin = decay(s.grin, 4, dt); s.blink = decay(s.blink, 20, dt); s.flash = decay(s.flash, 5, dt); s.glow = decay(s.glow, 0.5, dt);
  s.look.x = ease(s.look.x, s.lookTo.x, 9, dt); s.look.y = ease(s.look.y, s.lookTo.y, 9, dt);
  s.lookTo.x = ease(s.lookTo.x, 0, 0.6, dt); s.lookTo.y = ease(s.lookTo.y, 0, 0.6, dt); s.hueShift = ease(s.hueShift, s.hueTo, 2, dt);
}

/** The events, read the same way by every layout; `on.kick()`, `on.snare()` and `on.note()` are what the layout makes of a birth, a look up and a wedding. */
export function listen(s, events, on) {
  for (const e of events) {
    const slot = s.slotOf?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
    if (slot === 'impulse') {
      if (e.role === 'impact') on.snare();
      else if (e.role === 'grain') { if (s.t - s.lastBlink > 2.5) { s.blink = 1; s.lastBlink = s.t; } }
      else { on.kick(); s.bob = Math.max(s.bob, g); s.grin = Math.max(s.grin, g); }
    } else if (slot === 'ground') { if (e.note !== null) s.hueTo = ((e.note % 12) / 12) * 80 - 40; }
    else if (slot === 'line' || slot === 'counter') {
      if (e.note === null) continue;
      s.lookTo = { x: (e.pan - 0.5) * 2, y: 1 - 2 * clamp((e.note - 48) / 36) };
      if (slot === 'line') on.note();
    } else if (slot === 'field') s.glow = Math.min(1, 0.5 + 0.5 * g);
    else if (slot === 'transition') { if (e.dur >= 1) s.flash = 1; }
    else if (s.t - s.lastBlink > 2.5) { s.blink = 1; s.lastBlink = s.t; }
  }
}

/** The state every layout starts from: the palette, the cast's slots, the faces' dials, the tree's seed. */
export function baseState(score, rng, size) {
  const s = {
    pal: paletteOf(score, rng), aspect: size.w / size.h, t: 0,
    slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
    up: 0, upUntil: -1, upAt: [-1, -9], wedBar: -1, riser: 0, dark: 0, energy: 0.5,
    sway: 0, dance: 0, beat: 0, bob: 0, grin: 0, blink: 0, lastBlink: -9, look: { x: 0, y: 0 }, lookTo: { x: 0, y: 0 }, glow: 0, flash: 0, hueShift: 0, hueTo: 0,
  };
  seed(s, rng); s.key = s.rnd;
  return s;
}

/** The room: the background lit by the section, tinted by the bass. */
export function room(s, ctx, w, h, lit) {
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = hsla(s.pal.hue + s.hueShift, s.pal.sat * 0.5, lerp(9, 22, s.energy) * lit); ctx.fillRect(0, 0, w, h);
}

export default {
  name: 'family',

  init(score, rng, size) {
    const s = baseState(score, rng, size);
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
    const f = s.couples[nursery(s)], fa = s.people[f.a], gx = X(fa.x + 0.5), gy = Y(fa.y + 0.4);
    const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, 2 * k); gl.addColorStop(0, hsla(s.pal.field, 60, 60, 0.35 * s.glow * lit + 0.05)); gl.addColorStop(1, hsla(s.pal.field, 60, 50, 0));
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    // the lines: partners joined at the shoulder, a drop to a bar over the children, a stem to each
    ctx.strokeStyle = hsla(s.pal.hue, 20, 72, 0.55 * lit); ctx.lineWidth = Math.max(1, 0.025 * k);
    for (const c of s.couples) {
      const A = s.people[c.a], B = s.people[c.b], sy = Y(A.y + 0.45), m = (A.x + B.x) / 2;
      ctx.beginPath(); ctx.moveTo(X(A.x), sy); ctx.lineTo(X(B.x), sy);
      if (c.kids.length) {
        const kx = c.kids.map((i) => s.people[i].x), bar = Y(A.y + ROW - 0.75), mid = X(m);
        ctx.moveTo(mid, sy); ctx.lineTo(mid, bar); ctx.moveTo(X(Math.min(m, ...kx)), bar); ctx.lineTo(X(Math.max(m, ...kx)), bar); // the bar reaches the drop: a lone married child stands half a slot off it
        for (const i of c.kids) { const q = s.people[i]; ctx.moveTo(X(q.x), bar); ctx.lineTo(X(q.x), Y(q.y - 0.45 * q.size)); } // to the child's own head: a small one sits lower (scaled about its eyes); the bust covers the overshoot
      }
      ctx.stroke();
    }
    // the people: a bust a slot wide, eyes a little above its row line
    const live = new Set([f.a, f.b, ...f.kids]);
    for (const p of s.people) {
      const sz = k * p.size, sx = X(p.x), sy = Y(p.y) - 0.15 * sz;
      if (sx < -sz || sx > w + sz || sy < -sz * 1.5 || sy > h + sz) continue;
      ctx.save(); ctx.translate(sx, sy); bust(ctx, s, p, sz, live.has(p.id) && sz > LIVE * h, lit); ctx.restore();
    }
    if (s.flash > 0.01) { ctx.fillStyle = `rgba(255 250 235 / ${0.5 * s.flash})`; ctx.fillRect(0, 0, w, h); }
  },
};
