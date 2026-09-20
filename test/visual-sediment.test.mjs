// web/visual/sediment.mjs: the geological world on the same interface as tunnel and ink. The architecture it must
// honour (injected randomness, deterministic plain state, every job a deposit, strata closed at boundaries, a
// climax folding and a riser faulting what came before, deformation kept in state), not how the rock looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import sediment from '../web/visual/sediment.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'sediment' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const streamOf = (ir) => {
  const out = [];
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers))
    for (const h of l.pattern.queryArc(0, s.cycles)) if (h.hasOnset()) { const c = s.offset + h.whole.begin.valueOf(); out.push(eventOf(h, name, layerBase(name), c / ir.meta.cps)); }
  return out.sort((a, b) => a.t - b.t);
};
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const run = (ir, seconds = 8, draw = null) => {
  const p = createPerformance(sediment, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };

test('sediment is importable in Node and paints on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'sediment');
    assert.ok(p.state.marks.length > 20, 'the song left deposits');
    assert.ok(ctx.calls.fill > 10 && ctx.calls.stroke > 5, 'strata, clasts and veins');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job deposits: a kick a clast that lifts the surface, an impact a crack with chips and a crater, hats sand, the bass a lens, a melody a vein joining its last note and carving down, the pad haze, the impact chips', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const one = (evs, cycle = 0, st = null) => { st ??= createPerformance(sediment, score).state; sediment.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const kinds = (st) => st.marks.map((m) => m.kind);
  const kick = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }]);
  assert.deepEqual(kinds(kick), ['clast']); assert.ok(kick.surf.some((r) => r > 0), 'the stone relieves the surface');
  const snare = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]);
  assert.ok(kinds(snare).includes('crack') && kinds(snare).filter((k) => k === 'clast').length >= 2, 'a crack and chips');
  assert.ok(snare.surf.some((r) => r < 0), 'a crater');
  assert.deepEqual(kinds(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }])), ['speck']);
  const bass = one([{ ...base, layer: 'bass', kind: 'bass', note: 36, dur: 1 }]);
  assert.equal(bass.marks[0].kind, 'lens'); assert.ok(bass.marks[0].rx > 0.1, 'the length of the note is the width');
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 60 }]);
  assert.deepEqual(kinds(mel), ['vein']);
  one([{ ...base, layer: 'melody', kind: 'melody', note: 67 }], .25, mel);
  assert.ok(mel.marks[1].x2 > mel.marks[1].x, 'a higher note is further across; the second joins the first');
  assert.ok(mel.surf.some((r) => r < 0), 'the vein carves');
  const pad = one([{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, cutoff: 2000 }]);
  assert.equal(pad.marks.length, 0); assert.ok(pad.hazeTo > 0.5, 'haze, not a mark');
  assert.ok(one([{ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }]).marks.length >= 12, 'the impact throws chips');
  assert.equal(one([{ ...base, layer: null, kind: 'pitched', note: 60 }]).marks.length, 1, 'a pitched hap with no part still deposits');
  // the moment: a kick ripples the rock and sprays fragments, the bass heaves it, a pad breathes a cloud, a pen glows; all of it passes
  assert.equal(kick.waves.length, 1); assert.ok(kick.air.length >= 3, 'fragments in the air');
  assert.equal(bass.waves.length, 1); assert.ok(bass.waves[0].life > kick.waves[0].life, 'the ground heaves slower than a kick ripples');
  assert.equal(pad.clouds.length, 1); assert.equal(mel.pens.melody.hot, 1);
  for (let i = 0; i < 400; i++) sediment.step(kick, STEP, [], clockOf(score, 0.1));
  assert.deepEqual([kick.waves.length, kick.air.length], [0, 0], 'the ripple and the fragments are gone after a few seconds');
  for (let i = 0; i < 400; i++) sediment.step(mel, STEP, [], clockOf(score, 0.1));
  assert.ok(mel.pens.melody.hot < 0.01);
});

test('a boundary closes the stratum on the surface as it stands and opens the next on it; a climax folds what came before; a riser faults it; deformation is state', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), p = createPerformance(sediment, score), st = p.state;
  sediment.step(st, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }], clockOf(score, 0));
  assert.equal(st.strata.length, 1); assert.equal(st.strata[0].top, null);
  sediment.step(st, STEP, [], clockOf(score, 1.95, clockOf(score, 1.9))); // inside the riser
  assert.ok(st.riser > 0);
  sediment.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.equal(st.strata.length, 2, 'the drop opens a stratum');
  assert.ok(Array.isArray(st.strata[0].top) && st.strata[0].top.some((y) => y !== st.strata[0].top[0]), 'the intro closed on the surface as it stood, stone and all');
  assert.deepEqual(st.strata[1].bottom, st.strata[0].top, 'the drop floors on it');
  assert.equal(st.faults.length, 1, 'a boundary after a riser is a fault'); assert.equal(st.faults[0].at, 2);
  assert.equal(st.folds.length, 1, 'the climax folds'); assert.equal(st.folds[0].since, 2); assert.ok(st.folds[0].ampTo > 0);
  for (let i = 0; i < 120; i++) sediment.step(st, STEP, [], clockOf(score, 2.5));
  assert.ok(st.folds[0].amp > 0.005, 'the fold grows over the section');
  const ctx = ctxStub(); p.draw(ctx, 640, 360);
  assert.ok(ctx.calls.fill >= 3, 'two strata and the clast');
});

test('a new sheet when the song starts over; a plain pattern deposits on the fallback score', async () => {
  const g = await ready;
  const p = run(song(g), 8);
  assert.equal(p.state.sheet, 0); assert.ok(p.state.strata.length >= 2);
  p.advance(8.1, 0.05);
  assert.equal(p.state.sheet, 1); assert.deepEqual(p.state.marks, []); assert.deepEqual(p.state.folds, []);
  const q = createPerformance(sediment, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  q.push(eventOf(h, null, null, 0.1)); q.advance(0, 0); q.advance(0.5, 0.25);
  assert.equal(q.state.marks.length, 1); assert.equal(q.state.strata.length, 1);
  q.draw(ctxStub(), 320, 180);
});
