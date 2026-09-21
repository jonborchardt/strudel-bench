// web/visual/rave.mjs: the crowd world on the same interface as the others. The architecture it must honour
// (injected randomness, deterministic plain state, every job a light or a movement in the crowd, the surfer's
// lifecycle), not how the monkeys look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import rave from '../web/visual/rave.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'rave' }, [
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
  const p = createPerformance(rave, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
const kick = { ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }, snare = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };

test('rave is importable in Node and draws on a stub context with no randomness or clock of its own; the crowd stands far to near', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'rave');
    assert.equal(p.state.monkeys.length, 90);
    assert.ok(p.state.monkeys.every((m, i, a) => !i || a[i - 1].z >= m.z), 'painter\'s order: far first');
    assert.ok(new Set(p.state.monkeys.map((m) => Math.round(m.body[0] / 40))).size >= 4, 'several sock colours');
    assert.ok(new Set(p.state.monkeys.map((m) => m.hat)).size === 6 && new Set(p.state.monkeys.map((m) => m.eyes)).size === 5, 'every hat and every eye style is in the crowd');
    const mook = p.state.monkeys.at(-1);
    assert.equal(mook.name, 'mook'); assert.ok(mook.z === 0 && !mook.shades && !mook.hat && mook.body[0] > 330 && mook.x > 0.7 && mook.x < 1.1, 'Mook is nearest, pink, bare-headed, near the middle');
    assert.ok(ctx.calls.arc > 1000 && ctx.calls.ellipse > 300, 'heads, ears, eyes, muzzles');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job: a kick makes the crowd jump, an impact strobes, a melody note lights a beam in its pitch class aimed by its pan, the bass washes the faces, the pad is haze, hats turn heads, the crowd bobs on the beat', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const one = (evs, cycle = 0.1, st = null) => { st ??= createPerformance(rave, score).state; rave.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  assert.ok(one([kick]).monkeys.filter((m) => m.jump > 0).length > 40, 'most of the crowd jumps');
  assert.ok(one([snare]).strobe > 0.9);
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 64, pan: 0.9 }]), lit = mel.beams.filter((b) => b.on === 1);
  assert.equal(lit.length, 1); assert.ok(lit[0].angleTo > 0.5, 'aimed right'); assert.equal(lit[0].hue, 4 * 30, 'E: the fourth pitch class');
  const bass = one([{ ...base, layer: 'bass', kind: 'bass', note: 43 }]);
  assert.ok(bass.wash.level > 0.5 && bass.wash.hue === 7 * 30, 'G lights the wash');
  const pad = one([{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, cutoff: 3000 }]);
  assert.ok(pad.haze.level > 0.9 && pad.haze.tint > 0.5);
  assert.ok(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }]).monkeys.some((m) => m.tiltTo !== 0), 'a head turns');
  const st = one([], 0.125); assert.ok(st.beatPhase > 0 && st.beatPhase < 1, 'the beat phase is the clock\'s');
});

test('a climax puts hands up and lights the rig; a boundary re-aims every beam and shifts the colours; impacts in a loud passage lift a crowd surfer who crosses and is set down; a dropout kills the lights', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(rave, score).state;
  const aims = st.beams.map((b) => b.angleTo);
  rave.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.ok(st.beams.every((b, k) => b.angleTo !== aims[k] && b.on === 1), 'every lamp re-aimed and lit');
  assert.notEqual(st.hueShift, 0);
  for (let i = 0; i < 240; i++) rave.step(st, STEP, [], clockOf(score, 2.5));
  assert.ok(st.hands > 0.8 && st.manner.rig > 1.3);
  for (let k = 0; k < 900 && st.surfer; k++) rave.step(st, STEP, [], clockOf(score, 2.5)); // the boundary may have lifted one already
  for (let i = 0; i < 60 && !st.surfer; i++) rave.step(st, STEP, [snare], clockOf(score, 2.5));
  assert.ok(st.surfer, 'someone is up');
  const { i, x: from } = st.surfer;
  for (let k = 0; k < 30; k++) rave.step(st, STEP, [], clockOf(score, 2.5));
  assert.ok(st.surfer.rise > 0.5 && st.monkeys[i].x !== from, 'lifted and carried');
  for (let k = 0; k < 900 && st.surfer; k++) rave.step(st, STEP, [], clockOf(score, 2.5));
  assert.equal(st.surfer, null, 'set down'); assert.notEqual(st.monkeys[i].x, from, 'somewhere else');
  for (let k = 0; k < 200; k++) rave.step(st, STEP, [], clockOf(score, 3.5)); // the drop's dropout bar
  assert.ok(st.dark > 0.9);
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(rave, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.note('c4').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.beams.some((b) => b.on === 1 || b.on > 0.5), 'a note lights a lamp');
  p.draw(ctxStub(), 320, 180);
});
