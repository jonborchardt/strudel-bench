import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, lineText, setNote, extendNote } from '../web/roll.mjs';
import { melodyLine, bassLine } from '../lib/layers.mjs';

test('parseLine reads degrees, rests and holds and lineText writes them back; other notation is refused', () => {
  const s = parseLine('0 2@2 ~ -1 7');
  assert.deepEqual(s, [{ deg: 0, len: 1 }, { deg: 2, len: 2 }, { deg: null, len: 1 }, { deg: -1, len: 1 }, { deg: 7, len: 1 }]);
  assert.equal(lineText(s), '0 2@2 ~ -1 7');
  assert.equal(parseLine('[0 2] 4'), null);
  assert.equal(parseLine('<0 2>'), null);
  assert.equal(parseLine(''), null);
  for (const seed of [1, 2, 3, 7]) assert.ok(parseLine(melodyLine(seed, 8)), 'every seeded line is roll-editable');
  assert.ok(parseLine(bassLine(.5)));
});

test('setNote: a head takes the degree, the same degree rests it, a click inside a hold splits it', () => {
  const s = parseLine('0 2@2 ~');
  assert.equal(lineText(setNote(s, 0, 4)), '4 2@2 ~');
  assert.equal(lineText(setNote(s, 0, 0)), '~ 2@2 ~', 'same degree again: rest');
  assert.equal(lineText(setNote(s, 2, 5)), '0 2 5 ~', 'inside the hold: split there');
  assert.equal(lineText(setNote(s, 3, 1)), '0 2@2 1');
  assert.equal(setNote(s, 9, 1), s, 'past the end: unchanged');
});

test('extendNote: shift-click on a head merges it into the note before; inside a hold or at the start nothing changes', () => {
  const s = parseLine('0 2 ~ 4');
  assert.equal(lineText(extendNote(s, 1)), '0@2 ~ 4');
  assert.equal(lineText(extendNote(extendNote(s, 1), 1)), '0@2 ~ 4', 'now inside the hold: unchanged');
  assert.equal(lineText(extendNote(s, 2)), '0 2@2 4', 'a rest is swallowed too');
  assert.equal(extendNote(s, 0), s);
});
