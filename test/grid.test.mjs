import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankings, fit, bassGrid, place, accents } from '../lib/grid.mjs';

test('16/4 rankings', () => {
  assert.deepEqual(rankings(16, 4).on, [0, 8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15]);
  assert.deepEqual(rankings(16, 4).off, [2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15, 4, 12, 0, 8]);
  assert.deepEqual(rankings(16, 4).snare, [4, 12, 6, 14, 2, 10, 0, 8, 1, 3, 5, 7, 9, 11, 13, 15]);
});

test('other meters: rankings cover every step once, templates tile, bass grids land on the pulse', () => {
  for (const [steps, pulse] of [[12, 4], [12, 2], [14, 2], [20, 4]]) {
    const r = rankings(steps, pulse);
    for (const k of ['on', 'off', 'snare']) assert.deepEqual([...r[k]].sort((a, b) => a - b), Array.from({ length: steps }, (_, i) => i), `${steps}/${pulse} ${k}`);
    assert.equal(r.on[0], 0);
  }
  assert.equal(fit('x...x...x...x...', 12), 'x...x...x...');
  assert.equal(fit('x...x...x...x...', 20), 'x...x...x...x...x...');
  assert.equal(bassGrid(4, { steps: 12, pulse: 4 }), 'x...x...x...');
  assert.equal(bassGrid(1, { steps: 14, pulse: 2 }), 'x.............');
  assert.equal(bassGrid(8, { steps: 16, pulse: 4 }), 'x.x.x.x.x.x.x.x.');
  assert.equal(place('x...x...x...', 1).split('x').length - 1, 3);
  assert.equal(accents(1, { steps: 12, pulse: 4 }).split(' ').length, 12);
});

test('x/8 meters: off ranking never lands on a beat, on ranking prefers the half-bar beat', () => {
  const r = rankings(12, 2);
  assert.ok(r.off.slice(0, 6).every((i) => i % 2 === 1), `first off targets ${r.off.slice(0, 6)}`);
  assert.deepEqual(r.on.slice(0, 2), [0, 6]);
  assert.deepEqual(rankings(12, 4).on.slice(0, 3), [0, 4, 8], '3/4 has no half-bar');
});

test('parseGrid: characters, tiling, bars, euclid shorthand, errors', async () => {
  const { parseGrid, bjorklund, gains, positions, place, fromPositions } = await import('../lib/grid.mjs');
  assert.deepEqual(parseGrid('x...x...x...x...', 16), { grid: 'x...x...x...x...', bars: 1 });
  assert.deepEqual(parseGrid('x - X ~ o .', 12), { grid: 'x.X.o.x.X.o.', bars: 1 }, 'spaces ignored, - and ~ are rests, a short grid tiles');
  assert.deepEqual(parseGrid('x...x...x...x...|x...x...x..xx.x.', 16), { grid: 'x...x...x...x...x...x...x..xx.x.', bars: 2 }, '| separates bars');
  assert.deepEqual(parseGrid('3/8', 16), { grid: 'x.....x.....x...', bars: 1 }, 'euclid over the bar');
  assert.deepEqual(parseGrid('3/8+1', 16), { grid: '....x.....x...x.', bars: 1 }, 'rotated left by one slot: x..x..x. becomes ..x..x.x');
  assert.deepEqual(parseGrid('5/16', 16).grid, bjorklund(5, 16));
  assert.throws(() => parseGrid('x..y', 16), /unknown character "y"/);
  assert.throws(() => parseGrid('x'.repeat(20), 16), /whole number of bars/);
  assert.throws(() => parseGrid('3/5', 16), /divide the bar/);
  assert.throws(() => parseGrid('', 16), /empty/);
  assert.throws(() => parseGrid('  ', 16), /empty/);
  assert.equal(bjorklund(3, 8), 'x..x..x.'); assert.equal(bjorklund(0, 4), '....'); assert.equal(bjorklund(4, 4), 'xxxx');
  assert.equal(gains('x.X.o.'), '1 1 1.25 1 .4 1'); assert.equal(gains('x...x...'), null);
  assert.deepEqual(positions('X.o.'), [0, 2]);
  assert.equal(fromPositions([1, 3], 4, { 1: 'X', 3: 'o' }), '.X.o');
  assert.equal(place('x...x...x...x...', .9), place('X...x...o...x...', .9).replace(/[Xo]/g, 'x'), 'accents ride along with the hits drive moves');
  assert.equal(place('X...x...o...x...', .5), 'X...x...o...x...');
});
