// web/visual/tunnel.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired), not how it looks. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import tunnel from '../web/visual/tunnel.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
/** Every hap of every part over the song, as the page's tap would deliver it: audio time = cycle / cps. */
const streamOf = (ir) => {
  const out = [];
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers))
    for (const h of l.pattern.queryArc(0, s.cycles)) if (h.hasOnset()) { const c = s.offset + h.whole.begin.valueOf(); out.push(eventOf(h, name, layerBase(name), c / ir.meta.cps)); }
  return out.sort((a, b) => a.t - b.t);
};
// a canvas context that counts calls and refuses nothing: draw() must not need a real canvas
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const run = (ir, seconds = 3) => {
  const p = createPerformance(tunnel, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  const cps = ir.meta.cps;
  for (let t = 0; t <= seconds; t += 1 / 30) p.advance(t, t * cps);
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };

test('tunnel is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.stroke > 10, 'rings and ribbons stroke');
    assert.ok(ctx.calls.fillRect >= 1, 'the frame fades');
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

test('every cast job reaches the state: pulse rings, impact shock, grain, the bass radius, ribbons, fog, the boundary flash, the riser, the dark', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const fresh = () => createPerformance(tunnel, score, { w: 16, h: 9 });
  const st = (p) => p.state;
  const at = (p, cycle) => { const cl = clockOf(score, cycle, p.clock); return cl; };
  // one event at a time, one step each, against a fresh world
  const one = (ev, cycle = 0) => { const p = fresh(); tunnel.step(st(p), STEP, [ev], clockOf(score, cycle)); return st(p); };
  const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
  assert.ok(one({ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }).kicks.length === 1, 'a kick pushes a ring in');
  const hit = one({ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' });
  assert.ok(hit.dent > 0.5 && Math.abs(hit.cam.vx) > 0, 'an impact dents the wall and shocks the camera');
  assert.equal(one({ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }).grain.length, 1, 'a hat is one grain');
  const low = one({ ...base, layer: 'bass', kind: 'bass', note: 36 }), high = one({ ...base, layer: 'bass', kind: 'bass', note: 55 });
  assert.ok(low.radiusTo > 1 && high.radiusTo < 1, 'a low bass note widens the tunnel, a high one narrows it');
  const mel = one({ ...base, layer: 'melody', kind: 'melody', note: 67, pan: .7 });
  assert.equal(mel.ribbons.melody.length, 1, 'a melody note is a ribbon point');
  assert.ok(one({ ...base, layer: 'pad', kind: 'pad', note: 60, cutoff: 3000 }).fogTo > 0.4, 'a pad raises the fog');
  assert.equal(one({ ...base, layer: null, kind: 'pitched', note: 60 }).ribbons.line.length, 1, 'a pitched hap with no part is a line all the same');
  // the clock alone: a boundary flashes, the riser tail speeds the wall, the dropout tail darkens
  const p = fresh(); const s = st(p);
  tunnel.step(s, STEP, [], clockOf(score, 0)); tunnel.step(s, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(s.flash > 0.8, 'the boundary flashes (a climax: the full flash, less one step of decay)');
  const fx = fresh().state;
  tunnel.step(fx, STEP, [{ ...base, layer: 'fx', kind: 'fx', role: 'hit', dur: .125 }], clockOf(score, 0));
  assert.equal(fx.flash, 0, 'a riser slice is not a flash');
  tunnel.step(fx, STEP, [{ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }], clockOf(score, 0));
  assert.ok(fx.flash > 0.6, 'the impact is');
  const z0 = fresh().state.rings[3].z;
  const calm = fresh().state, rising = fresh().state;
  tunnel.step(calm, STEP, [], clockOf(score, 0)); tunnel.step(rising, STEP, [], clockOf(score, 1.5)); // intro's riser is its last bar
  assert.ok(rising.riser > 0 && z0 - rising.rings[3].z > z0 - calm.rings[3].z, 'into a riser the wall comes faster');
  const dark = fresh().state; for (let i = 0; i < 60; i++) tunnel.step(dark, STEP, [], clockOf(score, 3.5));
  assert.ok(dark.dark > 0.9, 'the dropout tail goes dark');
  assert.ok(at(p, 0).section === 'intro');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(tunnel, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.kicks.length, 1);
  p.draw(ctxStub(), 320, 180);
});
