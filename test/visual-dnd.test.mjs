// The six D&D themes (humans, orcs, halflings, gnomes, tieflings, dragonborn): one shared part pack and five
// quarantined ones, six casts, six rows in lib/visual.json, nothing else touched. What they promise, together,
// because the promise is the same six times over: parts/fantasy.mjs is genuinely shared (tagged `era:fantasy`, no
// `only:`, reached by every one of the six and by none of the editorial pools), each race pack is its cast's alone
// (`only:<race>`) and every part of it draws, each cast carries its own skeleton and its own signature (the orc's
// tusks, the tiefling's horns, the dragonborn's muzzle, a pointed ear where the race has one) into every shot and
// every random face, and with the theme named the tableau casts it in editorial shots, deterministically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import tableau, { TEMPLATES as EDITORIAL } from '../web/visual/tableau.mjs';
import { CASTS, THEMES, PACKS } from '../web/visual/themes.mjs';
import { PACKS as LIMNER_PACKS } from 'limner';
const { FANTASY } = LIMNER_PACKS.fantasy;
import { identityFrom, characterFrom, dress, ARCHETYPE_NAMES, ANATOMY, buildOf, COSTUMES } from 'limner';
import { portraitOps, toSvg, drawOn, parts, tagsOf, feetY, headBox } from 'limner';
import { composeVisual, describeVisual } from '../lib/visual.mjs';
import { GROUPS, groupsFor, controlsFor } from '../limner/schema.mjs';
import { ctxStub, run as runWorld, forbid } from './_visual.mjs';
import { seed } from '../web/visual/kit.mjs';
import { prng } from '../lib/random.mjs';

const clean = (o) => !/NaN|undefined|Infinity/.test(JSON.stringify(o));
const draws = (o, what) => { const ops = portraitOps(o); assert.ok(ops.length > 20 && clean(ops), what); const ctx = ctxStub(); drawOn(ctx, ops); assert.equal(ctx.calls.save, ctx.calls.restore, `${what} restores every clip`); assert.ok(toSvg(ops).startsWith('<svg')); return ops; };
const song = (g, visual, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' } }),
]).strudel;
const KIND = { makeup: 'makeup', marks: 'marks', hats: 'hat', tops: 'top', jackets: 'jacket', glasses: 'glasses', teeth: 'teeth' };
const WEAR = { makeup: (n) => ({ makeup: [n] }), marks: (n) => ({ marks: [n] }), hats: (n) => ({ hat: { style: n, color: '#6c7278', accent: '#cfc3a4' } }), tops: (n) => ({ top: { style: n, color: '#6b4a30' } }), jackets: (n) => ({ jacket: { style: n, color: '#4b3b2a' } }), glasses: (n) => ({ glasses: { style: n, color: '#b08d3c' } }), teeth: (n) => ({ mouth: { teeth: n, open: 0.6 } }) };

