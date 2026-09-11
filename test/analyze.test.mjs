import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, synth } from '../scripts/analyze.mjs';

const rate = 44100;
const tone = (hz, secs, amp = .5) => Float32Array.from({ length: rate * secs }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate));
const clicksAt = (times, secs = 2) => { const a = new Float32Array(rate * secs); for (const t of times) for (let k = 0; k < 40; k++) a[Math.floor(t * rate) + k] = 0.9 * (1 - k / 40); return a; };
const prng = (seed) => { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
const grid = (step, secs = 2) => Array.from({ length: Math.floor(secs / step) }, (_, i) => i * step);

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

test('empty audio throws instead of returning NaN', () => {
  assert.throws(() => analyze({ rate: 44100, channels: 1, frames: [new Float32Array(0)] }), /empty audio/);
});

test('all-silence audio reports zero active frames', () => {
  const silence = new Float32Array(rate * 2);
  const r = analyze({ rate, channels: 1, frames: [silence] });
  assert.equal(r.activeFrames, 0);
});

test('swing: delayed off-beat eighths raise it, straight eighths keep it near zero', () => {
  const eighth = 1 / (0.5 * 8);
  const straight = analyze({ rate, channels: 1, frames: [clicksAt(grid(eighth))] }, { cps: 0.5 });
  const swung = analyze({ rate, channels: 1, frames: [clicksAt(grid(eighth).map((t, i) => (i % 2 ? t + 0.05 : t)))] }, { cps: 0.5 });
  assert.ok(straight.swing < 0.03, `${straight.swing}`);
  assert.ok(swung.swing > 0.12, `${swung.swing}`);
});

test('jitter: randomly displaced sixteenths raise it', () => {
  const r = prng(7), six = 1 / (0.5 * 16);
  const tight = analyze({ rate, channels: 1, frames: [clicksAt(grid(six))] }, { cps: 0.5 });
  const loose = analyze({ rate, channels: 1, frames: [clicksAt(grid(six).map((t) => Math.max(0, t + (r() - 0.5) * 0.03)))] }, { cps: 0.5 });
  assert.ok(tight.jitter < 3, `${tight.jitter}`);
  assert.ok(loose.jitter > 5, `${loose.jitter}`);
});

test('novelty: alternating cycle contents raise it, a loop keeps it low', () => {
  const loop = analyze({ rate, channels: 1, frames: [clicksAt(grid(0.5, 4), 4)] }, { cps: 0.5 });
  const alt = analyze({ rate, channels: 1, frames: [clicksAt([0, .5, 1, 1.5, 2, 4, 4.5, 5, 5.5, 6], 8)] }, { cps: 0.5 });
  assert.ok(loop.novelty < 0.1, `${loop.novelty}`);
  assert.ok(alt.novelty > 0.3, `${alt.novelty}`);
});

test('flatness: a clipped sine is flatter than a clean one', () => {
  const clean = analyze({ rate, channels: 1, frames: [tone(220, 2)] });
  const clipped = analyze({ rate, channels: 1, frames: [tone(220, 2).map((x) => Math.max(-0.1, Math.min(0.1, x)) * 5)] });
  assert.ok(clean.flatness < clipped.flatness, `${clean.flatness} ${clipped.flatness}`);
});
