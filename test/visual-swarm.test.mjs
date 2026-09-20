// web/visual/swarm.mjs: the population world on the same interface as the others. The architecture it must honour
// (injected randomness, deterministic plain state, every job a force on the population, the population kept in the
// frame), not how the flock looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import swarm from '../web/visual/swarm.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'swarm' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, melody2: { density: .5, notes: '4 ~ 6 ~' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const streamOf = (ir) => {
  const out = [];
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers))
    for (const h of l.pattern.queryArc(0, s.cycles)) if (h.hasOnset()) { const c = s.offset + h.whole.begin.valueOf(); out.push(eventOf(h, name, layerBase(name), c / ir.meta.cps)); }
  return out.sort((a, b) => a.t - b.t);
};
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const run = (ir, seconds = 8, draw = null) => {
  const p = createPerformance(swarm, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
const speed = (st) => st.avx.reduce((n, vx, i) => n + Math.hypot(vx, st.avy[i]), 0) / st.ax.length;
const spread = (st) => { const mx = st.ax.reduce((a, b) => a + b, 0) / st.ax.length, my = st.ay.reduce((a, b) => a + b, 0) / st.ay.length; return st.ax.reduce((n, x, i) => n + Math.hypot(x - mx, st.ay[i] - my), 0) / st.ax.length; };

test('swarm is importable in Node and draws on a stub context with no randomness or clock of its own; two line parts are two groups', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'swarm');
    assert.deepEqual(p.state.groups, ['melody', 'melody2']);
    assert.ok(ctx.calls.stroke > 1000, 'a streak per agent per frame');
    assert.ok(p.state.ax.every((x, i) => x > -0.1 && x < p.state.aspect + 0.1 && p.state.ay[i] > -0.1 && p.state.ay[i] < 1.1), 'the population stays in the frame');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job is a force: a kick shoves the population outward, an impact splits a group, hats jitter, a bass note gusts and weighs, a melody note places its leader by pitch and pan, the pad thickens the air; a boundary moves home', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const settle = (st, n = 90) => { for (let i = 0; i < n; i++) swarm.step(st, STEP, [], clockOf(score, 0.1)); return st; };
  const fresh = () => settle(createPerformance(swarm, score).state);
  const one = (st, evs, cycle = 0.1) => { swarm.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const quiet = fresh(), kicked = one(fresh(), [{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }]);
  for (let i = 0; i < 20; i++) { swarm.step(quiet, STEP, [], clockOf(score, 0.1)); swarm.step(kicked, STEP, [], clockOf(score, 0.1)); }
  assert.ok(spread(kicked) > spread(quiet), 'a kick spreads the population');
  const split = one(fresh(), [{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]);
  assert.ok(split.split && split.split.life > 0);
  const hats = one(fresh(), [{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }]);
  assert.ok(speed(hats) !== speed(fresh()), 'hats jitter');
  const low = one(fresh(), [{ ...base, layer: 'bass', kind: 'bass', note: 28 }]), high = one(fresh(), [{ ...base, layer: 'bass', kind: 'bass', note: 55 }]);
  assert.ok(low.bass.weight > high.bass.weight && low.bass.cohere > 0.5 && Math.hypot(low.bass.gust.x, low.bass.gust.y) > 0.1);
  const mel = one(fresh(), [{ ...base, layer: 'melody', kind: 'melody', note: 72, pan: 0.9 }]);
  assert.ok(mel.leaders.melody.ty < 0.45 && mel.leaders.melody.tx > mel.aspect * 0.6, 'high and to the right');
  const pad = one(fresh(), [{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, cutoff: 4000 }]);
  assert.ok(pad.field.level > 0.5 && pad.field.tint > 0.5);
  const st = fresh(), home = { ...st.home };
  swarm.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  assert.ok(st.home.tx !== home.tx || st.home.ty !== home.ty, 'a boundary moves home');
});

test('visitors come in and leave: an impact sends a hawk, a bass note a seed, a pad chord a thermal; each crosses and is gone by the end of its span; a hawk pushes the agents away, a seed draws them', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const one = (st, evs) => { swarm.step(st, STEP, evs, clockOf(score, 0.1)); return st; };
  const fresh = () => { const st = createPerformance(swarm, score).state; for (let i = 0; i < 60; i++) one(st, []); return st; };
  const kinds = (st) => st.visitors.map((v) => v.kind);
  const st = one(fresh(), [{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }, { ...base, layer: 'bass', kind: 'bass', note: 36 }, { ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1 }]);
  assert.deepEqual(kinds(st).sort(), ['hawk', 'seed', 'thermal']);
  assert.ok(st.visitors.every((v) => Math.hypot(v.x - st.home.x, v.y - st.home.y) > 0.5), 'they start away from home');
  for (let i = 0; i < 60 * 15; i++) one(st, []);
  assert.deepEqual(kinds(st), [], 'all gone');
  const near = (st, v) => st.ax.reduce((n, x, i) => n + (Math.hypot(x - v.x, st.ay[i] - v.y) < 0.25 ? 1 : 0), 0);
  const hawk = { kind: 'hawk', x: 0, y: 0, vx: 0, vy: 0, r: 0.03, life: 9, span: 9, w: 1, hue: 0, through: false };
  const hawked = fresh(), quiet = fresh(); hawked.visitors.push({ ...hawk, x: hawked.home.x, y: hawked.home.y });
  for (let i = 0; i < 60; i++) { one(hawked, []); one(quiet, []); } // the same steps without it: the flock is still settling on home either way
  assert.ok(near(hawked, hawked.visitors[0]) < near(quiet, hawked.visitors[0]), 'the agents flee the hawk');
  const fed = fresh(), still = fresh(), seed = { kind: 'seed', x: fed.home.x + 0.3, y: fed.home.y, vx: 0, vy: 0, r: 0.02, life: 30, span: 30, w: 1, hue: 0, through: false }; fed.visitors.push(seed);
  for (let i = 0; i < 90; i++) { one(fed, []); one(still, []); }
  assert.ok(near(fed, seed) > near(still, seed) && seed.r < 0.02, 'the agents gather on the seed and eat it');
  const c = ctxStub(); swarm.draw(st, c, 640, 360); swarm.draw(hawked, c, 640, 360); swarm.draw(fed, c, 640, 360);
});

test('harmony is the relation between groups: a leader consonant with the bass draws the other group, a dissonant one pushes it', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const dist = (st) => { const L = st.leaders.melody; let d = 0, n = 0; st.ag.forEach((gi, i) => { if (gi === 1) { d += Math.hypot(st.ax[i] - L.x, st.ay[i] - L.y); n++; } }); return d / n; };
  const runWith = (note) => {
    const st = createPerformance(swarm, score).state;
    swarm.step(st, STEP, [{ ...base, layer: 'bass', kind: 'bass', note: 36 }, { ...base, layer: 'melody', kind: 'melody', note, pan: 0.5 }], clockOf(score, 0.1));
    for (let i = 0; i < 90; i++) swarm.step(st, STEP, i % 30 === 0 ? [{ ...base, layer: 'melody', kind: 'melody', note, pan: 0.5 }] : [], clockOf(score, 0.1));
    return dist(st);
  };
  assert.ok(runWith(67) < runWith(66), 'melody2 sits nearer a fifth than a tritone');
});

test('a plain pattern (no song) runs on the fallback score as one flock', async () => {
  const g = await ready;
  const p = createPerformance(swarm, fallbackScore(0.5), { w: 16, h: 9 });
  assert.deepEqual(p.state.groups, ['flock']);
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.shove >= 0);
  p.draw(ctxStub(), 320, 180);
});
