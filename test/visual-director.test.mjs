// web/visual/director.mjs: a world that composes worlds. What the architecture must honour: a one-layer director is
// the bare world; every child is stepped whether shown or not (a cumulative world hidden for a scene keeps the history);
// scenes change on the section boundary and a transition lands its rects and opacities in its bars; a breathing layer
// fades in and out from the song's own cycle; the overlay preset reads the arc; a single-world score never gets a
// director. The look is judged live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { createDirector, scenesOf, rolesOf, sceneAt, breathAt, circleRect, FULL, PRESETS } from '../web/visual/director.mjs';
import { WORLDS, worldOf, withPick } from '../web/visual/stage.mjs';
import { createPerformance } from '../web/visual/host.mjs';
import { streamOf, renderFrames } from '../web/visual/export.mjs';
import { composeVisual, compositionOf } from '../lib/visual.mjs';
import { prng } from '../lib/random.mjs';
import tunnel from '../web/visual/tunnel.mjs';

const song = (g, visual) => g.song({ cps: .5, key: 'C:minor', seed: 3, ...(visual ? { visual } : {}) }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 } }),
  g.section('verse', 2, { role: 'develop', drums: { density: .6 }, bass: {}, melody: { notes: '0 2 4 7' } }),
  g.section('drop', 2, { role: 'climax', drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: {} }),
  g.section('out', 2, { role: 'release', pad: { space: .9 }, melody: { notes: '7 4 2 0' } }),
]);
// a canvas that counts what is drawn on it, and refuses nothing
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : k === 'roundRect' ? undefined : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const canvasStub = () => { const made = []; return { made, createCanvas: (w, h) => { const c = { width: w, height: h, ctx: ctxStub(), getContext() { return this.ctx; } }; made.push(c); return c; } }; };
// a world that records what it is handed
const counter = (name) => ({ name, init: (score, rng, size) => ({ size, steps: 0, events: 0, draws: 0, r: rng() }), step: (s, dt, ev) => { s.steps++; s.events += ev.length; }, draw: (s) => { s.draws++; } });
const run = (world, pat, seconds, size = { w: 16, h: 9 }) => {
  const score = composeVisual(pat.strudel), p = createPerformance(world, score, size);
  for (const e of streamOf(pat)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) p.advance(t, t * score.cps);
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the director`); }; return () => { obj[key] = was; }; };

test('a one-layer director is the bare world: the same state, the same draws on its target; no randomness or clock of its own', async () => {
  const g = await ready, pat = song(g);
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const { made, createCanvas } = canvasStub();
    const d = createDirector(WORLDS, { createCanvas, scenes: [{ from: 0, layers: [{ world: 'tunnel', rect: FULL }] }] });
    const a = run(tunnel, pat, 6), b = run(d, pat, 6);
    assert.equal(JSON.stringify(b.state.children.tunnel), JSON.stringify(a.state));
    const out = ctxStub(); a.draw(out, 640, 360); b.draw(ctxStub(), 640, 360);
    assert.equal(made.length, 1, 'one target');
    assert.deepEqual(made[0].ctx.calls, out.calls, 'the same strokes on the target as on the page');
    assert.equal(made[0].width, 640); assert.equal(made[0].height, 360);
  } finally { undo.forEach((u) => u()); }
});

test('every child is stepped whether shown or not: a cumulative world hidden for a scene holds the marks made while hidden', async () => {
  const g = await ready, pat = song(g), score = composeVisual(pat.strudel), seconds = pat.strudel.total / score.cps;
  const scenes = [
    { from: 0, layers: [{ world: 'tunnel', rect: FULL }] }, // ink hidden through intro and verse
    { from: 2, transition: { type: 'crossfade', bars: 1 }, layers: [{ world: 'tunnel', rect: FULL }, { world: 'ink', rect: FULL, opacity: .5 }] },
    { from: 3, transition: { type: 'crossfade', bars: 1 }, layers: [{ world: 'tunnel', rect: FULL }] }, // and hidden again
  ];
  const d = createDirector(WORLDS, { createCanvas: canvasStub().createCanvas, scenes });
  const p = run(d, pat, seconds - 0.05); // short of the end: past it the song loops and ink starts a new sheet
  const shown = createDirector(WORLDS, { createCanvas: canvasStub().createCanvas, scenes: [{ from: 0, layers: scenes[1].layers }] }); // ink shown throughout: the same child, the same generator, the same events
  const q = run(shown, pat, seconds - 0.05);
  const marks = p.state.children.ink.marks;
  assert.equal(JSON.stringify(p.state.children.ink), JSON.stringify(q.state.children.ink), 'hidden or shown, the same sheet');
  assert.ok(marks.length > 20);
  const verse = score.sections[1];
  assert.ok(marks.some((m) => m.x < 0.5), 'marks from the first half of the sheet, painted while ink was hidden');
  assert.ok(p.state.children.ink.lastCycle > verse.until, 'ink saw the whole song');
  // drawn only while shown: the ink target exists only once ink was on
  const targetsAt = [];
  const { createCanvas: cc2, made: m2 } = canvasStub(); const d2 = createDirector(WORLDS, { createCanvas: cc2, scenes }), r = createPerformance(d2, score, { w: 16, h: 9 });
  for (const e of streamOf(pat)) r.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) { r.advance(t, t * score.cps); r.draw(ctxStub(), 640, 360); targetsAt.push([r.clock?.index ?? -1, m2.length]); }
  assert.ok(targetsAt.filter(([i]) => i <= 1).every(([, n]) => n === 1), 'one target through intro and verse');
  assert.ok(targetsAt.some(([i, n]) => i === 2 && n === 2), 'ink gets its target in the drop');
});

test('scenes change on the section boundary and a transition lands in its bars: rects and opacities reach their targets, leaving layers are dropped, expand grows from a point, the order puts the arriving picture over the old', async () => {
  const g = await ready, pat = song(g), score = composeVisual(pat.strudel);
  const W = { a: counter('a'), b: counter('b') };
  const scenes = [{ from: 0, layers: [{ world: 'a', rect: FULL }] }, { from: 1, transition: { type: 'expand', bars: 1 }, layers: [{ world: 'a', rect: FULL }, { world: 'b', rect: [0.5, 0.5, 0.4, 0.4], mask: 'rounded' }] }, { from: 2, transition: { type: 'collapse', bars: 2 }, layers: [{ world: 'a', rect: FULL }] }];
  const d = createDirector(W, { createCanvas: canvasStub().createCanvas, scenes }), p = createPerformance(d, score, { w: 16, h: 9 });
  let now = 0;
  const at = (cycle) => { const end = cycle / score.cps; while (now < end) { now = Math.min(end, now + 1 / 30); p.advance(now, now * score.cps); } return p.state; }; // in frames: a jump past the catch-up cap would lose time
  let s = at(0);
  assert.equal(s.scene, 0); assert.deepEqual(s.order, ['a']); assert.equal(s.trans, null);
  s = at(2.05); // the verse begins: b expands from the centre of its rect
  assert.equal(s.scene, 1); assert.deepEqual(s.order, ['a', 'b']); assert.equal(s.trans.type, 'expand');
  assert.ok(s.layers.b.cur.rect[2] < 0.05, 'b starts as a point');
  assert.deepEqual(s.layers.b.from.rect, [0.7, 0.7, 0, 0]);
  assert.equal(s.layers.b.from.opacity, 1); assert.equal(s.layers.a.cur.opacity, 1);
  s = at(2.5); assert.ok(s.layers.b.cur.rect[2] > 0.05 && s.layers.b.cur.rect[2] < 0.4, 'half a bar in: growing');
  s = at(3.15); assert.equal(s.trans, null); assert.deepEqual(s.layers.b.cur.rect, [0.5, 0.5, 0.4, 0.4]);
  s = at(4.05); // the drop: b collapses over a
  assert.equal(s.scene, 2); assert.deepEqual(s.order, ['a', 'b'], 'the leaving picture stays on top while it collapses'); assert.equal(s.layers.b.leaving, true);
  assert.deepEqual(s.layers.b.to.rect, [0.7, 0.7, 0, 0]);
  s = at(5); assert.ok(s.layers.b.cur.rect[2] < 0.4 && s.layers.b.cur.rect[2] > 0, 'a bar into two: still collapsing');
  s = at(6.15); assert.equal(s.trans, null); assert.deepEqual(s.order, ['a']); assert.equal(s.layers.b, undefined, 'gone');
  assert.equal(s.children.b.steps, s.children.a.steps, 'b was stepped throughout');
  assert.equal(s.children.b.events, s.children.a.events, 'and handed every event');
  assert.equal(s.children.a.size.w, 16); assert.equal(s.children.b.size.h, 9 * 0.4, "a child's size is its rect's share of the frame");
  assert.notEqual(s.children.a.r, s.children.b.r, 'each child its own generator');
  // a loop: the cycle wraps, back to the first scene by its own (cut) transition
  for (let k = 0; k < 3; k++) { now += 1 / 30; p.advance(now, 0.5 + k / 30); } s = p.state;
  assert.equal(s.scene, 0); assert.equal(s.trans, null);
  assert.equal(sceneAt(scenes, -1), 0); assert.equal(sceneAt(scenes, 7), 2);
});

test('a breathing layer fades in and out from the song\'s cycle: nothing at the start of every period, full half way, the same offline as live', async () => {
  const g = await ready, pat = song(g), score = composeVisual(pat.strudel);
  const W = { a: counter('a'), b: counter('b') };
  const d = createDirector(W, { createCanvas: canvasStub().createCanvas, scenes: [{ from: 0, layers: [{ world: 'a', rect: FULL }, { world: 'b', rect: FULL, opacity: 0.8, breathe: 4 }] }] });
  const p = createPerformance(d, score, { w: 16, h: 9 });
  let now = 0; const at = (cycle) => { const end = cycle / score.cps; while (now < end) { now = Math.min(end, now + 1 / 30); p.advance(now, now * score.cps); } return p.state.layers.b; };
  assert.ok(at(0.02).breath < 0.01, 'quiet at the start');
  assert.ok(Math.abs(at(2).breath - 1) < 0.01, 'full at half the period');
  assert.ok(at(4).breath < 0.01, 'gone again at the period');
  assert.ok(Math.abs(at(5).breath - 0.5) < 0.02);
  assert.ok(Math.abs(breathAt(1, 4) - 0.5) < 1e-9); assert.ok(Math.abs(breathAt(2, 4) - 1) < 1e-9);
  // drawn at opacity × breath: at the period's start b is not drawn at all
  at(8.0); const c1 = ctxStub(); p.draw(c1, 640, 360); assert.equal(p.state.children.b.draws, 0, 'b not drawn while its breath is out');
  at(10); const c2 = ctxStub(); p.draw(c2, 640, 360); assert.equal(p.state.children.b.draws, 1, 'drawn at full breath');
});

test('parts: a layer with a part list is handed only those events', async () => {
  const g = await ready, pat = song(g), score = composeVisual(pat.strudel);
  const W = { a: counter('a'), b: counter('b') };
  const d = createDirector(W, { createCanvas: canvasStub().createCanvas, scenes: [{ from: 0, layers: [{ world: 'a', rect: FULL }, { world: 'b', rect: FULL, opacity: .5, parts: ['melody'] }] }] });
  const p = run(d, pat, pat.strudel.total / score.cps + 0.5);
  const melody = streamOf(pat).filter((e) => e.layer === 'melody').length;
  assert.equal(p.state.children.b.events, melody); assert.ok(p.state.children.a.events > melody);
});

test('the overlay preset reads the arc: a base, a breathing second world whose peak follows the energy, and a portal that irises open at the first developing section; deterministic', async () => {
  const g = await ready;
  const pat = song(g, { composition: 'overlay', worlds: ['tunnel', 'ink', 'orrery'] }), score = composeVisual(pat.strudel);
  assert.deepEqual(score.composition, { preset: 'overlay', worlds: ['tunnel', 'ink', 'orrery'] });
  assert.equal(score.world, 'tunnel', "the primary is the score's world");
  const sc = scenesOf(score, prng(7));
  assert.deepEqual(sc.map((s) => s.from), [0, 1, 2, 3]);
  assert.deepEqual(sc.map((s) => s.layers.map((l) => l.world)), [['tunnel', 'ink'], ['tunnel', 'ink', 'orrery'], ['tunnel', 'ink', 'orrery'], ['tunnel', 'ink', 'orrery']]);
  assert.deepEqual(sc.map((s) => s.transition.type), ['cut', 'iris', 'crossfade', 'crossfade']);
  for (const s of sc) { assert.equal(s.layers[1].breathe, 8); assert.deepEqual(s.layers[1].rect, FULL); assert.equal(s.layers[1].blend, 'source-over'); }
  const op = sc.map((s) => s.layers[1].opacity); assert.ok(op[2] > op[0] && op[2] <= 0.95 && op[0] >= 0.45, "the second world's peak follows the energy: the drop over the intro");
  assert.equal(sc[1].layers[2].mask, 'circle'); assert.ok(Math.abs(sc[1].layers[2].rect[2] * 16 / 9 - sc[1].layers[2].rect[3]) < 1e-3, 'the portal is round');
  assert.deepEqual(scenesOf(score, prng(8)), sc, 'nothing in it is random');
  const c = circleRect(0.5, 0.5, 0.4); assert.ok(Math.abs(c[2] * 16 / 9 - c[3]) < 1e-3, 'square in pixels'); assert.equal(c[3], 0.4);
  // two worlds: no portal
  const two = scenesOf(composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel', 'ink'] }).strudel), prng(7));
  assert.ok(two.every((s) => s.layers.length === 2));
  // a composition with no worlds written: the score's world first, then the selection's next-best
  const s4 = composeVisual(song(g, { composition: 'overlay' }).strudel);
  assert.equal(s4.composition.worlds.length, 3); assert.equal(s4.composition.worlds[0], s4.world); assert.equal(new Set(s4.composition.worlds).size, 3);
  assert.deepEqual(compositionOf('single', 'ink', { tunnel: .9 }), { preset: 'single', worlds: ['ink'] });
  assert.deepEqual(rolesOf({ sections: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], peak: 'b' }), ['establish', 'climax', 'release']);
  assert.equal(scenesOf(composeVisual(song(g, 'ink').strudel), prng(1)).length, 1, 'a single world: one scene');
});

test('worldOf: a single-world score gets the bare world, a composed one the director; withPick is the view override', async () => {
  const g = await ready;
  const plain = composeVisual(song(g, 'ink').strudel);
  assert.equal(worldOf(plain), WORLDS.ink, 'the very object, no wrapper');
  assert.equal(worldOf(composeVisual(song(g).strudel)).name, composeVisual(song(g).strudel).world);
  const composed = composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel', 'ink'] }).strudel);
  assert.equal(worldOf(composed, { createCanvas: canvasStub().createCanvas }).name, 'director');
  assert.equal(worldOf(composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel'] }).strudel)), WORLDS.tunnel, 'one world listed: bare');
  assert.equal(withPick(composed, 'loom').composition, undefined); assert.equal(withPick(composed, 'loom').world, 'loom');
  assert.deepEqual(withPick(plain, 'overlay').composition.preset, 'overlay'); assert.equal(withPick(plain, 'overlay').composition.worlds[0], 'ink');
  assert.equal(withPick(plain, null), plain); assert.equal(withPick(plain, 'nope'), plain);
  assert.deepEqual(PRESETS, ['single', 'overlay']);
});

test('the header: composition and worlds are validated, and the check describes them', async () => {
  const g = await ready;
  assert.throws(() => g.song({ visual: { composition: 'mosaic-climax' } }, []), /composition must be one of/);
  assert.throws(() => g.song({ visual: { composition: 'overlay', worlds: ['tunnel', 'nope'] } }, []), /worlds must list worlds/);
  assert.throws(() => g.song({ visual: { worlds: ['tunnel'] } }, []), /goes with a composition/);
  assert.throws(() => g.song({ visual: { layout: 'x' } }, []), /not layout/);
  const { describeVisual } = await import('../lib/visual.mjs');
  const d = describeVisual(composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel', 'ink', 'orrery'] }).strudel));
  assert.ok(d.some((c) => c === 'overlay: tunnel + ink + orrery'), d.join(' · '));
});

test('through the exporter: a composed song renders every frame on a stub context, deterministically, drawing children into their targets and compositing them', async () => {
  const g = await ready, pat = song(g, { composition: 'overlay', worlds: ['tunnel', 'ink', 'orrery'] }), score = composeVisual(pat.strudel), stream = streamOf(pat), seconds = pat.strudel.total / score.cps;
  const once = async () => { const { createCanvas, made } = canvasStub(), ctx = ctxStub(); const r = await renderFrames({ world: worldOf(score, { createCanvas }), score, stream, seconds, title: { name: 't', line: '' }, ctx, w: 640, h: 360, yieldEvery: 1000 }); return { r, ctx, made }; };
  const a = await once(), b = await once();
  assert.equal(a.r.perf.state.scene, 3, 'the tail holds the last scene');
  assert.equal(JSON.stringify(a.r.perf.state), JSON.stringify(b.r.perf.state), 'the same frames twice');
  assert.equal(a.made.length, 3, 'a target per world');
  assert.ok(a.ctx.calls.drawImage >= a.r.frames, 'every frame composites at least the primary');
  assert.ok(a.ctx.calls.clip > a.r.frames, 'the portal is clipped');
  const ink = a.r.perf.state.children.ink; assert.ok(ink.marks.length > 20, 'ink painted the whole song while overlaid');
});
