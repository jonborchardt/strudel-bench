// limner/casts/elves.mjs + limner/parts/elf.mjs: the third theme, added to prove the character system is
// done: a kind of person is a part pack, a cast with a build and a row in lib/visual.json, nothing else touched. What
// it promises: the elf parts are quarantined (`only:elf`) and every one draws; the cast is slight and long-legged by
// its build (ANATOMY, cast.mjs), narrow-faced, long-necked, beardless because its beard pool is empty (the fallback,
// not a rule), pointed-eared
// in every shot; with the theme on the tableau casts the elves in editorial shots and poses, deterministically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import tableau, { TEMPLATES as EDITORIAL } from '../web/visual/tableau.mjs';
import { CASTS, CAST_MODULES, PACKS } from 'limner';
const ELVES = CASTS.elves, { ELF_EARS } = CAST_MODULES.elves, { ELF } = PACKS.elf;
import { THEMES } from '../web/visual/themes.mjs';
import { identityFrom, characterFrom, dress, ARCHETYPE_NAMES } from 'limner';
import { portraitOps, toSvg, drawOn, parts, tagsOf, feetY, headBox } from 'limner';
import { composeVisual, describeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid } from './_visual.mjs';
import { seed } from '../web/visual/kit.mjs';
import { prng } from '../lib/random.mjs';

const clean = (o) => !/NaN|undefined|Infinity/.test(JSON.stringify(o));
const draws = (o, what) => { const ops = portraitOps(o); assert.ok(ops.length > 20 && clean(ops), what); const ctx = ctxStub(); drawOn(ctx, ops); assert.equal(ctx.calls.save, ctx.calls.restore, `${what} restores every clip`); assert.ok(toSvg(ops).startsWith('<svg')); return ops; };
const song = (g, visual, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' } }),
]).strudel;
const THEMED = { world: 'tableau', theme: 'elves' };
const KIND = { makeup: 'makeup', hats: 'hat', tops: 'top', jackets: 'jacket' };
const WEAR = { makeup: (n) => ({ makeup: [n] }), hats: (n) => ({ hat: { style: n, color: '#b9b8b3', accent: '#405547' } }), tops: (n) => ({ top: { style: n, color: '#405547' } }), jackets: (n) => ({ jacket: { style: n, color: '#2f4a3a' } }) };

test('the elf pack is quarantined and draws: no part of it comes without only:elf, every one does when asked, each draws on the plain figure', () => {
  assert.ok(ELF.makeup.length >= 1 && ELF.hats.length >= 1 && ELF.tops.length >= 1 && ELF.jackets.length >= 1);
  assert.ok(!Object.values(ELF).flat().some((n) => /ear/i.test(n)), 'the ears are not a part: a pointed ear is the portrait\'s own ears.pointed, drawn as the ear, not a shard laid over a round one');
  for (const [kind, names] of Object.entries(ELF)) for (const n of names) {
    assert.ok(tagsOf(KIND[kind], n).has('only:elf'), `${n} is tagged only:elf`);
    assert.ok(!parts(KIND[kind]).includes(n) && !parts(KIND[kind], { any: ['only:dwarf', 'only:undead', 'everyday', 'era:80s'] }).includes(n), `${n} reaches no other cast's pool`);
    assert.ok(parts(KIND[kind], { any: ['only:elf'] }).includes(n), `${n} comes when asked for`);
    draws(WEAR[kind](n), n);
  }
  const tips = (ops) => ops.filter((o) => o.ear).map((o) => Math.max(...o.d.match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2 === 0)));
  const wide = portraitOps({ ears: { pointed: 1 }, face: { width: 190 } }), narrow = portraitOps({ ears: { pointed: 1 }, face: { width: 140 } });
  assert.equal(tips(wide).length, 2, 'two ears, each one blade');
  assert.ok(Math.max(...tips(wide)) > Math.max(...tips(narrow)), 'and they follow the face\'s width, so they sit where the ears sit on any head');
});

test('the elves cast: six archetypes, slight and long-legged by the build, narrow-faced and long-necked, beardless because the pool is empty, pointed-eared in every shot', () => {
  const s = {}; seed(s, prng(7));
  assert.equal(ELVES.name, 'elves'); assert.equal(ELVES.archetypeNames.length, 6); assert.ok(ELVES.archetypeNames.every((n) => !ARCHETYPE_NAMES.includes(n)));
  assert.ok(ELVES.build.legs > ELVES.build.trunk + 0.08 && ELVES.build.shoulders < 0.95 && ELVES.build.hands < 1, 'the build is an elf: taller than a human with all of it in the leg, narrow shoulders, slight hands');
  assert.deepEqual(ELVES.pools.beards, [], 'no beard pool: beardless by the empty-pool fallback, which is the Review Focus pin exercised by a real cast');
  assert.ok(!ELVES.pools.hair.some((h) => tagsOf('hair', h).has('overEars')) && ELVES.pools.hair.length > 15, 'and the hair is every everyday style but the two whose mass hangs over the ears: on this cast the ears are the point');
  const cast = ELVES.archetypeNames.map((n, i) => identityFrom(ELVES, s, n, i));
  assert.equal(new Set(cast.map((c) => JSON.stringify(c.base))).size, cast.length, 'no two alike');
  for (const c of cast) {
    assert.ok(c.base.build && c.base.build.legs > c.base.build.trunk, `${c.name}: built long-legged`);
    assert.ok(c.base.face.width <= 152 && c.base.neck.height >= 92 && c.base.body.width <= 0.92, `${c.name}: narrow face, long neck, slight body`);
    assert.equal(c.base.facialHair.style, 'none', `${c.name}: beardless`);
    const p = dress(c); const ops = draws(p, c.name);
    assert.ok(p.ears.pointed >= ELF_EARS[0], `${c.name}: the cast's signature, ears pointed by its own rule`);
    assert.equal(ops.filter((o) => o.ear).length, 2, `${c.name}: and both are drawn as one blade each`);
    const H = feetY(p) - headBox(p).top; assert.ok(H > 990 && H < 1050, `${c.name}: stands taller than a human (958 crown to floor) and all of it in the leg (${H.toFixed(0)})`);
    assert.ok(ELVES.costumes.includes(c.home.costume));
  }
  const crowd = Array.from({ length: 12 }, (_, i) => characterFrom(ELVES, s, ['establish', 'develop', 'climax', 'release'][i % 4], (i % 4) / 3));
  for (const k of crowd) assert.ok(clean(portraitOps(k)) && k.facialHair.style === 'none' && k.ears.pointed >= ELF_EARS[0] && portraitOps(k).filter((o) => o.ear).length === 2 && ELVES.pools.tops.includes(k.top.style) && ELVES.skins.includes(k.skin), 'a random elf is beardless, pointed-eared, pale, in the cast\'s tops');
});

