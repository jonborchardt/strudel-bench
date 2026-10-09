import { test } from 'node:test';
import assert from 'node:assert/strict';
import { softClipCurve, satCurve } from '../web/boot.mjs';

test('softClipCurve: identity under the knee, monotonic, a wall at 1', () => {
  const c = softClipCurve(2001, 0.8), at = (x) => c[Math.round(((x + 1) / 2) * 2000)];
  assert.ok(Math.abs(at(0.5) - 0.5) < 1e-3 && Math.abs(at(-0.5) + 0.5) < 1e-3, 'identity below the knee');
  assert.ok(at(1) < 1 && at(1) > 0.9, `full scale lands under the wall (${at(1)})`);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1], 'monotonic');
  assert.ok(c.every((y) => Math.abs(y) <= 1), 'never past ±1');
  assert.equal(at(0), 0);
});

const through = (amount, a, N = 2048) => { // dB change in rms of a sine of amplitude `a` through the curve
  const c = satCurve(amount);
  const at = (x) => c[Math.round(((Math.max(-1, Math.min(1, x)) + 1) / 2) * (c.length - 1))];
  let i2 = 0, o2 = 0;
  for (let i = 0; i < N; i++) { const x = a * Math.sin(2 * Math.PI * i / N); i2 += x * x; o2 += at(x) ** 2; }
  return 20 * Math.log10(Math.sqrt(o2 / i2));
};

test('satCurve: identity at 0', () => {
  const id = satCurve(0, 101);
  assert.ok(id.every((y, i) => Math.abs(y - ((i / 100) * 2 - 1)) < 1e-6));
});

test('satCurve: slope 1 at zero, odd, monotonic, bounded by 1/k', () => {
  const n = 8193, mid = 4096;
  for (const amount of [.3, .6, 1]) {
    const c = satCurve(amount, n), k = 4 * amount;
    assert.ok(Math.abs((c[mid + 1] - c[mid - 1]) / (2 * 2 / (n - 1)) - 1) < 1e-3, `amount ${amount}: unity slope`);
    assert.ok(Math.abs(c[mid]) < 1e-6, 'zero at zero');
    for (let j = 1; j <= mid; j += 97) assert.ok(Math.abs(c[mid + j] + c[mid - j]) < 1e-6, 'odd');
    for (let i = 1; i < n; i++) assert.ok(c[i] >= c[i - 1], 'monotonic');
    assert.ok(Math.max(...c.map(Math.abs)) <= 1 / k + 1e-6, 'bounded by 1/k');
    assert.ok(c[n - 1] < 1, 'ceiling under 1');
  }
});

test('satCurve: quiet material keeps its level, a hot signal comes out quieter', () => {
  for (const a of [.1, .3, .6, 1]) assert.ok(Math.abs(through(a, .03)) < .1, `amount ${a}: ${through(a, .03).toFixed(3)} dB`);
  assert.ok(through(1, .8) < -6, `hot signal: ${through(1, .8).toFixed(2)} dB`);
});
