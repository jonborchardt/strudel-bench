import test from 'node:test';
import assert from 'node:assert/strict';
import { defText, packJsonWith, nameProblem } from '../web/workshop.mjs';

test('defText writes only what differs from the sample part defaults', () => {
  assert.deepEqual(defText('amen', { sound: 'amen', begin: 0, end: 1, bars: 2, slices: 8 }), { bars: 2, slices: 8 });
  assert.deepEqual(defText('amen-kick', { sound: 'amen', end: .0625, bars: .125 }), { sound: 'amen', end: .0625, bars: .125 });
  assert.deepEqual(defText('amen', { sound: 'amen', begin: 0, end: 1, bars: 1, slices: 1 }), {}, 'a plain whole-file sample of its own name writes nothing');
  assert.deepEqual(defText('chop', { sound: 'amen', begin: 1 / 3, end: 1, bars: 2, slices: [.0625, .5], stretch: true }),
    { sound: 'amen', begin: .3333, bars: 2, slices: [.0625, .5], stretch: true }, 'fractions round to 4 decimals, break points too');
  assert.deepEqual(defText('amen', { begin: 0, end: 1, bars: 2, slices: 1, stretch: false }), { bars: 2 }, 'no sound, one slice, no stretch: dropped');
});

test('packJsonWith sets or removes one definition and keeps the pack metadata', () => {
  const meta = { deploy: true, license: 'CC0-1.0', source: 'generated', samples: { loop: { bars: 2 } } };
  assert.deepEqual(packJsonWith(meta, 'hit', { end: .5 }),
    { deploy: true, license: 'CC0-1.0', source: 'generated', samples: { loop: { bars: 2 }, hit: { end: .5 } } });
  assert.deepEqual(packJsonWith(meta, 'loop', null), { deploy: true, license: 'CC0-1.0', source: 'generated', samples: {} });
  assert.deepEqual(packJsonWith({ license: 'CC0-1.0' }, 'a', { bars: 2 }), { license: 'CC0-1.0', samples: { a: { bars: 2 } } }, 'a pack with no samples yet');
  assert.deepEqual(meta.samples, { loop: { bars: 2 } }, 'the pack read from disk is not mutated');
});

test('nameProblem refuses illegal names and names another pack already uses', () => {
  const packs = { 'demo-pack': { sounds: { loop: ['loop.wav'] }, samples: { 'loop-kick': { sound: 'loop' } } }, _t_ws: { sounds: { hit: ['hit.wav'] }, samples: {} } };
  assert.equal(nameProblem('hit2', '_t_ws', packs), null);
  assert.equal(nameProblem('hit', '_t_ws', packs), null, 'its own pack is where a definition belongs');
  assert.equal(nameProblem('loop', '_t_ws', packs), '"loop" is already a sound or sample in another pack');
  assert.equal(nameProblem('loop-kick', '_t_ws', packs), '"loop-kick" is already a sound or sample in another pack');
  assert.equal(nameProblem('', '_t_ws', packs), 'letters, digits, - and _ only');
  assert.equal(nameProblem('a b', '_t_ws', packs), 'letters, digits, - and _ only');
  assert.equal(nameProblem('a.wav', '_t_ws', packs), 'letters, digits, - and _ only');
});
