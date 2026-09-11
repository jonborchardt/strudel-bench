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
test('strudleLib.DESCRIPTORS/OVERLAYS are live getters that reflect loadVocab', async () => {
  const scope = await ready;
  const { strudleLib } = scope;
  assert.equal(strudleLib.DESCRIPTORS.punchy.articulation, 0.4);

  await strudleLib.loadVocab(async (f) => (f === 'descriptors.json' ? { zzz: { weight: 0.1 } } : {}));
  assert.equal(strudleLib.DESCRIPTORS.zzz.weight, 0.1);

  const libDir = fileURLToPath(new URL('../lib/', import.meta.url));
  await strudleLib.loadVocab(async (f) => JSON.parse(readFileSync(path.join(libDir, f), 'utf8')));
  assert.equal(strudleLib.DESCRIPTORS.zzz, undefined);
  assert.equal(strudleLib.DESCRIPTORS.punchy.articulation, 0.4);
});
