import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, tone } from '../lib/analyze.mjs';

const rate = 44100;
const clicksAt = (times, secs = 2) => { const a = new Float32Array(rate * secs); for (const t of times) for (let k = 0; k < 40; k++) a[Math.floor(t * rate) + k] = 0.9 * (1 - k / 40); return a; };
const prng = (seed) => { let x = seed >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
const grid = (step, secs = 2) => Array.from({ length: Math.floor(secs / step) }, (_, i) => i * step);

test('centroid tracks a sine frequency', () => {
  const a = analyze({ rate, channels: 1, frames: [tone(rate, 440, 2)] });
  const b = analyze({ rate, channels: 1, frames: [tone(rate, 4000, 2)] });
  assert.ok(Math.abs(a.centroidHz - 440) < 60, `${a.centroidHz}`);
  assert.ok(b.centroidHz > 3000 && b.highRatio > a.highRatio);
});

test('low-band ratio and width', () => {
  const low = analyze({ rate, channels: 1, frames: [tone(rate, 60, 2)] });
  const mid = analyze({ rate, channels: 1, frames: [tone(rate, 1000, 2)] });
  assert.ok(low.lowRatio > 0.9 && mid.lowRatio < 0.1);
  const mono = analyze({ rate, channels: 2, frames: [tone(rate, 440, 1), tone(rate, 440, 1)] });
  const wide = analyze({ rate, channels: 2, frames: [tone(rate, 440, 1), tone(rate, 440, 1).map((x) => -x)] });
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
  const half = new Float32Array(rate * 2); half.set(tone(rate, 4000, 1), 0);
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

test('pan: energy-weighted position and its spread; masking: shared band energy when both sound; depth reads its three inputs', async () => {
  const { masking, depthOf } = await import('../lib/analyze.mjs');
  const t = tone(rate, 440, 1), quiet = t.map((x) => x * .2);
  const right = analyze({ rate, channels: 2, frames: [quiet, t] });
  assert.ok(right.meanPan > 0.9 && right.panStd < 0.01, `${right.meanPan} ${right.panStd}`);
  assert.equal(analyze({ rate, channels: 2, frames: [t, t] }).meanPan, 0.5);
  const moving = analyze({ rate, channels: 2, frames: [t.map((x, i) => x * (i < rate / 2 ? 1 : .1)), t.map((x, i) => x * (i < rate / 2 ? .1 : 1))] });
  assert.ok(moving.panStd > 0.3, `${moving.panStd}`);
  const low = analyze({ rate, channels: 1, frames: [tone(rate, 80, 1)] }, { bands: true }), low2 = analyze({ rate, channels: 1, frames: [tone(rate, 100, 1)] }, { bands: true });
  const high = analyze({ rate, channels: 1, frames: [tone(rate, 5000, 1)] }, { bands: true });
  assert.ok(masking(low, low2).low > 0.5 && masking(low, high).low < 0.05, JSON.stringify([masking(low, low2), masking(low, high)]));
  const half = new Float32Array(rate); half.set(tone(rate, 100, .5), 0);
  const m = masking(low, analyze({ rate, channels: 1, frames: [half] }, { bands: true }));
  assert.ok(m.low > 0.2 && m.low < 0.7, `sounding together half the time halves the risk: ${m.low}`);
  assert.equal(analyze({ rate, channels: 1, frames: [t] }).bands, undefined, 'bands only on request');
  const near = depthOf({ relativeDb: -3, highRatio: .3, tail: 0 }), far = depthOf({ relativeDb: -24, highRatio: .02, tail: .5 });
  assert.ok(near < 0.15 && far > 0.85, `${near} ${far}`);
  assert.ok(depthOf({ relativeDb: -30, highRatio: .3, tail: 0 }) < depthOf({ relativeDb: -30, highRatio: .02, tail: .5 }), 'level alone is not distance');
});

test('flatness: a clipped sine is flatter than a clean one', () => {
  const clean = analyze({ rate, channels: 1, frames: [tone(rate, 220, 2)] });
  const clipped = analyze({ rate, channels: 1, frames: [tone(rate, 220, 2).map((x) => Math.max(-0.1, Math.min(0.1, x)) * 5)] });
  assert.ok(clean.flatness < clipped.flatness, `${clean.flatness} ${clipped.flatness}`);
  assert.equal(clean.clipped, 0);
  const hot = analyze({ rate, channels: 1, frames: [tone(rate, 220, 1, 2).map((x) => Math.max(-1, Math.min(1, x)))] });
  assert.ok(hot.clipped > 0.5, `most of a sine driven to twice full scale sits at it: ${hot.clipped}`);
});
