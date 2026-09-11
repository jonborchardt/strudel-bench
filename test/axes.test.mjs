import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

test('phases run in declared order and skip missing cells', async () => {
  const g = await ready;
  const { defineCell, applyPatternPhases } = g.strudleLib;
  const log = [];
  defineCell('t', 'space', { spatial: (p) => (log.push('spatial'), p) });
  defineCell('t', 'weight', { level: (p) => (log.push('level'), p), pitch: (p) => (log.push('pitch'), p) });
  defineCell('t', 'groove', { timing: (p) => (log.push('timing'), p) });
  applyPatternPhases('t', g.s('bd'), { space: .7, weight: .7, groove: .7 }, {});
  assert.deepEqual(log, ['timing', 'pitch', 'spatial', 'level']);
});

test('ctl: exact 0.5 is identity, numbers map, signals fmap, noopBelow respected', async () => {
  const g = await ready;
  const { ctl, piece } = g.strudleLib;
  const base = g.s('hh*4');
  const f = piece(200, 2000, 8000, { log: true });
  assert.equal(ctl(base, 'lpf', .5, f), base, 'same object at 0.5');
  assert.ok(Math.abs(f(.5) - 2000) < 1e-9);
  assert.ok(f(0) < f(.25) && f(.25) < f(.5) && f(.5) < f(.75) && f(.75) < f(1));
  assert.equal(ctl(base, 'lpf', 1, f).queryArc(0, 1)[0].value.cutoff, 8000);
  assert.equal(ctl(base, 'room', .3, (v) => v, { noopBelow: true }), base);
  const sig = ctl(base, 'lpf', g.saw.range(0, 1), f).queryArc(0, 1).map((h) => h.value.cutoff);
  assert.equal(sig.length, 4);
  assert.ok(sig[0] < sig[3]);
});

test('num() rejects signals on structural axes', async () => {
  const g = await ready;
  assert.throws(() => g.strudleLib.num(g.saw, 'density'), /density is structural/);
});
