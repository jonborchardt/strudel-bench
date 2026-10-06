// The interface is strong because Node enforces it, not because we agreed to be careful. `exports` in package.json is
// the whole mechanism: the two declared entries resolve and everything else is refused, so a consumer cannot quietly
// start depending on an internal module and strand it there.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('limner resolves, and a deep import into it does not', async () => {
  const m = await import('limner');
  assert.equal(typeof m.portraitOps, 'function', 'the published entry works');
  await assert.rejects(() => import('limner/portrait.mjs'), (e) => {
    assert.equal(e.code, 'ERR_PACKAGE_PATH_NOT_EXPORTED', `expected the exports map to refuse it, got ${e.code}: ${e.message}`);
    return true;
  });
});

test('the second entry is reachable because it is declared', async () => {
  const p = await import('limner/primitives');
  assert.equal(typeof p.tracePath, 'function');
});

test('the internals stay internal: the schema and the registries are not entry points', async () => {
  for (const sub of ['limner/schema.mjs', 'limner/people.mjs', 'limner/registry.mjs', 'limner/rng.mjs', 'limner/stances.mjs']) {
    await assert.rejects(() => import(sub), (e) => {
      assert.equal(e.code, 'ERR_PACKAGE_PATH_NOT_EXPORTED', `${sub} should not be an entry point, got ${e.code}`);
      return true;
    }, sub);
  }
});

test('what the barrel publishes is the drawing surface a host needs', async () => {
  const m = await import('limner');
  for (const name of ['portraitOps', 'toSvg', 'drawOn', 'renderPortrait', 'eyeY', 'feetY', 'headBox', 'parts', 'tag', 'tagsOf', 'REGISTRIES', 'DEFAULTS', 'seed', 'rand', 'prng']) {
    assert.ok(name in m, `the barrel must publish ${name}`);
  }
});
