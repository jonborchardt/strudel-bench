import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, synth } from '../scripts/analyze.mjs';

const rate = 44100;
const tone = (hz, secs, amp = .5) => Float32Array.from({ length: rate * secs }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate));

test('centroid tracks a sine frequency', () => {
  const a = analyze({ rate, channels: 1, frames: [tone(440, 2)] });
  const b = analyze({ rate, channels: 1, frames: [tone(4000, 2)] });
  assert.ok(Math.abs(a.centroidHz - 440) < 60, `${a.centroidHz}`);
  assert.ok(b.centroidHz > 3000 && b.highRatio > a.highRatio);
});

test('low-band ratio and width', () => {
  const low = analyze({ rate, channels: 1, frames: [tone(60, 2)] });
  const mid = analyze({ rate, channels: 1, frames: [tone(1000, 2)] });
  assert.ok(low.lowRatio > 0.9 && mid.lowRatio < 0.1);
  const mono = analyze({ rate, channels: 2, frames: [tone(440, 1), tone(440, 1)] });
  const wide = analyze({ rate, channels: 2, frames: [tone(440, 1), tone(440, 1).map((x) => -x)] });
  assert.ok(mono.width < 0.01 && wide.width > 0.9);
});

test('click train onset rate and crest', () => {
  const clicks = new Float32Array(rate * 2);
  for (let t = 0; t < 2; t += 0.25) for (let k = 0; k < 40; k++) clicks[Math.floor(t * rate) + k] = 0.9 * (1 - k / 40);
  const r = analyze({ rate, channels: 1, frames: [clicks] });
  assert.ok(Math.abs(r.onsetsPerSec - 4) < 0.6, `${r.onsetsPerSec}`);
  assert.ok(r.crest > 5);
});

test('active-frame gating ignores silence', () => {
  const half = new Float32Array(rate * 2); half.set(tone(4000, 1), 0);
  const r = analyze({ rate, channels: 1, frames: [half] });
  assert.ok(r.centroidHz > 3000, 'silence must not drag the centroid');
});