// one row per theme: its pack, how many of them there are, what every one of them is, and how tall it stands
// (`feet`, where the figure's feet land: FEET_Y 1078 is a human's, a dwarf's is 875, and the two small folk stand
// level with each other well
// under that, which is the whole point of giving a cast a skeleton). Every build is solved from `ANATOMY`, so what a
// row asserts here is the *shape* of the race, and the table itself is checked against the drawing further down.
const HALFLING = buildOf('halfling'), ORCS_SHOULDERS = buildOf('orc').shoulders;
const RACES = {
  humans: { pack: null, n: 6, feet: [1070, 1086], is: (b) => assert.equal(b.build, undefined, 'a human is the default skeleton') },
  orcs: { pack: 'orc', n: 6, feet: [1138, 1152], is: (b, p) => { assert.ok(b.build.shoulders > 1.3, 'heavy'); assert.ok(p.makeup.includes('tusks') && b.ears.pointed > 0.2, 'tusked and a little pointed of ear'); } },
  halflings: { pack: 'halfling', n: 6, feet: [669, 683], is: (b) => { assert.ok(b.build.legs < 0.5 && b.build.head < 0.8, 'small, and the head small with it: 1:5 of three feet is a child\'s head, not a big one on a small body'); assert.ok(b.ears.pointed > 0.2 && b.ears.pointed < 0.5, 'tapered, not an elf\'s'); } },
  gnomes: { pack: 'gnome', n: 5, feet: [668, 682], is: (b) => { assert.ok(b.build.head > HALFLING.head && b.build.hands > HALFLING.hands && b.build.shoulders < HALFLING.shoulders && b.build.trunk < HALFLING.trunk, 'a halfling\'s height and the slighter of the two: narrower and shorter in the torso, with the larger head and hands'); assert.ok(b.ears.pointed > 0.6, 'long-eared'); } },
  tieflings: { pack: 'tiefling', n: 6, feet: [1071, 1085], is: (b, p) => { assert.ok(Object.values(b.build).every((v) => v > 0.95 && v < 1.05), 'a human\'s height and a human\'s proportions: the horns are the difference'); assert.ok(p.makeup.includes('curvedHorns') && b.ears.pointed > 0.4, 'horned and pointed of ear'); } },
  dragonborn: { pack: 'dragonborn', n: 5, feet: [1162, 1176], is: (b, p) => { assert.ok(b.build.shoulders >= ORCS_SHOULDERS && b.build.trunk > 1.25, 'the broadest shoulders and the longest torso of the eight'); for (const m of ['scaleHide', 'hornCrest']) assert.ok(p.makeup.includes(m), `${m} in every shot`);
    assert.equal(p.nose.muzzle, 1, 'the muzzle is the face\'s own nose (portrait\'s `nose.muzzle`), not something worn: a pack registers parts, and a nose is not a part'); assert.equal(p.mouth.teeth, 'fangs'); } },
};

test('the fantasy pack is shared, not quarantined: every part is tagged era:fantasy and nothing else, reaches all six casts and none of the editorial pools, and draws', () => {
  assert.ok(FANTASY.tops.length >= 2 && FANTASY.jackets.length >= 1 && FANTASY.hats.length >= 1);
  for (const [kind, names] of Object.entries(FANTASY)) for (const n of names) {
    const t = tagsOf(KIND[kind], n);
    assert.ok(t.has('era:fantasy') && ![...t].some((x) => x.startsWith('only:')), `${n} is shared: era:fantasy, no only:`);
    assert.ok(!parts(KIND[kind], { all: ['everyday'] }).includes(n), `${n} is not everyday, so no editorial crowd wears it`);
    assert.ok(parts(KIND[kind], { any: ['era:fantasy'] }).includes(n), `${n} comes when asked for`);
    draws(WEAR[kind](n), n);
  }
  for (const name of Object.keys(RACES)) { const P = CASTS[name].pools;
    for (const n of FANTASY.tops) assert.ok(P.tops.includes(n), `${name} reach the shared ${n}`);
    for (const n of FANTASY.jackets) assert.ok(P.jackets.includes(n), `${name} reach the shared ${n}`);
  }
});

