import { test } from 'node:test';
import assert from 'node:assert/strict';
import { peaks, fmtTime, soundUrl } from '../web/sampler.mjs';

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
