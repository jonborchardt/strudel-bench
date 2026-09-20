// web/visual/orrery.mjs: the celestial world on the same interface as the others. The architecture it must honour
// (injected randomness, deterministic plain state, every job a body, a force or a star, the system rearranged at a
// boundary), not how the sky looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import orrery from '../web/visual/orrery.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'orrery' }, [
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
  const p = createPerformance(orrery, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };

test('orrery is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'orrery');
    assert.deepEqual(p.state.order, ['melody'], 'a body per line part');
    assert.ok(ctx.calls.arc > 100 && ctx.calls.stroke > 50, 'stars, orbits, trails, the mass');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job: a bass note sets the gravity (low is heavy) and lights the mass, a melody note sets its body\'s orbit by pitch and places a star, a chord\'s notes link into a figure, a kick flares, an impact is a meteor, hats are dust, the pad is nebula', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const one = (evs, cycle = 0.1, st = null) => { st ??= createPerformance(orrery, score).state; orrery.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const low = one([{ ...base, layer: 'bass', kind: 'bass', note: 28 }]), high = one([{ ...base, layer: 'bass', kind: 'bass', note: 55 }]);
  assert.ok(low.mass.m > high.mass.m && low.mass.glow > 0.5);
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 72 }]), lowMel = one([{ ...base, layer: 'melody', kind: 'melody', note: 48 }]);
  assert.ok(mel.bodies.melody.aTo > lowMel.bodies.melody.aTo, 'a higher note orbits further out');
  assert.equal(mel.stars.length, 1); assert.equal(mel.stars[0].link, null);
  const chord = one([{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, cutoff: 3000 }, { ...base, layer: 'pad', kind: 'pad', note: 64, dur: 1 }, { ...base, layer: 'pad', kind: 'pad', note: 67, dur: 1 }]);
  assert.equal(chord.stars.length, 3); assert.ok(chord.stars[1].link && chord.stars[2].link, 'linked in order');
  const two = one([{ ...base, layer: 'melody', kind: 'melody', note: 60 }, { ...base, layer: 'bass', kind: 'bass', note: 36 }]);
  assert.ok(two.stars.every((x) => x.link === null), 'different parts do not link: a figure per part');
  assert.ok(chord.nebula.level > 0.5 && chord.nebula.tint > 0.5);
  const kick = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }]);
  assert.ok(kick.mass.flare > 0.9 && kick.flares.length === 1);
  assert.equal(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]).meteors.length, 1);
  const dust = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }], 0.1, mel);
  assert.equal(dust.dust.length, 1, 'dust on a body\'s orbit');
  for (let i = 0; i < 30; i++) orrery.step(mel, STEP, [], clockOf(score, 0.1));
  assert.ok(mel.bodies.melody.trail.length > 20 && mel.bodies.melody.theta !== 0, 'the body moves and leaves a trail');
});

test('a boundary rearranges every plane; a climax pulls the body toward the conjunction line; a dropout stops the orbits; a new bar starts a new figure', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(orrery, score).state;
  orrery.step(st, STEP, [{ ...base, layer: 'melody', kind: 'melody', note: 60 }], clockOf(score, 0.1));
  const rot = st.bodies.melody.rotTo;
  orrery.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.notEqual(st.bodies.melody.rotTo, rot, 'a new plane');
  assert.deepEqual(st.lastStar, {}, 'a new bar, a new figure');
  for (let i = 0; i < 240; i++) orrery.step(st, STEP, [], clockOf(score, 2.5));
  assert.ok(st.state.align > 0.9);
  const off = Math.abs(Math.atan2(Math.sin(st.alignAngle - st.bodies.melody.theta), Math.cos(st.alignAngle - st.bodies.melody.theta)));
  assert.ok(off < 0.6, `near conjunction (${off.toFixed(2)} rad off)`);
  for (let i = 0; i < 200; i++) orrery.step(st, STEP, [], clockOf(score, 3.5)); // the drop's dropout bar
  const th = st.bodies.melody.theta; orrery.step(st, STEP, [], clockOf(score, 3.5));
  assert.ok(Math.abs(st.bodies.melody.theta - th) < 1e-3, 'stopped');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(orrery, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.note('c4').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.deepEqual(p.state.order, ['line']);
  p.draw(ctxStub(), 320, 180);
});