for (const [name, R] of Object.entries(RACES)) test(`the ${name} pack and cast: its own parts quarantined and drawing, ${R.n} archetypes each with the cast's skeleton and signature, a random crowd dressed from its pools`, () => {
  const cast = CASTS[name], s = {}; seed(s, prng(7));
  if (R.pack) { const own = PACKS[R.pack][R.pack.toUpperCase()]; assert.ok(own, `parts/${R.pack}.mjs exports its manifest as ${R.pack.toUpperCase()}`); // by name, not the first object export: a pack that grows a second one would otherwise quarantine-check the wrong thing and still pass
    for (const [kind, names] of Object.entries(own)) for (const n of names) {
      assert.ok(tagsOf(KIND[kind], n).has(`only:${R.pack}`), `${n} is tagged only:${R.pack}`);
      assert.ok(!parts(KIND[kind]).includes(n) && !parts(KIND[kind], { any: ['everyday', 'era:80s', 'era:fantasy'] }).includes(n), `${n} reaches no plain, everyday or shared pool`);
      assert.ok(parts(KIND[kind], { any: [`only:${R.pack}`] }).includes(n), `${n} comes when asked for`);
      draws(WEAR[kind](n), n);
    } }
  assert.equal(cast.name, name); assert.equal(cast.archetypeNames.length, R.n);
  assert.ok(cast.archetypeNames.every((n) => !ARCHETYPE_NAMES.includes(n)), 'none of them is an editorial archetype');
  const people = cast.archetypeNames.map((n, i) => identityFrom(cast, s, n, i));
  assert.equal(new Set(people.map((c) => JSON.stringify(c.base))).size, people.length, 'no two alike');
  for (const c of people) { const p = dress(c); draws(p, `${name}:${c.name}`); R.is(c.base, p); assert.ok(cast.costumes.includes(c.home.costume), `${c.name}: dressed from the cast's own wardrobe`); assert.ok(feetY(p) >= R.feet[0] && feetY(p) <= R.feet[1], `${c.name}: stands ${R.feet[0]}..${R.feet[1]} tall for its race (feet at ${Math.round(feetY(p))}; a human's are at 1078, a dwarf's at 875)`); }
  const crowd = Array.from({ length: 12 }, (_, i) => characterFrom(cast, s, ['establish', 'develop', 'climax', 'release'][i % 4], (i % 4) / 3));
  for (const k of crowd) { assert.ok(clean(portraitOps(k)), 'a random one draws'); assert.ok(cast.pools.tops.includes(k.top.style), `a random one wears the cast's tops (${k.top.style})`); assert.ok(k.hat.style === 'none' || Object.values(cast.wardrobe).flat().includes(k.hat.style), `a random one wears the cast's hats (${k.hat.style})`); R.is(k, k); }
});

test('the editor is narrowed by a theme, not only widened: the cast\'s pools are its menus, its wardrobe its hats, and `limits` pins the dials that are the race rather than the wardrobe', () => {
  const of = (theme, path) => controlsFor({ seed: 1, family: 'any', theme, ov: {} }).find((c) => c.path === path);
  assert.deepEqual(groupsFor({ theme: 'none' }), GROUPS, 'with no theme on, nothing is added and nothing is taken away');
  for (const name of Object.keys(RACES)) {
    const cast = CASTS[name], tops = of(name, 'top.style').options;
    assert.ok(tops.length < GROUPS.flatMap((g) => g.items).find((c) => c.path === 'top.style').options.length, `${name}: the tops menu is narrowed`);
    assert.ok(!tops.includes('crewTshirt') && !tops.includes('hoodie'), `${name}: no modern top on the menu (${tops})`);
    const wornTops = cast.costumes.map((c) => COSTUMES[c]?.(0).top?.style).filter(Boolean); // what its own costume families put on, which limitsOf allows beside the pool so a preset can never write an off-menu value
    assert.ok(tops.every((n) => cast.pools.tops.includes(n) || wornTops.includes(n)), `${name}: every top offered is one the cast wears (${tops.filter((n) => !cast.pools.tops.includes(n) && !wornTops.includes(n))})`);
    assert.ok(of(name, 'hat.style').options.every((n) => n === 'none' || Object.values(cast.wardrobe).flat().includes(n)), `${name}: only the cast's own hats`);
    assert.deepEqual(of(name, 'costume').options, cast.costumes, `${name}: its own costume families`);
  }
  assert.deepEqual(of('dragonborn', 'hair.style').options, ['bald', 'buzz', 'shavedHead'], 'a dragonborn has three hairstyles, not twenty-seven');
  assert.deepEqual(of('dragonborn', 'facialHair.style').options, ['none']);
  assert.deepEqual(of('dragonborn', 'mouth.teeth').options, ['fangs']);
  assert.equal(of('dragonborn', 'nose.muzzle').min, 1, 'a dragonborn is muzzled and the editor cannot take it off');
  assert.equal(of('humans', 'nose.muzzle').max, 0, 'and a human cannot be given one');
  assert.ok(of('gnomes', 'ears.pointed').min >= 0.5 && of('humans', 'ears.pointed').max <= 0.2, 'the ear is the race');
  assert.ok(of('halflings', 'build.legs').max < 0.55 && of('gnomes', 'build.legs').max < 0.55, 'and so are the legs: neither of the small folk comes near a human');
  for (const name of Object.keys(RACES)) for (const [path, v] of Object.entries(CASTS[name].limits ?? {})) if (path.startsWith('build.') && typeof v[0] === 'number') {
    const k = { trunk: 'trunk', legs: 'legs', shoulders: 'shoulders', arms: 'arms', head: 'head' }[path.slice(6)], own = CASTS[name].build[k];
    assert.ok(own >= v[0] && own <= v[1], `${name}: its own ${path} (${own}) is inside the band the editor allows (${v})`);
    const c = of(name, path); assert.ok(c.min <= own && c.max >= own, `${name}: and the slider the page builds still reaches it (${c.min}..${c.max})`);
  }
  assert.equal(of('tieflings', 'hat.style').options.length, 1, 'a tiefling wears no hat: the horns have the crown');
});

