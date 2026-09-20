// web/visual/director.mjs: a world that composes worlds. What the architecture must honour: a one-layer director is
// the bare world; every child is stepped whether shown or not (a cumulative world hidden for a scene keeps the history);
// scenes change on the section boundary and a transition lands its rects and opacities in its bars; the mosaic is bounded
// and seeded; the presets read the arc; a single-world score never gets a director. The look is judged live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { createDirector, scenesOf, mosaic, placeInsets, budget, rolesOf, sceneAt, inset, circleRect, FULL, PRESETS } from '../web/visual/director.mjs';
import { WORLDS, worldOf, withPick } from '../web/visual/stage.mjs';
import { createPerformance, clockOf, STEP } from '../web/visual/host.mjs';
import { streamOf, renderFrames } from '../web/visual/export.mjs';
import { composeVisual, compositionOf } from '../lib/visual.mjs';
import { prng } from '../lib/random.mjs';
import ink from '../web/visual/ink.mjs';
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
    { from: 2, transition: { type: 'crossfade', bars: 1 }, layers: [{ world: 'tunnel', rect: FULL }, { world: 'ink', rect: FULL, opacity: .5, blend: 'screen' }] },
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

test('parts: a layer with a part list is handed only those events', async () => {
  const g = await ready, pat = song(g), score = composeVisual(pat.strudel);
  const W = { a: counter('a'), b: counter('b') };
  const d = createDirector(W, { createCanvas: canvasStub().createCanvas, scenes: [{ from: 0, layers: [{ world: 'a', rect: FULL }, { world: 'b', rect: FULL, opacity: .5, parts: ['melody'] }] }] });
  const p = run(d, pat, pat.strudel.total / score.cps + 0.5);
  const melody = streamOf(pat).filter((e) => e.layer === 'melody').length;
  assert.equal(p.state.children.b.events, melody); assert.ok(p.state.children.a.events > melody);
});

test('mosaic: 2 to 5 tiles that tile the frame, none tiny or extreme, the largest first, the same seed the same tiles', () => {
  for (let seed = 1; seed <= 24; seed++) for (let n = 2; n <= 5; n++) {
    const tiles = mosaic(n, prng(seed));
    assert.equal(tiles.length, n, `seed ${seed} n ${n}`);
    assert.ok(Math.abs(tiles.reduce((s, t) => s + t[2] * t[3], 0) - 1) < 1e-3, 'they tile the frame');
    for (const t of tiles) { assert.ok(t[2] * t[3] >= 0.12 - 1e-3, `no tile under 12%: ${t}`); const a = (t[2] * 16) / (t[3] * 9); assert.ok(a >= 0.6 - 1e-3 && a <= 2.4 + 1e-3, `aspect ${a}`); }
    for (let i = 1; i < n; i++) assert.ok(tiles[i - 1][2] * tiles[i - 1][3] >= tiles[i][2] * tiles[i][3]);
    for (const a of tiles) for (const b of tiles) if (a !== b) assert.ok(a[0] + a[2] <= b[0] + 1e-3 || b[0] + b[2] <= a[0] + 1e-3 || a[1] + a[3] <= b[1] + 1e-3 || b[1] + b[3] <= a[1] + 1e-3, 'no overlap');
    assert.deepEqual(mosaic(n, prng(seed)), tiles);
  }
  assert.notDeepEqual(mosaic(4, prng(1)), mosaic(4, prng(2)), 'another seed, another mosaic');
  const r = inset([0, 0, 0.5, 0.5]); assert.ok(r[0] > 0 && r[1] > 0 && r[2] < 0.5 && r[3] < 0.5); assert.ok(Math.abs(r[0] * 16 / 9 - r[1]) < 1e-3, 'the gutter is square in pixels');
  const c = circleRect(0.5, 0.5, 0.4); assert.ok(Math.abs(c[2] * 16 / 9 - c[3]) < 1e-3, 'square in pixels'); assert.equal(c[3], 0.4);
});

