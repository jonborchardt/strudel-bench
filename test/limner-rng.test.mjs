// limner carries its own copies of the seeded generators, because it owns its determinism once it is a package of its
// own. Verbatim is load-bearing: `test/fixtures/layout-golden.json`, limner's cast golden and its ops golden are all
// statements about these exact bit patterns, so a "tidied" copy would move every one of them at once and the diff would
// say only that every face changed.
//
// This test lives here rather than in limner/test/ because it has to see both sides, and limner is not allowed to import
// from web/ or lib/. The host may import limner; the reverse is the boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, rand, prng, pick, clamp, lerp } from 'limner';
import { seed as kitSeed, rand as kitRand } from '../web/visual/kit.mjs';
import { prng as libPrng, pick as libPick } from '../lib/random.mjs';

const draws = (fn, n = 200) => Array.from({ length: n }, fn);

test('limner\'s rand is the host\'s rand: the same mulberry32 stream from the same seed', () => {
  const a = {}, b = {};
  seed(a, prng(7)); kitSeed(b, libPrng(7));
  assert.equal(a.rnd, b.rnd, 'the cursor starts in the same place');
  assert.deepEqual(draws(() => rand(a)), draws(() => kitRand(b)), '200 draws, identical');
});

test('limner\'s prng is the host\'s prng, for every seed a cast is built from', () => {
  for (const s of [0, 1, 2, 3, 7, 11, 99, 1000, 65535, 2 ** 31 - 1]) {
    const x = prng(s), y = libPrng(s);
    assert.deepEqual(draws(() => x()), draws(() => y()), `seed ${s}`);
  }
});

test('limner\'s pick lands on the host\'s entry, which is what keeps a seeded wardrobe stable', () => {
  const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
  for (let s = 0; s < 40; s++) assert.equal(pick(prng(s), list), libPick(libPrng(s), list), `seed ${s}`);
});

test('clamp and lerp came across unchanged, including their edges', () => {
  assert.equal(clamp(5), 1); assert.equal(clamp(-1), 0); assert.equal(clamp(0.4), 0.4);
  assert.equal(clamp(5, 0, 10), 5); assert.equal(clamp(-5, -2, 2), -2);
  assert.equal(lerp(0, 10, 0.5), 5); assert.equal(lerp(0, 10, 2), 10, 'lerp clamps t, it does not extrapolate');
  assert.equal(lerp(0, 10, -1), 0);
});
