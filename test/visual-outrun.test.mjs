// web/visual/outrun.mjs: the architecture a world must honour (injected randomness only, deterministic state, plain
// data, every cast role wired), not how it looks. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import outrun from '../web/visual/outrun.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { layerBase } from '../lib/song.mjs';

const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'outrun' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
  g.section('out', 2, { role: 'release', drums: { density: .4 } }),
]).strudel;
const streamOf = (ir) => {
  const out = [];
  for (const s of ir.sections) for (const [name, l] of Object.entries(s.layers))
    for (const h of l.pattern.queryArc(0, s.cycles)) if (h.hasOnset()) { const c = s.offset + h.whole.begin.valueOf(); out.push(eventOf(h, name, layerBase(name), c / ir.meta.cps)); }
  return out.sort((a, b) => a.t - b.t);
};
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };
const run = (ir, seconds = 8) => {
  const p = createPerformance(outrun, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  for (let t = 0; t <= seconds; t += 1 / 30) p.advance(t, t * ir.meta.cps);
  return p;
};
const forbid = (obj, key) => { const was = obj[key]; obj[key] = () => { throw new Error(`${key} called inside the world`); }; return () => { obj[key] = was; }; };

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

test('every cast job reaches the state: the melody steers, the bass bends the road, a kick is a gear kick, an impact a car to pass, hats plant the roadside, the pad clouds; the riser climbs, the boundary is a checkpoint, the dropout a crash', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir);
  const fresh = () => createPerformance(outrun, score, { w: 16, h: 9 }).state;
  const one = (ev, cycle = 0) => { const s = fresh(); outrun.step(s, STEP, [ev], clockOf(score, cycle)); return s; };
  const base = { t: 0, cycle: 0, dur: .25, gain: 1, velocity: 1, pan: .5, cutoff: null, room: 0, note: null, voice: null, role: null };
  const kinds = (s) => s.segs.flatMap((x) => x.sprites.map((o) => o.kind));
  const still = fresh(); outrun.step(still, STEP, [], clockOf(score, 0));
  const kicked = one({ ...base, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse' });
  assert.ok(kicked.vel > still.vel && kicked.kick > 0.9, 'a kick is a burst of speed and a bob');
  const hit = one({ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }), first = still.cars.sort((a, b) => a.z - b.z)[0];
  assert.equal(hit.cars.length, still.cars.length, 'a snare conjures no car');
  assert.ok(hit.cars.sort((a, b) => a.z - b.z)[0].v < first.v && hit.cars[0].lit > 0.9, 'the car ahead brakes, lights on');
  // contact: a car in our lane just ahead is followed, never driven through; a kick while on it shoves it off the road
  const carAt = (s, z) => ({ z, x: 0, v: 2, hue: 0, kind: 'car', lit: 0, passed: 0, hit: 0, knocked: 0, spin: 0 });
  const tail = fresh(); tail.cars = [carAt(tail, tail.pos + 0.9)]; tail.vel = 12; tail.melX = 0; tail.avoid = 0;
  let gapMin = Infinity; for (let i = 0; i < 90; i++) { outrun.step(tail, STEP, [], clockOf(score, 0)); tail.avoid = 0; tail.x = 0; gapMin = Math.min(gapMin, tail.cars[0].z - tail.pos); }
  assert.ok(gapMin > 0.5 && tail.vel <= 2.01 && !tail.cars[0].knocked, `we sit behind it at its speed (gap ${gapMin.toFixed(2)}, vel ${tail.vel.toFixed(2)})`);
  outrun.step(tail, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }], clockOf(score, 0)); outrun.step(tail, STEP, [], clockOf(score, 0));
  assert.ok(!tail.cars[0].knocked && tail.knocks === 0, 'a snare while already tucked in behind it is no crash');
  const ram = fresh(); ram.cars = [carAt(ram, ram.pos + 1.5)]; ram.vel = 12; ram.melX = 0; ram.avoid = 0; // arriving on it as the snare lands: the crash
  outrun.step(ram, STEP, [{ ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' }], clockOf(score, 0)); outrun.step(ram, STEP, [], clockOf(score, 0));
  assert.ok(ram.cars[0].knocked !== 0 && ram.knocks === 1, 'reaching it on a snare shoves it off');
  Object.assign(tail, { cars: ram.cars, knocks: ram.knocks });
  for (let i = 0; i < 60; i++) outrun.step(tail, STEP, [], clockOf(score, 0));
  const knocked = tail.cars.find((c) => c.knocked);
  assert.ok(!knocked || Math.abs(knocked.x) > 1.2, 'and it spins out past the shoulder (or is already behind us)');
  const hats = fresh(); for (let i = 0; i < 40; i++) outrun.step(hats, STEP, [{ ...base, layer: 'perc', kind: 'perc', voice: 'hh', role: 'grain' }], clockOf(score, 0));
  const planted = kinds(hats).length - kinds(still).length;
  assert.ok(planted > 3 && planted < 40, 'hats plant some of the roadside, not one each');
  const low = one({ ...base, layer: 'bass', kind: 'bass', note: 30 }), high = one({ ...base, layer: 'bass', kind: 'bass', note: 58 });
  assert.ok(low.curveTo < 0 && high.curveTo > 0, 'a low bass note bends the road left, a high one right');
  const left = one({ ...base, layer: 'melody', kind: 'melody', note: 60 }), right = one({ ...base, layer: 'melody', kind: 'melody', note: 84 });
  assert.ok(left.melX < -0.5 && right.melX > 0.5, 'a low melody note steers left, a high one right');
  const drove = fresh(); for (let i = 0; i < 120; i++) outrun.step(drove, STEP, i ? [] : [{ ...base, layer: 'melody', kind: 'melody', note: 84 }], clockOf(score, 0));
  assert.ok(drove.x > 0.4, 'and the car goes there');
  assert.ok(one({ ...base, layer: 'pad', kind: 'pad', note: 60, cutoff: 3000 }).cloudTo > 0.5, 'a pad brings cloud');
  assert.ok(one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }).flash > 0.6, 'the impact flashes');
  assert.ok(one({ ...base, layer: null, kind: 'pitched', note: 80 }).melX > 0.3, 'a pitched hap with no part steers all the same');
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

test('over a long run the traffic gets passed, the road bends both ways and the score climbs', async () => {
  const g = await ready;
  const ir = song(g), p = createPerformance(outrun, composeVisual(ir), { w: 16, h: 9 });
  for (const e of streamOf(ir)) p.push(e);
  let lo = 0, hi = 0;
  for (let t = 0; t <= 40; t += 1 / 30) { p.advance(t, t * ir.meta.cps); lo = Math.min(lo, p.state.curve); hi = Math.max(hi, p.state.curve); }
  const s = p.state;
  assert.ok(s.passed > 0, 'cars were passed');
  assert.ok(s.score > 1000);
  assert.ok(s.cars.length <= 14);
  assert.ok(hi > 0 && lo < 0, 'the road bends both ways');
  const HALF = { palm: 1.1, tree: 0.9, pine: 1, bush: 0.7, cactus: 0.55, rock: 0.6, cliff: 1.35, sign: 0.4, billboard: 1.05, lamp: 0.7, building: 0.65, house: 0.75, barn: 0.85, windmill: 0.95, lighthouse: 0.35, pylon: 0.85 };
  const inRoad = s.segs.flatMap((x) => x.sprites).filter((o) => o.kind !== 'arch' && Math.abs(o.x) - (HALF[o.kind] ?? 0.6) * o.h < 1.16);
  assert.deepEqual(inRoad, [], 'nothing planted reaches inside the shoulder');
  assert.ok(s.cars.every((c) => c.knocked || Math.abs(c.x) <= 0.62), 'traffic keeps to its lanes unless knocked');
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(outrun, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.kick > 0 || p.state.vel > 0);
  p.draw(ctxStub(), 320, 180);
});
