// lib/visual.mjs: the visual score. Strict about architecture and invariants (determinism, plain data, legal slots, a
// chosen world belongs to its policy pool, the score's shape); loose about the aesthetic policy itself (which mood gets
// which world, what a mode is called), which lib/visual.json is meant to change freely.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { AXIS_NAMES } from '../lib/axes.mjs';
import { OVERLAYS } from '../lib/vocab.mjs';
import { POLICY, classifyHap } from '../lib/visual.mjs';

test('visual policy is well-formed data: every mood names existing worlds, every kind list ends in grain, every palette entry reads an axis', () => {
  for (const [mood, worlds] of Object.entries(POLICY.moods)) {
    assert.ok(mood === 'neutral' || OVERLAYS[mood], `mood "${mood}" is not an overlay word`);
    assert.ok(worlds.length, `mood "${mood}" names no world`);
    for (const w of worlds) assert.ok(POLICY.worlds[w], `mood "${mood}" names unknown world "${w}"`);
  }
  assert.ok(POLICY.moods.neutral, 'a neutral row is the fallback');
  for (const [kind, slots] of Object.entries(POLICY.kinds)) assert.equal(slots.at(-1), 'grain', `kinds.${kind} must end in grain`);
  for (const [name, axis] of Object.entries(POLICY.palette)) assert.ok(AXIS_NAMES.includes(axis), `palette.${name} reads unknown axis "${axis}"`);
  assert.ok(POLICY.temperature.default);
  assert.ok(POLICY.moodThreshold > 0 && POLICY.moodThreshold < 1);
  for (const [w, def] of Object.entries(POLICY.worlds)) for (const [slot, n] of Object.entries(def.slots)) assert.ok(Number.isInteger(n) && n >= 0 && slot !== 'grain', `worlds.${w}.slots.${slot}: a whole number, and grain is never capped`);
});

test('classifyHap: kit voices by bare or indexed name, or in full under a known kit; pitched by note; anything else with a sound is a hit; nothing else is none', async () => {
  await ready; // S.noteToMidi is a strudel global once the scope exists
  const drum = (voice) => ({ kind: 'drums', voice, role: POLICY.voices[voice], note: null });
  assert.deepEqual(classifyHap({ s: 'bd', bank: 'RolandTR909' }), drum('bd'));
  assert.deepEqual(classifyHap({ s: 'RolandTR909_hh' }), drum('hh'), 'a kit voice written in full: a kit lib/kits.json knows, then the voice');
  assert.deepEqual(classifyHap({ s: 'sd:2' }), drum('sd'));
  assert.deepEqual(classifyHap({ s: 'cajon' }), { kind: 'hit', voice: null, role: 'hit', note: null });
  assert.deepEqual(classifyHap({ s: 'psaltery_bow' }), { kind: 'hit', voice: null, role: 'hit', note: null });
  assert.deepEqual(classifyHap({ s: 'mystery_bd' }), { kind: 'hit', voice: null, role: 'hit', note: null }, 'a last word that is a voice under no known kit is still a sample');
  assert.deepEqual(classifyHap({ s: 'piano', note: 48 }), { kind: 'pitched', voice: null, role: null, note: 48 });
  assert.deepEqual(classifyHap({ note: 'c3' }), { kind: 'pitched', voice: null, role: null, note: 48 });
  assert.deepEqual(classifyHap({ s: 'bd', note: 36 }), drum('bd'), 'a voice wins over a note');
  for (const v of [undefined, 7, 'bd', {}, { gain: 1 }]) assert.deepEqual(classifyHap(v), { kind: 'none', voice: null, role: null, note: null });
});
