// web/visual/combo.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired), plus the one thing this world is about - who has the floor. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import combo from '../web/visual/combo.mjs';
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
  const p = createPerformance(combo, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  const cps = ir.meta.cps;
  for (let t = 0; t <= seconds; t += 1 / 30) p.advance(t, t * cps);
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };

test('combo is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.stroke > 5, 'the bodies and the ring stroke');
    assert.ok(ctx.calls.fillRect >= 1, 'the frame fades');
    assert.ok(ctx.calls.ellipse >= 1, 'the ring is drawn');
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

test('every part in the cast takes a seat on the ring, evenly spaced', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const s = createPerformance(combo, score, { w: 16, h: 9 }).state;
  assert.deepEqual(s.order.sort(), Object.keys(score.cast).sort(), 'one seat per cast part, before a note sounds');
  const angles = s.order.map((n) => s.seats[n].angle).sort((a, b) => a - b);
  const gaps = angles.slice(1).map((a, i) => a - angles[i]);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1, 'the band sits evenly round the ring');
});

test('every player is the instrument it is played on, and a note rings it', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const one = (ev, cycle = 0) => { const p = createPerformance(combo, score, { w: 16, h: 9 }); combo.step(p.state, STEP, [ev], clockOf(score, cycle)); return p.state; };
  const rung = (els) => els.filter((e) => e.amp > 0);
  const init = createPerformance(combo, score, { w: 16, h: 9 }).state;
  assert.deepEqual([init.seats.bass.form, init.seats.melody.form, init.seats.pad.form, init.seats.drums.form, init.seats.perc.form],
    ['strings', 'strings', 'column', 'membrane', 'cluster'], 'the job says which instrument');
  assert.ok(init.seats.bass.els.length <= 4 && init.seats.melody.els.length >= 4, 'the bass has fewer, thicker strings than a melody');
  assert.equal(rung(one({ ...base, layer: 'bass', kind: 'bass', note: 40 }).seats.bass.els).length, 1, 'a bass note rings one string');
  const pad = one({ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 2 }).seats.pad;
  assert.ok(rung(pad.els).length === 1 && rung(pad.els)[0].hold === 2, 'a pad note holds the column open for its length');
  const kick = one({ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' }).seats.drums;
  assert.equal(kick.ripples.length, 1, 'a kick ripples the head from the centre');
  assert.ok(Math.abs(kick.ripples[0].x) < 0.2, 'struck in the middle, where a kick lands');
  const snare = one({ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }).seats.drums;
  assert.ok(Math.hypot(snare.ripples[0].x, snare.ripples[0].y) > 0.2, 'an impact lands off centre');
  assert.ok(one({ ...base, layer: 'perc', kind: 'perc' }).seats.perc.dots.every((d) => d.v > 0), 'perc rattles the whole cluster');
  const fx = one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 });
  assert.ok(fx.sweep > 0.9, 'an impact sends the light round the ring');
  assert.ok(one({ ...base, layer: null, kind: 'pitched', note: 60 }).seats.line.els.length > 0, 'a pitched hap with no part still gets a seat and an instrument');
});

test('a note picks the string by where it sits in that player\'s own register, not on an absolute scale', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const p = createPerformance(combo, score, { w: 16, h: 9 }), s = p.state;
  const clock = clockOf(score, 0);
  // a line that never leaves one octave still uses the whole instrument
  const play = (note) => combo.step(s, STEP, [{ ...base, layer: 'melody', kind: 'melody', note }], clock);
  play(60); play(72);
  const rungBy = (note) => { for (const el of s.seats.melody.els) el.amp = 0; play(note); return s.seats.melody.els.findIndex((e) => e.amp > 0); };
  const lo = rungBy(60), hi = rungBy(72), n = s.seats.melody.els.length;
  assert.ok(hi - lo >= n - 2, `one octave spans nearly the whole instrument (strings ${lo}..${hi} of ${n})`);
  assert.ok(0.25 * (n - 1) < n - 2, 'which the absolute 36..84 scale would not do: an octave is a quarter of it');
});

