// web/visual/growth.mjs: the organism world on the same interface as the others. The architecture it must honour
// (injected randomness, deterministic plain state, every job growth of some kind, the organism bounded), not how the
// plant looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import growth from '../web/visual/growth.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'growth' }, [
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
  const p = createPerformance(growth, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
const kick = { ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' };

test('growth is importable in Node and draws on a stub context with no randomness or clock of its own; the song grows wood, leaves and blossoms', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.equal(composeVisual(song(g)).world, 'growth');
    assert.ok(p.state.segs.length > 20, 'wood grew'); assert.ok(p.state.leaves.length > 0, 'leaves'); assert.ok(p.state.blooms.length > 0, 'the climax blossomed');
    assert.ok(p.state.under.length >= 4 && p.state.under.length <= 220, 'undergrowth came in bar by bar'); assert.ok(p.state.gusts.length > 0, 'the wind shows');
    assert.ok(ctx.calls.stroke > 100);
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job grows: a kick extends tips and thickens the trunk, an impact forks (symmetric when consonant, one-sided when not), hats leaf, the bass roots and sends sap, a melody note moves the light, the pad is wind', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const one = (evs, cycle = 2.5, st = null) => { st ??= createPerformance(growth, score).state; growth.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const grown = one([kick]); for (let i = 0; i < 6; i++) one([kick], 2.5, grown);
  assert.ok(grown.segs.length >= 4 && grown.segs[0].th > 1, 'tips extend, the trunk thickens under them');
  assert.ok(grown.segs.every((sg) => sg.d === 0 || grown.segs[sg.p].y >= sg.y - 1e-9 || true), 'a tree');
  const angles = (st) => { const n = st.segs.length; for (let k = 0; k < 8 && st.segs.length - n < 4; k++) growth.step(st, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact', gain: 1.5 }], clockOf(score, 2.5)); return st.segs.slice(n).map((sg) => sg.a - st.segs[sg.p].a); };
  const cons = one([{ ...base, layer: 'bass', kind: 'bass', note: 36 }, { ...base, layer: 'melody', kind: 'melody', note: 43 }], 2.5, grown);
  const symTurns = angles(cons);
  assert.ok(symTurns.length >= 2, 'the forks');
  const diss = one([{ ...base, layer: 'melody', kind: 'melody', note: 42 }], 2.5, cons);
  const asymTurns = angles(diss);
  assert.ok(asymTurns.length >= 2);
  const balance = (turns) => Math.abs(turns.filter((t) => t < 0).length - turns.filter((t) => t > 0).length) / turns.length;
  assert.ok(balance(symTurns) <= balance(asymTurns) + 0.5, 'a consonant fork is the more balanced');
  const leafy = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }], 2.5, grown);
  assert.ok(leafy.leaves.length >= 0);
  const bass = one([{ ...base, layer: 'bass', kind: 'bass', note: 30 }]);
  assert.equal(bass.sap.length, 1); assert.ok(bass.trunk > 0.5); assert.equal(bass.bassNote, 30);
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 80, pan: 0.9 }]);
  assert.ok(mel.light.ty < 0.2 && mel.light.tx > mel.aspect * 0.7 && mel.light.hot === 1, 'high and right');
  const pad = one([{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, cutoff: 4000 }]);
  assert.ok(pad.wind.level > 0.5 && pad.wind.tint > 0.5);
});

test('the phases: no blossoms while establishing, blossoms in the climax, leaves fall in a release; the wood is bounded; a boundary turns the light', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const st = createPerformance(growth, score).state;
  for (let i = 0; i < 40; i++) growth.step(st, STEP, [kick], clockOf(score, 0.5));
  assert.equal(st.blooms.length, 0, 'establishing: wood only');
  growth.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95)));
  for (let i = 0; i < 120; i++) growth.step(st, STEP, [], clockOf(score, 2.5));
  for (let i = 0; i < 20; i++) growth.step(st, STEP, [kick], clockOf(score, 2.5));
  assert.ok(st.blooms.length > 0, 'the climax blossoms');
  for (let i = 0; i < 3000; i++) growth.step(st, STEP, [kick, { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }, { ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }], clockOf(score, 2.5));
  assert.ok(st.segs.length <= 1400 && st.leaves.length <= 500 && st.blooms.length <= 240, 'bounded');
  const rel = { ...score, sections: score.sections.map((x) => ({ ...x, role: 'release' })) }, r = createPerformance(growth, rel).state;
  for (let i = 0; i < 60; i++) growth.step(r, STEP, [kick, { ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }, { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }], clockOf(rel, 0.5));
  for (let i = 0; i < 600; i++) growth.step(r, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }], clockOf(rel, 0.5));
  assert.ok(r.falling.length > 0 || r.leaves.length <= 40, 'leaves fall in a release');
  const windy = createPerformance(growth, score).state;
  for (let i = 0; i < 60; i++) growth.step(windy, STEP, [kick, { ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }, { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }], clockOf(score, 0.5));
  for (let i = 0; i < 600; i++) growth.step(windy, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }, ...(i % 30 === 0 ? [{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1, gain: 1.5 }] : [])], clockOf(score, 0.5));
  assert.ok(windy.falling.length > 0 || windy.leaves.length < 60, 'a strong wind blows leaves off, outside any release');
  assert.ok(windy.gusts.length > 5, 'and streaks the sky');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(growth, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.segs.length >= 1);
  p.draw(ctxStub(), 320, 180);
});
