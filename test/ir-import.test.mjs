// test/ir-import.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeWav } from '../scripts/analyze.mjs';
import { importIr, toStereo } from '../scripts/ir.mjs';

const tmp = path.resolve(import.meta.dirname, '_t_ir.wav');
const impulse = (rate, leadMs, seconds, chans = 2) => { // silence, a click, then a decaying noise tail
  const n = Math.round(rate * seconds), lead = Math.round(rate * leadMs / 1000);
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - .5; };
  return Array.from({ length: chans }, (_, c) => Float32Array.from({ length: n }, (_, i) => (i < lead ? 0 : i === lead ? .9 : (c === 2 ? 0 : rnd() * Math.exp(-(i - lead) / (rate * .4)) * .3))));
};

test('importIr trims the leading silence, keeps the rate, adds the pre-delay, normalises to .5 and fades out', () => {
  writeWav(tmp, 96000, impulse(96000, 100, 3));
  try {
    const { rate, channels } = importIr(fs.readFileSync(tmp), { seconds: 2, predelayMs: 20 });
    assert.equal(rate, 96000);
    assert.equal(channels.length, 2);
    assert.equal(channels[0].length, 96000 * 2);
    const pre = Math.round(96000 * .02);
    assert.equal(channels[0].slice(0, pre).some((x) => x !== 0), false, 'the pre-delay is digital silence');
    assert.ok(Math.abs(channels[0][pre]) > .4, 'the click lands right after the pre-delay');
    const peak = channels.reduce((m, ch) => ch.reduce((a, x) => Math.max(a, Math.abs(x)), m), 0);
    assert.ok(Math.abs(peak - .5) < 1e-3, `peak ${peak}`);
    assert.ok(Math.abs(channels[0].at(-1)) < 1e-4, 'faded out');
  } finally { fs.rmSync(tmp, { force: true }); }
});

test('toStereo: mono duplicates, 4-channel B-format decodes W±Y (silent Y gives identical channels)', () => {
  const [l, r] = toStereo([Float32Array.of(.2, .4)]);
  assert.deepEqual([...l], [...r]);
  const W = Float32Array.of(.5, .5), X = Float32Array.of(.1, .1), Y = new Float32Array(2), Z = new Float32Array(2);
  const [bl, br] = toStereo([W, X, Y, Z]);
  assert.deepEqual([...bl], [...br]);
  const [cl, cr] = toStereo([W, X, Float32Array.of(.2, .2), Z]);
  assert.ok(cl[0] > cr[0], 'positive Y is left');
});

test('importIr refuses a file whose peak is not at the head', () => {
  // low noise from sample 0 (above the -60 dBFS floor, so the trim stays at 0), the real peak 0.83 s in
  const ch = Float32Array.from({ length: 48000 }, (_, i) => ((i * 7919) % 1000 / 1000 - .5) * .02);
  ch[40000] = .9;
  writeWav(tmp, 48000, [ch, ch]);
  try { assert.throws(() => importIr(fs.readFileSync(tmp)), /peak .* not at the head/); }
  finally { fs.rmSync(tmp, { force: true }); }
});
