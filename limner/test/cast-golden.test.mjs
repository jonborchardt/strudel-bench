// The editorial faces are pinned: characterOf for eight seeds and identityOf for the twenty-four archetypes must be
// byte-for-byte what they were on 2026-10-05 (test/fixtures/cast-golden.json). A change here is a change to every seeded
// face in every world and in the editor's links; it is made on purpose or not at all (UPDATE_GOLDEN=1, then read the diff).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { characterOf, identityOf, ARCHETYPE_NAMES } from '../index.mjs';
import { seed, prng } from '../rng.mjs';
const ROLES = ['establish', 'develop', 'climax', 'release'];
test('the editorial crowd and cast are what they were', () => {
  const crowd = [1, 2, 3, 7, 11, 42, 99, 1234].map((n) => { const s = {}; seed(s, prng(n)); return { seed: n, role: ROLES[n % 4], character: characterOf(s, ROLES[n % 4], (n % 4) / 3) }; });
  const s = {}; seed(s, prng(7));
  const now = JSON.parse(JSON.stringify({ crowd, cast: ARCHETYPE_NAMES.map((name, i) => identityOf(s, name, i)) })), url = new URL('./fixtures/cast-golden.json', import.meta.url);
  if (process.env.UPDATE_GOLDEN) writeFileSync(url, JSON.stringify(now));
  assert.deepEqual(now, JSON.parse(readFileSync(url, 'utf8')));
});
