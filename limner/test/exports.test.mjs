// The interface is strong because Node enforces it, not because we agreed to be careful. `exports` in package.json is
// the whole mechanism: the two declared entries resolve and everything else is refused, so a consumer cannot quietly
// start depending on an internal module and strand it there.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('limner resolves', async () => {
  assert.equal(typeof (await import('limner')).portraitOps, 'function', 'the published entry works');
});

test('the second entry is reachable because it is declared', async () => {
  const p = await import('limner/primitives');
  assert.equal(typeof p.tracePath, 'function');
});

test('the internals stay internal: a deep import is refused', async () => {
  for (const sub of ['limner/portrait.mjs', 'limner/schema.mjs', 'limner/people.mjs', 'limner/registry.mjs', 'limner/rng.mjs', 'limner/stances.mjs']) {
    await assert.rejects(() => import(sub), (e) => {
      assert.equal(e.code, 'ERR_PACKAGE_PATH_NOT_EXPORTED', `${sub} should not be an entry point, got ${e.code}`);
      return true;
    }, sub);
  }
});
