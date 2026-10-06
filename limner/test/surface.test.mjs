// The published surface, exercised the way the README says to use it. If this file stops compiling, the README is wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { person, archetype, dress, renderPortrait, portraitOps, toSvg, drawOn, eyeY, feetY, CASTS, PACKS, CAST_MODULES, STANCES, parts, buildOf, ANATOMY } from '../index.mjs';
import { ctxStub } from './_stub.mjs';

test('the README example runs, and the same seed gives the same person', () => {
  const a = person({ cast: 'dwarves', seed: 7 }), b = person({ cast: 'dwarves', seed: 7 });
  assert.deepEqual(a, b, 'the sugar is deterministic in its seed');
  assert.notDeepEqual(a, person({ cast: 'dwarves', seed: 8 }), 'and another seed is another person');
  const svg = renderPortrait(a); // a character is already drawable parameters; it needs no dressing
  assert.match(svg, /^<svg/, 'and it draws');
  assert.ok(!/NaN|Infinity|undefined/.test(svg), 'with no holes in it');
});

test('every cast can be asked for a person and a named archetype, and both draw', () => {
  for (const name of Object.keys(CASTS)) {
    assert.match(renderPortrait(person({ cast: name, seed: 3 })), /^<svg/, `${name} draws a crowd member`);
    const who = archetype({ cast: name, seed: 3, name: CASTS[name].archetypeNames[0] });
    const svg = renderPortrait(dress(who, {})); // an identity is a person plus a wardrobe: dress picks the occasion
    assert.match(svg, /^<svg/, `${name} draws its first archetype`);
    assert.ok(!/NaN/.test(svg), `${name} draws no NaN`);
  }
});

test('an unknown cast name falls back to the editorial one rather than throwing', () => {
  assert.ok(person({ cast: 'wizards', seed: 1 }), 'a name nobody registered still gives a person');
  assert.deepEqual(person({ cast: 'wizards', seed: 1 }), person({ cast: 'editorial', seed: 1 }));
});

test('ops are the output type, and both renderers read the same list', () => {
  const ops = portraitOps(person({ seed: 5 }));
  assert.ok(Array.isArray(ops) && ops.length > 50, 'a list of ops');
  assert.match(toSvg(ops), /^<svg/, 'one renderer prints them');
  const ctx = ctxStub();
  drawOn(ctx, ops);
  assert.equal(ctx.calls.save, ctx.calls.restore, 'the other paints them, balanced');
  assert.ok(ctx.calls.fill > 10);
});

test('the measurements a host frames and stands a figure on', () => {
  const p = person({ seed: 5 });
  assert.equal(typeof eyeY(p), 'number');
  assert.equal(typeof feetY(p), 'number');
  assert.ok(eyeY(p) < feetY(p), 'the eyes are above the feet');
});

test('the registries are the only way to the parts, and a build comes from the published table', () => {
  assert.equal(Object.keys(CASTS).length, Object.keys(CAST_MODULES).length);
  assert.ok(Object.keys(PACKS).length >= 10);
  assert.ok(parts('top', { any: ['everyday'] }).length > 0, 'a pool query returns parts');
  assert.ok(!parts('top', { any: ['everyday'] }).some((n) => parts('top', { any: ['only:undead'] }).includes(n) && !parts('top', { any: ['everyday'] }).includes(n)), 'quarantine holds');
  for (const race of Object.keys(ANATOMY)) assert.ok(buildOf(race).trunk > 0, `${race} solves to a build`);
  assert.ok(STANCES.editorial.directFrontal, 'and the stances are published');
});
