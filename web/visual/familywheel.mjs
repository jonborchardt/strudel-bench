// familywheel: the family world's tree laid out as a wheel, and the whole of it always on screen. The two founders sit
// in the middle; every generation is a ring one bust further out (RING, more only when a ring is crowded), every grown
// robot one size, so the wheel grows outward and the camera
// zooms out slowly to keep every robot in frame, the wheel turning slowly as it grows so the newest birth drifts to the
// bottom, every robot upright to the frame like a car on a Ferris wheel. Many lines grow at once (up to LINES couples a
// generation), each couple with one to three children and most couples having some: a kick is a birth into the family
// on the outer rings with the fewest children so far, so the births go round the wheel; a melody note, once a bar,
// marries a grown child off, from the families with fewest married children first, so the lines spread. Each child is
// a robot with its parents' face genes (family.mjs childOf). A snare bumps the whole wheel. The lines play: each
// generation its own hue, moved by the bass, brighter with the section's energy, a bright wave running out from the
// founders to the rim on every kick, the family with the last birth glowing with the pad. Either side of the wheel (when
// the frame is wider than it) the newest robots stand whole, births alternating sides, each new one stepping up in front
// and the ones before it receding behind, smaller and dimmer, in a line that runs off the frame. The family that had the last
// birth sways and bobs; everyone dances, rusts and fades to sepia as in family.mjs, which
// this file shares its people with. Deterministic: randomness only from the state's own generator (kit.mjs).
import { ease, decay, hsla, rand } from './kit.mjs';
import { baseState, feel, listen, bust, figure, poseOf, room, lineStyle, person, wed, outsider, childOf, layout, BIRTH_GAP, WED_AGE, MAX_PEOPLE } from './family.mjs';

export const LINES = 12; // couples a generation at most: the wheel keeps this many family lines going
export const RING = 1; // the least gap between generations, in the units a bust is sized in
export const BUST = 0.85; // every grown robot's width, the newest children 0.7 of it
const SPACE = 1.1; // centre to centre along a ring, in busts
const TAU = Math.PI * 2;
/** An angle eased toward another the short way round, so a robot whose place crosses 0 does not fly round the wheel. */
export const easeAngle = (a, to, rate, dt) => a + (((to - a) % TAU + TAU * 1.5) % TAU - Math.PI) * (1 - Math.exp(-rate * dt));
const kids = (s) => 1 + Math.floor(rand(s) * 3); // children a couple will have: one to three

/** The founders, wed, in the middle. */
export function newWheel(s) {
  Object.assign(s, { people: [], couples: [], focus: 0, lastBirth: -BIRTH_GAP, maxGen: 0, pulse: 0, shown: [[0], [1]], shownAt: [-9, -9], side: 0 });
  wed(s, person(s, outsider(s), 0, -1, false), kids(s)); // the founders stand either side until the first births take their places
  place(s, true);
}

/** Where everyone goes. Every grown robot is one size (BUST). A ring sits one bust out from the ring inside it, or
 *  further only when it has more robots than that circle holds side by side; on it the robots go evenly round in the
 *  tree's leaf order (family.mjs layout, so children sit out from their parents), the ring turned to fit the tree best. */
export function place(s, snap = false) {
  layout(s);
  const W = Math.max(2, ...s.people.map((p) => p.x + 0.5)), rings = new Map();
  for (const p of s.people) { p.tz = BUST; if (!rings.has(p.gen)) rings.set(p.gen, []); rings.get(p.gen).push(p); }
  let r = 0;
  for (const gen of [...rings.keys()].sort((a, b) => a - b)) {
    const ring = rings.get(gen).sort((a, b) => a.x - b.x);
    if (gen === 0) { for (const p of ring) { p.ta = 0; p.tr = 0; } continue; }
    r = Math.max(r + RING, ring.length * BUST * SPACE / TAU);
    // evenly round the whole ring in the tree's order (no empty sectors), turned to sit as near as it can to where the tree wants each robot
    const want = ring.map((p) => TAU * p.x / W), even = ring.map((p, i) => TAU * i / ring.length);
    const turn = Math.atan2(want.reduce((t, a, i) => t + Math.sin(a - even[i]), 0), want.reduce((t, a, i) => t + Math.cos(a - even[i]), 0));
    ring.forEach((p, i) => { p.ta = (even[i] + turn + TAU) % TAU; p.tr = r; });
  }
  s.rim = r;
  for (const p of s.people) if (snap || p.a === undefined) { p.a = p.ta; p.r = p.tr; p.z = p.tz; }
}

/** A person's place in the world: the founders side by side in the middle, everyone else on their ring. */
const posOf = (p) => (p.gen === 0 ? [(p.inlaw ? 0.5 : -0.5) * p.z, 0] : [p.r * Math.cos(p.a), p.r * Math.sin(p.a)]);

