// The editorial faces are pinned: characterOf for eight seeds and identityOf for the twenty-four archetypes must be
// byte-for-byte what they were on 2026-10-05 (test/fixtures/cast-golden.json, scripts/castgolden.mjs). A change here
// is a change to every seeded face in every world and in the editor's links; it is made on purpose or not at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { characterOf, identityOf, ARCHETYPE_NAMES } from 'limner';
import { seed } from '../web/visual/kit.mjs';
import { prng } from '../lib/random.mjs';
const golden = JSON.parse(readFileSync(new URL('./fixtures/cast-golden.json', import.meta.url), 'utf8'));
test('the editorial crowd is what it was', () => {
  for (const g of golden.crowd) { const s = {}; seed(s, prng(g.seed)); assert.deepEqual(JSON.parse(JSON.stringify(characterOf(s, g.role, (g.seed % 4) / 3))), g.character, `seed ${g.seed}`); }
});
test('the editorial cast is what it was', () => {
  const s = {}; seed(s, prng(7));
  assert.deepEqual(JSON.parse(JSON.stringify(ARCHETYPE_NAMES.map((name, i) => identityOf(s, name, i)))), golden.cast);
});
