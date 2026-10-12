// web/visual/family.mjs: the tree (children between their parents, caps, a layout with no overlaps), then the world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../web/visual/kit.mjs';
import family, { blend, childOf, newTree, birth, marry, layout, MAX_PEOPLE } from '../web/visual/family.mjs';
import { ready } from './_scope.mjs';
import { clockOf, createPerformance, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';

const tree = (n = 1) => { const s = { t: 0 }; seed(s, () => n / 7); newTree(s); return s; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test('a child sits between its parents: colours mixed, numbers in range, no hat, deterministic', () => {
  const s = tree(), [A, B] = s.people.map((p) => p.char);
  const kid = childOf(A, B, s);
  rgb(kid.skin).forEach((v, i) => assert.ok(v >= Math.min(rgb(A.skin)[i], rgb(B.skin)[i]) - 1 && v <= Math.max(rgb(A.skin)[i], rgb(B.skin)[i]) + 1, 'skin channel between'));
  const lo = Math.min(A.face.width, B.face.width) * 0.97, hi = Math.max(A.face.width, B.face.width) * 1.03;
  assert.ok(kid.face.width >= lo && kid.face.width <= hi, 'face width between, give or take the noise');
  assert.equal(kid.hat.style, 'none');
  const s2 = tree(); assert.deepEqual(childOf(...s2.people.map((p) => p.char), s2), kid, 'same generator, same child');
  assert.equal(blend('round', 'round', s), 'round');
  assert.equal(blend(null, null, s), null);
});

test('births fill the focused couple up to its room and then wait; the line goes deep, one couple a generation; the cap holds', () => {
  const s = tree();
  assert.equal(s.people.length, 2); assert.equal(s.couples.length, 1);
  const room = s.couples[0].room;
  assert.ok(room >= 2 && room <= 5);
  for (let i = 0; i < 10; i++) { s.t += 1; birth(s); }
  assert.equal(s.couples[0].kids.length, room, 'founders stop at their room');
  assert.equal(s.people.length, 2 + room, 'and with nobody else married, births stop');
  s.t += 0.1; const n = s.people.length; s.t += 5; marry(s); s.lastBirth = s.t; assert.equal(birth(s), false, 'births are 0.4 s apart');
  assert.equal(s.people.length, n + 1, 'the marriage brought one in-law');
  for (let i = 0; i < 2000; i++) { s.t += 1; birth(s); if (i % 3 === 0) marry(s); }
  assert.ok(s.people.length <= MAX_PEOPLE, 'never past the cap');
  assert.ok(s.maxGen > 100, `the line went deep (${s.maxGen})`);
  assert.ok(s.couples.every((c, i) => s.people[c.a].gen === i), 'one couple a generation');
  assert.equal(s.couples[0].kids.length, room, 'the founders never had another child');
  for (const c of s.couples) assert.ok(c.kids.filter((k) => s.people[k].partner >= 0).length <= 1, 'at most one married child a couple');
});

test('marry takes the oldest unmarried blood child, old enough, and focuses the new couple', () => {
  const s = tree();
  s.t = 1; birth(s); s.t = 2; birth(s);
  assert.equal(marry(s), false, 'a newborn does not marry');
  s.t = 10; assert.equal(marry(s), true);
  const c = s.couples[s.focus], p = s.people[c.a], q = s.people[c.b];
  assert.equal(p.id, s.couples[0].kids[0], 'the first-born marries first');
  assert.ok(q.inlaw && q.gen === p.gen && p.partner === q.id && q.partner === p.id);
});

test('layout: no two people in one row overlap, children under their parents', () => {
  const s = tree(3);
  for (let i = 0; i < 400; i++) { s.t += 1; birth(s); if (i % 4 === 0) marry(s); }
  layout(s);
  const rows = new Map(); for (const p of s.people) { const r = rows.get(p.gen) ?? []; r.push(p.x); rows.set(p.gen, r); }
  for (const xs of rows.values()) { xs.sort((a, b) => a - b); for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 0.999, 'a slot apart'); }
  for (const c of s.couples) if (c.kids.length) {
    const mid = (s.people[c.a].x + s.people[c.b].x) / 2, kx = c.kids.map((k) => s.people[k].x);
    // the kids' blocks are centred on the couple; a married kid stands half a slot off its block's centre, so the drop lands within half a slot of the kids' span
    assert.ok(mid >= Math.min(...kx) - 0.5 - 1e-9 && mid <= Math.max(...kx) + 0.5 + 1e-9, 'kids under their parents');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'plain data');
});

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'family' }, [
  g.section('intro', 4, { role: 'establish', pad: { space: .8 }, drums: { density: .5 }, fx: { riser: 1 } }),
  g.section('drop', 4, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' } }),
]).strudel;
const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };
const MEL = { ...base, layer: 'melody', kind: 'melody', note: 72 };

