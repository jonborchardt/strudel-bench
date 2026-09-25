// web/visual/cabaret.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired), plus what this world is about - the kick walks the star, the snare hops him, the
// melody drives the spot, the pad breathes the curtains, the hats send the chorus across. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import cabaret from '../web/visual/cabaret.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'cabaret' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, melody2: { notes: '7 5 4 2' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const streamOf = (ir) => {
  const out = [];
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers))
    for (const h of l.pattern.queryArc(0, s.cycles)) if (h.hasOnset()) { const c = s.offset + h.whole.begin.valueOf(); out.push(eventOf(h, name, layerBase(name), c / ir.meta.cps)); }
  return out.sort((a, b) => a.t - b.t);
};
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const run = (ir, seconds = 8) => {
  const p = createPerformance(cabaret, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) p.advance(t, t * ir.meta.cps);
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };
const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
const KICK = { ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' };

test('cabaret is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.stroke > 10, 'the figure and the boards stroke');
    assert.ok(ctx.calls.fillRect > 10, 'the house, the boards, the curtains and the pelmet are painted');
    assert.ok(ctx.calls.clip >= 1, 'the backdrop is clipped to the flats');
    assert.ok(p.state.scene.roll > 0, 'the backdrop rolls');
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

test('every cast job reaches the state: a kick steps the star and a wing turns him, a snare hops him, the melody drives the spot by register and colour, the pad breathes the curtain, the bass shoves the backdrop, hats send the chorus across, the boundary is a curtain call, the dropout a bow, a climax the big number', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir), clock = clockOf(score, 0);
  const fresh = () => createPerformance(cabaret, score, { w: 16, h: 9 }).state;
  const one = (ev, s = fresh()) => { cabaret.step(s, STEP, [ev], clock); return s; };
  const still = fresh(); cabaret.step(still, STEP, [], clock);
  const kicked = one(KICK);
  assert.ok(kicked.star.to !== still.star.to && kicked.star.bob > 0.9 && kicked.star.foot === -still.star.foot, 'a kick is a step: the other foot, a bob, a new place');
  const walked = fresh(); for (let i = 0; i < 60; i++) cabaret.step(walked, STEP, [KICK], clock);
  assert.ok(walked.star.to >= walked.aspect * 0.2 && walked.star.to <= walked.aspect * 0.8, 'sixty steps keep him on the boards');
  const at = fresh(); at.star.dir = 1; at.star.to = at.aspect * 0.79; one(KICK, at);
  assert.equal(at.star.dir, -1, 'at the wing he turns');
  const hopped = one({ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' });
  assert.ok(hopped.star.hop > 0.9 && hopped.star.to === still.star.to, 'a snare is a hop, not a step');
  const mel = (note) => ({ ...base, layer: 'melody', kind: 'melody', note });
  const lo = one(mel(48)), hi = one(mel(72));
  const s2 = fresh(); cabaret.step(s2, STEP, [mel(48)], clock); cabaret.step(s2, STEP, [mel(72)], clock);
  assert.ok(s2.spots[0].to > lo.spots[0].to, "a note above the part's low sends the spot stage-right");
  assert.equal(hi.spots[0].hueTo, 0, 'a C tints the spot at hue 0'); assert.equal(one(mel(55)).spots[0].hueTo, 210, 'a G at 210');
  assert.equal(score.cast.melody2.slot, 'counter', 'a second melody is a counter part here: one spot each');
  const two = fresh(); for (let i = 0; i < 60; i++) cabaret.step(two, STEP, i % 20 ? [] : [{ ...base, layer: 'melody2', kind: 'melody', note: 67 }], clock);
  assert.ok(two.spots[1].on > 0.8 && two.spots[0].on > 0.8, 'a counter note brings the second spot up beside the first');
  assert.equal(two.spots[1].hueTo, 210 + 150, 'in its own colour');
  for (let i = 0; i < 300; i++) cabaret.step(two, STEP, [], clock);
  assert.ok(two.spots[1].on < 0.2, 'and it goes out when the part stops');
  const fill = fresh(); const d0 = fill.star.dir; for (let i = 0; i < 4; i++) cabaret.step(fill, STEP, [KICK], clock);
  assert.ok(fill.star.dir === -d0 && fill.star.turn > 0.8, 'four quick kicks, a fill, spin him round');
  const mid = fresh(); cabaret.step(mid, STEP, [KICK], clock); for (let i = 0; i < 5; i++) cabaret.step(mid, STEP, [], clock); cabaret.step(mid, STEP, [KICK], clock);
  assert.ok(mid.star.stagger > 0.9, 'a kick landing mid-step is a stagger');
  assert.ok(one({ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 2 }).curtain.breath > 0.4, 'a pad note stirs the curtain edge');
  assert.ok(one({ ...base, layer: 'bass', kind: 'bass', note: 36 }).scene.shove > one({ ...base, layer: 'bass', kind: 'bass', note: 60 }).scene.shove, 'a low bass note shoves the backdrop harder than a high one');
  const hats = fresh(); hats.act.chorus = 1; for (let i = 0; i < 60; i++) cabaret.step(hats, STEP, [{ ...base, layer: 'perc', kind: 'perc', voice: 'hh', role: 'grain' }], clock);
  assert.ok(hats.chorus.length > 0 && hats.chorus.length <= 5, 'hats send a chorus line across, never more than five');
  assert.ok(hats.chorus.every((w) => w.c && w.dir && w.bob > 0.9), 'each a whole character, going one way, stepping with the hit');
  const seen = []; for (let k = 0; k < 12; k++) { hats.chorus = []; for (let i = 0; i < 40; i++) cabaret.step(hats, STEP, [{ ...base, layer: 'perc', kind: 'perc', voice: 'hh', role: 'grain' }], clock); seen.push(...hats.chorus); }
  assert.ok(seen.some((w) => w.fly > 0.14) && seen.filter((w) => w.fly).length < seen.length / 2, 'now and then one crosses on wires from the flies, most stay on the boards');
  const call = fresh(); const before = call.star.dir, kind = call.scene.kind; cabaret.step(call, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(call.curtain.call > 0.9 && call.star.dir === -before && call.scene.kind !== kind, 'the boundary flaps the curtain, turns him, and changes the flat');
  const bow = fresh(); for (let i = 0; i < 90; i++) cabaret.step(bow, STEP, [], clockOf(score, 3.5));
  assert.ok(bow.bow > 0.8 && bow.dark > 0.8, 'the dropout is his bow in the dark');
  const rising = fresh(); for (let i = 0; i < 60; i++) cabaret.step(rising, STEP, [], clockOf(score, 1.5));
  assert.ok(rising.spots[0].pin > 0.3, 'the riser pins the spot');
  const big = fresh(); for (let i = 0; i < 120; i++) cabaret.step(big, STEP, [], clockOf(score, 2.5));
  assert.ok(big.act.glitz > 0.8, 'in a climax the footlights go to colour');
  assert.ok(big.spots[1].on > 0.4, 'and the second spot comes up to sweep');
  assert.ok(one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }).flash > 0.9, 'the impact is the flash bulb');
});

test('over a long run the chorus comes and goes and the star stays on the boards', async () => {
  const g = await ready;
  const p = run(song(g), 40), s = p.state;
  assert.ok(s.star.x >= s.aspect * 0.15 && s.star.x <= s.aspect * 0.85);
  assert.ok(s.chorus.length <= 5);
  assert.ok(s.scene.roll > 0.2, 'the scenery has gone by');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(cabaret, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.star.bob > 0 || p.state.star.x !== p.state.aspect / 2);
  p.draw(ctxStub(), 320, 180);
});
