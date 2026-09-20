// web/visual/loom.mjs: the machine world on the same interface as the others. The architecture it must honour
// (injected randomness, deterministic plain state, every job a mechanism, every mechanism a mark in the cloth), not how
// the loom looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import loom from '../web/visual/loom.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'loom' }, [
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
  const p = createPerformance(loom, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };

test('loom is importable in Node and draws on a stub context with no randomness or clock of its own; the song weaves cloth', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'loom');
    assert.ok(p.state.rows.length > 5, 'rows woven');
    assert.ok(ctx.calls.fillRect > 500, 'the cloth\'s cells');
    assert.ok(p.state.lint.length > 0, 'lint flies');
    assert.equal(p.state.shuttles.length, 12); assert.ok(p.state.thrown > 40, 'the shuttles fly often');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every mechanism: a kick packs a row and flips the shed, an impact throws the shuttle to the other side, hats flick the heddles, the bass torques the wheel and picks the weave by pitch class, a melody note lays a pick into the next row by pitch, the pad thickens the warp', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const one = (evs, cycle = 0.1, st = null) => { st ??= createPerformance(loom, score).state; loom.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const kick = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }]);
  assert.equal(kick.rows.length, 1); assert.equal(kick.shedTo, 1); assert.ok(kick.beater > 0.9);
  const snare = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]);
  assert.equal(snare.shuttles[0].side, 1); assert.equal(snare.shuttles[0].tx, 0.9); assert.equal(snare.lane, 1, 'the next throw takes the next shuttle');
  assert.ok(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }]).heddle > 0.5);
  const bass = one([{ ...base, layer: 'bass', kind: 'bass', note: 38 }]);
  assert.ok(bass.wheel.torque > 0.5); assert.equal(bass.tie, (38 % 12) % 3);
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 72 }]);
  assert.equal(mel.picks.length, 1); assert.ok(mel.picks[0].x > 0.5 && mel.picks[0].x <= 1, 'a high note to the right, inside the warp');
  one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }], 0.2, mel);
  assert.equal(mel.rows[0].picks.length, 1); assert.equal(mel.picks.length, 0, 'the row took the pick');
  const pad = one([{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, cutoff: 4000 }]);
  assert.ok(pad.warp.count > 0.6 && pad.warp.tint > 0.5);
  assert.equal(one([{ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }]).rows.length, 1, 'the impact packs a row');
});

test('the wheel turns at the tempo, faster into a riser, stopped in a dropout; a boundary starts a new band; the cloth is bounded', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(loom, score).state;
  for (let i = 0; i < 120; i++) loom.step(st, STEP, [], clockOf(score, 0.5));
  const a1 = st.wheel.angle; loom.step(st, STEP, [], clockOf(score, 0.5)); const w0 = st.wheel.angle - a1;
  assert.ok(w0 > 0, 'turning');
  for (let i = 0; i < 120; i++) loom.step(st, STEP, [], clockOf(score, 1.9));
  const a2 = st.wheel.angle; loom.step(st, STEP, [], clockOf(score, 1.9));
  assert.ok(st.wheel.angle - a2 > w0, 'faster into the riser');
  loom.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.equal(st.band, 1);
  for (let i = 0; i < 300; i++) loom.step(st, STEP, [], clockOf(score, 3.5));
  const a3 = st.wheel.angle; loom.step(st, STEP, [], clockOf(score, 3.5));
  assert.ok(st.wheel.angle - a3 < 1e-3, 'stopped in the dropout');
  for (let i = 0; i < 200; i++) loom.step(st, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }], clockOf(score, 2.5));
  assert.ok(st.rows.length <= 70, 'old cloth rolls away');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(loom, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.rows.length, 1);
  p.draw(ctxStub(), 320, 180);
});
