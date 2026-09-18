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

test('stretch uses the section cps too, not the scheduler\'s (strudel fit() would read the song cps)', async () => {
  const g = await ready;
  const pat = g.song({ cps: .5 }, [g.section('a', 2, { bpm: 240, sample: { sound: 'ping', bars: 2, slices: 2, pattern: '0 1', stretch: true } })]);
  const h = pat.strudel.sections[0].layers.sample.pattern.queryArc(0, 2).find((x) => x.hasOnset());
  near(h.value.speed, 1 * .5 / 1, 'section cps 1, slice width .5, one-cycle step: speed = cps / step * width');
  assert.equal(h.value.unit, 'c');
});

test('chop.strudel checks clean on the deployed demo pack and dumps to strudel that plays the same', async () => {
  const path = await import('node:path'); const fs = await import('node:fs');
  const { checkFile } = await import('../scripts/check.mjs');
  const file = path.resolve(import.meta.dirname, '..', 'songs', 'chop.strudel');
  const r = await checkFile(file);
  assert.deepEqual(r.problems, []);
  assert.ok(r.events.some((l) => l.includes('"s":"loop"') && l.includes('"unit":"c"')));
  // soundFile (scripts/check.mjs) prints the basename + variant count, not the pack path (precedent: the didgeridoo/steinway test in test/check.test.mjs)
  assert.ok(r.sounds.some((u) => u.name === 'loop' && /^loop\.wav \(1 variant\)$/.test(u.file)), 'the sounds block names the file');
  // the dump: strudel's own slice/speed/unit calls plus the stretch closure (printed with its cps inlined, so it
  // re-evaluates on its own), and the repl transpiler turns the printed "0 1 ..." back into the pattern
  const { dumpFile } = await import('../scripts/dump.mjs');
  const { evaluate } = await import('@strudel/core'); const { transpiler } = await import('@strudel/transpiler');
  await ready; globalThis.aliasBank ??= async () => {};
  const out = await dumpFile(file);
  assert.match(out, /\.slice\(\[0, 0\.125, .*1\], "0 1 0 3 4 \[6 7\] 7 6"\)/);
  assert.match(out, /\.withHaps\(\(haps\) => haps\.map/); assert.doesNotMatch(out, /\bcps\b/, 'the stretch closure carries the number, not a free variable');
  assert.match(out, /\.unit\("c"\)/);
  const stream = (p, n) => { const o = []; for (let c = 0; c < n; c++) for (const h of p.queryArc(c, c + 1)) o.push(`${h.whole?.begin} ${h.value.s ?? ''} ${h.value.begin ?? ''} ${h.value.speed ?? ''}`); return o; };
  const song = await (await evaluate(fs.readFileSync(file, 'utf8'), transpiler)).pattern;
  const dumped = await (await evaluate(out, transpiler)).pattern;
  assert.deepEqual(stream(dumped, song.strudel.total), stream(song, song.strudel.total));
});

test('slices as break points: fractions of the file inside the region, in order; the count follows', async () => {
  const g = await ready;
  const { slicePoints } = await import('../lib/layers.mjs');
  assert.deepEqual(slicePoints(.1, .9, [.2, .5]), [.1, .2, .5, .9]);
  assert.deepEqual(slicePoints(0, 1, []), [0, 1], 'no breaks: one slice');
  const c = { ...meta, cycles: 2 };
  const p = g.sample({ sound: 'ping', begin: .1, end: .9, bars: 2, slices: [.2, .5], pattern: '0 1 2' }, c);
  const hs = onsets(p);
  assert.equal(hs.length, 3);
  assert.equal(onsets(g.sample({ sound: 'ping', bars: 2, slices: [], pattern: '0' }, c)).length, 1, 'an empty list is one slice');
  near(hs[1].value.begin, .2, 'slice 1 begins at the first break'); near(hs[1].value.end, .5, 'and ends at the second');
  near(hs[2].value.end, .9, 'the last slice ends at the region end');
  assert.throws(() => g.sample({ sound: 'ping', slices: [.2, .5], pattern: '0 3' }, c), /slice 3 is out of range \(slices: 3/);
  assert.throws(() => g.sample({ sound: 'ping', slices: [.5, .2] }, c), /increasing/);
  assert.throws(() => g.sample({ sound: 'ping', begin: .3, slices: [.2] }, c), /inside/);
  assert.throws(() => g.sample({ sound: 'ping', slices: [.2, 'x'] }, c), /fractions of the file/);
  assert.throws(() => g.sample({ sound: 'ping', slices: [.2, .2] }, c), /increasing/);
});

test('a definition from the pack sits under the part: name resolves to the pack sound, keys override, the default pattern plays every slice', async () => {
  const g = await ready;
  const { registerSamples, resolveSample, SAMPLES } = await import('../lib/packs.mjs');
  registerSamples({ mine: { sounds: { ping: ['mine/ping.wav'] }, samples: { ping: { bars: 2, slices: 4 }, 'ping-tail': { sound: 'ping', begin: .5, bars: 1 } } } });
  try {
    assert.deepEqual(resolveSample({ sound: 'ping-tail', bars: 3 }), { sound: 'ping', begin: .5, bars: 3 }, 'the part overrides, the sound resolves');
    assert.deepEqual(resolveSample({ sound: 'nope', bars: 3 }), { sound: 'nope', bars: 3 }, 'no definition: unchanged');
    const c = { ...meta, cycles: 2 };
    const hs = onsets(g.sample({ sound: 'ping' }, c));
    assert.equal(hs.length, 4, 'bars 2, slices 4, the default pattern plays every slice once over the two bars');
    assert.deepEqual(hs.map((h) => h.value.s), ['ping', 'ping', 'ping', 'ping']);
    near(hs[1].value.begin, .25, 'slice 1 of four');
    const t = onsets(g.sample({ sound: 'ping-tail' }, c), 1);
    assert.equal(t.length, 1); near(t[0].value.begin, .5, 'the definition region'); near(t[0].value.speed, .5 * .5 / 1, 'cps .5, half the file, one bar');
    assert.equal(onsets(g.sample({ sound: 'ping', pattern: '0' }, c)).length, 1, 'a written pattern wins over the default: one slice spanning the definition\'s two bars, not four');
  } finally { SAMPLES.clear(); }
  assert.equal(onsets(g.sample({ sound: 'ping', slices: 4 }, { ...meta, cycles: 1 }), 1).length, 4, 'no definitions at all: an unwritten pattern is still every slice in order');
});

test('a region that strands a break the definition carries does not build, and an override that keeps them inside does', async () => {
  const g = await ready;
  const { registerSamples, SAMPLES } = await import('../lib/packs.mjs');
  registerSamples({ mine: { sounds: { ping: ['mine/ping.wav'] }, samples: { chop: { sound: 'ping', bars: 2, slices: [.0625, .5] } } } });
  const c = { ...meta, cycles: 2 };
  try {
    // the part inherits both breaks; trimming to end .3 leaves .5 outside the region, which song() refuses (the page
    // has to drop the stranded break in the same edit, or refuse the trim)
    assert.throws(() => g.sample({ sound: 'chop', end: .3 }, c), /inside the region/);
    assert.equal(onsets(g.sample({ sound: 'chop', end: .3, slices: [.0625] }, c), 2).length, 2, 'an override that keeps the breaks inside the region builds');
  } finally { SAMPLES.clear(); }
});

test('a definition passes a :variant suffix through to the pack sound', async () => {
  await ready;
  const { registerSamples, resolveSample, SAMPLES } = await import('../lib/packs.mjs');
  registerSamples({ mine: { sounds: { kick: ['mine/kick/a.wav', 'mine/kick/b.wav'] }, samples: { kick: { bars: 1 }, 'kick-x': { sound: 'kick', end: .5 } } } });
  try {
    assert.equal(resolveSample({ sound: 'kick:2' }).sound, 'kick:2', 'the variant survives the definition');
    assert.equal(resolveSample({ sound: 'kick:2' }).bars, 1, 'and the definition still applies');
    assert.equal(resolveSample({ sound: 'kick-x:1' }).sound, 'kick:1', 'a renamed definition keeps the part\'s variant');
  } finally { SAMPLES.clear(); }
});

test('a definition name another pack already uses is skipped and reported, but a name matching the pack\'s own sound is the sound\'s default', async () => {
  await ready;
  const { registerSamples, sampleDef, SAMPLES, SAMPLE_PROBLEMS } = await import('../lib/packs.mjs');
  registerSamples({
    a: { sounds: { hit: ['a/hit.wav'] }, samples: { shared: { sound: 'hit', end: .5 } } },
    b: { sounds: { boom: ['b/boom.wav'] }, samples: { shared: { sound: 'boom' }, boom: { bars: 4 } } },
    c: { sounds: { thud: ['c/thud.wav'] }, samples: { hit: { sound: 'thud' } } },
  });
  try {
    assert.equal(sampleDef('shared').pack, 'a', 'packs are read in name order, so the first pack keeps the name');
    assert.equal(sampleDef('boom').bars, 4, 'a definition named like its own pack\'s sound is that sound\'s default interpretation');
    assert.equal(SAMPLE_PROBLEMS.length, 2);
    assert.match(SAMPLE_PROBLEMS.join('\n'), /samples\/user\/b\/pack\.json samples\.shared: collides with sample "shared" in pack "a"/);
    assert.match(SAMPLE_PROBLEMS.join('\n'), /samples\/user\/c\/pack\.json samples\.hit: collides with sound "hit" in pack "a"/);
    registerSamples({});
    assert.equal(SAMPLE_PROBLEMS.length, 0, 'the problems clear with the registry');
  } finally { SAMPLES.clear(); }
});

test('a list of definitions on a sample part: each hit picks a take that keeps its own region; bars and slice count must agree', async () => {
  const g = await ready;
  const { registerSamples, SAMPLES } = await import('../lib/packs.mjs');
  registerSamples({ mine: { sounds: { a: ['mine/a.wav'], b: ['mine/b.wav'] }, samples: { a: { begin: .2, end: .6, bars: .5 }, b: { begin: .3, end: .9, bars: .5 }, c: { sound: 'b', bars: 1 } } } });
  try {
    const hs = onsets(g.sample({ sound: ['a', 'b'], pattern: '0 0 0 0' }, { ...meta, cycles: 4 }), 4);
    assert.equal(hs.length, 32, 'four hits per half bar over four bars');
    assert.ok(new Set(hs.map((h) => h.value.s)).size === 2, 'both takes play');
    for (const h of hs) { const [b0, e0] = h.value.s === 'a' ? [.2, .6] : [.3, .9]; near(h.value.begin, b0, `${h.value.s} keeps its region`); near(h.value.end, e0, 'end'); near(h.value.speed, .5 * (e0 - b0) / .5, 'its own natural speed'); assert.equal(h.value.unit, 'c'); assert.equal(h.value.n, undefined, 'no stray n'); assert.equal(h.value.take, undefined, 'no stray take'); }
    assert.deepEqual(hs.map((h) => h.value.s), onsets(g.sample({ sound: ['a', 'b'], pattern: '0 0 0 0' }, { ...meta, cycles: 4 }), 4).map((h) => h.value.s), 'deterministic');
    // bars .5 (from both definitions) compresses the pattern to repeat every half cycle (as the 32-hit check above
    // shows for the natural case too), so one real cycle holds two repeats of the 3-event pattern: 6 onsets, not 3.
    const st = onsets(g.sample({ sound: ['a', 'b'], pattern: '0 [0 0]', stretch: true }, { ...meta, cycles: 1 }), 1);
    assert.equal(st.length, 6); assert.ok(st[1].value.speed > st[0].value.speed || st[1].value.s !== st[0].value.s, 'stretched: a slice on the half step plays faster than the same take on the full step');
    // absolute, not relative: speed must match this hap's *own* real (post-slow) step duration, so slow(bars) run
    // after withHaps (using the pre-slow duration) can't hide behind a same-direction comparison.
    near(st[0].value.speed, (meta.cps / st[0].whole.duration.valueOf()) * (st[0].value.end - st[0].value.begin), 'stretch speed uses the real step duration');
    assert.throws(() => g.sample({ sound: ['a', 'c'] }, { ...meta, cycles: 1 }), /bars .* must agree/);
    assert.throws(() => g.sample({ sound: ['a', 'b'], slices: [.25] }, { ...meta, cycles: 1 }), /inside the region/, 'a shared break point must sit inside every take\'s region (.25 is outside b\'s .3..9)');
  } finally { SAMPLES.clear(); }
});

test('transpose: semitones on the speed, on natural and stretched slices alike', async () => {
  const g = await ready;
  const sp = (attrs) => onsets(g.sample({ sound: 'ping', slices: 2, pattern: '0 1', ...attrs }, { ...meta, cycles: 1 }), 1)[0].value.speed;
  near(sp({ transpose: 12 }) / sp({}), 2, 'an octave up doubles the speed');
  near(sp({ transpose: -12, stretch: true }) / sp({ stretch: true }), .5, 'an octave down halves it, stretched too');
  assert.throws(() => g.sample({ sound: 'ping', transpose: 'up' }, { ...meta, cycles: 1 }), /transpose must be a number/);
});

test('transpose applies to a takes list too', async () => {
  const g = await ready;
  const { registerSamples, SAMPLES } = await import('../lib/packs.mjs');
  registerSamples({ mine: { sounds: { a: ['mine/a.wav'], b: ['mine/b.wav'] }, samples: { a: { bars: .5 }, b: { bars: .5 } } } });
  try {
    const c = { ...meta, cycles: 4 };
    const hs = onsets(g.sample({ sound: ['a', 'b'], pattern: '0 0 0 0' }, c), 4);
    const hsUp = onsets(g.sample({ sound: ['a', 'b'], pattern: '0 0 0 0', transpose: 12 }, c), 4);
    near(hsUp[0].value.speed / hs[0].value.speed, 2, 'a takes-list part transposes too');
  } finally { SAMPLES.clear(); }
});

test('two takes that resolve to the same pack sound do not collapse: chooseIn picks the take index, not the resolved name', async () => {
  const g = await ready;
  const { registerSamples, SAMPLES } = await import('../lib/packs.mjs');
  registerSamples({ mine: { sounds: { loop: ['mine/loop.wav'] }, samples: { kick: { sound: 'loop', end: .25, bars: .5 }, snare: { sound: 'loop', begin: .25, end: .5, bars: .5 } } } });
  try {
    const hs = onsets(g.sample({ sound: ['kick', 'snare'], pattern: '0 0 0 0' }, { ...meta, cycles: 4 }), 4);
    assert.ok(hs.length > 0);
    assert.ok(hs.every((h) => h.value.s === 'loop'), 'both takes resolve to the same pack sound');
    const begins = new Set(hs.map((h) => h.value.begin));
    assert.ok(begins.has(0) && begins.has(.25), 'both takes\' own regions still play, not just one');
  } finally { SAMPLES.clear(); }
});
