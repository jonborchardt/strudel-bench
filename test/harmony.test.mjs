import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

test('parseProgression maps numerals to degrees, rejects junk, defaults to i VI', async () => {
  await ready;
  const { parseProgression, DEFAULT_PROGRESSION, degreeMini } = await import('../lib/harmony.mjs');
  assert.deepEqual(parseProgression('i VI III VII').map((c) => c.degree), [0, 5, 2, 6]);
  assert.deepEqual(parseProgression('I  v').map((c) => c.numeral), ['I', 'v']);
  assert.throws(() => parseProgression('V7'), /numeral/);
  assert.throws(() => parseProgression('ix'), /numeral/);
  assert.deepEqual(parseProgression(undefined), parseProgression(DEFAULT_PROGRESSION));
  assert.deepEqual(parseProgression(''), parseProgression(DEFAULT_PROGRESSION));
  assert.equal(degreeMini(parseProgression('i VI III VII')), '<0 5 2 6>');
  assert.equal(degreeMini(parseProgression('i')), '<0>');
});

test('chordName and describeHarmony read the key\'s diatonic quality', async () => {
  await ready;
  const { chordName, describeHarmony, parseProgression } = await import('../lib/harmony.mjs');
  assert.equal(chordName('C:minor', 0), 'Cm');
  assert.equal(chordName('C:minor', 5), 'Ab');
  assert.equal(chordName('C:minor', 1), 'Ddim');
  assert.equal(chordName('C:major', 4), 'G');
  assert.equal(chordName('Eb:major', 5), 'Cm');
  assert.equal(describeHarmony('C:minor', parseProgression('i VI III VII')), 'i VI III VII in C:minor → Cm Ab Eb Bb');
});