test('the ears are a rule, not a number: every elf is pointed, no two of them alike, an archetype may pin its own, and the same seed draws the same ears', () => {
  const of = (sd) => { const s = {}; seed(s, prng(sd)); return ELVES.archetypeNames.map((n, i) => identityFrom(ELVES, s, n, i)); };
  const cast = of(7), vals = cast.map((c) => c.base.ears.pointed);
  assert.ok(ELF_EARS[0] > 0.5 && ELF_EARS[1] <= 1 && ELF_EARS[0] < ELF_EARS[1], 'the rule is a range, and its floor still reads as an elf');
  for (const c of cast) assert.ok(c.base.ears.pointed >= ELF_EARS[0] && c.base.ears.pointed <= ELF_EARS[1], `${c.name}: ${c.base.ears.pointed} inside the cast's range`);
  assert.ok(new Set(vals).size >= 4, `six elves, ${new Set(vals).size} different ears: the rule draws, it does not pin`);
  assert.equal(cast.find((c) => c.name === 'moonsinger').base.ears.pointed, 1, 'and an archetype that pins its own wins over the rule');
  assert.deepEqual(of(7).map((c) => c.base.ears.pointed), vals, 'the same seed draws the same ears');
  assert.notDeepEqual(of(8).map((c) => c.base.ears.pointed), vals, 'another seed draws others');
  const c = {}; seed(c, prng(3)); const crowd = Array.from({ length: 12 }, () => characterFrom(ELVES, c));
  assert.ok(new Set(crowd.map((k) => k.ears.pointed)).size >= 8, 'and a random elf draws its own too');
  for (const k of crowd) assert.ok(k.ears.pointed >= ELF_EARS[0] && k.ears.pointed <= ELF_EARS[1]);
});

test('the theme: the song names it, the tableau casts the elves and plans only editorial shots, deterministically, with no clock or randomness of its own', async () => {
  const g = await ready;
  const score = composeVisual(song(g, THEMED));
  assert.equal(score.theme, 'elves'); assert.match(describeVisual(score).join(' · '), /theme elves/);
  assert.equal(THEMES.elves.templates, undefined); assert.deepEqual(THEMES.elves.cast, ELVES.archetypeNames);
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = runWorld(tableau, song(g, THEMED), 8), s = p.state, ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 30 && ctx.calls.save === ctx.calls.restore);
    assert.deepEqual(s.cast.map((c) => c.name), ELVES.archetypeNames);
    assert.ok(s.cast.every((c) => c.base.build.legs > c.base.build.trunk && c.base.facialHair.style === 'none' && c.base.ears.pointed >= ELF_EARS[0]), 'every one of them is built long-legged, beardless and pointed-eared, in every shot: it is on the person, not the styling');
    assert.ok(s.plan.flat().every((x) => EDITORIAL[x.tpl]), 'every shot is an editorial template');
    // over a song long enough to cast most of them: everyone who owns a vine wears it in every shot and every mutation
    const big = runWorld(tableau, g.song({ cps: .5, key: 'C:minor', seed: 5, visual: THEMED }, [
      g.section('a', 16, { role: 'establish', drums: { density: .3 } }), g.section('b', 16, { role: 'develop', drums: { density: .6 }, melody: { notes: '0 2' } }), g.section('c', 16, { role: 'climax', drums: { density: 1 }, bass: {} }), g.section('d', 16, { role: 'release', pad: {} }),
    ]).strudel, 4).state;
    const worn = big.plan.flat().flatMap((x) => x.alts.flatMap((alt) => alt.map((st, i) => [big.cast[x.ids[i]], st]))).filter(([c]) => Array.isArray(c.home.makeup));
    assert.ok(worn.length > 0 && worn.every(([c, st]) => c.home.makeup.every((m) => st.makeup.includes(m)) && st.makeup.every((m) => typeof m === 'string')), 'a list-valued home makeup (an elf\'s vine) is the cast\'s face: in every shot and every mutation, under whatever paint the phase adds');
    assert.ok(worn.length >= 4 && big.plan.flat().length > 10, 'and the long song casts enough of them to mean it');
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'plain data');
  } finally { for (const u of undo) u(); }
  const a = JSON.stringify(runWorld(tableau, song(g, THEMED), 4).state), b = JSON.stringify(runWorld(tableau, song(g, THEMED), 4).state);
  assert.equal(a, b); assert.notEqual(a, JSON.stringify(runWorld(tableau, song(g, { world: 'tableau', theme: 'dwarves' }), 4).state), 'another cast is another state');
});