test('the six themes: the song names one, the score carries it, the tableau casts it in editorial shots alone, deterministically, and refuses another world', async () => {
  const g = await ready;
  for (const name of Object.keys(RACES)) {
    const visual = { world: 'tableau', theme: name }, cast = CASTS[name];
    const score = composeVisual(song(g, visual));
    assert.equal(score.theme, name); assert.match(describeVisual(score).join(' · '), new RegExp(`theme ${name}`));
    assert.equal(THEMES[name].templates, undefined, 'the editorial dance: the tableau\'s own templates'); assert.deepEqual(THEMES[name].cast, cast.archetypeNames);
    const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
    try {
      const p = runWorld(tableau, song(g, visual), 8), st = p.state, ctx = ctxStub();
      p.draw(ctx, 320, 180);
      assert.ok(ctx.calls.fill > 30 && ctx.calls.save === ctx.calls.restore, `${name} draws a frame`);
      assert.equal(st.theme, name);
      assert.deepEqual(st.cast.map((c) => c.name), cast.archetypeNames);
      assert.ok(st.plan.flat().every((x) => EDITORIAL[x.tpl]), `${name}: every shot is an editorial template`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'plain data');
    } finally { for (const u of undo) u(); }
    const a = JSON.stringify(runWorld(tableau, song(g, visual), 4).state);
    assert.equal(a, JSON.stringify(runWorld(tableau, song(g, visual), 4).state), `${name} is deterministic`);
    assert.notEqual(a, JSON.stringify(runWorld(tableau, song(g, 'tableau'), 4).state), `${name} is a different cast from the editorial one`);
    assert.throws(() => song(g, { world: 'tunnel', theme: name }), /belongs to the tableau world/);
  }
});

