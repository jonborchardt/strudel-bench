// web/visual/caseboard.mjs: the evidence board on the same interface as the others. What it must honour: injected
// randomness, deterministic plain state, a job per kind of hit, and the long story: the case is solved by the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import caseboard, { MAX, SUSPECTS, START } from '../web/visual/caseboard.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'caseboard' }, [
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
const run = (ir, seconds = 7.9, draw = null) => {
  const p = createPerformance(caseboard, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };

test('caseboard draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(); run(song(g), 7.9, ctx);
    assert.equal(composeVisual(song(g)).world, 'caseboard');
    assert.ok(ctx.calls.fillRect > 1000 && ctx.calls.stroke > 100 && ctx.calls.fillText > 100, 'board, papers and strokes');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job: a snare pins something up, a melody note ties yarn, the bass plucks it, hats gust and write, a kick swings the lamp', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const fresh = () => createPerformance(caseboard, score).state;
  const mid = clockOf(score, 2), one = (evs, st = fresh()) => { caseboard.step(st, STEP, evs, mid); return st; };
  assert.equal(fresh().items.length, START, 'the board opens with a map and one suspect');
  const sn = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]);
  assert.equal(sn.items.length, START + 1, 'the snare pins one');
  for (let k = 0; k < 3; k++) one([{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }], sn); // the board opens with a map and a suspect: pin up some evidence to tie
  for (let i = 0; i < 60; i++) caseboard.step(sn, STEP, [], mid);
  assert.ok(sn.items.every((i) => i.st === 'on'), 'pinned');
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 67 }], sn);
  assert.ok(mel.yarn.length >= 1, 'yarn');
  const y = mel.yarn[0], from = mel.items.find((i) => i.id === y.a), to = mel.items.find((i) => i.id === y.b);
  assert.ok(from.about >= 0 && (to.who === from.about || to.about === from.about || to.kind === 'map'), 'evidence is tied to what it is about');
  one([{ ...base, layer: 'bass', kind: 'bass', note: 36 }], mel);
  assert.ok(mel.yarn.every((k) => k.pl > 0), 'the bass plucks every string');
  const hh = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }]);
  assert.ok(hh.gust > 0.2 && hh.items.some((i) => i.va !== 0));
  assert.ok(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }]).lamp.v !== 0);
});

test('the case: suspects are crossed out one by one, the culprit is circled, the stamp lands; a loop starts a new case', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(caseboard, score).state;
  let prev = null, most = 0;
  const to = (c0, c1) => { for (let c = c0; c < c1; c += STEP * score.cps) { const k = clockOf(score, c, prev); caseboard.step(st, STEP, [], k); prev = k; most = Math.max(most, st.items.length); } };
  to(0, score.total * 0.7);
  assert.ok(st.dead.length >= 1 && st.dead.length < SUSPECTS - 1 && !st.dead.includes(st.culprit), 'part way: some crossed out, not the culprit');
  to(score.total * 0.7, score.total * 0.9999);
  assert.equal(st.fin, 2); assert.ok(st.stamp > 0.5);
  assert.equal(st.dead.length, SUSPECTS - 1); assert.ok(!st.dead.includes(st.culprit));
  const photo = st.items.find((i) => i.who === st.culprit);
  assert.ok(st.marks.some((m) => m.id === photo.id && m.kind === 'circle' && m.turns > 2), 'the culprit is circled');
  assert.ok(most <= MAX + 1);
  const no = st.caseNo;
  caseboard.step(st, STEP, [], clockOf(score, 0.01, prev));
  assert.ok(st.fin === 0 && st.dead.length === 0 && st.yarn.length === 0 && st.items.filter((i) => i.st === 'off').length > START && st.items.every((i) => i.st === 'off' || i.st === 'in'), 'everything is taken down');
  assert.notEqual(st.caseNo, no);
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(caseboard, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.note('c4').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  p.draw(ctxStub(), 320, 180);
});
