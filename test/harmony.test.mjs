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
  assert.equal(chordName('E:minor', 1), 'F#dim');
  assert.equal(chordName('B:minor', 4), 'F#m');
  assert.equal(describeHarmony('C:minor', parseProgression('i VI III VII')), 'i VI III VII in C:minor → Cm Ab Eb Bb');
});

const onsets = (p, cycles) => p.queryArc(0, cycles).filter((h) => h.hasOnset()).sort((a, b) => a.whole.begin.valueOf() - b.whole.begin.valueOf());
const notesInCycle = (p, c) => onsets(p, c + 1).filter((h) => h.whole.begin.valueOf() >= c).map((h) => h.value.note);
const layerPat = (g, meta, spec, layer) => g.song(meta, [g.section('_', 2, spec)]).strudle.sections[0].layers[layer].pattern;

test('bass and pad follow the progression, melody stays in key', async () => {
  const g = await ready;
  const meta = { key: 'C:minor', seed: 3 };
  const spec = { progression: 'i VI', bass: {}, pad: {}, melody: {} };
  const bass = layerPat(g, meta, spec, 'bass'), pad = layerPat(g, meta, spec, 'pad'), mel = layerPat(g, meta, spec, 'melody');
  assert.equal(notesInCycle(bass, 1)[0] - notesInCycle(bass, 0)[0], 8, 'bass root moves C -> Ab (8 semitones)');
  assert.equal(Math.min(...notesInCycle(pad, 1)) - Math.min(...notesInCycle(pad, 0)), 8, 'pad root moves C -> Ab');
  assert.deepEqual(notesInCycle(mel, 1), notesInCycle(mel, 0), 'melody does not transpose with the chord');
});

test('section key override changes pitched layers, not drums', async () => {
  const g = await ready;
  const base = { drums: { density: .6 }, pad: {} };
  const a = g.song({ key: 'C:minor' }, [g.section('_', 1, base)]).strudle.sections[0].layers;
  const b = g.song({ key: 'C:minor' }, [g.section('_', 1, { key: 'Eb:major', ...base })]).strudle.sections[0].layers;
  assert.equal(Math.min(...notesInCycle(a.pad.pattern, 0)), 60, 'C4 in C minor');
  assert.equal(Math.min(...notesInCycle(b.pad.pattern, 0)), 63, 'Eb4 in Eb major');
  const sig = (p) => JSON.stringify(onsets(p, 1).map((h) => [h.whole.begin.valueOf(), h.value.s]));
  assert.equal(sig(a.drums.pattern), sig(b.drums.pattern));
});

test('no progression keeps the pad exactly as before (default i VI)', async () => {
  const g = await ready;
  const withDefault = layerPat(g, { key: 'C:minor' }, { pad: {} }, 'pad');
  const explicit = layerPat(g, { key: 'C:minor' }, { pad: { chord: '<0 5>' } }, 'pad');
  const sig = (p) => JSON.stringify(onsets(p, 2).map((h) => [h.whole.begin.valueOf(), h.value.note]));
  assert.equal(sig(withDefault), sig(explicit));
});

test('relativeKey, withMode and applyHarmonyWords', async () => {
  await ready;
  const { relativeKey, withMode, applyHarmonyWords } = await import('../lib/harmony.mjs');
  const { parsePhrase } = await import('../lib/vocab.mjs');
  assert.equal(relativeKey('C:minor'), 'Eb:major');
  assert.equal(relativeKey('A:major'), 'F#:minor');
  assert.equal(relativeKey('Db:major'), 'Bb:minor');
  assert.throws(() => relativeKey('D:dorian'), /relative/);
  assert.equal(withMode('C:minor', 'major'), 'C:major');
  const s0 = { key: 'C:minor', progression: 'i VI' };
  assert.deepEqual(applyHarmonyWords(s0, parsePhrase('relative major, pop').harmony), { key: 'Eb:major', progression: 'I V vi IV' });
  assert.deepEqual(applyHarmonyWords(s0, parsePhrase('major').harmony), { key: 'C:major', progression: 'i VI' });
  assert.deepEqual(applyHarmonyWords(s0, parsePhrase('relative').harmony), { key: 'Eb:major', progression: 'i VI' });
  assert.deepEqual(applyHarmonyWords(s0, parsePhrase('punchier').harmony), s0, 'no harmony words: unchanged');
  assert.deepEqual(applyHarmonyWords(s0, parsePhrase('tense, resolved').harmony).progression, 'I IV V I', 'last progression word wins');
  assert.deepEqual(applyHarmonyWords({ key: 'C:aeolian', progression: 'i VI' }, parsePhrase('relative minor').harmony), { key: 'C:minor', progression: 'i VI' });
});
