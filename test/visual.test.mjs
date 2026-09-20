// lib/visual.mjs: the visual score. Strict about architecture and invariants (determinism, plain data, legal slots, a
// chosen world belongs to its policy pool, the score's shape); loose about the aesthetic policy itself (which mood gets
// which world, what a mode is called), which lib/visual.json is meant to change freely.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { AXIS_NAMES } from '../lib/axes.mjs';
import { OVERLAYS } from '../lib/vocab.mjs';
import { POLICY, classifyHap, onsetsOf, meanAxes, moodOf, worldFor, castOf, composeVisual, describeVisual } from '../lib/visual.mjs';

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

// a small song with a real arc: two develop sections around a climax, one with its own tempo
const arcSong = (g, meta = {}) => g.song({ cps: .5, key: 'C:minor', seed: 3, ...meta }, [
  g.section('intro', 4, { role: 'establish', pad: { space: .8 }, drums: { density: .3 } }),
  g.section('build', 4, { role: 'develop', progression: 'i [VI VII]', drums: { density: .6 }, bass: {}, melody: { brightness: g.ramp(.3, .7) }, fx: { riser: 2 } }),
  g.section('drop', 8, { role: 'climax', bpm: 60, drums: { density: .9, level: 1.5 }, bass: { density: .8 }, melody: { density: .7 }, melody2: {}, melody3: {}, pad: { arp: 'up' }, perc: { sound: 'cajon' }, fx: { impact: true } }),
]).strudel;
const r3 = (x) => +x.toFixed(3);

test('composeVisual is deterministic plain data, with or without onsets handed in', async () => {
  const g = await ready;
  const ir = arcSong(g);
  const a = composeVisual(ir), b = composeVisual(ir, { onsets: onsetsOf(ir) }), c = composeVisual(arcSong(g));
  assert.deepEqual(a, b); assert.deepEqual(a, c);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a, 'no patterns, closures or NaN inside');
  assert.deepEqual(Object.keys(a), ['seed', 'mood', 'world', 'palette', 'cps', 'total', 'meter', 'key', 'cast', 'sections', 'peak', 'climax'], "the score's shape");
});

test('the score reads the song: meta, sections in song cycles, chords per bar, transitions, parts', async () => {
  const g = await ready;
  const s = composeVisual(arcSong(g));
  assert.equal(s.seed, 3); assert.equal(s.cps, .5); assert.equal(s.key, 'C:minor'); assert.equal(s.meter, '4/4');
  assert.deepEqual(s.sections.map((x) => x.name), ['intro', 'build', 'drop']);
  const [intro, build, drop] = s.sections;
  assert.deepEqual([intro.at, intro.until, intro.bars], [0, 4, 4]);
  assert.deepEqual([drop.at, drop.until, drop.bars, drop.cps], [8, 24, 8, .25], 'drop at 60 bpm: 8 bars span 16 song cycles at half the tempo');
  assert.equal(s.total, 24);
  assert.equal(build.chords.length, 4); assert.equal(build.chords[0], 'Cm'); assert.equal(build.chords[1], 'Ab Bb', 'a bracketed bar keeps both chords');
  assert.deepEqual([build.riser, build.impact, drop.riser, drop.impact], [2, null, 0, 'bd']);
  assert.deepEqual([intro.role, intro.dropout, intro.sweep], ['establish', 0, 0]);
  assert.deepEqual(build.parts.melody.attrs, { brightness: 'signal' }, 'a signal is named, not sampled');
  assert.deepEqual(drop.parts.drums.attrs, { density: .9 }, 'axis keys only: level and materials are not attrs');
  assert.equal(drop.parts.drums.level, 1.5); assert.equal(intro.parts.drums.level, 1);
  assert.ok(drop.parts.drums.onsets > intro.parts.drums.onsets);
  assert.deepEqual(drop.parts.drums.plan.voices, ['bd', 'sd', 'hh', 'oh', 'cp']);
});

