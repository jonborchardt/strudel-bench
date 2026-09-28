// web/visual/parlor.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired), plus what this world is about - the rocking chairs keep the beat, the sleepers
// breathe with the pads, the rest deal cards and walk the floor. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import parlor from '../web/visual/parlor.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { streamOf, ctxStub, run as runWorld, forbid, base } from './_visual.mjs';
const run = (ir, seconds = 3) => runWorld(parlor, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const who = (s, part) => s.residents[s.parts[part].res];

test('parlor is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.stroke > 10, 'the chairs and the residents stroke');
    assert.ok(ctx.calls.fillRect >= 5, 'the room is painted');
    assert.ok(ctx.calls.rotate >= 1, 'a chair rocks');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b);
  assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'plain data: no functions, no NaN, no Infinity');
});

test('every part is a resident of the kind its job says: the kit and bass rock, the pad sleeps, the melody plays cards, perc walks', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const s = createPerformance(parlor, score, { w: 16, h: 9 }).state;
  assert.deepEqual(s.order.sort(), Object.keys(score.cast).sort(), 'one record per cast part');
  assert.deepEqual(['drums', 'bass', 'pad', 'melody', 'perc'].map((n) => who(s, n).kind), ['rocker', 'rocker', 'sleeper', 'player', 'walker']);
  assert.equal(s.parts.fx.res, null, 'the fx part is the room itself, not a resident');
  assert.equal(new Set(s.residents.filter((r) => r.kind === 'rocker').map((r) => r.x)).size, 2, 'two rocking chairs, in two places');
  assert.ok(s.table && s.table.seats.filter((q) => q.res !== null).length === 1, 'the melody has a seat at the table');
});

test('a hit shoves the rocking chair, a pad note is a breath, a note deals a card from the seat its register picks, perc takes a step', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir), clock = clockOf(score, 0);
  const fresh = () => createPerformance(parlor, score, { w: 16, h: 9 }).state;
  const one = (ev) => { const s = fresh(); parlor.step(s, STEP, [ev], clock); return s; };
  const kicked = who(one({ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }), 'drums');
  assert.ok(Math.abs(kicked.w) > 0.5, `a kick shoves the chair (w ${kicked.w})`);
  const still = fresh(); for (let i = 0; i < 120; i++) parlor.step(still, STEP, [], clock);
  assert.ok(Math.abs(who(still, 'drums').a) > 0.001 && Math.abs(who(still, 'drums').a) < 0.2, 'left alone the chair still rocks, faintly');
  const rocked = fresh(); for (let i = 0; i < 120; i++) parlor.step(rocked, STEP, i % 30 === 0 ? [{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }] : [], clock);
  assert.ok(Math.abs(who(rocked, 'drums').a) <= 0.22, 'and never tips');
  const pad = who(one({ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 2 }), 'pad');
  assert.ok(pad.hold === 2 && pad.age < 0.1 && pad.chest > 0, 'a pad note holds the breath for its length');
  const s = fresh();
  const deal = (note) => parlor.step(s, STEP, [{ ...base, layer: 'melody', kind: 'melody', note }], clock);
  deal(60); deal(72);
  const seatOf = (note) => { deal(note); return s.table.cards.at(-1).seat; };
  assert.ok(seatOf(60) < seatOf(72), 'a low note is dealt from a lower seat than a high one, inside the part\'s own octave');
  assert.equal(s.table.cards.length, 4);
  assert.ok(s.table.seats[s.table.cards.at(-1).seat].reach > 0.9, 'the seat that dealt it reaches');
  const w = who(one({ ...base, layer: 'perc', kind: 'perc' }), 'perc');
  assert.ok(Math.abs(w.to - w.x) > 0.01 && w.bob > 0.9, 'a perc hit is a step');
  assert.ok(one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }).flash > 0.9, 'an fx impact flicks the lights');
  assert.equal(one({ ...base, layer: null, kind: 'pitched', note: 60 }).table.cards.length, 1, 'a pitched hap with no part still deals a card');
});

test('the clock alone: a boundary strikes the clock, a riser brings the nurse, a dropout goes dark', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const fresh = () => createPerformance(parlor, score, { w: 16, h: 9 }).state;
  const s = fresh();
  parlor.step(s, STEP, [], clockOf(score, 0));
  parlor.step(s, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(s.chime > 0.9, 'the clock strikes at the boundary');
  const calm = fresh(), rising = fresh();
  for (let i = 0; i < 60; i++) { parlor.step(calm, STEP, [], clockOf(score, 0)); parlor.step(rising, STEP, [], clockOf(score, 1.5)); }
  assert.ok(rising.nurse.on > 0.5 && calm.nurse.on < 0.05, 'the nurse comes in on the riser');
  const dark = fresh(); for (let i = 0; i < 60; i++) parlor.step(dark, STEP, [], clockOf(score, 3.5));
  assert.ok(dark.dark > 0.9, 'the dropout tail goes dark');
});

test('the cat sits on a lap, crosses the floor to another now and then, and the window has traffic', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir), clock = clockOf(score, 0);
  const s = createPerformance(parlor, score, { w: 16, h: 9 }).state;
  assert.equal(s.residents[s.cat.chair].kind, 'rocker', 'the cat starts on a rocking chair');
  const modes = new Set(), chairs = new Set([s.cat.chair]);
  for (let i = 0; i < 60 * 60; i++) { parlor.step(s, STEP, [], clock); modes.add(s.cat.mode); if (s.cat.chair !== null) chairs.add(s.cat.chair); }
  assert.ok(modes.has('walk') && chairs.size >= 2, `in a minute the cat gets down and finds another lap (${[...chairs]})`);
  assert.ok(s.outside.passers.length + s.outside.clouds.length > 3, 'something is going by outside');
  parlor.step(s, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(s.outside.passers.some((p) => p.kind === 'bus'), 'the bus goes by at a boundary');
  const hats = createPerformance(parlor, score, { w: 16, h: 9 }).state;
  for (let i = 0; i < 40; i++) parlor.step(hats, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }], clock);
  assert.ok(hats.outside.passers.some((p) => p.kind === 'bird'), 'hats lift birds off the tree');
});

test('a plain pattern (no song) runs on the fallback score, in a home with someone rocking and someone asleep', async () => {
  const g = await ready;
  const p = createPerformance(parlor, fallbackScore(0.5), { w: 16, h: 9 });
  assert.deepEqual(p.state.residents.map((r) => r.kind), ['rocker', 'sleeper']);
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.residents.filter((r) => r.kind === 'rocker').length, 2, 'the hit takes its own chair');
  p.draw(ctxStub(), 320, 180);
});
