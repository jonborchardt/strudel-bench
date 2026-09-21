// web/visual/ink.mjs: the cumulative world on the same interface as tunnel. The architecture it must honour (injected
// randomness, deterministic plain state, every job a mark, a sheet that persists and repaints only when fresh), not
// how the painting looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import ink from '../web/visual/ink.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed }, [
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
  const p = createPerformance(ink, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { p.advance(t, t * ir.meta.cps); if (draw) p.draw(draw, 640, 360); }
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };

test('ink is importable in Node and paints on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const ctx = ctxStub(), p = run(song(g), 8, ctx);
    assert.ok(p.state.marks.length > 20, 'the song left marks');
    assert.ok(ctx.calls.fill > 10 && ctx.calls.stroke > 5, 'dabs and strokes');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; the state is plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
});

test('every job leaves its mark: a kick dab, an impact splatter, hat specks, a bass stroke, a melody stroke joining its last note, a pad wash, the impact burst; a boundary folds the sheet', async () => {
  const g = await ready;
  const score = composeVisual(song(g));
  const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
  const one = (evs, cycle = 0, st = null) => { st ??= createPerformance(ink, score).state; ink.step(st, STEP, evs, clockOf(score, cycle)); return st; };
  const kinds = (st) => st.marks.map((m) => m.kind);
  assert.deepEqual(kinds(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }])), ['dab']);
  const snare = one([{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }]);
  assert.ok(snare.marks.filter((m) => m.kind === 'dab').length >= 6 && kinds(snare).includes('seg'), 'a splatter and a streak');
  assert.equal(kinds(one([{ ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }]))[0], 'dab');
  const bass = one([{ ...base, layer: 'bass', kind: 'bass', note: 36, dur: .5 }]);
  assert.equal(bass.marks[0].kind, 'seg'); assert.ok(bass.marks[0].x2 > bass.marks[0].x, 'the length of the note');
  const mel = one([{ ...base, layer: 'melody', kind: 'melody', note: 60 }]);
  assert.deepEqual(kinds(mel), ['dab'], 'the first note touches down');
  one([{ ...base, layer: 'melody', kind: 'melody', note: 67 }], .25, mel);
  assert.deepEqual(kinds(mel), ['dab', 'seg', 'dab'], 'the second joins the first');
  assert.ok(mel.marks[1].y2 < mel.marks[1].y, 'a higher note is higher on the sheet');
  const lifted = one([{ ...base, layer: 'melody', kind: 'melody', note: 62 }], 1.5, mel);
  assert.deepEqual(kinds(lifted).slice(-1), ['dab'], 'after a rest longer than a bar the brush lifts');
  assert.equal(kinds(one([{ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 1 }]))[0], 'wash');
  assert.ok(one([{ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }]).marks.length > 15, 'the impact bursts');
  const fold = createPerformance(ink, score).state;
  ink.step(fold, STEP, [], clockOf(score, 0)); ink.step(fold, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.deepEqual(kinds(fold), ['seg'], 'the boundary is a fold line');
  assert.ok(Math.abs(fold.marks[0].x - fold.marks[0].x2) < 1e-9 && fold.marks[0].y < fold.marks[0].y2, 'vertical');
  assert.ok(one([{ ...base, layer: null, kind: 'pitched', note: 60 }]).marks.length === 1, 'a pitched hap with no part still draws');
});

test('marks dry by simulation time; a new sheet when the song starts over; draw repaints the whole sheet every frame (the paper, the future\'s blooms, every mark), so a kick\'s ripple and a fold can move what was painted', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), p = createPerformance(ink, score);
  let now = 0; const to = (t) => { for (; now < t; now = Math.min(t, now + 0.1)) p.advance(now, now * .5); p.advance(t, t * .5); now = t; }; // a real clock: an advance replays at most half a second
  p.push({ t: .1, cycle: 0, dur: .25, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse', gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null });
  to(.2);
  assert.equal(p.state.marks[0].dry, false);
  assert.equal(p.state.waves.length, 1, 'the kick ripples the sheet');
  const c0 = ctxStub(); p.draw(c0, 640, 360);
  assert.ok(c0.calls.createRadialGradient > 10, 'the future blooms, and the wet dab bleeds: gradients');
  to(4);
  assert.equal(p.state.marks[0].dry, true);
  const c1 = ctxStub(); p.draw(c1, 640, 360);
  assert.ok(c1.calls.fillRect >= 1, 'the paper and the dust'); assert.equal(c1.calls.fill, c1.calls.createRadialGradient + 2, 'the blooms, and the dab flat once dry, on both sides of the centre');
  const c2 = ctxStub(); to(4.05); p.draw(c2, 640, 360);
  assert.ok(c2.calls.fillRect >= 1, 'the next frame paints it all again'); assert.ok(c2.calls.fill > 10);
  assert.equal(p.state.sheet, 0);
  to(9); p.advance(9.1, 0.05); // the song wrapped
  assert.equal(p.state.sheet, 1); assert.deepEqual(p.state.marks, []); assert.deepEqual(p.state.folds, []);
  const c4 = ctxStub(); p.draw(c4, 1280, 720); assert.ok(c4.calls.fillRect >= 1, 'a new sheet is paper again');
});

test('the sheet deforms what was painted before: a boundary creases it, a climax buckles it, a drip keeps running', async () => {
  const g = await ready;
  const score = composeVisual(song(g)), st = createPerformance(ink, score).state;
  ink.step(st, STEP, [], clockOf(score, 0.5));
  ink.step(st, STEP, [{ t: 0, cycle: 0, dur: .25, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact', gain: 1.2, velocity: 1, pan: .5, cutoff: null, room: 0, note: null }], clockOf(score, 0.5));
  assert.ok(st.marks.some((m) => m.drip > 0), 'a hard impact drips');
  ink.step(st, STEP, [], clockOf(score, 2, clockOf(score, 1.95))); // into the climax
  assert.equal(st.folds.length, 1); assert.equal(st.buckles.length, 1);
  assert.ok(st.folds[0].at > st.marks[0].at, 'the crease is after the marks it moves');
  for (let i = 0; i < 120; i++) ink.step(st, STEP, [], clockOf(score, 2.5));
  assert.ok(Math.abs(st.folds[0].amp) > 0.005 && st.buckles[0].amp > 0.005, 'both have grown');
});

test('a plain pattern (no song) paints on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(ink, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.marks.length, 1);
  p.draw(ctxStub(), 320, 180);
});
