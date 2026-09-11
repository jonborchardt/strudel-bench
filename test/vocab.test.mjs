import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhrase, applyDeltas } from '../lib/vocab.mjs';

test('modifiers scale, comparatives resolve, unknown words reported', () => {
  const r = parsePhrase('much heavier, a little darker, sparkly');
  assert.ok(r.deltas.weight > 0.3, 'much heavier ≈ 2× heavy.weight');
  assert.ok(Math.abs(r.deltas.brightness + 0.15) < 1e-9, 'a little darker = .5 x dark.brightness');
  assert.deepEqual(r.unknown, ['sparkly']);
});

test('less negates', () => {
  const a = parsePhrase('punchy').deltas.articulation;
  const b = parsePhrase('less punchy').deltas.articulation;
  assert.ok(a > 0 && Math.abs(a + b) < 1e-9);
});

test('collisions keep every contribution', () => {
  const r = parsePhrase('much brighter but also darker');
  const c = r.contributions.brightness;
  assert.equal(c.length, 2);
  assert.ok(c.some((x) => x.delta > 0) && c.some((x) => x.delta < 0));
  assert.ok(Math.abs(r.deltas.brightness - (c[0].delta + c[1].delta)) < 1e-9);
});

test('applyDeltas reports saturation and defaults missing axes to 0.5', () => {
  const out = applyDeltas({ brightness: .95 }, { brightness: .4, weight: .2 });
  assert.deepEqual(out.brightness, { from: .95, requestedDelta: .4, appliedDelta: .05, to: 1, saturated: true });
  assert.equal(out.weight.from, .5);
  assert.equal(out.weight.saturated, false);
  assert.ok(Math.abs(out.weight.to - .7) < 1e-9);
});
