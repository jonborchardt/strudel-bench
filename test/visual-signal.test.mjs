// web/visual/signal.mjs: the instrument world on the same interface as the others. The architecture it must honour
// (injected randomness, deterministic plain state, every job a reading, a topology per section), not how the panel looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import signal from '../web/visual/signal.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'signal' }, [
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
  const p = createPerformance(signal, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };

test('signal is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'signal');
    assert.ok(p.state.order.length >= 4, 'a node per part that sounded');
    assert.ok(ctx.calls.stroke > 100, 'the field, the routes, the trails');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job is a reading: a kick rings the bus, an impact arcs between nodes, hats tick the route, the bass feeds the carrier and sets its wavelength, a melody note places the probe and starts a trail, the pad raises the contours', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const one = (evs, cycle = 0, st = null) => { st ??= createPerformance(signal, score).state; signal.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const kick = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }]);
  assert.equal(kick.rings.length, 1); assert.equal(kick.pulses.length, 1); assert.ok(kick.nodes.drums.hot > 0.9, 'the node lights');
  const snare = one([{ ...base, layer: 'perc', kind: 'perc', role: 'hit' }, { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]); // the perc node exists when the snare fires
  assert.equal(snare.arcs.length, 1); assert.notEqual(snare.arcs[0].b, 'drums', 'to another node');
  assert.equal(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }]).ticks.length, 1);
  const lowBass = one([{ ...base, layer: 'bass', kind: 'bass', note: 28 }]), highBass = one([{ ...base, layer: 'bass', kind: 'bass', note: 60 }]);
  assert.ok(lowBass.carrier.amp > 0.5 && lowBass.carrier.k < highBass.carrier.k, 'a low note is a long wave');
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 72, dur: 1 }]);
  assert.ok(mel.probes.melody.on && mel.probes.melody.trail.length >= 1);
  const lower = one([{ ...base, layer: 'melody', kind: 'melody', note: 48 }]);
  assert.ok(lower.probes.melody.y > mel.probes.melody.y, 'a lower note sits lower');
  for (let i = 0; i < 30; i++) signal.step(mel, STEP, [], clockOf(score, 0.2 + i * 0.01));
  assert.ok(mel.probes.melody.trail.length > 5, 'a held note draws as the beam sweeps');
  const pad = one([{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, cutoff: 4000 }]);
  assert.ok(pad.contour.level > 0.5 && pad.contour.tint > 0.5);
  assert.ok(one([{ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }]).flash > 0.5, 'the impact flashes');
  assert.equal(one([{ ...base, layer: null, kind: 'pitched', note: 60 }]).order.length, 1, 'a pitched hap with no part still gets a node');
});

test('a boundary re-routes: every node moves to a new place and eases there; a dropout stops the carrier; the carrier decays between notes', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(signal, score).state;
  signal.step(st, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }, { ...base, layer: 'bass', kind: 'bass', note: 36 }], clockOf(score, 0));
  const before = { ...st.nodes.drums }, amp = st.carrier.amp, phase = st.carrier.phase;
  signal.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.ok(st.nodes.drums.tx !== before.tx || st.nodes.drums.ty !== before.ty, 'a new place');
  assert.ok(Math.abs(st.nodes.drums.x - before.x) < Math.abs(st.nodes.drums.tx - before.x) + 1e-9, 'easing, not jumping');
  assert.ok(st.carrier.amp < amp && st.carrier.phase > phase, 'the carrier runs and decays');
  for (let i = 0; i < 120; i++) signal.step(st, STEP, [], clockOf(score, 3.5)); // inside the drop's dropout bar
  assert.ok(st.dark > 0.9);
  const p2 = st.carrier.phase; signal.step(st, STEP, [], clockOf(score, 3.5));
  assert.ok(st.carrier.phase - p2 < 1e-3, 'stopped');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(signal, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.order.length, 1);
  p.draw(ctxStub(), 320, 180);
});