test('energy is normalised to the loudest section; peak and climax are named separately, never reconciled', async () => {
  const g = await ready;
  const s = composeVisual(arcSong(g));
  assert.equal(Math.max(...s.sections.map((x) => x.energy)), 1);
  assert.equal(s.peak, 'drop'); assert.equal(s.climax, 'drop');
  const quiet = composeVisual(g.song({}, [g.section('a', 2, { role: 'climax', pad: { density: .2 } }), g.section('b', 2, { drums: { density: .9 } })]).strudel);
  assert.equal(quiet.peak, 'b'); assert.equal(quiet.climax, 'a', 'a climax that is not the loudest section is reported as such, not fixed');
  const none = composeVisual(g.song({}, [g.section('a', 1, { drums: {} })]).strudel);
  assert.equal(none.climax, null);
  const empty = composeVisual(g.song({}, []).strudel);
  assert.deepEqual([empty.sections, empty.peak, empty.climax, empty.cast], [[], null, null, {}]);
  const silent = composeVisual(g.song({}, [g.section('a', 1, { raw: {} })]).strudel);
  assert.equal(silent.sections[0].energy, 0, 'no onsets anywhere: 0, not NaN');
});

test("mood: the overlay the song leans toward, neutral at the baseline; the world always belongs to the mood's policy pool", async () => {
  const g = await ready;
  const om = Object.fromEntries(Object.entries(OVERLAYS.ominous).map(([a, d]) => [a, r3(.5 + d)])); // the overlay applied to the baseline
  const ominous = composeVisual(g.song({}, [g.section('a', 4, { drums: om, bass: om, pad: om })]).strudel);
  assert.equal(ominous.mood, 'ominous');
  assert.ok((POLICY.moods.ominous ?? POLICY.moods.neutral).includes(ominous.world));
  const flat = composeVisual(g.song({}, [g.section('a', 4, { drums: {}, bass: {} })]).strudel);
  assert.equal(flat.mood, 'neutral');
  assert.ok(POLICY.moods.neutral.includes(flat.world));
  assert.equal(moodOf(meanAxes(g.song({}, []).strudel)), 'neutral', 'no parts: the baseline');
  assert.equal(moodOf(meanAxes(g.song({}, [g.section('a', 1, { drums: { brightness: .52 } })]).strudel)), 'neutral', 'a lean under the threshold is no mood');
});

test("worldFor: seeds reach every world of a pool, a seed always picks the same one, a mood with no row takes neutral's", () => {
  const policy = { moods: { neutral: ['a', 'b', 'c'], sad: ['d'] } };
  const picks = new Set(Array.from({ length: 32 }, (_, i) => worldFor('neutral', i + 1, policy)));
  assert.deepEqual([...picks].sort(), ['a', 'b', 'c']);
  assert.equal(worldFor('neutral', 5, policy), worldFor('neutral', 5, policy));
  assert.equal(worldFor('sad', 9, policy), 'd');
  assert.ok(['a', 'b', 'c'].includes(worldFor('no-such-mood', 1, policy)));
  for (const m of Object.keys(POLICY.moods)) for (const seed of [1, 2, 3]) assert.ok(POLICY.moods[m].includes(worldFor(m, seed)), `${m}/${seed} picks inside its pool`);
});

test('meanAxes weights by bars and skips signals; the palette is the means renamed by policy plus a temperature the policy names', async () => {
  const g = await ready;
  const ir = g.song({ key: 'D:phrygian' }, [g.section('a', 1, { drums: { brightness: .2 } }), g.section('b', 3, { drums: { brightness: .6, weight: g.ramp(0, 1) } })]).strudel;
  const m = meanAxes(ir);
  assert.ok(Math.abs(m.brightness - .5) < 1e-9, '(.2*1 + .6*3) / 4');
  assert.equal(m.weight, .5, 'a signal does not count; the baseline stands');
  assert.deepEqual(Object.keys(m), AXIS_NAMES);
  const s = composeVisual(ir);
  assert.deepEqual(Object.keys(s.palette), ['temperature', ...Object.keys(POLICY.palette)]);
  assert.ok(Object.values(POLICY.temperature).includes(s.palette.temperature));
  for (const [name, axis] of Object.entries(POLICY.palette)) assert.equal(s.palette[name], r3(m[axis]), `palette.${name} reads the mean ${axis}`);
  assert.equal(composeVisual(g.song({ key: 'C:nosuchmode' }, []).strudel).palette.temperature, POLICY.temperature.default);
});