test('placeInsets and budget: a world is placed only in a tile it reads at, loom keeps a wide one, past two high-motion worlds the rest dim, an overlay is capped', () => {
  const tiles = [[0, 0, 0.5, 1], [0.5, 0, 0.3, 0.5], [0.5, 0.5, 0.5, 0.3], [0.8, 0, 0.2, 0.5]]; // aspects .89, 1.07, 2.96, .71
  const placed = placeInsets(tiles, ['loom', 'sediment', 'orrery', 'ink']);
  assert.deepEqual(placed.map((p) => p.world), ['sediment', 'orrery', 'ink'], 'loom needs aspect 1.3 and .45 high, no tile has both; sediment takes the tall one, orrery the next, ink the .3-high one, nothing fits the sliver');
  assert.deepEqual(placeInsets([[0, 0, 1, 0.5]], ['loom']).map((p) => p.world), ['loom']);
  const three = budget([{ world: 'tunnel', rect: FULL, opacity: 1, blend: 'source-over' }, { world: 'swarm', rect: FULL, opacity: 1, blend: 'screen' }, { world: 'signal', rect: [0, 0, 0.5, 0.5], opacity: 1, blend: 'source-over' }, { world: 'swarm', rect: [0.5, 0.5, 0.5, 0.5], opacity: 1, blend: 'source-over' }]);
  assert.deepEqual(three.map((l) => l.opacity), [1, 1, 0.6, 0.6]);
  assert.equal(budget([{ world: 'signal', rect: FULL, opacity: 0.6, blend: 'screen' }])[0].opacity, 0.35, "signal's overlay cap");
});

test('presets read the arc: mosaic-climax is one world, then two, then a bleed mosaic at the climax, then one again; overlay is a base, a following overlay and a portal that irises open; deterministic', async () => {
  const g = await ready;
  const pat = song(g, { composition: 'mosaic-climax', worlds: ['tunnel', 'ink', 'loom', 'orrery'] }), score = composeVisual(pat.strudel);
  assert.deepEqual(score.composition, { preset: 'mosaic-climax', worlds: ['tunnel', 'ink', 'loom', 'orrery'] });
  assert.equal(score.world, 'tunnel', 'the primary is the score\'s world');
  const sc = scenesOf(score, prng(7));
  assert.deepEqual(sc.map((s) => s.from), [0, 1, 2, 3]);
  assert.deepEqual(sc.map((s) => s.layers.map((l) => l.world)), [['tunnel'], ['tunnel', 'ink'], ['tunnel', 'ink', 'loom', 'orrery'], ['ink']], 'ink overlays through develop and the climax; the release ends on ink, the listed world that makes a final frame');
  assert.deepEqual(sc.map((s) => s.transition.type), ['cut', 'crossfade', 'mosaic-in', 'mosaic-out']);
  assert.equal(sc[1].layers[1].blend, score.palette.luminance >= 0.5 ? 'multiply' : 'screen', "ink overlays by its own paper rule: light paper multiplies, a dark sheet screens"); assert.ok(sc[1].layers[1].opacity > 0 && sc[1].layers[1].opacity < 1);
  assert.deepEqual(sc[2].layers[0].rect, FULL, 'the primary stays full under the mosaic');
  for (const l of sc[2].layers.slice(2)) { assert.ok(l.rect[2] < 1 && l.rect[3] < 1 && l.rect[0] >= 0, 'an inset'); assert.equal(l.mask, 'rounded'); }
  assert.ok(sc[2].layers.find((l) => l.world === 'loom').rect[2] * 16 / (sc[2].layers.find((l) => l.world === 'loom').rect[3] * 9) >= 1.3, 'loom in a wide tile');
  assert.deepEqual(scenesOf(score, prng(7)), sc); assert.notDeepEqual(scenesOf(score, prng(8)).map((s) => s.layers.map((l) => l.rect)), sc.map((s) => s.layers.map((l) => l.rect)));
  // no final-frame world listed: the release collapses to the primary
  const pat2 = song(g, { composition: 'mosaic-climax', worlds: ['tunnel', 'swarm', 'orrery', 'signal'] }), sc2 = scenesOf(composeVisual(pat2.strudel), prng(7));
  assert.deepEqual(sc2.map((s) => s.layers.map((l) => l.world)), [['tunnel'], ['tunnel', 'swarm'], ['tunnel', 'swarm', 'orrery', 'signal'], ['tunnel']]);
  assert.equal(sc2[3].transition.type, 'mosaic-out');
  // overlay
  const pat3 = song(g, { composition: 'overlay', worlds: ['tunnel', 'ink', 'orrery'] }), sc3 = scenesOf(composeVisual(pat3.strudel), prng(7));
  assert.deepEqual(sc3.map((s) => s.layers.map((l) => l.world)), [['tunnel', 'ink'], ['tunnel', 'ink', 'orrery'], ['tunnel', 'ink', 'orrery'], ['tunnel', 'ink', 'orrery']]);
  assert.deepEqual(sc3.map((s) => s.transition.type), ['cut', 'iris', 'crossfade', 'crossfade']);
  assert.equal(sc3[1].layers[2].mask, 'circle'); assert.ok(Math.abs(sc3[1].layers[2].rect[2] * 16 / 9 - sc3[1].layers[2].rect[3]) < 1e-3, 'the portal is round');
  const op = sc3.map((s) => s.layers[1].opacity); assert.ok(op[2] > op[0], "the overlay's opacity follows the energy: the drop over the intro");
  // a composition with no worlds written: the score's world first, then the selection's next-best
  const pat4 = song(g, { composition: 'overlay' }), s4 = composeVisual(pat4.strudel);
  assert.equal(s4.composition.worlds.length, 3); assert.equal(s4.composition.worlds[0], s4.world); assert.equal(new Set(s4.composition.worlds).size, 3);
  assert.deepEqual(compositionOf('single', 'ink', { tunnel: .9 }), { preset: 'single', worlds: ['ink'] });
  assert.deepEqual(rolesOf({ sections: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], peak: 'b' }), ['establish', 'climax', 'release']);
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
  assert.deepEqual(withPick(plain, 'mosaic-climax').composition.preset, 'mosaic-climax'); assert.equal(withPick(plain, 'mosaic-climax').composition.worlds[0], 'ink');
  assert.equal(withPick(plain, null), plain); assert.equal(withPick(plain, 'nope'), plain);
  assert.ok(PRESETS.includes('single') && PRESETS.includes('overlay') && PRESETS.includes('mosaic-climax'));
});

