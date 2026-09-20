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

const deepFrozen = (o) => (o && typeof o === 'object' ? Object.isFrozen(o) && Object.values(o).every(deepFrozen) : true);

test('song() keeps each layer\'s structural plan: plain frozen data, after the structural axes', async () => {
  const g = await ready;
  const ir = g.song({ cps: .5, key: 'C:minor', seed: 3 }, [
    g.section('a', 2, {
      drums: { density: .3, sounds: { bd: 'timpani' } },
      bass: { notes: '0 4', density: .9 },
      melody: { notes: '0 2', phrase: 2, follow: true },
      melody2: { follow: 'tones' },
      pad: { arp: 'up', density: .8 },
      fx: { riser: 9, impact: true },
      perc: { sound: 'cajon' },
      sample: { sound: 'loop', bars: 2, slices: 4 },
      raw: {},
    }),
  ]).strudel;
  const L = ir.sections[0].layers;
  assert.deepEqual(L.drums.plan.voices, ['bd', 'sd'], 'density .3: bd and sd sound, hats do not');
  assert.deepEqual(Object.keys(L.drums.plan.grids), ['bd', 'sd']);
  assert.match(L.drums.plan.grids.bd, /^[x.]{16}$/);
  assert.deepEqual(L.drums.plan.bars, { bd: 1, sd: 1 });
  assert.deepEqual(L.bass.plan, { line: '0 4', grid: 'x.x.x.x.x.x.x.x.', bars: 1, octave: 2 }, 'a written line stays; density .9 puts the grid on every half-beat');
  assert.deepEqual(L.melody.plan, { line: '0 2', phrase: 2, follow: 'chords', octave: 4 });
  assert.equal(L.melody2.plan.follow, 'tones');
  assert.equal(typeof L.melody2.plan.line, 'string', 'the seeded line is recorded as text');
  assert.deepEqual(L.pad.plan, { tones: 4, octave: 4, arp: 'up' });
  assert.deepEqual(L.fx.plan, { riser: 2, impact: 'bd' }, 'the riser is clipped to the section');
  assert.deepEqual(L.perc.plan, { grid: 'x...x...x...x...', bars: 1 });
  assert.deepEqual(L.sample.plan, { bars: 2, slices: 4, takes: ['loop'] });
  assert.equal(L.raw.plan, null);
  for (const [name, l] of Object.entries(L)) {
    if (!l.plan) continue;
    assert.ok(deepFrozen(l.plan), `${name}.plan is frozen at every depth`);
    assert.deepEqual(JSON.parse(JSON.stringify(l.plan)), l.plan, `${name}.plan is plain data`);
  }
  assert.throws(() => { L.drums.plan.voices.push('x'); }, TypeError);
  assert.equal(L.drums.pattern.plan, undefined, 'the orbit() wrapper does not carry it: song() copies it before');
});

test('a plan holds no pattern: a bass line written as a pattern is recorded as null', async () => {
  const g = await ready;
  const ir = g.song({}, [g.section('a', 1, { bass: { notes: g.mini('0 4') } })]).strudel;
  assert.equal(ir.sections[0].layers.bass.plan.line, null);
});

test('a layer registered without a plan gets null', async () => {
  const g = await ready;
  g.strudelLib.registerLayer('blip', () => g.s('hh*4'));
  const ir = g.song({}, [g.section('a', 1, { blip: {} })]).strudel;
  assert.equal(ir.sections[0].layers.blip.plan, null);
});
