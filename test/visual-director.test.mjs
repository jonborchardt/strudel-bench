// web/visual/director.mjs: a world that composes two worlds, the base and one breathing over it. What the architecture
// must honour: the base is the bare world; the second world is stepped whether shown or not (a cumulative one keeps the
// history); the breath comes from the song's cycle and its top from the section's energy; a single-world score never
// gets a director. The look is judged live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { createDirector, breathAt, BREATH, PRESETS } from '../web/visual/director.mjs';
import { WORLDS, worldOf, withPick } from '../web/visual/stage.mjs';
import { createPerformance } from '../web/visual/host.mjs';
import { streamOf, renderFrames } from '../web/visual/export.mjs';
import { composeVisual, compositionOf } from '../lib/visual.mjs';
import tunnel from '../web/visual/tunnel.mjs';
import ink from '../web/visual/ink.mjs';

const song = (g, visual) => g.song({ cps: .5, key: 'C:minor', seed: 3, ...(visual ? { visual } : {}) }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 } }),
  g.section('verse', 2, { role: 'develop', drums: { density: .6 }, bass: {}, melody: { notes: '0 2 4 7' } }),
  g.section('drop', 2, { role: 'climax', drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: {} }),
  g.section('out', 2, { role: 'release', pad: { space: .9 }, melody: { notes: '7 4 2 0' } }),
]);
// a canvas that counts what is drawn on it, and refuses nothing
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const canvasStub = () => { const made = []; return { made, createCanvas: (w, h) => { const c = { width: w, height: h, ctx: ctxStub(), getContext() { return this.ctx; } }; made.push(c); return c; } }; };
const counter = (name) => ({ name, init: (score, rng, size) => ({ size, steps: 0, events: 0, draws: 0, r: rng() }), step: (s, dt, ev) => { s.steps++; s.events += ev.length; }, draw: (s) => { s.draws++; } });
const run = (world, score, pat, seconds) => {
  const p = createPerformance(world, score, { w: 16, h: 9 });
  for (const e of streamOf(pat)) p.push(e);
  let now = 0; const at = (t) => { while (now < t) { now = Math.min(t, now + 1 / 30); p.advance(now, now * score.cps); } return p; }; // in frames: a jump past the catch-up cap would lose time
  at(seconds);
  return { p, at };
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the director`); }; return () => { obj[key] = was; }; };

test('the base is the bare world (the same state, the same draws) and the second world sees every event whether shown or not; no randomness or clock of its own', async () => {
  const g = await ready, pat = song(g, { composition: 'overlay', worlds: ['tunnel', 'ink'] }), score = composeVisual(pat.strudel), seconds = pat.strudel.total / score.cps - 0.05; // short of the end: past it the song loops and ink starts a new sheet
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const { made, createCanvas } = canvasStub();
    const bare = run(tunnel, score, pat, seconds).p, d = run(createDirector(WORLDS, { createCanvas }), score, pat, seconds).p;
    assert.equal(JSON.stringify(d.state.children.base), JSON.stringify(bare.state), 'the base is the bare world');
    const out = ctxStub(); bare.draw(out, 640, 360); const page = ctxStub(); d.draw(page, 640, 360);
    assert.deepEqual(made[0].ctx.calls, out.calls, 'the same strokes on the base target as on the page');
    assert.equal(made[0].width, 640); assert.ok(page.calls.drawImage >= 1, 'composited');
    const alone = run(ink, { ...score, seed: score.seed }, pat, seconds).p; // ink by itself on the same events: the same marks (its generator differs, so the counts, not the states)
    assert.ok(d.state.children.over.marks.length > 20 && Math.abs(d.state.children.over.marks.length - alone.state.marks.length) < 40, 'ink painted the whole song while breathing');
    assert.ok(d.state.children.over.lastCycle > score.sections[2].at, 'ink saw the whole song');
  } finally { undo.forEach((u) => u()); }
});

test('the breath: nothing at the start of every period, full half way, from the song\'s cycle; its top follows the energy; the second world is drawn only while breathing in', async () => {
  const g = await ready;
  const base = song(g), score = { ...composeVisual(base.strudel), composition: { preset: 'overlay', worlds: ['a', 'b'] } };
  const W = { a: counter('a'), b: counter('b'), tunnel: counter('tunnel') };
  const { p, at } = run(createDirector(W, { createCanvas: canvasStub().createCanvas }), score, base, 0);
  const s = () => p.state;
  at(0.05 / score.cps); assert.ok(s().breath < 0.01, 'quiet at the start');
  p.draw(ctxStub(), 640, 360); assert.equal(s().children.over.draws, 0, 'b not drawn while breathed out'); assert.equal(s().children.base.draws, 1);
  at(1.5 / score.cps); const intro = s().peak;
  at(BREATH / 2 / score.cps); assert.ok(Math.abs(s().breath - 1) < 0.01, 'full at half the period');
  p.draw(ctxStub(), 640, 360); assert.equal(s().children.over.draws, 1, 'drawn at full breath');
  at(5.5 / score.cps); assert.ok(s().peak > intro && s().peak <= 0.95, 'the top rises into the drop');
  at(BREATH / score.cps); assert.ok(s().breath < 0.01, 'gone again at the period');
  assert.equal(s().children.over.steps, s().children.base.steps, 'stepped throughout'); assert.equal(s().children.over.events, s().children.base.events, 'every event');
  assert.notEqual(s().children.base.r, s().children.over.r, 'each its own generator'); assert.deepEqual(s().children.over.size, { w: 16, h: 9 });
  assert.ok(Math.abs(breathAt(1, 4) - 0.5) < 1e-9 && Math.abs(breathAt(2, 4) - 1) < 1e-9 && breathAt(0) === 0);
});

test('worldOf: a single-world score gets the bare world, a composed one the director; withPick is the view override; the score carries the composition', async () => {
  const g = await ready;
  const plain = composeVisual(song(g, { world: 'ink', composition: 'single' }).strudel);
  assert.equal(worldOf(plain), WORLDS.ink, 'the very object, no wrapper');
  assert.equal(composeVisual(song(g, 'ink').strudel).composition.preset, 'overlay', 'a world name alone: the default composition over it');
  const composed = composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel', 'ink'] }).strudel);
  assert.deepEqual(composed.composition, { preset: 'overlay', worlds: ['tunnel', 'ink'] }); assert.equal(composed.world, 'tunnel', "the base is the score's world");
  assert.equal(worldOf(composed, { createCanvas: canvasStub().createCanvas }).name, 'director');
  assert.equal(worldOf(composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel'] }).strudel)), WORLDS.tunnel, 'one world listed: bare');
  const s4 = composeVisual(song(g, { composition: 'overlay' }).strudel);
  assert.equal(s4.composition.worlds.length, 2); assert.equal(s4.composition.worlds[0], s4.world); assert.equal(new Set(s4.composition.worlds).size, 2, 'no worlds written: the score\'s world, then the selection\'s next-best');
  assert.deepEqual(compositionOf('single', 'ink', { tunnel: .9 }), { preset: 'single', worlds: ['ink'] });
  assert.equal(withPick(composed, 'loom').composition, undefined); assert.equal(withPick(composed, 'loom').world, 'loom');
  assert.equal(withPick(plain, 'overlay').composition.preset, 'overlay'); assert.equal(withPick(plain, 'overlay').composition.worlds[0], 'ink');
  assert.equal(withPick(plain, null), plain); assert.equal(withPick(plain, 'nope'), plain);
  assert.deepEqual(PRESETS, ['single', 'overlay']);
});

test('the header: composition and worlds are validated, and the check describes them', async () => {
  const g = await ready;
  assert.throws(() => g.song({ visual: { composition: 'mosaic' } }, []), /composition must be one of/);
  assert.throws(() => g.song({ visual: { composition: 'overlay', worlds: ['tunnel', 'nope'] } }, []), /worlds must list worlds/);
  assert.throws(() => g.song({ visual: { worlds: ['tunnel'] } }, []), /goes with a composition/);
  assert.throws(() => g.song({ visual: { layout: 'x' } }, []), /not layout/);
  const { describeVisual } = await import('../lib/visual.mjs');
  const d = describeVisual(composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel', 'ink'] }).strudel));
  assert.ok(d.some((c) => c === 'overlay: tunnel + ink'), d.join(' · '));
});

test('through the exporter: a composed song renders every frame on a stub context, deterministically', async () => {
  const g = await ready, pat = song(g, { composition: 'overlay', worlds: ['tunnel', 'ink'] }), score = composeVisual(pat.strudel), stream = streamOf(pat), seconds = pat.strudel.total / score.cps;
  const once = async () => { const { createCanvas, made } = canvasStub(), ctx = ctxStub(); const r = await renderFrames({ world: worldOf(score, { createCanvas }), score, stream, seconds, title: { name: 't', line: '' }, ctx, w: 640, h: 360, yieldEvery: 1000 }); return { r, ctx, made }; };
  const a = await once(), b = await once();
  assert.equal(JSON.stringify(a.r.perf.state), JSON.stringify(b.r.perf.state), 'the same frames twice');
  assert.equal(a.made.length, 2, 'a target per world');
  assert.ok(a.ctx.calls.drawImage >= a.r.frames, 'every frame composites at least the base');
  assert.ok(a.r.perf.state.children.over.marks.length > 20, 'ink painted the whole song');
});