/** A kick: a child for the family on the outer two rings with room and the fewest children so far. */
export function birth(s) {
  if (s.people.length >= MAX_PEOPLE || s.t - s.lastBirth < BIRTH_GAP) return false;
  const front = Math.max(...s.couples.map((q) => s.people[q.a].gen));
  const open = s.couples.map((q, i) => i).filter((i) => s.couples[i].kids.length < s.couples[i].room && s.people[s.couples[i].a].gen >= front - 1);
  if (!open.length) return false;
  const fewest = Math.min(...open.map((i) => s.couples[i].kids.length)), pick = open.filter((i) => s.couples[i].kids.length === fewest);
  s.focus = pick[Math.floor(rand(s) * pick.length)];
  const c = s.couples[s.focus], A = s.people[c.a], B = s.people[c.b];
  c.kids.push(person(s, childOf(A.char, B.char, s), A.gen + 1, s.focus, false).id);
  s.lastBirth = s.t; place(s);
  return true;
}

/** A melody note: a grown child of the oldest generation with room for another line marries, from the family with fewest married children, while the generation has room for another line. */
export function marry(s) {
  if (s.people.length >= MAX_PEOPLE) return false;
  const lines = new Map(); for (const c of s.couples) { const g = s.people[c.a].gen; lines.set(g, (lines.get(g) ?? 0) + 1); }
  // only where a couple can still have children (births go to the outer two rings of couples), so no line is wed into a dead end
  const front = Math.max(...s.couples.map((q) => s.people[q.a].gen));
  const grown = s.people.filter((p) => !p.inlaw && p.partner < 0 && p.parents >= 0 && p.gen >= front && s.t - p.born >= WED_AGE && (lines.get(p.gen) ?? 0) < LINES);
  if (!grown.length) return false;
  // the oldest generation with room first, so a generation fills out to its lines before the next begins
  const low = Math.min(...grown.map((p) => p.gen)), married = (p) => s.couples[p.parents].kids.filter((k) => s.people[k].partner >= 0).length;
  const pool = grown.filter((p) => p.gen === low), fewest = Math.min(...pool.map(married)), pick = pool.filter((p) => married(p) === fewest);
  wed(s, pick[Math.floor(rand(s) * pick.length)], kids(s)); place(s);
  return true;
}

/** The height the camera spans to hold the whole wheel: the outermost ring and a bust beyond it. */
export const wholeSpan = (s) => 2 * ((s.rim ?? 0) + 1.1 * RING);
/** The turn that puts the family with the last birth at the bottom of the frame. */
const aimTurn = (s) => { const c = s.couples[s.focus], p = s.people[c.kids.at(-1) ?? c.a]; return p.gen === 0 ? s.cam?.phi ?? 0 : Math.PI / 2 - p.a; };

export const QUEUE = 9; // robots kept in each side's line; the back ones are off the frame by then
/** A birth steps up beside the wheel on the side whose front robot has stood there longer, so births alternate left and
 *  right; the robots already on that side each step one place back. */
function showBorn(s, id) { const q = s.shown[s.side]; q.unshift(id); q.length = Math.min(q.length, QUEUE); s.shownAt[s.side] = s.t; s.side = 1 - s.side; }

/** The frame either side of the wheel: each side a line of robots standing whole, the newest in front and every one
 *  before it a step further back, smaller, dimmer, higher and nearer the edge, so the line runs off the frame. The line
 *  steps back smoothly when a robot arrives. */
function sides(s, ctx, w, h, lit) {
  const pw = (w - h) / 2;
  if (pw < 0.12 * h) return; // a frame about as narrow as the wheel has no sides
  const fh = Math.min(h * 0.8, pw * 0.95 * FIG_ASPECT), fy = h * 0.92;
  s.shown.forEach((q, side) => {
    const out = side ? 1 : -1, cx = side ? w - pw / 2 : pw / 2, arrive = 1 - Math.exp(-(s.t - s.shownAt[side]) * 5);
    const gy = fy - fh / 2, gl = ctx.createRadialGradient(cx, gy, 0, cx, gy, fh * 0.6); gl.addColorStop(0, hsla(s.pal.field, 60, 60, (0.15 + 0.3 * s.glow) * lit)); gl.addColorStop(1, hsla(s.pal.field, 60, 50, 0));
    ctx.fillStyle = gl; ctx.fillRect(cx - fh * 0.6, gy - fh * 0.6, fh * 1.2, fh * 1.2);
    for (let i = q.length - 1; i >= 0; i--) { // back to front
      const e = i - 1 + arrive, sc = RECEDE ** e, x = cx + out * pw * 0.2 * (1 - sc) / (1 - RECEDE), y = fy - h * 0.06 * (1 - sc) / (1 - RECEDE);
      const a = lit * DIM ** Math.max(0, e) * Math.min(1, 1 + e); // the newest fades in as it steps up from in front
      if (a < 0.03) continue;
      const who = s.people[q[i]]; ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); figure(ctx, s, who, fh, a, i ? 0 : poseOf(s, who)); ctx.restore(); // the front one strikes poses to the music; the line behind sways, each its own way
    }
  });
}
const RECEDE = 0.8, DIM = 0.82; // each step back in a side's line: this much the size, this much the light
const FIG_ASPECT = 1284 / 580; // limner's whole figure, tall over wide

