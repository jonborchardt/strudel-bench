// web/visual/outrun.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired) and the game's promise (a lane is always clear, a car is never driven through), not
// how it looks. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import outrun, { HALF } from '../web/visual/outrun.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { streamOf, ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
const run = (ir, seconds = 8) => runWorld(outrun, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'outrun' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
  g.section('out', 2, { role: 'release', drums: { density: .4 } }),
]).strudel;
const carIn = (lane, z) => ({ z, lane, x: [-0.66, 0, 0.66][lane], hue: 0, kind: 'car', lit: 0, passed: 0 });

test('outrun is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 40, 'the road bands, the roadside and the cars fill');
    assert.ok(ctx.calls.fillText > 3, 'the HUD is written');
    assert.ok(p.state.pos > 10 && p.state.segs.length > 80, 'the road moves and keeps coming');
    assert.ok(p.state.segs.some((x) => x.sprites.length), 'the roadside is not bare');
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

test('every cast job reaches the state: the melody picks the lane, the kick lands the change, the bass bends the road, a snare flashes the car ahead, hats plant the roadside, the pad clouds; the riser climbs, the boundary is a checkpoint, the dropout a crash', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const fresh = () => createPerformance(outrun, score, { w: 16, h: 9 }).state;
  const one = (ev, cycle = 0) => { const s = fresh(); outrun.step(s, STEP, [ev], clockOf(score, cycle)); return s; };
  const kinds = (s) => s.segs.flatMap((x) => x.sprites.map((o) => o.kind));
  const still = fresh(); outrun.step(still, STEP, [], clockOf(score, 0));
  const kicked = one(KICK);
  assert.ok(kicked.vel > still.vel && kicked.kick > 0.9, 'a kick is a burst of speed and a bob');
  const hit = one({ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' });
  assert.equal(hit.cars.length, still.cars.length, 'a snare conjures no car');
  assert.ok(hit.cars.sort((a, b) => a.z - b.z)[0].lit > 0.9, 'the car ahead flashes its lights');
  const hats = fresh(); for (let i = 0; i < 40; i++) outrun.step(hats, STEP, [{ ...base, layer: 'perc', kind: 'perc', voice: 'hh', role: 'grain' }], clockOf(score, 0));
  const planted = kinds(hats).length - kinds(still).length;
  assert.ok(planted > 3 && planted < 40, 'hats plant some of the roadside, not one each');
  const low = one({ ...base, layer: 'bass', kind: 'bass', note: 30 }), high = one({ ...base, layer: 'bass', kind: 'bass', note: 58 });
  assert.ok(low.curveTo < 0 && high.curveTo > 0, 'a low bass note bends the road left, a high one right');
  // the lane: the melody's register wants it, the kick lands it, a car in it refuses it, a car in ours moves us out at once
  const mel = (note) => ({ ...base, layer: 'melody', kind: 'melody', note });
  const two = (a, b) => { const s = fresh(); outrun.step(s, STEP, [a], clockOf(score, 0)); outrun.step(s, STEP, [b], clockOf(score, 0)); return s; };
  assert.equal(one(mel(60)).want, 1, 'the first note only sets the reference');
  assert.equal(two(mel(60), mel(64)).want, 2, 'a note above the last steps a lane right'); assert.equal(two(mel(64), mel(60)).want, 0, 'below, a lane left'); assert.equal(two(mel(64), mel(64)).want, 1, 'a repeat stays');
  assert.equal(two({ ...base, layer: null, kind: 'pitched', note: 60 }, { ...base, layer: null, kind: 'pitched', note: 67 }).want, 2, 'a pitched hap with no part picks a lane all the same');
  const bassNote = (note) => ({ ...base, layer: 'bass', kind: 'bass', note });
  assert.equal(two(bassNote(36), bassNote(43)).want, 2, 'with no melody yet, the bass picks');
  const held = two(mel(60), mel(64)); outrun.step(held, STEP, [bassNote(43)], clockOf(score, 0)); outrun.step(held, STEP, [bassNote(36)], clockOf(score, 0));
  assert.equal(held.want, 2, 'but not while the melody is sounding');
  const drive = fresh(); drive.cars = []; outrun.step(drive, STEP, [mel(60)], clockOf(score, 0)); outrun.step(drive, STEP, [mel(72)], clockOf(score, 0));
  assert.equal(drive.lane, 1, 'the pick waits for the kick');
  outrun.step(drive, STEP, [KICK], clockOf(score, 0));
  assert.equal(drive.lane, 2, 'the kick lands it');
  for (let i = 0; i < 30; i++) outrun.step(drive, STEP, [], clockOf(score, 0));
  assert.ok(drive.x > 0.5, 'and the car crosses to it in well under a second');
  const refused = fresh(); refused.cars = [carIn(2, refused.pos + 5)]; refused.want = 2; outrun.step(refused, STEP, [KICK], clockOf(score, 0));
  assert.equal(refused.lane, 0, 'a lane with a car ahead is refused, for the other edge');
  const both = fresh(); both.cars = [carIn(2, both.pos + 5), carIn(0, both.pos + 4)]; both.want = 2; outrun.step(both, STEP, [KICK], clockOf(score, 0));
  assert.equal(both.lane, 1, 'both edges taken: the middle');
  const blocked = fresh(); blocked.cars = [carIn(1, blocked.pos + 5)]; outrun.step(blocked, STEP, [], clockOf(score, 0));
  assert.notEqual(blocked.lane, 1, 'a car ahead in our own lane moves us out, no kick needed');
  const late = fresh(); late.cars = []; late.want = 0;
  for (let i = 0; i < 60; i++) outrun.step(late, STEP, [], clockOf(score, 0));
  assert.equal(late.lane, 0, 'with no kick for a beat and a half the change lands anyway');
  assert.ok(one({ ...base, layer: 'pad', kind: 'pad', note: 60, cutoff: 3000 }).cloudTo > 0.5, 'a pad brings cloud');
  assert.ok(one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }).flash > 0.6, 'the impact flashes');
  const bombs = fresh(); for (let i = 0; i < 12 && !bombs.nukes.length; i++) outrun.step(bombs, STEP, [{ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }], clockOf(score, 0));
  assert.ok(bombs.nukes.length > 0, 'and most times sets off a bomb beyond the horizon');
  // the clock alone
  const rising = fresh(); for (let i = 0; i < 30; i++) outrun.step(rising, STEP, [], clockOf(score, 1.5)); // intro's riser is its last bar
  assert.ok(rising.riser > 0 && rising.slopeTo > 0, 'the riser is a climb');
  outrun.step(rising, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.ok(rising.check > 0 && rising.stage === 2 && kinds(rising).includes('arch'), 'the boundary is a checkpoint with its gantry');
  assert.ok(Math.abs(rising.time - 8) < 0.2, 'the time is the seconds to the next checkpoint, plus a few');
  const dark = fresh(); for (let i = 0; i < 60; i++) outrun.step(dark, STEP, [], clockOf(score, 3.5));
  assert.ok(dark.crash === 1 && dark.tumble > 0 && dark.vel < 3, 'the dropout is a crash: the car tumbles and stops');
  outrun.step(dark, STEP, [], clockOf(score, 4));
  assert.equal(dark.crash, 0); assert.equal(dark.x, 0);
  assert.equal(new Set(fresh().lands).size, 3, 'three roles, three stages');
});

test("over a long run the traffic gets passed and never driven through, a lane is always open, the road bends both ways, nothing planted reaches the shoulder", async () => {
  const g = await ready;
  const ir = song(g), p = createPerformance(outrun, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  let lo = 0, hi = 0, through = 0, closed = 0, changes = 0, lane = 1, flew = false;
  const inLane = [0, 0, 0];
  for (let t = 0; t <= 40; t += 1 / 30) {
    p.advance(t, t * ir.meta.cps); const s = p.state; inLane[s.lane]++; flew ||= s.fliers.length > 0;
    lo = Math.min(lo, s.curve); hi = Math.max(hi, s.curve);
    if (!s.crash) for (const c of s.cars) if (Math.abs(c.z - s.pos) < 0.6 && Math.abs(c.x - s.x) < 0.5) through++; // half our width plus half a car's is 0.53
    for (const c of s.cars) { const lanes = new Set(s.cars.filter((o) => Math.abs(o.z - c.z) < 16).map((o) => o.lane)); if (lanes.has(1) && lanes.size > 1) closed++; }
    if (s.lane !== lane) { changes++; lane = s.lane; }
  }
  const s = p.state;
  assert.ok(s.passed > 0, 'cars were passed');
  assert.ok(flew, 'something crossed the sky');
  assert.equal(through, 0, 'never a car where we are');
  assert.equal(closed, 0, 'the middle lane never shares a stretch with an edge lane, so a way out always exists');
  assert.ok(changes > 2, 'the car changes lane');
  assert.ok(inLane[1] < 0.6 * (inLane[0] + inLane[1] + inLane[2]), `the middle lane is not where it lives (${inLane.join('/')} frames)`);
  assert.ok(s.score > 1000);
  assert.ok(hi > 0 && lo < 0, 'the road bends both ways');
  const inRoad = s.segs.flatMap((x) => x.sprites).filter((o) => o.kind !== 'arch' && Math.abs(o.x) - (HALF[o.kind] ?? 0.6) * o.h < 1.16);
  assert.deepEqual(inRoad, [], 'nothing planted reaches inside the shoulder');
  assert.ok(s.cars.every((c) => Math.abs(c.x) <= 0.66), 'traffic keeps to its lanes');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(outrun, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.kick > 0 || p.state.vel > 0);
  p.draw(ctxStub(), 320, 180);
});
