import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

const meta = { cps: .5, key: 'C:minor', seed: 3, kit: 'RolandTR909' };
const onsets = (p, cycles = 2) => p.queryArc(0, cycles).filter((h) => h.hasOnset()).sort((a, b) => a.whole.begin.valueOf() - b.whole.begin.valueOf());
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('slicePoints folds the trim into an n+1 point grid', async () => {
  const { slicePoints } = await import('../lib/layers.mjs');
  assert.deepEqual(slicePoints(0, 1, 4), [0, .25, .5, .75, 1]);
  const p = slicePoints(.2, .6, 2);
  near(p[0], .2, 'first'); near(p[1], .4, 'mid'); near(p[2], .6, 'last');
});

test('a sample part with no sound is silence; with a sound it plays the region as slices over its bars', async () => {
  const g = await ready;
  assert.equal(onsets(g.sample({}, { ...meta, cycles: 2 })).length, 0);
  const p = g.sample({ sound: 'ping', begin: .1, end: .9, bars: 2, slices: 4, pattern: '0 1 2 3' }, { ...meta, cycles: 2 });
  const hs = onsets(p);
  assert.equal(hs.length, 4, 'four slices across two bars');
  assert.deepEqual(hs.map((h) => h.whole.begin.valueOf()), [0, .5, 1, 1.5], 'the pattern spans the sample bars');
  near(hs[1].value.begin, .3, 'slice 1 begins'); near(hs[1].value.end, .5, 'slice 1 ends');
  assert.equal(hs[1].value.s, 'ping');
  assert.equal(hs[1].value.unit, 'c');
  near(hs[1].value.speed, .5 * .8 / 2, 'natural: speed = cps * region / bars for every slice');
  near(hs[3].value.speed, hs[1].value.speed, 'natural: the same speed on every slice');
});

test('stretch fits each slice to its step (strudel fit): a half-width slice on a quarter step doubles the speed of a full one', async () => {
  const g = await ready;
  const p = g.sample({ sound: 'ping', bars: 1, slices: 2, pattern: '0 [1 1]', stretch: true }, { ...meta, cycles: 1 });
  const hs = onsets(p, 1);
  assert.equal(hs.length, 3);
  assert.equal(hs[0].value.unit, 'c');
  near(hs[1].value.speed / hs[0].value.speed, 2, 'a slice on a step half as long plays twice as fast');
});

test('a pattern index outside the slices is refused, as are bad regions', async () => {
  const g = await ready;
  const c = { ...meta, cycles: 1 };
  assert.throws(() => g.sample({ sound: 'ping', slices: 4, pattern: '0 4' }, c), /slice 4 is out of range \(slices: 4/);
  assert.throws(() => g.sample({ sound: 'ping', slices: 2, pattern: '<0 1 2>' }, c), /slice 2 is out of range/, 'later cycles are checked too');
  assert.throws(() => g.sample({ sound: 'ping', begin: .5, end: .5 }, c), /begin .* before end/);
  assert.throws(() => g.sample({ sound: 'ping', bars: 0 }, c), /bars must be a positive number/);
  assert.throws(() => g.sample({ sound: 'ping', slices: 2.5 }, c), /slices must be a positive integer/);
  assert.throws(() => g.sample({ sound: 'ping', pattern: 3 }, c), /pattern must be/);
});

test('a double-quoted pattern (already a mini pattern via the transpiler) works too', async () => {
  const g = await ready;
  const p = g.sample({ sound: 'ping', slices: 2, pattern: g.mini('0 1') }, { ...meta, cycles: 1 });
  assert.equal(onsets(p, 1).length, 2);
});

test('sample axes: .5 is a no-op, each cell moves something, level scales gain', async () => {
  const g = await ready;
  const c = { ...meta, cycles: 1 };
  const sig = (p) => JSON.stringify(onsets(p, 1).map((h) => h.value));
  const base = g.sample({ sound: 'ping', slices: 2, pattern: '0 1' }, c);
  for (const a of Object.keys(g.strudelLib.cells.sample)) {
    assert.equal(sig(g.sample({ sound: 'ping', slices: 2, pattern: '0 1', [a]: .5 }, c)), sig(base), `${a} at .5`);
    // brightness only darkens (a sample has no filter to open), so it is probed at 0; the rest at 1
    assert.notEqual(sig(g.sample({ sound: 'ping', slices: 2, pattern: '0 1', [a]: a === 'brightness' ? 0 : 1 }, c)), sig(base), `${a} at its far end`);
  }
  assert.deepEqual(Object.keys(g.strudelLib.cells.sample).sort(), ['brightness', 'space', 'weight', 'width']);
  near(onsets(g.sample({ sound: 'ping', level: .5 }, c), 1)[0].value.gain, .5, 'level');
});

test('a section with its own bpm fits its sample to its own tempo (ctx.cps is the section cps)', async () => {
  const g = await ready;
  const pat = g.song({ cps: .5 }, [g.section('a', 2, { bpm: 240, sample: { sound: 'ping', bars: 2 } })]);
  const h = pat.strudel.sections[0].layers.sample.pattern.queryArc(0, 2).find((x) => x.hasOnset());
  near(h.value.speed, 1 * 1 / 2, 'bpm 240 in 4/4 is 1 cps: speed = cps * 1 / 2');
});

test('chop.strudel checks clean on the deployed demo pack and dumps to strudel that plays the same', async () => {
  const path = await import('node:path'); const fs = await import('node:fs');
  const { checkFile } = await import('../scripts/check.mjs');
  const file = path.resolve(import.meta.dirname, '..', 'songs', 'chop.strudel');
  const r = await checkFile(file);
  assert.deepEqual(r.problems, []);
  assert.ok(r.events.some((l) => l.includes('"s":"loop"') && l.includes('"unit":"c"')));
  // soundFile (scripts/check.mjs) prints the basename + variant count, not the pack path (see the didgeridoo/steinway test above)
  assert.ok(r.sounds.some((u) => u.name === 'loop' && /^loop\.wav \(1 variant\)$/.test(u.file)), 'the sounds block names the file');
  // the dump: strudel's own slice/fit/speed/unit calls, and the repl transpiler turns the printed "0 1 ..." back into the pattern
  const { dumpFile } = await import('../scripts/dump.mjs');
  const { evaluate } = await import('@strudel/core'); const { transpiler } = await import('@strudel/transpiler');
  await ready; globalThis.aliasBank ??= async () => {};
  const out = await dumpFile(file);
  assert.match(out, /\.slice\(\[0, 0\.125, .*1\], "0 1 0 3 4 \[6 7\] 7 6"\)/);
  assert.match(out, /\.fit\(\)/); assert.match(out, /\.unit\("c"\)/);
  const stream = (p, n) => { const o = []; for (let c = 0; c < n; c++) for (const h of p.queryArc(c, c + 1)) o.push(`${h.whole?.begin} ${h.value.s ?? ''} ${h.value.begin ?? ''} ${h.value.speed ?? ''}`); return o; };
  const song = await (await evaluate(fs.readFileSync(file, 'utf8'), transpiler)).pattern;
  const dumped = await (await evaluate(out, transpiler)).pattern;
  assert.deepEqual(stream(dumped, song.strudel.total), stream(song, song.strudel.total));
});
