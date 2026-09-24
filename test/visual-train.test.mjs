// web/visual/train.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired), not how it looks. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import train from '../web/visual/train.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'train' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
  g.section('out', 2, { role: 'release', drums: { density: .4 } }),
]).strudel;
const streamOf = (ir) => {
  const out = [];
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers))
    for (const h of l.pattern.queryArc(0, s.cycles)) if (h.hasOnset()) { const c = s.offset + h.whole.begin.valueOf(); out.push(eventOf(h, name, layerBase(name), c / ir.meta.cps)); }
  return out.sort((a, b) => a.t - b.t);
};
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const run = (ir, seconds = 8) => {
  const p = createPerformance(train, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) p.advance(t, t * ir.meta.cps);
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };

test('train is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 10, 'the ridges, the ground and the scenery fill');
    assert.ok(ctx.calls.fillRect >= 1, 'the sky is painted');
    assert.ok(p.state.objs.length > 0 && p.state.dist > 1, 'the land moves and scenery keeps coming');
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

test('every cast job reaches the state: a kick throws a pole, an impact a sign, hats and lines are birds, the bass lifts the hills, the pad clouds; the riser darkens, its boundary enters a tunnel, a plain boundary an overpass, the dropout is dark', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const fresh = () => createPerformance(train, score, { w: 16, h: 9 }).state;
  const one = (ev, cycle = 0) => { const s = fresh(); train.step(s, STEP, [ev], clockOf(score, cycle)); return s; };
  const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
  const kinds = (s) => s.objs.map((o) => o.kind);
  assert.ok(kinds(one({ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' })).includes('pole'), 'a kick throws a pole past');
  const hit = kinds(one({ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }));
  assert.ok(hit.includes('billboard') || hit.includes('crossing') || hit.includes('tourist'), 'an impact is a crossing, a billboard or a tourist');
  const hats = fresh(); for (let i = 0; i < 20; i++) train.step(hats, STEP, [{ ...base, layer: 'perc', kind: 'perc', voice: 'hh', role: 'grain' }], clockOf(score, 0));
  assert.ok(hats.birds.length > 0 && hats.birds.length < 20, 'hats lift some birds, not one each');
  const low = one({ ...base, layer: 'bass', kind: 'bass', note: 30 }), high = one({ ...base, layer: 'bass', kind: 'bass', note: 58 });
  assert.ok(low.hillBass > 1 && high.hillBass < 1, 'a low bass note lifts the hills, a high one flattens them');
  const mel = one({ ...base, layer: 'melody', kind: 'melody', note: 67 });
  assert.equal(mel.birds.length, 1); assert.ok(mel.birds[0].y < 0.3, 'a melody note is a bird high in the sky');
  assert.ok(one({ ...base, layer: 'pad', kind: 'pad', note: 60, cutoff: 3000 }).cloudTo > 0.5, 'a pad brings cloud');
  assert.equal(one({ ...base, layer: null, kind: 'pitched', note: 60 }).birds.length, 1, 'a pitched hap with no part is a bird all the same');
  assert.ok(one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }).flash > 0.6, 'the impact flashes');
  // the clock alone
  const rising = fresh(); for (let i = 0; i < 30; i++) train.step(rising, STEP, [], clockOf(score, 1.5)); // intro's riser is its last bar
  assert.ok(rising.riser > 0 && rising.dark > 0.1, 'the riser closes the cutting in');
  train.step(rising, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(rising.inTunnel > 0, 'the boundary after a riser enters a tunnel');
  const plain = fresh(); train.step(plain, STEP, [], clockOf(score, 4)); train.step(plain, STEP, [], clockOf(score, 4.01, clockOf(score, 3.99)));
  assert.ok(kinds(plain).includes('overpass'), 'a plain boundary passes under a bridge');
  const dark = fresh(); for (let i = 0; i < 60; i++) train.step(dark, STEP, [], clockOf(score, 3.5));
  assert.ok(dark.tunnel > 0.9 && dark.lamps.length > 0, 'the dropout is a tunnel with lamps');
  assert.equal(new Set(fresh().lands).size, 3, 'three roles, three landscapes');
});

test('the whimsy pool and the sky traffic show up over a long run, and the weather is a state the boundary sets', async () => {
  const g = await ready;
  const ir = song(g), p = createPerformance(train, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  const plain = new Set(['tree', 'pine', 'hedge', 'barn', 'house', 'cows', 'cow', 'sheep', 'horse', 'tractor', 'deer', 'rock', 'cactus', 'billboard', 'fence', 'boat', 'island', 'truss', 'pole', 'crossing', 'overpass', 'portal']);
  let flew = false, stood = false; // at some moment of the run, since what flies also leaves
  for (let t = 0; t <= 60; t += 1 / 30) { p.advance(t, t * ir.meta.cps); flew ||= p.state.objs.some((o) => o.sky); stood ||= p.state.objs.some((o) => !o.sky && !plain.has(o.kind)); }
  const s = p.state;
  assert.ok(flew, 'something flies');
  assert.ok(stood, 'something from the pool stands in the landscape');
  assert.ok(['clear', 'rain', 'snow'].includes(s.weather));
  assert.ok(s.rain >= 0 && s.rain <= 1 && s.snow >= 0 && s.snow <= 1);
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(train, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.objs.some((o) => o.kind === 'pole'));
  p.draw(ctxStub(), 320, 180);
});
