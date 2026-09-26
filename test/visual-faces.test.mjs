// web/visual/faces.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired) and what this world promises: a cut on every impact and at least one a bar, a hat at
// the climax, a close shot that sometimes pulls back, a played face. Human eyes judge the look (faces.html shows the wardrobe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import faces, { characterOf } from '../web/visual/faces.mjs';
import { portraitOps, renderPortrait, toSvg, tracePath, drawOn, HAIR_STYLES, HAT_STYLES, TOP_STYLES, FACIAL_HAIR_STYLES, EYE_STYLES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, GLASSES_STYLES, JACKET_STYLES, ACCESSORY_STYLES, DETAIL_STYLES, HEAD_DY, FACE_SHAPES } from '../web/visual/portrait.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
const run = (ir, seconds = 8) => runWorld(faces, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'faces' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, melody2: { notes: '7 5 4 2' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };

test('every part style draws finite numbers, as SVG and on a canvas', () => {
  const of = (key, styles) => styles.map((s) => ({ [key]: { style: s } }));
  const styles = [...of('hair', HAIR_STYLES), ...of('hat', HAT_STYLES), ...of('top', TOP_STYLES), ...of('jacket', JACKET_STYLES), ...of('facialHair', FACIAL_HAIR_STYLES), ...of('eyes', EYE_STYLES), ...BROW_STYLES.map((s) => ({ eyes: { browStyle: s } })), ...of('nose', NOSE_STYLES), ...of('mouth', MOUTH_STYLES), ...of('glasses', GLASSES_STYLES),
    ...ACCESSORY_STYLES.map((s) => ({ accessories: [s] })), ...DETAIL_STYLES.map((s) => ({ details: [s] })), { mouth: { open: .8 } }, { mouth: { smile: .9 } }, { mouth: { style: 'full', open: .5 } }];
  assert.ok(HAIR_STYLES.length >= 20 && HAT_STYLES.length >= 12 && TOP_STYLES.length >= 9 && JACKET_STYLES.length >= 7 && EYE_STYLES.length === 7 && NOSE_STYLES.length === 8, 'the wardrobe is there');
  for (const o of styles) {
    const ops = portraitOps(o), svg = toSvg(ops);
    assert.ok(ops.length > 20 && !/NaN|undefined/.test(JSON.stringify(ops)), JSON.stringify(o));
    assert.ok(svg.startsWith('<svg') && svg.includes('<path'), 'svg');
    const ctx = ctxStub(); drawOn(ctx, ops); assert.ok(ctx.calls.fill > 10 && ctx.calls.stroke > 5, 'painted');
  }
  assert.ok(renderPortrait({ background: '#123' }).includes('fill="#123"'), 'the background rect');
  const ops = portraitOps({ face: { width: 176 } }), ear = ops.find((o) => o.k === 'ellipse' && o.ry === 27);
  assert.equal(ear.cx, 200 - 88, 'the ears, hair and hat follow the face width');
  const hatted = portraitOps({ hair: { style: 'afroMedium' }, hat: { style: 'baseballCap', color: '#123456' } }), at = hatted.findIndex((o) => o.k === 'clip' && o.d.startsWith('M -100 137'));
  assert.ok(at > 0 && hatted.slice(at).filter((o) => o.fill === '#123456').length >= 4, 'under a hat the hair above its crown is painted over in the hat colour, before the hat');
  assert.equal(hatted.filter((o) => o.k === 'ellipse' && o.fill === '#123456' && o.rx === 96).length, 1, 'the afro keeps its full shape below, and its mass above is hat');
  assert.equal(portraitOps({ hair: { style: 'afroMedium' } }).filter((o) => o.k === 'clip').length, 5, 'without a hat only the eyes, the hairline shadow and the hair texture clip (an afro textures its back and its front)');
  assert.equal(portraitOps({ light: { side: 1, amount: 1 } }).find((o) => o.fill === '#fff' && o.rx === 34).cx, 230, 'the light falls on the side the character says');
  assert.equal(portraitOps({ light: { amount: 0 } }).filter((o) => o.rx === 34).length, 0, 'a flat face has no modelling');
  const long = portraitOps({ hair: { style: 'longStraight' } }), firstPop = long.findIndex((o) => o.k === 'pop');
  assert.ok(long.slice(0, firstPop).some((o) => o.k === 'path' && o.d.includes('L 294 350')), 'long hair puts a sheet behind the neck before the front frame');
  assert.ok(firstPop < long.findIndex((o) => o.k === 'path' && o.d.includes('L 340 600')), 'and behind the shirt');
  const asym = portraitOps({ eyes: { asym: 0.8, browSkew: 0.4 } }), lids = asym.filter((o) => o.k === 'clip');
  assert.ok(lids[0].d.includes('188.8') && lids[1].d.includes('Q 226 187 '), 'the left eye opens 80% as far as the right');
  assert.ok(portraitOps({ nose: { width: 30 } }).some((o) => o.k === 'path' && o.d.startsWith('M 198.5 205')), 'the nose is scaled to its width');
  assert.equal(portraitOps({ skin: '#452d27' }).find((o) => o.k === 'path' && o.d.startsWith('M 199 205')).stroke, '#231714', 'the nose line on deep skin is darker than the skin, not the light-skin brown');
  assert.equal(ops.filter((o) => o.k === 'clip').length, 4, 'each iris is clipped to its lids, the hair shadow to the face, the strands to the hair'); assert.ok(toSvg(ops).includes('<clipPath'));
  const cc = ctxStub(); drawOn(cc, ops); assert.equal(cc.calls.clip, 4);
  const posed = portraitOps({ pose: { headX: 10, headTilt: 0.1, bodyTilt: -0.03 } }), pushes = posed.filter((o) => o.k === 'push');
  assert.equal(pushes.length, 4, 'the body group, the head group twice, the neck group'); assert.equal(posed.filter((o) => o.k === 'pop').length, 4);
  assert.ok(toSvg(posed).includes(`<g transform="translate(10 ${HEAD_DY}) rotate(`), 'the head sits down the neck and the pose prints as svg groups');
  assert.deepEqual([pushes[2].tx, pushes[2].rot, pushes[2].cy], [3, 0.1 * 0.3, 374], 'the neck follows 30% of the head, pivoting at its base');
  const pc = ctxStub(); drawOn(pc, posed); assert.equal(pc.calls.save, pc.calls.restore, 'every push and clip is restored');
  const ctx = ctxStub(); tracePath(ctx, 'M 1 2 L 3 4 C 1 2 3 4 5 6 Q 1 2 3 4 Z');
  assert.deepEqual([ctx.calls.moveTo, ctx.calls.lineTo, ctx.calls.bezierCurveTo, ctx.calls.quadraticCurveTo, ctx.calls.closePath], [1, 1, 1, 1, 1]);
});

test('every hairline meets the head: no background between the front hair and the face on any face shape', () => {
  // the face and the front hair rasterized on a coarse grid over the forehead and temples: a cell that is neither, with hair just above and face just below, is a gap
  const poly = (d) => { const pts = []; let cur; const bez = (p0, p1, p2, p3) => { for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t, f = (k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]; pts.push([f(0), f(1)]); } cur = p3; };
    tracePath({ moveTo: (x, y) => pts.push(cur = [x, y]), lineTo: (x, y) => pts.push(cur = [x, y]), bezierCurveTo: (a, b, c, d, e, f) => bez(cur, [a, b], [c, d], [e, f]), quadraticCurveTo: (a, b, c, d) => bez(cur, [cur[0] + 2 / 3 * (a - cur[0]), cur[1] + 2 / 3 * (b - cur[1])], [c + 2 / 3 * (a - c), d + 2 / 3 * (b - d)], [c, d]), closePath() {} }, d); return pts; };
  const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const hit = (polys) => (x, y) => polys.some((p) => inside(p, x, y));
  for (const style of HAIR_STYLES) for (const [shape, face] of Object.entries(FACE_SHAPES)) {
    const ops = portraitOps({ hair: { style }, face }), fi = ops.findIndex((o) => o.k === 'path' && o.d.startsWith('M 200 112'));
    const inFace = hit([poly(ops[fi].d)]), inHair = hit(ops.slice(fi).filter((o) => o.k === 'path' && o.fill === '#30231e' && !o.stroke).map((o) => poly(o.d)));
    let gaps = 0;
    for (let x = 100; x <= 300; x += 2) for (let y = 100; y < 150; y += 2) {
      if (inHair(x, y) || inFace(x, y)) continue;
      let above = false, below = false;
      for (let k = 1; k <= 6; k++) { above ||= inHair(x, y - k); below ||= inFace(x, y + k); }
      gaps += above && below;
    }
    assert.ok(gaps <= 1, `${style} on a ${shape} face: ${gaps} gap cells between the hair and the head`);
  }
});

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
  for (let i = 0; i < 40; i++) { const k = characterOf(still); assert.ok(!/NaN|undefined/.test(JSON.stringify(portraitOps(k))), 'every generated character draws'); assert.ok(k.hat.style === 'none' || k.hair.style !== 'highBun', 'no bun under a hat'); }
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(faces, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.bob > 0 && p.state.faces.length >= 3);
  p.draw(ctxStub(), 320, 180);
});