test('castOf: slots by kind in first-appearance order, capacities per world, overflow to grain, an unknown kind is grain, drum voices by name with roles', async () => {
  const g = await ready;
  const ir = arcSong(g);
  const policy = { voices: { bd: 'thump', sd: 'crack', hh: 'tick', oh: 'tick', cp: 'crack' },
    kinds: { drums: ['impulse', 'grain'], bass: ['ground', 'grain'], melody: ['line', 'counter', 'grain'], pad: ['field', 'grain'], fx: ['transition', 'grain'], perc: ['grain'] },
    worlds: { one: { slots: { impulse: 1, ground: 1, line: 1, counter: 1, field: 1, transition: 1 } }, wide: { slots: { impulse: 1, ground: 1, line: 2, counter: 2, field: 1, transition: 1 } }, tight: { slots: {} } } };
  const one = castOf(ir, 'one', policy);
  assert.deepEqual(Object.entries(one).map(([k, c]) => `${k}:${c.slot}`), ['pad:field', 'drums:impulse', 'bass:ground', 'melody:line', 'fx:transition', 'melody2:counter', 'melody3:grain', 'perc:grain']);
  assert.deepEqual(one.drums, { kind: 'drums', slot: 'impulse', voices: { bd: 'thump', sd: 'crack', hh: 'tick', oh: 'tick', cp: 'crack' } }, 'the union of voices over sections, roles from the table');
  assert.equal(one.melody2.kind, 'melody');
  const wide = castOf(ir, 'wide', policy);
  assert.deepEqual([wide.melody2.slot, wide.melody3.slot], ['line', 'counter'], 'room for two lines: the second melody takes it, the third moves down');
  assert.ok(Object.values(castOf(ir, 'tight', policy)).every((c) => c.slot === 'grain'), 'no capacity anywhere: everything is grain, nothing fails');
  g.strudelLib.registerLayer('probe', () => g.s('hh'));
  assert.equal(castOf(g.song({}, [g.section('a', 1, { probe: {} })]).strudel, 'one', policy).probe.slot, 'grain', 'an unknown kind is grain');
  // the real policy: every part lands on a slot its kind may take, inside the world's capacity
  for (const world of Object.keys(POLICY.worlds)) {
    const cast = castOf(ir, world), used = {};
    for (const [name, c] of Object.entries(cast)) {
      assert.ok((POLICY.kinds[c.kind] ?? ['grain']).includes(c.slot), `${world}: ${name} on ${c.slot}`);
      used[c.slot] = (used[c.slot] ?? 0) + 1;
    }
    for (const [slot, n] of Object.entries(used)) if (slot !== 'grain') assert.ok(n <= POLICY.worlds[world].slots[slot], `${world}: ${n} parts on ${slot}`);
  }
  const timp = castOf(g.song({}, [g.section('a', 1, { drums: { sounds: { bd: 'timpani' } } })]).strudel, Object.keys(POLICY.worlds)[0]);
  assert.deepEqual(Object.keys(timp.drums.voices), ['bd', 'sd', 'hh'], 'a voice keeps its name whatever sample plays it');
  assert.equal(timp.drums.voices.bd, POLICY.voices.bd);
});

test("describeVisual: the world with its mood and temperature, each part's slot (drum voices with roles), and where the peak is against the climax", async () => {
  const g = await ready;
  const score = composeVisual(arcSong(g)), d = describeVisual(score);
  assert.equal(d[0], `${score.world} (${score.mood}, ${score.palette.temperature})`);
  for (const [name, c] of Object.entries(score.cast)) {
    const voices = c.voices ? ` (${Object.entries(c.voices).map(([v, r]) => `${v} ${r}`).join(', ')})` : '';
    assert.ok(d.includes(`${name} → ${c.slot}${voices}`), `${name}: ${d.join(' | ')}`);
  }
  assert.equal(d.length, 2 + Object.keys(score.cast).length, 'one clause per part, between the world and the peak');
  assert.equal(d.at(-1), 'peak drop (climax)');
  const mk = (peak, climax) => ({ world: 'ink', mood: 'sad', palette: { temperature: 'cool' }, cast: {}, peak, climax });
  assert.deepEqual(describeVisual(mk('build', 'drop')), ['ink (sad, cool)', 'peak build; climax drop'], 'a diagnostic, not a lint');
  assert.deepEqual(describeVisual(mk('drop', null)), ['ink (sad, cool)', 'peak drop; no climax']);
  assert.deepEqual(describeVisual(mk(null, null)), ['ink (sad, cool)'], 'no sections: nothing to say');
});
