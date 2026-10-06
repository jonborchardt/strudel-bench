// web/visual/casts/dwarves.mjs + web/visual/parts/dwarf.mjs: the second theme, and the proof the character system is
// general: a kind of person is a part pack, a cast with a build and a row in lib/visual.json, on the tableau's own
// dance. What it promises: the dwarf parts are quarantined (`only:dwarf`) and every one draws; with the theme on the
// tableau casts the dwarves, each short and broad by the cast's build, in editorial shots and poses, deterministically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import tableau, { TEMPLATES as EDITORIAL } from '../web/visual/tableau.mjs';
import DWARVES from '../web/visual/casts/dwarves.mjs';
import { DWARF } from '../web/visual/parts/dwarf.mjs';
import { THEMES } from '../web/visual/themes.mjs';
import { identityFrom, characterFrom, dress, ARCHETYPE_NAMES } from '../web/visual/cast.mjs';
import { portraitOps, toSvg, drawOn, parts, tagsOf, feetY, HAT_CROWN } from '../web/visual/portrait.mjs';
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
const THEMED = { world: 'tableau', theme: 'dwarves' };
const KIND = { beards: 'facialHair', hats: 'hat', tops: 'top', jackets: 'jacket', marks: 'marks' };
const WEAR = { beards: (n) => ({ facialHair: { style: n } }), hats: (n) => ({ hat: { style: n, color: '#8d939a', accent: '#5a4634' } }), tops: (n) => ({ top: { style: n, color: '#8d939a' } }), jackets: (n) => ({ jacket: { style: n, color: '#5a4634' } }), marks: (n) => ({ marks: [n] }) };

test('the dwarf pack is quarantined and draws: no part of it comes without only:dwarf, every one does when asked, each draws on the plain figure', () => {
  assert.ok(DWARF.beards.length >= 2 && DWARF.hats.length >= 2 && DWARF.tops.length >= 1 && DWARF.jackets.length >= 1 && DWARF.marks.length >= 1);
  for (const [kind, names] of Object.entries(DWARF)) for (const n of names) {
    assert.ok(tagsOf(KIND[kind], n).has('only:dwarf'), `${n} is tagged only:dwarf`);
    assert.ok(!parts(KIND[kind]).includes(n) && !parts(KIND[kind], { all: ['everyday'] }).includes(n), `${n} reaches no plain or everyday pool`);
    assert.ok(parts(KIND[kind], { any: ['only:dwarf'] }).includes(n), `${n} comes when asked for`);
    draws(WEAR[kind](n), n);
  }
  assert.ok(HAT_CROWN.hornlessHelm > 100 && HAT_CROWN.hornlessHelm < 140, 'the helm sits on the skull and the hair is cut under it');
  const s = {}; seed(s, prng(3));
  for (let i = 0; i < 8; i++) assert.equal(characterFrom({ ...DWARVES, pools: { ...DWARVES.pools, beards: [] } }, s).facialHair.style, 'none', 'an empty beard pool falls back to none'); // the Review Focus pin: no crash, the default part
});

test('the dwarves cast: eight archetypes, each broad, short-necked and built short, bearded, drawn from the editorial families and the dwarf wardrobe', () => {
  const s = {}; seed(s, prng(7));
  assert.equal(DWARVES.name, 'dwarves'); assert.equal(DWARVES.archetypeNames.length, 8); assert.ok(DWARVES.archetypeNames.every((n) => !ARCHETYPE_NAMES.includes(n)), 'none of them is an editorial archetype');
  assert.ok(DWARVES.build.legs < 0.7 && DWARVES.build.shoulders > 1.05 && DWARVES.build.trunk > DWARVES.build.legs + 0.2 && DWARVES.build.head > 0.9, 'the build is a dwarf: short legs under a long broad torso, and a near-human head on all of it (1:6 of four and a half foot)');
  const cast = DWARVES.archetypeNames.map((n, i) => identityFrom(DWARVES, s, n, i));
  assert.equal(new Set(cast.map((c) => JSON.stringify(c.base))).size, cast.length, 'no two alike');
  for (const c of cast) {
    assert.ok(c.base.build && c.base.build.legs < 0.7, `${c.name}: built short`);
    assert.ok(c.base.face.width >= 176 && c.base.neck.height <= 50 && c.base.body.width >= 1.25, `${c.name}: broad face, short neck, wide body`);
    assert.ok(c.base.facialHair.style !== 'none', `${c.name}: bearded`);
    const p = dress(c); draws(p, c.name);
    assert.ok(feetY(p) < 950, `${c.name}: stands short (feet at ${feetY(p)})`);
    assert.ok(DWARVES.costumes.includes(c.home.costume), `${c.name}: dressed from the cast's wardrobe`);
  }
  const crowd = Array.from({ length: 12 }, (_, i) => characterFrom(DWARVES, s, ['establish', 'develop', 'climax', 'release'][i % 4], (i % 4) / 3));
  for (const k of crowd) { assert.ok(clean(portraitOps(k)) && DWARVES.pools.tops.includes(k.top.style) && (k.hat.style === 'none' || parts('hat', { any: ['only:dwarf'] }).includes(k.hat.style)), 'a random dwarf wears the cast\'s tops and hats'); }
});

test('the theme: the song names it, the score carries it, the tableau casts the dwarves and plans only editorial shots and poses, deterministically, with no clock or randomness of its own', async () => {
  const g = await ready;
  const score = composeVisual(song(g, THEMED));
  assert.equal(score.theme, 'dwarves'); assert.match(describeVisual(score).join(' · '), /theme dwarves/);
  assert.equal(THEMES.dwarves.templates, undefined, 'the editorial dance: no templates of its own, the tableau\'s fallbacks take over'); assert.equal(THEMES.dwarves.styling, undefined); assert.deepEqual(THEMES.dwarves.cast, DWARVES.archetypeNames);
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = runWorld(tableau, song(g, THEMED), 8), s = p.state, ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 30 && ctx.calls.save === ctx.calls.restore);
    assert.equal(s.theme, 'dwarves');
    assert.deepEqual(s.cast.map((c) => c.name), DWARVES.archetypeNames);
    assert.ok(s.cast.every((c) => c.base.build.legs < 0.7), 'every identity carries the build');
    const all = s.plan.flat();
    assert.ok(all.length >= 2 && all.every((x) => EDITORIAL[x.tpl]), 'every shot is an editorial template: ' + all.map((x) => x.tpl).join(' '));
    const beaded = all.flatMap((x) => x.alts.flatMap((alt) => alt.map((st, i) => [s.cast[x.ids[i]], st]))).filter(([c]) => [c.home.marks].flat().includes('beadedBraids'));
    assert.ok(beaded.length > 0 && beaded.every(([, st]) => st.marks.includes('beadedBraids')), 'a list-valued home mark (the beads down the braids) is the cast\'s own and stays on in every shot and mutation: ' + JSON.stringify(beaded.find(([, st]) => !st.marks.includes('beadedBraids'))?.[1]?.marks));
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'plain data');
  } finally { for (const u of undo) u(); }
  const a = JSON.stringify(runWorld(tableau, song(g, THEMED), 4).state), b = JSON.stringify(runWorld(tableau, song(g, THEMED), 4).state);
  assert.equal(a, b); assert.notEqual(a, JSON.stringify(runWorld(tableau, song(g, 'tableau'), 4).state), 'the theme is a different cast');
  assert.throws(() => song(g, { world: 'tunnel', theme: 'dwarves' }), /belongs to the tableau world/);
});
