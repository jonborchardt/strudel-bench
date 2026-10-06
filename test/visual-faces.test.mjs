// web/visual/faces.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired) and what this world promises: a cut on every impact and at least one a bar, a hat at
// the climax, a close shot that sometimes pulls back, a played face. Human eyes judge the look (faces.html shows the wardrobe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import faces, { characterOf } from '../web/visual/faces.mjs';
import { readFileSync } from 'node:fs';
import { portraitOps, renderPortrait, toSvg, tracePath, drawOn, eyeY, mouthY, feetY, mapXY, hatWidth, HAT_TUCK, HAIR_STYLES, HAT_STYLES, TOP_STYLES, FACIAL_HAIR_STYLES, EYE_STYLES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, GLASSES_STYLES, JACKET_STYLES, ACCESSORY_STYLES, DETAIL_STYLES, HEAD_DY, EAR_POINT, FACE_SHAPES, tag, tagsOf, parts, REGISTRIES } from 'limner';
import '../web/visual/thriller.mjs'; // for its side effect: the theme's parts are registered and tagged, so the only:* assertions below have something to keep out
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
const run = (ir, seconds = 8) => runWorld(faces, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'faces' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, melody2: { notes: '7 5 4 2' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };

// an eye's lid clip: a Q curve up on the face, not the neckline opening's own Q curve down on the chest
const isLid = (o) => o.k === 'clip' && /^M [\d.]+ [\d.]+ Q/.test(o.d) && +o.d.split(' ')[2] < 300;

test('faces is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 60, 'three portraits fill');
    assert.ok(ctx.calls.save >= 3 && ctx.calls.restore >= 3, 'each in its own transform');
    assert.ok(p.state.count > 8, 'the song has cut between faces');
    assert.equal(p.state.faces.length, 3, 'the live face and the two before it');
    assert.ok(p.state.wide >= 0 && p.state.wide <= 1 && (p.state.wideTo === 0 || p.state.wideTo === 1), 'the shot is close or wide');
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

test('every cast job reaches the state: a kick bobs and opens the mouth, an impact cuts, hats blink, the melody looks and lifts the brows, a counter tilts, the bass tints, the pad glows, the riser zooms, the impact flashes, a bar with no impact cuts, the boundary dresses for the section and picks the shot, the climax is hatted, the dropout shuts the eyes', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir), clock = clockOf(score, 0);
  const fresh = () => { const s = createPerformance(faces, score, { w: 16, h: 9 }).state; for (let i = 0; i < 12; i++) faces.step(s, STEP, [], clock); return s; }; // the first step cuts to the intro's wardrobe; a fifth of a second later the next cut is allowed
  const one = (ev, s = fresh()) => { faces.step(s, STEP, [ev], clock); return s; };
  const still = fresh();
  const kicked = one(KICK);
  assert.ok(kicked.bob > 0.9 && kicked.grin > 0.9 && kicked.count === still.count, 'a kick nods and grins, no cut');
  const cut = one(SNARE);
  assert.ok(cut.stare > 0.9 && Math.abs(cut.skew) > 0.9, 'a snare widens the eyes and cocks a brow');
  const swaying = fresh(); faces.step(swaying, STEP, [], clockOf(score, 0.25));
  assert.ok(Math.abs(swaying.sway) > 0.05, 'the face sways with the bar');
  assert.equal(cut.count, still.count + 1, 'an impact cuts to a new face');
  assert.notDeepEqual(cut.faces[0], still.faces[0]); assert.deepEqual(cut.faces[1], still.faces[0], 'the last face steps back');
  const twice = fresh(); faces.step(twice, STEP, [SNARE, SNARE], clock);
  assert.equal(twice.count, still.count + 1, 'two impacts in one step are one cut');
  const HAT = { ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }, hat = one(HAT);
  assert.ok(hat.blink > 0.9 && hat.skew !== 0, 'a hat blinks and twitches a brow');
  for (let i = 0; i < 30; i++) faces.step(hat, STEP, [], clock); faces.step(hat, STEP, [HAT], clock);
  assert.ok(hat.blink < 0.1, 'the next hat half a second later does not: a blink every few seconds, not every eighth');
  const mel = (note, pan = 0.5) => ({ ...base, layer: 'melody', kind: 'melody', note, pan });
  const hi = one(mel(84, 0.9)), lo = one(mel(48, 0.1));
  assert.ok(hi.lookTo.y < 0 && hi.lookTo.x > 0.5 && hi.browTo > 6 && hi.tune > 0.4, 'a high note right of centre: eyes up and right, brows up, a wider smile');
  assert.ok(lo.tune < -0.4, 'a low note flattens the smile');
  assert.ok(lo.lookTo.y > 0 && lo.lookTo.x < -0.5 && lo.browTo < 1, 'a low note left: eyes down and left');
  assert.equal(score.cast.melody2.slot, 'counter');
  assert.notEqual(one({ ...base, layer: 'melody2', kind: 'melody', note: 72, pan: 0.9 }).tiltTo, 0, 'a counter note tilts the head');
  const bass = one({ ...base, layer: 'bass', kind: 'bass', note: 43 });
  assert.equal(bass.hueTo, ((43 % 12) / 12) * 80 - 40, 'a G tints the room by its pitch class');
  const pad = one({ ...base, layer: 'pad', kind: 'pad', note: 60, dur: 2, cutoff: 8000 });
  assert.ok(pad.glow > 0.9 && pad.warm < 0.5, 'a bright pad note is a cold glow');
  assert.ok(one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }).flash > 0.9, 'the impact is the flash');
  const bars = fresh(); const n0 = bars.count; for (let i = 0; i < 130; i++) faces.step(bars, STEP, [], clockOf(score, (i / 130) * 1.05));
  assert.ok(bars.count > n0, 'a bar passing with no impact cuts by itself');
  const bound = fresh(); faces.step(bound, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.equal(bound.role, 'climax'); assert.notEqual(bound.faces[0].hat.style, 'none', 'the boundary cuts to the climax wardrobe: hatted');
  const shots = new Set(); for (let i = 0; i < 24; i++) { const b = fresh(); for (let j = 0; j < i; j++) { faces.step(b, STEP, [SNARE], clock); for (let k = 0; k < 10; k++) faces.step(b, STEP, [], clock); } faces.step(b, STEP, [], clockOf(score, 2, clockOf(score, 1.9))); shots.add(b.wideTo); }
  assert.deepEqual([...shots].sort(), [0, 1], 'a boundary picks the shot: sometimes close, sometimes wide');
  assert.ok(['none', 'beanie', 'baseballCap', 'cuffedBeanie'].includes(still.faces[0].hat.style), 'the intro establishes bare-headed or in a beanie');
  const rising = fresh(); for (let i = 0; i < 60; i++) faces.step(rising, STEP, [], clockOf(score, 1.5));
  assert.ok(rising.riser > 0.3, 'the riser zooms');
  const shut = fresh(); for (let i = 0; i < 90; i++) faces.step(shut, STEP, [], clockOf(score, 3.5));
  assert.ok(shut.dark > 0.8, 'the dropout shuts the eyes');
  const c = characterOf(still, 'climax', 1);
  assert.ok(c.mouth.smile > 0.4 && c.hat.style !== 'none' && HAIR_STYLES.includes(c.hair.style) && TOP_STYLES.includes(c.top.style) && EYE_STYLES.includes(c.eyes.style) && c.eyes.asym !== 1, 'a character at full energy smiles under a hat, in ordinary clothes, with uneven eyes');
  for (let i = 0; i < 40; i++) { const k = characterOf(still); assert.ok(!/NaN|undefined/.test(JSON.stringify(portraitOps(k))), 'every generated character draws'); assert.ok(k.hat.style === 'none' || k.hair.style !== 'highBun', 'no bun under a hat'); assert.ok(!['bob', 'bluntBob', 'longStraight'].includes(k.hair.style) || k.facialHair.style === 'none', 'no beard under a bob or long hair'); }
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(faces, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.bob > 0 && p.state.faces.length >= 3);
  p.draw(ctxStub(), 320, 180);
});