export default {
  name: 'familywheel',

  init(score, rng, size) {
    const s = baseState(score, rng, size);
    newWheel(s);
    s.cam = { span: wholeSpan(s), phi: 0 };
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    feel(s, dt, clock);
    s.pulse = decay(s.pulse, 5, dt);
    listen(s, events, { kick: () => { if (birth(s)) showBorn(s, s.people.length - 1); }, snare: () => { s.pulse = 1; }, note: () => { if (clock.bar !== s.wedBar && marry(s)) s.wedBar = clock.bar; } });
    for (const p of s.people) {
      p.a = easeAngle(p.a, p.ta, 3, dt); p.r = ease(p.r, p.tr, 3, dt); p.z = ease(p.z, p.tz, 3, dt);
      p.size = ease(p.size, s.maxGen - p.gen === 0 && p.gen > 0 ? 0.7 : 1, 2, dt);
    }
    // the slow zoom out (never in: nobody leaves the frame) and the slow turn, the shortest way round
    const c = s.cam;
    c.span = Math.max(ease(c.span, wholeSpan(s), 0.8, dt), 2 * Math.max(...s.people.map((p) => p.r + 0.6 * p.z)));
    c.phi = easeAngle(c.phi, aimTurn(s), 0.4, dt);
  },

  draw(s, ctx, w, h) {
    const lit = 1 - 0.55 * s.dark, c = s.cam, k = h / (c.span * (1 + 0.04 * s.pulse));
    room(s, ctx, w, h, lit);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(k, k); ctx.rotate(c.phi);
    const n = s.couples[s.focus], [gx, gy] = posOf(s.people[n.a]), gr = 3 * RING;
    const gl = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr); gl.addColorStop(0, hsla(s.pal.field, 60, 60, 0.35 * s.glow * lit + 0.05)); gl.addColorStop(1, hsla(s.pal.field, 60, 50, 0));
    ctx.fillStyle = gl; ctx.fillRect(gx - gr, gy - gr, 2 * gr, 2 * gr); // the glow's own square, not a field four frames wide
    // the lines: partners joined, a spoke out from the couple to an arc half way to the next ring, a spoke to each child,
    // playing (family.mjs lineStyle: a hue a generation, the bass, the energy, a kick's wave out to the rim, the pad's glow)
    for (let qi = 0; qi < s.couples.length; qi++) {
      const q = s.couples[qi], A = s.people[q.a], B = s.people[q.b], [ax, ay] = posOf(A), [bx, by] = posOf(B), ch = q.kids.map((i) => s.people[i]);
      lineStyle(ctx, s, A.gen, qi === s.focus, 1 / k, lit);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      if (ch.length) {
        const rm = (A.r + ch[0].r) / 2, am = A.gen === 0 ? ch[0].a : (Math.atan2(ay + by, ax + bx) + TAU) % TAU; // in the children's 0..TAU, or the arc runs the long way round
        const rel = ch.map((p) => ((p.a - am) % TAU + TAU * 1.5) % TAU - Math.PI).concat(0), lo = am + Math.min(...rel), hi = am + Math.max(...rel); // round the short way, whichever side of 0 the children fall
        ctx.moveTo((ax + bx) / 2, (ay + by) / 2); ctx.lineTo(rm * Math.cos(am), rm * Math.sin(am));
        ctx.moveTo(rm * Math.cos(lo), rm * Math.sin(lo)); ctx.arc(0, 0, rm, lo, hi);
        for (const p of ch) { ctx.moveTo(rm * Math.cos(p.a), rm * Math.sin(p.a)); ctx.lineTo(p.r * Math.cos(p.a), p.r * Math.sin(p.a)); }
      }
      ctx.stroke();
    }
    // the people, upright to the frame; the family with the last birth live
    const live = new Set([n.a, n.b, ...n.kids]); // the family with the last birth sways and bobs
    for (const p of s.people) {
      const z = p.z * p.size, [x, y] = posOf(p);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-c.phi);
      bust(ctx, s, p, z, z * k, lit, live.has(p.id)); ctx.restore();
    }
    ctx.restore();
    sides(s, ctx, w, h, lit);
    if (s.flash > 0.01) { ctx.fillStyle = `rgba(255 250 235 / ${0.5 * s.flash})`; ctx.fillRect(0, 0, w, h); }
  },
};
