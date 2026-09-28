// web/visual/dish.mjs: the architecture a world must honour (injected randomness only, deterministic plain state,
// everything kept in the dish), plus what this world is about - every part is a species, every hit a birth until the
// species has its number, common parts small and many, rare parts big and few, nothing ever dies, and a hit moves its
// species. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import dish, { sizeOf, capOf } from '../web/visual/dish.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
const run = (ir, seconds = 8) => runWorld(dish, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'dish' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, melody2: { notes: '7 5 4 2' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const inDish = (s, o, r = 0) => Math.hypot(o.x - s.cx, o.y - s.cy) <= 0.6 - r + 1e-3;
const HAT = { ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' };

test('dish is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    assert.equal(composeVisual(song(g)).world, 'dish');
    p.draw(ctx, 320, 180);
    assert.ok(p.state.microbes.length > 10, 'a culture has grown from the hits');
    assert.ok(ctx.calls.stroke > p.state.microbes.length, 'a membrane per microbe, the rim');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('common parts breed small microbes and many, rare parts big and few', () => {
  assert.ok(sizeOf(8) < sizeOf(2) && sizeOf(2) < sizeOf(0.25), 'the size falls with the rate');
  assert.ok(capOf(sizeOf(8)) > 25 && capOf(sizeOf(0.25)) < 6, 'hats by the dozens, a pad chord by a handful');
});

test('every part is a species and every hit a birth until the number is reached, then a move; a drum voice is its own species; nothing ever dies', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), clock = clockOf(score, 0.1);
  const fresh = () => createPerformance(dish, score, { w: 16, h: 9 }).state;
  const one = (evs, s = fresh(), c = clock) => { dish.step(s, STEP, evs, c); return s; };
  const s = one([KICK, HAT, { ...base, layer: 'bass', kind: 'bass', note: 36 }, { ...base, layer: 'melody', kind: 'melody', note: 80, pan: 0.9 }, { ...base, layer: 'pad', kind: 'pad', note: 60, dur: 2, cutoff: 300 }]);
  assert.deepEqual(Object.keys(s.species).sort(), ['bass', 'drums:bd', 'drums:hh', 'melody', 'pad']);
  assert.equal(s.microbes.length, 5, 'one newborn per hit');
  assert.ok(s.microbes.every((m) => m.r < 0.01), 'born from a point');
  const mel = s.microbes.find((m) => m.sp === 'melody');
  assert.ok(mel.y < 0.4 && mel.x > s.cx, 'a pitched newborn arrives high and to the right of its note and pan');
  assert.ok(s.species['drums:hh'].size < s.species.pad.size && s.species['drums:hh'].cap > s.species.pad.cap, 'hats small and many, the pad big and few');
  const kinds = new Set(Object.values(s.species).map((x) => `${x.shape}/${x.motion}`)), hues = new Set(Object.values(s.species).map((x) => Math.round(x.hue)));
  assert.ok(kinds.size >= 3 && hues.size === 5, 'the species differ in shape, motion and colour');
  assert.ok(s.pulse > 0.9 && s.current.str > 0.4 && s.lamp.level > 0.9 && s.lamp.warm > 0.7, 'the kick is also the wave, the bass the current, the pad the lamp');
  const hats = fresh(); for (let i = 0; i < 400; i++) one([HAT], hats, clockOf(score, 0.1 + i / 400));
  const cap = hats.species['drums:hh'].cap, n = hats.microbes.length;
  assert.ok(n === cap && n > 50, `the species stops at its number (${n} of ${cap})`);
  for (let i = 0; i < 60; i++) one([], hats);
  const before = hats.microbes.map((m) => Math.hypot(m.vx, m.vy));
  one([HAT], hats);
  assert.equal(hats.microbes.length, n, 'a hit past the number is no birth');
  assert.ok(hats.microbes.some((m, i) => Math.hypot(m.vx, m.vy) > before[i]) && hats.microbes.every((m) => m.flash > 0.9), 'but every member moves and its nucleus lights');
  const st = fresh(); dish.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.ok(st.stain.a > 0.9 && inDish(st, st.stain), 'a boundary drops a stain on the dish');
  const dim = fresh(); for (let i = 0; i < 90; i++) dish.step(dim, STEP, [], clockOf(score, 3.5));
  assert.ok(dim.dark > 0.8);
  assert.ok(one([{ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }]).flash === 1, 'the fx impact is a flash');
  assert.equal(s.ripples.length, 5, 'every hit ripples the water');
  const rip = one([HAT]).ripples[0], rp = one([HAT]); for (let i = 0; i < 30; i++) one([], rp);
  assert.ok(rp.ripples[0].r > rip.r && rp.ripples[0].life > 0, 'a ripple spreads');
  for (let i = 0; i < 120; i++) one([], rp);
  assert.equal(rp.ripples.length, 0, 'and fades');
});

test('the microbes interact: no two overlap, a touch between species turns them apart, a ripple front shoves what it passes', async () => {
  const g = await ready;
  const p = run(song(g), 20), ms = p.state.microbes;
  assert.ok(ms.length > 20);
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) assert.ok(Math.hypot(ms[i].x - ms[j].x, ms[i].y - ms[j].y) >= ms[i].rc + ms[j].rc - 0.004, `${i} and ${j} overlap`);
  const score = composeVisual(song(g)), clock = clockOf(score, 0.1);
  const st = createPerformance(dish, score, { w: 16, h: 9 }).state;
  dish.step(st, STEP, [KICK, HAT], clock); for (let i = 0; i < 90; i++) dish.step(st, STEP, [], clock);
  const [a, b] = st.microbes; a.x = st.cx - a.rc * 0.5; a.y = st.cy; b.x = st.cx + b.rc * 0.5; b.y = st.cy; a.vx = b.vx = 0; a.vy = b.vy = 0; st.ripples = [];
  dish.step(st, STEP, [], clock);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.rc + b.rc - 1e-4 && Math.cos(a.a) < 0 && Math.cos(b.a) > 0 && a.flash > 0.3, 'pushed apart to touching, each turned away, both lit');
  const c = st.microbes[0]; c.x = st.cx; c.y = st.cy; c.vx = c.vy = 0;
  st.ripples = [{ x: st.cx - 0.1, y: st.cy, r: 0.1, v: 0, life: 0, span: 2, w: 1 }];
  const vx0 = c.vx; dish.step(st, STEP, [], clock);
  assert.ok(c.vx > vx0, 'the ripple front shoves it outward');
});

test('over a long run the culture only grows, every microbe stays in the dish, and none stands still', async () => {
  const g = await ready;
  const p = run(song(g), 20), n = p.state.microbes.length;
  assert.ok(n > 20 && p.state.microbes.every((m) => inDish(p.state, m, m.r * 0.5)));
  const at = p.state.microbes.map((m) => [m.x, m.y]);
  for (let t = 20; t <= 24; t += 1 / 30) p.advance(t, t * 0.5);
  assert.ok(p.state.microbes.length >= n, 'nothing dies');
  assert.ok(p.state.microbes.every((m, i) => i >= at.length || Math.hypot(m.x - at[i][0], m.y - at[i][1]) > 0.002), 'every microbe has moved');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(dish, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.microbes.length, 1);
  p.draw(ctxStub(), 320, 180);
});
