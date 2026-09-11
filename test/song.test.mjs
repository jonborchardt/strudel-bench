import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

test('song() builds an arranged pattern with section metadata', async () => {
  const g = await ready;
  g.strudleLib.registerLayer('blip', (attrs, ctx) => g.s('hh*4'));
  const pat = g.song({ cps: .5, key: 'C:minor' }, [
    g.section('a', 2, { role: 'establish', blip: { density: .5 } }),
    g.section('b', 4, { blip: {} }),
  ]);
  assert.equal(typeof pat.queryArc, 'function');
  const m = pat.strudle;
  assert.equal(m.total, 6);
  assert.deepEqual(m.sections.map((s) => [s.name, s.cycles, s.offset, s.role]), [['a', 2, 0, 'establish'], ['b', 4, 2, undefined]]);
  assert.deepEqual(m.sections[0].layers.blip.attrs, { density: .5 });
  assert.equal(pat.queryArc(0, 6).filter((h) => h.hasOnset()).length, 24);
  assert.equal(pat.queryArc(6, 12).filter((h) => h.hasOnset()).length, 24, 'song loops');
});

test('unknown layer name throws with a useful message', async () => {
  const g = await ready;
  assert.throws(() => g.song({}, [g.section('a', 1, { nope: {} })]), /unknown layer "nope"/);
});