test('the header: composition and worlds are validated, and the check describes them', async () => {
  const g = await ready;
  assert.throws(() => g.song({ visual: { composition: 'grid' } }, []), /composition must be one of/);
  assert.throws(() => g.song({ visual: { composition: 'overlay', worlds: ['tunnel', 'nope'] } }, []), /worlds must list worlds/);
  assert.throws(() => g.song({ visual: { worlds: ['tunnel'] } }, []), /goes with a composition/);
  assert.throws(() => g.song({ visual: { layout: 'x' } }, []), /not layout/);
  const { describeVisual } = await import('../lib/visual.mjs');
  const d = describeVisual(composeVisual(song(g, { composition: 'overlay', worlds: ['tunnel', 'ink', 'orrery'] }).strudel));
  assert.ok(d.some((c) => c === 'overlay: tunnel + ink + orrery'), d.join(' · '));
});

test('through the exporter: a composed song renders every frame on a stub context, deterministically, drawing children into their targets and compositing them', async () => {
  const g = await ready, pat = song(g, { composition: 'mosaic-climax', worlds: ['tunnel', 'ink', 'orrery', 'swarm'] }), score = composeVisual(pat.strudel), stream = streamOf(pat), seconds = pat.strudel.total / score.cps;
  const once = async () => { const { createCanvas, made } = canvasStub(), ctx = ctxStub(); const r = await renderFrames({ world: worldOf(score, { createCanvas }), score, stream, seconds, title: { name: 't', line: '' }, ctx, w: 640, h: 360, yieldEvery: 1000 }); return { r, ctx, made }; };
  const a = await once(), b = await once();
  assert.equal(a.r.perf.state.scene, 3, 'the tail holds the last scene');
  assert.equal(JSON.stringify(a.r.perf.state), JSON.stringify(b.r.perf.state), 'the same frames twice');
  assert.equal(a.made.length, 4, 'a target per world');
  assert.ok(a.ctx.calls.drawImage >= a.r.frames, 'every frame composites at least the primary');
  assert.ok(a.ctx.calls.clip > a.r.frames, 'insets are clipped');
  const ink = a.r.perf.state.children.ink; assert.ok(ink.marks.length > 20, 'ink painted the whole song while overlaid');
});