test('family runs over a song with no randomness or clock of its own, deterministic, plain data', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = runWorld(family, song(g), 16);
    assert.ok(p.state.people.length > 4, 'kicks made children');
    assert.ok(p.state.couples.length > 1, 'the melody made a marriage');
    p.draw(ctxStub(), 320, 180);
  } finally { for (const u of undo) u(); }
  const a = JSON.stringify(runWorld(family, song(g), 16).state), b = JSON.stringify(runWorld(family, song(g), 16).state), c = JSON.stringify(runWorld(family, song(g, 4), 16).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = runWorld(family, song(g), 16).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('the music drives the tree and the camera', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), clock = clockOf(score, 0.1);
  const fresh = () => createPerformance(family, score, { w: 16, h: 9 }).state;
  const one = (ev, s = fresh(), c = clock) => { family.step(s, STEP, ev ? [ev] : [], c); return s; };
  const kicked = one(KICK);
  assert.equal(kicked.couples[0].kids.length, 1, 'a kick is a birth in the focused family');
  assert.ok(kicked.bob > 0.9);
  const hats = one({ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' });
  assert.ok(hats.blink > 0.9 && hats.people.length === 2, 'a hat blinks, no birth');
  const old = fresh(); for (let i = 0; i < 400; i++) family.step(old, STEP, i % 30 ? [] : [KICK], clock);
  const wed = one(MEL, old); assert.equal(wed.couples.length, 2, 'a melody note marries a grown child');
  assert.equal(wed.focus, 1, 'and the camera goes to the new couple');
  one(MEL, wed); assert.equal(wed.couples.length, 2, 'one marriage a bar');
  const back = one(SNARE, wed);
  assert.equal(back.back, 0, 'a snare looks back up to the parents');
  assert.ok(back.backUntil > back.t);
  const until = back.backUntil;
  one(SNARE, back, { ...clock, bar: 1 }); assert.equal(back.backUntil, until, 'not again inside two bars');
  one(SNARE, back, { ...clock, bar: 2 }); assert.ok(back.backUntil > until, 'two bars on, it may look again');
  assert.equal(back.back, 0, 'and still only one generation up');
  const top = one(SNARE); assert.ok(top.backUntil < top.t, 'the founders have no parents: a snare does nothing');
  const bound = fresh(); family.step(bound, STEP, [], clockOf(score, 4, clockOf(score, 3.9)));
  assert.ok(bound.wideUntil > bound.t, 'a boundary is a wide shot');
  const noKick = fresh(); for (let i = 0; i < 900; i++) family.step(noKick, STEP, i % 20 ? [] : [MEL], clockOf(score, i / 60));
  assert.equal(noKick.people.length, 2, 'no kicks, no births: the founders alone');
  const span = fresh().cam.span;
  assert.ok(Number.isFinite(span) && span > 0, 'the camera starts on the founders');
});

test('three minutes of kicks and melody go many generations deep, one line', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), clock = clockOf(score, 0.1), s = createPerformance(family, score, { w: 16, h: 9 }).state;
  for (let i = 0; i < 180 * 60; i++) family.step(s, STEP, i % 30 ? [] : [KICK, MEL], { ...clock, bar: Math.floor(i / 120) }); // a bar every two seconds
  assert.ok(s.maxGen > 10, `deep (${s.maxGen} generations)`);
  assert.ok(s.couples.every((c, i) => s.people[c.a].gen === i), 'one couple a generation');
  assert.equal(s.focus, s.couples.length - 1, 'the camera follows the newest couple');
});

test('draw: lines, every person on screen, the focused family live; Node has no OffscreenCanvas and falls back', async () => {
  const g = await ready;
  const p = runWorld(family, song(g), 16), ctx = ctxStub();
  assert.equal(typeof OffscreenCanvas, 'undefined');
  p.draw(ctx, 320, 180);
  assert.ok(ctx.calls.stroke > 0, 'tree lines');
  assert.ok(ctx.calls.save >= 2, 'the focused couple drawn live, each in its own transform');
  assert.ok(ctx.calls.fill > 40, 'portrait ops filled');
  const lone = createPerformance(family, composeVisual(song(g)), { w: 16, h: 9 }), c2 = ctxStub();
  lone.draw(c2, 320, 180);
  assert.ok(c2.calls.save >= 2, 'founders alone still draw');
});
