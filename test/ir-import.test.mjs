// test/ir-import.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readWav } from '../lib/analyze.mjs';
import { writeWav } from '../scripts/analyze.mjs';
import { importIr, toStereo } from '../scripts/ir.mjs';

const tmp = path.resolve(import.meta.dirname, '_t_ir.wav');
const impulse = (rate, leadMs, seconds, chans = 2) => { // silence, a click, then a decaying noise tail
  const n = Math.round(rate * seconds), lead = Math.round(rate * leadMs / 1000);
  let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff - .5; };
  return Array.from({ length: chans }, (_, c) => Float32Array.from({ length: n }, (_, i) => (i < lead ? 0 : i === lead ? .9 : (c === 2 ? 0 : rnd() * Math.exp(-(i - lead) / (rate * .4)) * .3))));
};

test('with keepDirect: importIr trims the leading silence, keeps the rate, adds the pre-delay, normalises to .5 and fades out', () => {
  writeWav(tmp, 96000, impulse(96000, 100, 3));
  try {
    const { rate, channels } = importIr(fs.readFileSync(tmp), { seconds: 2, predelayMs: 20, keepDirect: true });
    assert.equal(rate, 96000);
    assert.equal(channels.length, 2);
    assert.equal(channels[0].length, 96000 * 2);
    const pre = Math.round(96000 * .02);
    assert.equal(channels[0].slice(0, pre).some((x) => x !== 0), false, 'the pre-delay is digital silence');
    assert.ok(Math.abs(channels[0][pre]) > .4, 'the kept click lands right after the pre-delay');
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

test('importIr removes the direct sound: under 20% of the energy within 2.5 ms of the largest sample; keepDirect keeps the click', () => {
  writeWav(tmp, 48000, impulse(48000, 30, 2));
  const near = (ch) => { // share of energy within 2.5 ms of the largest sample
    let at = 0; ch.forEach((x, i) => { if (Math.abs(x) > Math.abs(ch[at])) at = i; });
    const w = Math.round(48000 * .0025); let e = 0, all = 0;
    ch.forEach((x, i) => { all += x * x; if (Math.abs(i - at) <= w) e += x * x; });
    return { share: e / all, at };
  };
  try {
    const buf = fs.readFileSync(tmp);
    const cut = importIr(buf, { seconds: 1, predelayMs: 10 }).channels[0];
    assert.ok(near(cut).share < .2, `direct share ${near(cut).share}`);
    assert.equal(near(importIr(buf, { seconds: 1, predelayMs: 10, keepDirect: true }).channels[0]).at, 480, 'the click stays the largest sample');
  } finally { fs.rmSync(tmp, { force: true }); }
});

test('the trim floor follows the peak: noise 53 dB under it ahead of the arrival is not the start', () => {
  const ch = new Float32Array(48000); ch.fill(.002, 0, 240); ch[1000] = .9; ch[1100] = .3; // .002 is 53 dB under the peak
  writeWav(tmp, 48000, [ch, ch]);
  try {
    const { channels } = importIr(fs.readFileSync(tmp), { seconds: .5, predelayMs: 5, keepDirect: true });
    const first = channels[0].findIndex((x) => x !== 0);
    assert.equal(first, 240, 'first nonzero sample is the pre-delay (5 ms = 240), the click: the noise was trimmed');
  } finally { fs.rmSync(tmp, { force: true }); }
});

const ROOT = path.resolve(import.meta.dirname, '..'), ROOMS = path.join(ROOT, 'samples/user/rooms');
test('every rooms impulse is stereo, and no song asks a room.size longer than its file (superdough cuts the tail at size)', { skip: !fs.existsSync(path.join(ROOMS, 'meta.json')) && 'no rooms pack' }, () => {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOMS, 'meta.json'), 'utf8'));
  for (const key of Object.keys(meta)) assert.equal(readWav(fs.readFileSync(path.join(ROOT, 'samples/user', key))).channels, 2, `${key} is not stereo`);
  for (const f of fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel'))) {
    for (const [, body] of fs.readFileSync(path.join(ROOT, 'songs', f), 'utf8').matchAll(/{([^{}]*)}/g)) {
      const ir = body.match(/ir:s*'([^']+)'/)?.[1], size = Number(body.match(/size:s*([d.]+)/)?.[1]), m = meta[`rooms/${ir}.wav`];
      if (ir && size && m) assert.ok(size <= m.seconds, `${f}: room.size ${size} outlasts ${ir}.wav (${m.seconds} s)`);
    }
  }
});
