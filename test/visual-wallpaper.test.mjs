// web/visual/wallpaper.mjs: the living wallpaper on the same interface as the others. What it must honour: injected
// randomness, deterministic plain state, every job a spring or a growth, the pull back to order, mutation over time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import wallpaper from '../web/visual/wallpaper.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'wallpaper' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' } }),
]).strudel;
const streamOf = (ir) => {
  const out = [];
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers))
    for (const h of l.pattern.queryArc(0, s.cycles)) if (h.hasOnset()) { const c = s.offset + h.whole.begin.valueOf(); out.push(eventOf(h, name, layerBase(name), c / ir.meta.cps)); }
  return out.sort((a, b) => a.t - b.t);
};
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const run = (ir, seconds = 8, draw = null) => {
  const p = createPerformance(wallpaper, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };

test('wallpaper draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(); run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'wallpaper');
    assert.ok(ctx.calls.stroke > 100 && ctx.calls.fill > 100, 'lattice and motifs');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job: bass and kick breathe, a snare slides a row and flips motifs that turn back, hats shimmer, a melody note grows a curl that stays', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const fresh = () => createPerformance(wallpaper, score).state;
  const one = (evs, st = fresh()) => { wallpaper.step(st, STEP, evs, clockOf(score, 0.1)); return st; };
  assert.ok(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }]).breath.v > 0.5);
  assert.ok(one([{ ...base, layer: 'bass', kind: 'bass', note: 36 }]).swell > 0.3);
  const sn = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]);
  assert.ok(sn.rows.some((r) => r.v !== 0), 'a row slides');
  assert.ok(sn.cells.some((c) => c.flip === -1 || c.vr !== 0), 'motifs flip or turn');
  for (let i = 0; i < 300; i++) wallpaper.step(sn, STEP, [], clockOf(score, 0.1));
  assert.ok(sn.cells.every((c) => c.flip === 1 && Math.abs(c.r) < 0.05) && sn.rows.every((r) => Math.abs(r.x) < 0.05), 'the wall restores its order');
  assert.ok(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }]).shimmer > 0.2);
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 67 }]);
  const grown = mel.cells.find((c) => c.grown > 0);
  assert.ok(grown && grown.bloom === 1);
  for (let i = 0; i < 600; i++) wallpaper.step(mel, STEP, [], clockOf(score, 0.1));
  assert.ok(grown.grown > 0.25, 'the curl stays');
});

test('loud passages mutate the wall; a boundary changes the genome and moves the camera', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(wallpaper, score).state;
  const loud = { ...clockOf(score, 2.5), energy: 1 };
  for (let i = 0; i < 60 * 30; i++) wallpaper.step(st, STEP, i % 15 ? [] : [{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }], loud);
  assert.ok(st.cells.some((c) => c.kind !== st.ref), 'a new kind has appeared');
  const gene = JSON.stringify(st.geneTo), zoom = st.zoomTo;
  wallpaper.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(JSON.stringify(st.geneTo) !== gene || st.zoomTo !== zoom);
  assert.notEqual(st.zoomTo, zoom, 'the camera moves at a boundary');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(wallpaper, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.note('c4').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  p.draw(ctxStub(), 320, 180);
});
