// web/visual/family.mjs: the tree (children between their parents, caps, a layout with no overlaps), then the world.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, rand } from '../web/visual/kit.mjs';
import family, { blend, childOf, newTree, birth, marry, layout, MAX_PEOPLE, nursery, poseOf, POSES } from '../web/visual/family.mjs';
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
  assert.ok([A.eyes.iris, B.eyes.iris].includes(kid.eyes.iris) && kid.mouth.color === kid.eyes.iris, "one parent's eye light, never a mix");
  assert.ok(kid.makeup?.includes('plating'), 'a robot, plated');
  for (const k of ['top', 'pose']) assert.ok(kid[k] !== A[k] && kid[k] !== B[k], `its own ${k}, not a parent's`);
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

test('marry takes a grown unmarried child of the focused couple, and focuses the new couple', () => {
  const s = tree(); s.couples[0].room = 5;
  s.t = 1; birth(s); s.t = 2; birth(s);
  assert.equal(marry(s), false, 'a family still having children does not marry one off');
  s.t = 10; assert.equal(marry(s), true);
  const c = s.couples[s.focus], p = s.people[c.a], q = s.people[c.b];
  assert.ok(s.couples[0].kids.includes(p.id), 'a child of the founders marries');
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
  assert.equal(kicked.kickT, kicked.t, 'and starts the wave down the lines');
  const hats = one({ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' });
  assert.ok(hats.blink > 0.9 && hats.people.length === 2, 'a hat blinks, no birth');
  const old = fresh(); for (let i = 0; i < 400; i++) family.step(old, STEP, i % 30 ? [] : [KICK], clock);
  const wed = one(MEL, old); assert.equal(wed.couples.length, 2, 'a melody note marries a grown child');
  assert.equal(wed.focus, 1, 'and the camera goes to the new couple');
  one(MEL, wed); assert.equal(wed.couples.length, 2, 'one marriage a bar');
  assert.equal(nursery(wed), 0, 'the newlyweds have no babies yet: the camera stays on the family that has them');
  const back = one(SNARE, wed);
  assert.ok(back.up === 1 && back.upUntil > back.t, 'a snare looks one generation up');
  const until = back.upUntil;
  one(SNARE, back, { ...clock, bar: 1 }); assert.equal(back.upUntil, until, 'not again inside two bars');
  one(SNARE, back, { ...clock, bar: 2 }); assert.ok(back.upUntil > until && back.up === 1, 'two bars on, it may look again, still one up');
  const levels = new Set(); for (let i = 0; i < 60; i++) { const b = fresh(); for (let j = 0; j < i; j++) rand(b); family.step(b, STEP, [], clockOf(score, 4, clockOf(score, 3.9))); levels.add(b.up); }
  assert.deepEqual([...levels].sort(), [1, 2], 'a boundary looks up one, now and then two');
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
  const at = s.couples.slice(0, -1).map((c, i) => c.kids.indexOf(s.couples[i + 1].a));
  assert.ok(at.some((x) => x > 0), `the line is not always the leftmost child (${at.join(' ')})`);
});

test('a standing robot strikes poses to the music, each robot its own way', () => {
  const calm = { pulse: 0, dance: 0, bob: 0, beat: 0, lookTo: { x: 0, y: 0 } }, a = { id: 1 };
  assert.equal(poseOf(calm, a), 0, 'still music: standing');
  assert.ok([4, 5].includes(poseOf({ ...calm, pulse: 1 }, a)), 'a snare: hands up or a point');
  assert.equal(POSES[poseOf({ ...calm, pulse: 1 }, a)].props?.length, 1, 'an arm pose');
  assert.equal(poseOf({ ...calm, bob: 1 }, a), 3, 'a kick: a nod');
  assert.deepEqual([poseOf({ ...calm, lookTo: { x: -1, y: 0 } }, a), poseOf({ ...calm, lookTo: { x: 1, y: 0 } }, a)], [1, 2], 'the melody turns the head to its side');
  const dancing = (p) => [0, 1, 2, 3, 4, 5, 6, 7].map((beat) => poseOf({ ...calm, dance: 1, beat }, p));
  assert.ok(new Set(dancing(a)).size >= 2, 'a dance break moves the head beat by beat');
  const ids = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => dancing({ id }).join());
  assert.ok(new Set(ids).size >= 3, `robots dance differently (${ids.join(' | ')})`);
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8].some((id) => poseOf({ ...calm, pulse: 1 }, { id }) !== poseOf({ ...calm, pulse: 1 }, a)), 'and answer a snare differently');

});

test('dance breaks: a loud section dances all through, a middling one the last two bars of every eight, a quiet one never', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), c0 = clockOf(score, 0.1);
  const after = (energy, bar) => { const s = createPerformance(family, score, { w: 16, h: 9 }).state; for (let i = 0; i < 60; i++) family.step(s, STEP, [], { ...c0, energy, bar }); return s.dance; };
  assert.ok(after(0.9, 1) > 0.9, 'loud: dancing');
  assert.ok(after(0.5, 6) > 0.9 && after(0.5, 2) < 0.1, 'middling: a break at the end of the eight');
  assert.ok(after(0.2, 7) < 0.1, 'quiet: still');
});

test('the babies are always on screen, through births, marriages, snares and boundaries', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), s = createPerformance(family, score, { w: 16, h: 9 }).state;
  let checked = 0;
  for (let i = 0; i < 120 * 60; i++) {
    const bar = Math.floor(i / 120), c = { ...clockOf(score, 0.1), bar, index: Math.floor(bar / 8), boundary: i % 960 === 0 && i > 0 };
    family.step(s, STEP, i % 30 ? (i % 45 ? [] : [SNARE]) : [KICK, MEL], c);
    if (i % 10) continue;
    const n = s.couples[nursery(s)], halfH = s.cam.span / 2, halfW = halfH * 16 / 9;
    for (const k of n.kids) { const p = s.people[k]; assert.ok(Math.abs(p.x - s.cam.x) < halfW && Math.abs(p.y - s.cam.y) < halfH, `baby ${k} in frame at step ${i}`); checked++; }
  }
  assert.ok(checked > 500);
});

test('draw: lines and a picture per person, never limner frame by frame; Node has no OffscreenCanvas and draws placeholders', async () => {
  const g = await ready;
  const p = runWorld(family, song(g), 16), ctx = ctxStub();
  assert.equal(typeof OffscreenCanvas, 'undefined');
  p.draw(ctx, 320, 180);
  assert.ok(ctx.calls.stroke > 0, 'tree lines');
  assert.ok(ctx.calls.save >= 2, 'each person in its own transform');
  assert.ok(ctx.calls.fillRect >= 3, 'a placeholder per person on screen');
  assert.ok(!ctx.calls.fill, 'no limner ops drawn in the frame: a robot costs it ~20 ms, so the pictures are cached');
  const lone = createPerformance(family, composeVisual(song(g)), { w: 16, h: 9 }), c2 = ctxStub();
  lone.draw(c2, 320, 180);
  assert.ok(c2.calls.save >= 2, 'founders alone still draw');
});