test('the floor goes to the part playing above its own norm, and a single hit does not steal it', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const p = createPerformance(combo, score, { w: 16, h: 9 }), s = p.state;
  const clock = clockOf(score, 0);
  const hit = (layer, kind, extra = {}) => ({ ...base, layer, kind, ...extra });
  // four seconds of the whole band comping steadily, the melody among them
  for (let i = 0; i < 240; i++) {
    const evs = i % 4 === 0 ? [hit('drums', 'drums', { voice: 'bd', role: 'pulse' }), hit('bass', 'bass', { note: 40 })] : i % 8 === 4 ? [hit('melody', 'melody', { note: 64 })] : [];
    combo.step(s, STEP, evs, clock);
  }
  const before = s.floor;
  // now the melody takes off: every other step, far above its own level
  for (let i = 0; i < 120; i++) combo.step(s, STEP, i % 2 ? [hit('melody', 'melody', { note: 67 })] : [], clock);
  assert.equal(s.floor, 'melody', `the soloist takes the floor (was ${before})`);
  assert.ok(s.seats.melody.sw > s.seats.bass.sw, 'the floor-holder swells and the compers draw back');
  assert.ok(s.seats.bass.lean > 0, 'the compers turn toward it');
  // every hit runs out across the ground they share, the soloist's strongest
  s.waves.length = 0; s.seats.bass.lastWave = s.seats.melody.lastWave = -9; // the ground rings are throttled per player; this asks for a fresh one from each
  combo.step(s, STEP, [hit('bass', 'bass', { note: 40 })], clock);
  combo.step(s, STEP, [hit('melody', 'melody', { note: 67 })], clock);
  assert.equal(s.waves.length, 2, "both players ring the ground they stand on");
  assert.ok(s.waves[1].hot > s.waves[0].hot, "the one with the floor rings it hardest");
  // one loud hit from the pad does not take the seat
  combo.step(s, STEP, [hit('pad', 'pad', { note: 60, gain: 1.5, velocity: 1 })], clock);
  assert.equal(s.floor, 'melody', 'a single hit never steals the floor');
});

test('the clock alone: a boundary hands over, a riser tightens the ring, a dropout goes dark', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const fresh = () => createPerformance(combo, score, { w: 16, h: 9 }).state;
  const s = fresh();
  combo.step(s, STEP, [], clockOf(score, 0));
  combo.step(s, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(s.sweep > 0.8, 'the boundary hands the floor over with a sweep');
  const calm = fresh(), rising = fresh();
  for (let i = 0; i < 30; i++) { combo.step(calm, STEP, [], clockOf(score, 0)); combo.step(rising, STEP, [], clockOf(score, 1.5)); } // intro's riser is its last bar
  assert.ok(rising.riser > 0 && calm.riser === 0, 'the riser tail is read from the clock');
  const dark = fresh(); for (let i = 0; i < 60; i++) combo.step(dark, STEP, [], clockOf(score, 3.5));
  assert.ok(dark.dark > 0.9, 'the dropout tail goes dark');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(combo, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.equal(p.state.seats.impulse.ripples.length, 1);
  p.draw(ctxStub(), 320, 180);
});

test('two parts doing the same job are built as two different instruments', async () => {
  const g = await ready;
  const ir = g.song({ cps: .5, key: 'C:minor', seed: 5 }, [
    g.section('a', 2, { role: 'develop', melody: { notes: '0 2 4 7' }, melody2: { notes: '7 4 2 0' }, melody3: { notes: '0 4' }, pad: { arp: 'up' } }),
  ]).strudel;
  const s = createPerformance(combo, composeVisual(ir), { w: 16, h: 9 }).state;
  const build = (n) => [s.seats[n].els.length, +s.seats[n].ring.toFixed(3), +s.seats[n].tall.toFixed(3), +s.seats[n].wide.toFixed(3)].join('/');
  const three = ['melody', 'melody2', 'melody3'].map(build);
  assert.equal(new Set(three).size, 3, `three melodies, three builds (got ${three.join(', ')})`);
  assert.equal(new Set(['melody', 'melody2', 'melody3'].map((n) => s.seats[n].hue)).size, 3, 'and three colours');
});
