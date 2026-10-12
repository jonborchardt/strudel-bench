// web/visual/familywheel.mjs: the family tree as a wheel. Many lines at once (never more than LINES couples a
// generation), the founders in the middle and every generation a ring further out, the babies always in frame while
// the camera turns round the rim, deterministic plain data, and drawn on a stub with Node's missing OffscreenCanvas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import wheel, { LINES, RING, BUST, easeAngle, lineage } from '../web/visual/familywheel.mjs';
import { clockOf, createPerformance, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'familywheel' }, [
  g.section('intro', 4, { role: 'establish', pad: { space: .8 }, drums: { density: .5 }, fx: { riser: 1 } }),
  g.section('drop', 4, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' } }),
]).strudel;
const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };
const MEL = { ...base, layer: 'melody', kind: 'melody', note: 72 };
/** Three minutes of a busy song: kicks, a melody note and now and then a snare, a bar every two seconds, a section every sixteen bars. */
const long = (g, check) => {
  const score = composeVisual(song(g)), s = createPerformance(wheel, score, { w: 16, h: 9 }).state;
  for (let i = 0; i < 180 * 60; i++) {
    const bar = Math.floor(i / 120), c = { ...clockOf(score, 0.1), bar, index: Math.floor(bar / 16), boundary: i % 1920 === 0 && i > 0 };
    wheel.step(s, STEP, i % 30 ? (i % 45 ? [] : [SNARE]) : [KICK, MEL], c);
    check?.(s, i);
  }
  return s;
};

test('familywheel runs over a song with no randomness or clock of its own, deterministic, plain data, and draws', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = runWorld(wheel, song(g), 16), ctx = ctxStub();
    assert.ok(p.state.people.length > 4, 'kicks made children');
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.stroke > 0 && ctx.calls.save >= 3, 'lines, and each bust in its own transform');
    const lone = createPerformance(wheel, composeVisual(song(g)), { w: 16, h: 9 }), c2 = ctxStub();
    lone.draw(c2, 320, 180);
    assert.ok(c2.calls.save >= 3, 'the founders alone still draw');
  } finally { for (const u of undo) u(); }
  const a = JSON.stringify(runWorld(wheel, song(g), 16).state), b = JSON.stringify(runWorld(wheel, song(g), 16).state), c = JSON.stringify(runWorld(wheel, song(g, 4), 16).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = runWorld(wheel, song(g), 16).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('a kick sends a wave out along the lines; the sides show the newest robot and the line it came down', async () => {
  const g = await ready, s = long(g), score = composeVisual(song(g));
  const line = lineage(s);
  assert.ok(line.length === s.people[line[0].id].gen + 1, 'from the newest robot back to a founder, one a generation');
  assert.ok(line.slice(1).every((p, i) => s.couples[line[i].parents].a === p.id), 'each the blood parent of the one before');
  assert.equal(line.at(-1).gen, 0);
  const t0 = s.t; wheel.step(s, STEP, [KICK], clockOf(score, 0.1)); assert.equal(s.kickT, t0 + STEP, 'the kick starts the wave');
  const wide = ctxStub(), square = ctxStub();
  wheel.draw(s, wide, 320, 180); wheel.draw(s, square, 180, 180);
  assert.ok(wide.calls.save - square.calls.save >= 2, 'a wide frame draws the sides (the newest robot and its line), a square one does not');
});

test('many lines, most families with children, one to three each, rings a bust apart, going deep', async () => {
  const g = await ready, s = long(g);
  const per = new Map(); for (const c of s.couples) { const gen = s.people[c.a].gen; per.set(gen, (per.get(gen) ?? 0) + 1); }
  assert.ok([...per.values()].every((n) => n <= LINES), 'at most LINES couples a generation');
  assert.ok([...per.values()].some((n) => n >= 6), `many lines at once (${[...per.values()].join(' ')})`);
  assert.ok(s.maxGen >= 8, `deep (${s.maxGen} generations)`);
  assert.ok(s.couples.every((c) => c.room >= 1 && c.room <= 3 && c.kids.length <= c.room), 'one to three children a couple');
  const settled = s.couples.filter((c) => s.people[c.a].gen < s.maxGen - 1);
  assert.ok(settled.filter((c) => c.kids.length).length >= 0.8 * settled.length, `most families had children (${settled.filter((c) => c.kids.length).length} of ${settled.length})`);
  assert.ok(s.people.every((p) => p.tz === BUST), 'every robot one size (the newest children are scaled by their growing, not their ring)');
  const radius = [...new Set(s.people.map((p) => p.gen))].sort((a, b) => a - b).map((g) => s.people.find((p) => p.gen === g).tr);
  assert.equal(radius[0], 0, 'the founders in the middle');
  for (let g = 1; g < radius.length; g++) {
    const n = s.people.filter((p) => p.gen === g).length, least = Math.max(radius[g - 1] + RING, n * BUST * 1.1 / (2 * Math.PI));
    assert.ok(Math.abs(radius[g] - least) < 1e-9, `ring ${g} sits one bust out, or just far enough to hold its ${n} robots`);
    const at = s.people.filter((p) => p.gen === g).map((p) => p.ta).sort((a, b) => a - b);
    for (let i = 1; i < at.length; i++) assert.ok((at[i] - at[i - 1]) * radius[g] >= BUST - 1e-9, `no two robots on ring ${g} overlap`);
  }
});

test('a robot whose place crosses 0 goes the short way, never round the wheel', async () => {
  assert.ok(easeAngle(6.2, 0.1, 3, 1 / 60) > 6.2, 'from just under a turn to just over 0: forward across 0');
  assert.ok(easeAngle(0.1, 6.2, 3, 1 / 60) < 0.1, 'and back across it');
  const g = await ready, was = new Map(); let worst = 0;
  long(g, (s) => { for (const p of s.people) { if (was.has(p.id)) worst = Math.max(worst, Math.abs(p.a - was.get(p.id))); was.set(p.id, p.a); } });
  assert.ok(worst < 0.1, `no robot jumps along its ring in a step (worst ${worst.toFixed(3)} rad)`);
});

test('everyone is always on screen: the camera zooms out slowly and never in', async () => {
  const g = await ready;
  let checked = 0, last = 0; const turns = new Set();
  long(g, (s, i) => {
    if (i % 10) return;
    const c = s.cam, half = c.span / 2 + 1e-9;
    assert.ok(c.span >= last - 1e-9, `no zoom in at step ${i}`); last = c.span;
    turns.add(Math.round(c.phi * 4));
    for (const p of s.people) { assert.ok(Math.hypot(p.r * Math.cos(p.a), p.r * Math.sin(p.a)) + 0.5 * p.z <= half, `robot ${p.id} in frame at step ${i}`); checked++; }
  });
  assert.ok(checked > 10000, `checked ${checked}`);
  assert.ok(turns.size > 2, 'the wheel turns as it grows');
});
