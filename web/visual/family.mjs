// family: the song grows one family line, deeper and deeper, and the camera sits on its newest family. Two founders
// stand at the top as busts (never legs); a kick is a birth into the family on screen, a new child growing in under
// the couple, until the couple's room is full; a melody note, once a bar, marries that family's eldest grown child to
// someone from outside, and the camera goes down to the new couple (coder's Enter and scroll), so each generation is
// one couple and its children and the families above never change again: the song follows one line in time, not
// every branch. A snare looks back up to the parents' family for two seconds, at most once every two bars, and only
// one generation (coder's cursor going back up the file); a boundary or a riser pulls out to the last three
// generations of the line (coder's new tab). Each child is a blend of its two
// parents (childOf), so the family's face drifts down the tree and every in-law brings new blood. Age is how many
// generations sit below you: the newest are children, then adults, then grey, then sepia, like portraits on a wall.
// The family on screen is played as the faces world plays its face: the bar sways it, a kick grins, hats blink, the
// melody moves the eyes, the bass tints the room, the pad glows behind them, a dropout dims and shuts the eyes.
// Deterministic: randomness only from the state's own generator (kit.mjs).
import { clamp, lerp, decay, ease, hsla, seed, rand, paletteOf, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, characterOf, mix } from './limner.mjs';

export const ROW = 1.5; // generations apart, in slots (a slot is one bust's width)
export const MAX_PEOPLE = 1000; // a safety cap only: the tree is one line (a couple and its children a generation), so a long song goes deep, not wide
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

/** A child for the focused couple, up to its room; when it is full, births wait for a marriage. */
export function birth(s) {
  const c = s.couples[s.focus];
  if (s.people.length >= MAX_PEOPLE || s.t - s.lastBirth < BIRTH_GAP || c.kids.length >= c.room) return false;
  const A = s.people[c.a], B = s.people[c.b];
  c.kids.push(person(s, childOf(A.char, B.char, s), A.gen + 1, s.focus, false).id);
  s.lastBirth = s.t; layout(s);
  return true;
}

/** The focused couple's eldest child old enough marries an outsider, and the focus goes down to the new couple: the line goes one generation deeper, and the couples above never change again. */
export function marry(s) {
  if (s.people.length >= MAX_PEOPLE) return false;
  const p = s.couples[s.focus].kids.map((k) => s.people[k]).find((q) => q.partner < 0 && s.t - q.born >= WED_AGE);
  if (!p) return false;
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

const BACK = 2, WIDE = 2; // seconds a snare's look back and a boundary's wide shot last

/** The box around some people, padded to a bust. */
const boxOf = (ps) => ({ x0: Math.min(...ps.map((p) => p.x)) - 0.6, x1: Math.max(...ps.map((p) => p.x)) + 0.6, y0: Math.min(...ps.map((p) => p.y)) - 0.7, y1: Math.max(...ps.map((p) => p.y)) + 0.8 });
const familyBox = (s, ci) => { const c = s.couples[ci]; return boxOf([c.a, c.b, ...c.kids].map((i) => s.people[i])); };
const wideBox = (s) => boxOf(s.people.filter((p) => p.gen >= s.maxGen - 2));
/** Where the camera wants to be: centre and the height in slots that fits the box at this aspect. */
const aim = (b, aspect) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, span: Math.max(b.y1 - b.y0, (b.x1 - b.x0) / aspect) });

/** A snare looks up one generation, to the focused couple's parents' family, at most once every two bars; the founders have nobody to look up to. */
function lookBack(s, clock) {
  const up = s.people[s.couples[s.focus].a].parents;
  if (up < 0 || (clock.index === s.backAt[0] && clock.bar - s.backAt[1] < 2)) return;
  s.back = up; s.backUntil = s.t + BACK; s.backAt = [clock.index, clock.bar];
}

const SHEET = { w: 400, h: 480 };
const LIVE = 0.22; // a bust taller than this share of the frame is drawn live and played; smaller ones come from the cache
const GREY = '#b9b6ae', BMP = 240; // the cache's width in pixels: LIVE of a 1080p frame, so a cached bust is never stretched there
const stageOf = (s, p) => (s.maxGen === 0 ? 1 : Math.min(3, s.maxGen - p.gen)); // 0 child, 1 adult, 2 grey, 3 sepia; founders alone are adults
/** The character as its age shows: a child has no beard, grey from the grandparents up. */
const aged = (c, st) => (st === 0 ? { ...c, facialHair: { style: 'none' } } : st >= 2 ? { ...c, hairColor: mix(c.hairColor, GREY, 0.75) } : c);
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

