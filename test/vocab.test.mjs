import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parsePhrase, applyDeltas } from '../lib/vocab.mjs';
import { ready } from './_scope.mjs';

test('modifiers scale, comparatives resolve, unknown words reported', () => {
  const r = parsePhrase('much heavier, a little darker, sparkly');
  assert.ok(r.deltas.weight > 0.3, 'much heavier ≈ 2× heavy.weight');
  assert.ok(Math.abs(r.deltas.brightness + 0.15) < 1e-9, 'a little darker = .5 x dark.brightness');
  assert.deepEqual(r.unknown, ['sparkly']);
});

test('less negates', () => {
  const a = parsePhrase('punchy').deltas.articulation;
  const b = parsePhrase('less punchy').deltas.articulation;
  assert.ok(a > 0 && Math.abs(a + b) < 1e-9);
});

test('collisions keep every contribution', () => {
  const r = parsePhrase('much brighter but also darker');
  const c = r.contributions.brightness;
  assert.equal(c.length, 2);
  assert.ok(c.some((x) => x.delta > 0) && c.some((x) => x.delta < 0));
  assert.ok(Math.abs(r.deltas.brightness - (c[0].delta + c[1].delta)) < 1e-9);
});

test('applyDeltas reports saturation and defaults missing axes to 0.5', () => {
  const out = applyDeltas({ brightness: .95 }, { brightness: .4, weight: .2 });
  assert.deepEqual(out.brightness, { from: .95, requestedDelta: .4, appliedDelta: .05, to: 1, saturated: true });
  assert.equal(out.weight.from, .5);
  assert.equal(out.weight.saturated, false);
  assert.ok(Math.abs(out.weight.to - .7) < 1e-9);
});

test('overlay words are tagged overlay:true, control-vocabulary words overlay:false', () => {
  const sad = parsePhrase('sad').contributions.brightness.find((c) => c.key === 'sad');
  assert.equal(sad.overlay, true);
  const punchy = parsePhrase('punchy').contributions.articulation.find((c) => c.key === 'punchy');
  assert.equal(punchy.overlay, false);
});

// Last on purpose: this test drives loadVocab(), which reassigns the module-level DESCRIPTORS/OVERLAYS
// bindings in lib/vocab.mjs. It restores the real on-disk tables before returning so it leaves no residue
// for tests earlier in this file (node:test runs a file's top-level tests in declaration order).
test('strudelLib.DESCRIPTORS/OVERLAYS are live getters that reflect loadVocab', async () => {
  const scope = await ready;
  const { strudelLib } = scope;
  assert.equal(strudelLib.DESCRIPTORS.punchy.articulation, 0.4);

  await strudelLib.loadVocab(async (f) => (f === 'descriptors.json' ? { zzz: { weight: 0.1 } } : {}));
  assert.equal(strudelLib.DESCRIPTORS.zzz.weight, 0.1);

  const libDir = fileURLToPath(new URL('../lib/', import.meta.url));
  await strudelLib.loadVocab(async (f) => JSON.parse(readFileSync(path.join(libDir, f), 'utf8')));
  assert.equal(strudelLib.DESCRIPTORS.zzz, undefined);
  assert.equal(strudelLib.DESCRIPTORS.punchy.articulation, 0.4);
});

test('harmony words are consumed as states, not deltas or unknowns', () => {
  const r = parsePhrase('happy, relative major, pop');
  assert.deepEqual(r.unknown, []);
  assert.deepEqual(r.harmony, [{ word: 'major', kind: 'mode', value: 'major', relative: true }, { word: 'pop', kind: 'progression', value: 'I V vi IV' }]);
  assert.ok(r.deltas.brightness > 0, 'axis overlay still applied');
  assert.deepEqual(parsePhrase('relative').harmony, [{ word: 'relative', kind: 'relative' }]);
  assert.deepEqual(parsePhrase('much dorian').harmony, [{ word: 'dorian', kind: 'mode', value: 'dorian', relative: false }], 'modifiers ignored on harmony words');
});

test('describeAxes reads axis values back as the words that would have set them', async () => {
  const { describeAxes } = await import('../lib/vocab.mjs');
  assert.deepEqual(describeAxes({ brightness: .2, density: .9, space: .5, sound: 'piano' }), ['dark', 'very busy']);
  assert.deepEqual(describeAxes({ brightness: .55 }), [], 'near the baseline says nothing');
  for (const w of describeAxes({ weight: .9, groove: .8, width: .1 })) assert.ok(/heavy|massive|swung|narrow/.test(w), w);
});
