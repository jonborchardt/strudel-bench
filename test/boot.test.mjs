import { test } from 'node:test';
import assert from 'node:assert/strict';
import { softClipCurve } from '../web/boot.mjs';

test('softClipCurve: identity under the knee, monotonic, a wall at 1', () => {
  const c = softClipCurve(2001, 0.8), at = (x) => c[Math.round(((x + 1) / 2) * 2000)];
  assert.ok(Math.abs(at(0.5) - 0.5) < 1e-3 && Math.abs(at(-0.5) + 0.5) < 1e-3, 'identity below the knee');
  assert.ok(at(1) < 1 && at(1) > 0.9, `full scale lands under the wall (${at(1)})`);
  for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1], 'monotonic');
  assert.ok(c.every((y) => Math.abs(y) <= 1), 'never past ±1');
  assert.equal(at(0), 0);
});