export default {
  name: 'family',

  init(score, rng, size) {
    const s = {
      pal: paletteOf(score, rng), aspect: size.w / size.h, t: 0,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      back: 0, backUntil: -1, backAt: [-1, -9], wideUntil: -1, wedBar: -1, riser: 0, dark: 0, energy: 0.5,
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
    if (clock.boundary) s.wideUntil = s.t + WIDE;
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.sway = Math.sin(((clock.bar % 2) + clock.barPhase) * Math.PI) * lerp(0.15, 1, s.energy);
    s.bob = decay(s.bob, 6, dt); s.grin = decay(s.grin, 4, dt); s.blink = decay(s.blink, 20, dt); s.flash = decay(s.flash, 5, dt); s.glow = decay(s.glow, 0.5, dt);
    s.look.x = ease(s.look.x, s.lookTo.x, 9, dt); s.look.y = ease(s.look.y, s.lookTo.y, 9, dt);
    s.lookTo.x = ease(s.lookTo.x, 0, 0.6, dt); s.lookTo.y = ease(s.lookTo.y, 0, 0.6, dt); s.hueShift = ease(s.hueShift, s.hueTo, 2, dt);
    for (const e of events) {
      const slot = s.slotOf?.[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5);
      if (slot === 'impulse') {
        if (e.role === 'impact') lookBack(s, clock);
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
    const lit = 1 - 0.55 * s.dark, k = h / s.cam.span;
    const X = (x) => w / 2 + (x - s.cam.x) * k, Y = (y) => h / 2 + (y - s.cam.y) * k;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = hsla(s.pal.hue + s.hueShift, s.pal.sat * 0.5, lerp(9, 22, s.energy) * lit); ctx.fillRect(0, 0, w, h);
    // the pad's glow behind the family on screen
    const f = s.couples[s.t < s.backUntil ? s.back : s.focus], fa = s.people[f.a], gx = X(fa.x + 0.5), gy = Y(fa.y + 0.4);
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
      const sz = k * p.size, sx = X(p.x), sy = Y(p.y) - 0.15 * sz, sc = sz / SHEET.w, st = stageOf(s, p);
      if (sx < -sz || sx > w + sz || sy < -sz * 1.5 || sy > h + sz) continue;
      if (live.has(p.id) && sz > LIVE * h) {
        const c = aged(p.char, st), played = { ...c,
          pose: { ...c.pose, headX: s.sway * 10, headY: (c.pose?.headY ?? 0) - 8 * s.bob, headTilt: (c.pose?.headTilt ?? 0) + s.sway * 0.06 },
          eyes: { ...c.eyes, openness: c.eyes.openness * (1 - s.blink) * (1 - 0.85 * s.dark) + 0.02, look: { x: s.look.x, y: s.look.y } },
          mouth: { ...c.mouth, smile: lerp(-0.1, 0.4, s.energy) + 0.35 * s.grin } };
        ctx.save(); if (st >= 3) ctx.filter = SEPIA;
        ctx.translate(sx, sy); ctx.scale(sc, sc); ctx.translate(-SHEET.w / 2, -eyeY(c));
        ctx.beginPath(); ctx.rect(0, 0, SHEET.w, SHEET.h); ctx.clip(); // a bust, cut where the cached ones are: the figure goes on to the feet
        drawOn(ctx, portraitOps(played), lit); ctx.restore();
        continue;
      }
      const b = bitmap(s, p, st), bw = sz, bh = sz * SHEET.h / SHEET.w, top = sy - eyeY(p.char) * sc;
      ctx.globalAlpha = lit;
      if (b) ctx.drawImage(b, sx - bw / 2, top, bw, bh);
      else { ctx.fillStyle = p.char.skin; ctx.fillRect(sx - bw / 4, top + bh * 0.2, bw / 2, bh / 2); } // no OffscreenCanvas (Node): a placeholder
      ctx.globalAlpha = 1;
    }
    if (s.flash > 0.01) { ctx.fillStyle = `rgba(255 250 235 / ${0.5 * s.flash})`; ctx.fillRect(0, 0, w, h); }
  },
};
