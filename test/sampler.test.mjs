import { test } from 'node:test';
import assert from 'node:assert/strict';
import { peaks, fmtTime, soundUrl, sliceSpec, frac, breaksIn, breakPoints, toggleBreak, detectTempo, barsGuess, snapTo, snapDivisions, SNAPS } from '../web/sampler.mjs';

const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, m);

test('peaks: the largest magnitude per column, columns wider than the data still fill', () => {
  const data = Float32Array.from([0, .5, -1, 0, .2, .1, 0, 0]);
  assert.deepEqual([...peaks(data, 4)], [.5, 1, .2, 0].map(Math.fround));
  assert.deepEqual([...peaks(data, 2)], [1, .2].map(Math.fround));
  assert.equal(peaks(new Float32Array(3), 10).length, 10, 'more columns than samples');
  assert.deepEqual([...peaks(Float32Array.from([.3, .6, .9]), 10)].filter((x) => x > 0).length, 3, 'each sample lands in one column');
});

test('fmtTime: seconds under a minute, m:ss above', () => {
  assert.equal(fmtTime(2.345), '2.35s');
  assert.equal(fmtTime(0), '0.00s');
  assert.equal(fmtTime(62.5), '1:02.50');
});

test('soundUrl: the file behind a sound and its variant index from the sound map', () => {
  const map = { loop: { data: { samples: ['samples/user/demo-pack/loop.wav'] } }, hh: { data: { samples: ['a.wav', 'b.wav', 'c.wav'] } }, piano: { data: { samples: { C4: ['c4.mp3'] } } } };
  assert.equal(soundUrl(map, 'loop'), 'samples/user/demo-pack/loop.wav');
  assert.equal(soundUrl(map, 'hh:1'), 'b.wav');
  assert.equal(soundUrl(map, 'hh:4'), 'b.wav', 'the index wraps like superdough');
  assert.equal(soundUrl(map, 'HH'), 'a.wav', 'names are registered lowercase');
  assert.equal(soundUrl(map, 'piano'), null, 'a pitched map has no one file');
  assert.equal(soundUrl(map, 'nope'), null);
  assert.equal(soundUrl(map, 'hh:abc'), null, 'a non-numeric index is no file');
});

test('sliceSpec: an array as is, a count at least 1', () => {
  assert.deepEqual(sliceSpec([.1]), [.1]);
  assert.equal(sliceSpec(8), 8);
  assert.equal(sliceSpec('expr'), 1);
  assert.equal(sliceSpec(undefined), 1);
  assert.equal(sliceSpec(0), 1);
  assert.equal(sliceSpec(-4), 1);
});

test('frac: a fraction of the file as the songs write it', () => {
  assert.equal(frac(.0625), '.0625');
  assert.equal(frac(1 / 3), '.3333');
  assert.equal(frac(1), '1');
});

test('break points: seconds to rounded fractions, refused when outside the region or not rising', () => {
  assert.deepEqual(breakPoints([1, 2, 3], 4, 0, 1), [.25, .5, .75]);
  assert.deepEqual(breakPoints([], 4, 0, 1), []);
  assert.match(breakPoints([0.0001, 2], 4, 0, 1), /must rise and lie inside/, 'rounds onto begin: refused');
  assert.match(breakPoints([2, 2.0001], 4, 0, 1), /must rise/, 'a duplicate after rounding');
  assert.match(breakPoints([3, 2], 4, 0, 1), /must rise/, 'out of order');
  assert.match(breakPoints([1], 4, .3, 1), /inside the region/, 'before begin');
});

test('breaksIn keeps the breaks a trim leaves inside the region, rounded and rising', () => {
  assert.deepEqual(breaksIn([.0625, .125, .5, .5625], .3, 1), [.5, .5625]);
  assert.deepEqual(breaksIn([.1, .10001, .2], 0, 1), [.1, .2], 'a duplicate after rounding is dropped');
});

test('toggleBreak removes the break within tolerance, else inserts in order inside the region', () => {
  assert.deepEqual(toggleBreak([.25, .5], .5004, 0, 1, .005), [.25]);
  assert.deepEqual(toggleBreak([.25, .5], .4, 0, 1, .005), [.25, .4, .5]);
  const same = [.25];
  assert.equal(toggleBreak(same, .05, .1, 1, .005), same, 'outside the region: the list itself, so the page can skip the commit');
});


const clicks = (bpm, secs, rate = 22050, offset = 0) => { // a click track: 5 ms bursts on every beat
  const d = new Float32Array(Math.round(secs * rate)), per = (60 / bpm) * rate;
  for (let t = offset * rate; t < d.length; t += per) for (let i = 0; i < rate * .005 && Math.round(t) + i < d.length; i++) d[Math.round(t) + i] = (i % 2 ? 1 : -1) * .8;
  return d;
};
test('detectTempo finds a click track within a bpm, on the whole file and on a region', () => {
  const a = detectTempo(clicks(120, 8), 22050); assert.ok(Math.abs(a.bpm - 120) <= 1, `120: ${a.bpm}`); assert.ok(a.confidence > .3);
  const b = detectTempo(clicks(94, 8), 22050); assert.ok(Math.abs(b.bpm - 94) <= 1, `94: ${b.bpm}`);
  const c = detectTempo(clicks(120, 8, 22050, .1), 22050, .25, .75); assert.ok(Math.abs(c.bpm - 120) <= 1, `region: ${c.bpm}`);
  const s = detectTempo(new Float32Array(22050 * 4), 22050); assert.equal(s.bpm, 0, 'silence: nothing');
  assert.equal(detectTempo(clicks(120, 1), 22050).bpm, 0, 'too short to say');
});
test('barsGuess rounds a region to a musical bar count', () => {
  assert.equal(barsGuess(4, 120, 4), 2); assert.equal(barsGuess(5.1, 94, 4), 2); assert.equal(barsGuess(1.1, 120, 4), .5); assert.equal(barsGuess(30, 120, 4), 16); assert.equal(barsGuess(2, 120, 3), 1);
});
test('snapTo lands on the nearest interior grid point, or leaves x alone when snapping is off', () => {
  assert.equal(snapTo(.26, 0, 1, 8), .25); assert.equal(snapTo(.02, 0, 1, 8), .125, 'never onto begin'); assert.equal(snapTo(.99, 0, 1, 8), .875, 'never onto end');
  near(snapTo(.3, .2, .6, 4), .3, 'a region'); assert.equal(snapTo(.31, 0, 1, 0), .31);
  assert.equal(snapDivisions(2, 4, 4), 32); assert.equal(SNAPS['1/16'], 4);
});