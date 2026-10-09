import { test } from 'node:test';
import assert from 'node:assert/strict';
import { softClipCurve, satCurve, satGains } from '../web/boot.mjs';

test('softClipCurve: identity under the knee, monotonic, a wall at 1', () => {
  const c = softClipCurve(2001, 0.8), at = (x) => c[Math.round(((x + 1) / 2) * 2000)];
  assert.ok(Math.abs(at(0.5) - 0.5) < 1e-3 && Math.abs(at(-0.5) + 0.5) < 1e-3, 'identity below the knee');
  assert.ok(at(1) < 1 && at(1) > 0.9, `full scale lands under the wall (${at(1)})`);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1], 'monotonic');
  assert.ok(c.every((y) => Math.abs(y) <= 1), 'never past ±1');
  assert.equal(at(0), 0);
});

const through = (amount, a, N = 2048) => { // rms in and out of a sine of amplitude `a` through the chain
  const c = satCurve(amount), { pre, post } = satGains(amount);
  const at = (x) => c[Math.round(((Math.max(-1, Math.min(1, x)) + 1) / 2) * (c.length - 1))];
  let i2 = 0, o2 = 0;
  for (let i = 0; i < N; i++) { const x = a * Math.sin(2 * Math.PI * i / N); i2 += x * x; o2 += (at(x * pre) * post) ** 2; }
  return 20 * Math.log10(Math.sqrt(o2 / i2));
};

test('satCurve: identity at 0, odd and monotonic and bounded otherwise', () => {
  const id = satCurve(0, 101);
  assert.ok(id.every((y, i) => Math.abs(y - ((i / 100) * 2 - 1)) < 1e-6));
  const c = satCurve(.7, 1001);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1]);
  assert.ok(Math.abs(c[0] + 1) < 1e-6 && Math.abs(c[1000] - 1) < 1e-6);
  assert.ok(Math.abs(c[500]) < 1e-6, 'odd: zero at zero');
  assert.ok(c[750] > .75, 'bent: the curve rises faster than the line'); // x = .5 maps above .75
});

test('satGains: rms-neutral for a -12 dBFS sine at every amount, 1/1 at zero', () => {
  assert.deepEqual(satGains(0), { pre: 1, post: 1 });
  for (const a of [.2, .5, 1]) assert.ok(Math.abs(through(a, .25)) < .15, `amount ${a}: ${through(a, .25).toFixed(2)} dB`);
  assert.ok(through(1, .8) < -1, 'a hot signal comes out quieter than it went in (soft clipping)');
});