// ANATOMY (cast.mjs) is the published D&D table: a height in inches and then the figure in head heights, every
// figure a range. Its two halves pull against each other in a drawing whose human stands 4.6 heads rather than
// 7.5 — a head-to-body ratio and an absolute height do not both land at a range's midpoint — so `buildOf` solves
// one parameter across every range at once. This is the check that it comes out, measured off the drawing itself
// rather than off the arithmetic: each race stands at its own height against a human, and its head-to-body ratio
// falls inside its own row. The human row must solve to the figure as drawn, which is what ties the two together.
test('every race is built to the anatomy table: its height against a human\'s, and its head-to-body ratio inside its own row, measured off the figure the build draws', () => {
  const mid = (r) => (r[0] + r[1]) / 2;
  const measure = (build) => { const p = build ? { build } : {}, h = headBox(p); return { height: feetY(p) - h.top, head: h.chin - h.top }; };
  const human = measure(null), base = human.height / human.head;
  assert.ok(base > 4.5 && base < 4.8, `this drawing's human stands ${base.toFixed(2)} heads (the table says 7 to 8): the build table is read as ratios to it, not as absolutes`);
  assert.deepEqual(buildOf('human'), { head: 1, trunk: 1, legs: 1, shoulders: 1, arms: 1, hands: 1, feet: 1 }, 'the human row solves to the figure as drawn, which is what every other row is measured against');
  for (const [race, t] of Object.entries(ANATOMY)) {
    const b = buildOf(race), m = measure(race === 'human' ? null : b);
    const want = t.height / ANATOMY.human.height, got = m.height / human.height;
    assert.ok(Math.abs(got / want - 1) < 0.02, `a ${race} stands ${(got * 100).toFixed(0)}% of a human, its row wants ${(want * 100).toFixed(0)}%`);
    const heads = m.height / m.head, band = t.totalHeight.map((x) => (base * x) / mid(ANATOMY.human.totalHeight));
    assert.ok(heads >= band[0] - 0.02 && heads <= band[1] + 0.02, `a ${race} is ${heads.toFixed(2)} heads tall; its row (${t.totalHeight}) against a human's (${ANATOMY.human.totalHeight}) on this drawing's ${base.toFixed(2)}-head human is ${band[0].toFixed(2)}..${band[1].toFixed(2)}`);
    for (const k of ['trunk', 'legs', 'shoulders', 'arms', 'hands', 'feet', 'head']) assert.ok(b[k] > 0.3 && b[k] < 2, `${race}.${k} = ${b[k]} is a number the portrait will not clamp`);
  }
  // the order the lineup reads in, with the ties the table means: a halfling and a gnome stand level, a tiefling and a human do
  const tall = (r) => measure(r === 'human' ? null : buildOf(r)).height;
  assert.ok(Math.abs(tall('halfling') - tall('gnome')) < 8, `a halfling (${tall('halfling').toFixed(0)}) and a gnome (${tall('gnome').toFixed(0)}) stand level: what tells them apart is the build, not the ruler`);
  assert.ok(Math.abs(tall('human') - tall('tiefling')) < 8, 'a tiefling stands as a human does');
  assert.ok(tall('elf') > tall('human'), 'an elf is taller than a human, not shorter');
  const order = Object.keys(ANATOMY).sort((a, c) => Math.round(tall(a) / 10) - Math.round(tall(c) / 10) || a.localeCompare(c)); // the two ties are real, so they sort by name rather than by a unit of rounding
  assert.deepEqual(order, ['gnome', 'halfling', 'dwarf', 'human', 'tiefling', 'elf', 'halfOrc', 'orc', 'dragonborn'], 'and the rest line up shortest to tallest');
});

test('every cast carries the build the table solves for it, so no cast drifts off ANATOMY by hand', () => {
  for (const [name, race] of Object.entries({ elves: 'elf', dwarves: 'dwarf', halflings: 'halfling', gnomes: 'gnome', orcs: 'orc', tieflings: 'tiefling', dragonborn: 'dragonborn' }))
    assert.deepEqual(CASTS[name].build, buildOf(race), `${name} is ${race} as the table has it`);
  assert.equal(CASTS.humans.build, 'default', 'and a human is the figure as drawn, which is the table\'s human');
  const slider = Object.fromEntries(GROUPS.flatMap((g) => g.items).filter((c) => c.path.startsWith('build.')).map((c) => [c.path.slice(6), c]));
  for (const cast of Object.values(CASTS)) for (const [k, v] of Object.entries(cast.build === 'default' ? {} : cast.build))
    assert.ok(v >= slider[k].min && v <= slider[k].max, `${cast.name}: build.${k} = ${v} is on the editor's own slider (${slider[k].min}..${slider[k].max}), or the page cannot show the figure it draws`);
});

// The casts and the part packs are limner's registries now, and a theme row names one of each. The error a misspelt row
// raises has to keep naming what it got and listing what exists, or a typo in lib/visual.json becomes a blank stage with
// no clue where to look.
test('a theme naming a cast limner does not have fails with that cast named and the real ones listed', async () => {
  const { bindTheme } = await import('../web/visual/themes.mjs');
  assert.throws(() => bindTheme('bad', { cast: 'wizards', dance: 'editorial', packs: [] }), (e) => {
    assert.match(e.message, /unknown cast "wizards"/, 'names the cast that was asked for');
    assert.match(e.message, /editorial/, "and lists one that exists, from limner's registry");
    return true;
  });
  assert.throws(() => bindTheme('bad', { cast: 'editorial', dance: 'editorial', packs: ['sorcery'] }), /unknown pack "sorcery"/);
  assert.throws(() => bindTheme('bad', { cast: 'editorial', dance: 'moonwalk', packs: [] }), /unknown dance "moonwalk"/);
});
