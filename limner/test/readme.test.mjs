// Every code example in README.md, run. A README that drifts from the library is worse than none, and the surface it
// documents is a promise once this is on npm, so the promises are executable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../index.mjs';
import * as P from '../primitives.mjs';
import { ctxStub } from './_stub.mjs';

const {
  person, archetype, characterFrom, dress, renderPortrait, renderFigure, portraitOps, toSvg, drawOn,
  parts, tag, stanceOf, STANCES, CASTS, ANATOMY, buildOf, COSTUME_FAMILIES, EXPRESSIONS, DEFAULTS,
  seed, rand, prng, eyeY, feetY, CHIN_Y, FEET_Y,
} = L;

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const svgOf = (s) => { assert.match(s, /^<svg/); assert.ok(!/NaN|Infinity|undefined/.test(s), 'drawn with no holes'); return s; };

test('the headline example', () => {
  svgOf(renderPortrait(person({ cast: 'dwarves', seed: 7 })));
  assert.match(renderPortrait(person({ seed: 1 })), /viewBox="0 0 400 480"/, 'the bust viewBox the README quotes');
});

test('every cast gives a person and a named archetype, and both draw; an unknown cast is the editorial one', () => {
  for (const name of Object.keys(CASTS)) {
    svgOf(renderPortrait(person({ cast: name, seed: 3 })));
    svgOf(renderPortrait(dress(archetype({ cast: name, seed: 3, name: CASTS[name].archetypeNames[0] }), {})));
  }
  assert.deepEqual(person({ cast: 'wizards', seed: 1 }), person({ cast: 'editorial', seed: 1 }));
});

test('a character draws directly; an identity must be dressed, and says so when it is not', () => {
  const who = person({ cast: 'elves', seed: 3 });
  svgOf(renderPortrait(who));
  const sitter = archetype({ cast: 'elves', seed: 3, name: 'moonsinger' });
  svgOf(renderPortrait(dress(sitter, { expression: 'grin', costume: 'severeBlackSuit' })));
  svgOf(renderPortrait(dress(sitter, { expression: 'deadpan', hat: 'bucketHat' })));
  assert.throws(() => dress(who), 'dressing a character is the documented error');
});

test('ops are the output type and both renderers read them', () => {
  const ops = portraitOps(person({ seed: 1 }));
  assert.ok(Array.isArray(ops) && ops.length > 300, `the README says ~343 ops, got ${ops.length}`);
  svgOf(toSvg(ops, '#c8102e'));
  const ctx = ctxStub();
  drawOn(ctx, ops);
  assert.equal(ctx.calls.save, ctx.calls.restore, 'balanced');
  assert.match(renderFigure(person({ seed: 1 })), /viewBox="-30 -200 460 1284"/, 'the figure viewBox the README quotes');
});

test('the parameters example, every style name in it', () => {
  svgOf(renderPortrait({
    skin: '#b07a52',
    face: { width: 168, height: 212, jaw: 0.7, chin: 0.4, fullness: 0.3, asym: { chin: 0.4 } },
    eyes: { style: 'hooded', spacing: 62, squint: 0.3, iris: '#4a6b4e', look: { x: 0.4, y: -0.2 } },
    nose: { style: 'aquiline', length: 44, width: 22 },
    mouth: { style: 'full', smile: 0.35, open: 0.1 },
    hair: { style: 'afroMedium', color: '#2b2320' },
    facialHair: { style: 'fullBeard', density: 0.8, color: '#3a2f28', mustache: true },
    top: { style: 'tunic', color: '#6e7278' },
    jacket: { style: 'blazer' },
    hat: { style: 'wideBrimFelt' },
    pose: { headTilt: 0.08, turn: 0.3, shoulder: 0.4, gaze: 'camera' },
    light: { contrast: 1.4 },
    build: { trunk: 0.9, legs: 0.8, shoulders: 1.2, head: 1.05 },
  }));
  // the groups the README lists are the groups DEFAULTS has
  for (const g of ['skin', 'hairColor', 'face', 'ears', 'eyes', 'nose', 'mouth', 'hair', 'facialHair', 'hat', 'top', 'jacket', 'body', 'build', 'pants', 'shoes', 'glasses', 'accessories', 'details', 'makeup', 'marks', 'props', 'blush', 'neck', 'pose', 'light', 'background', 'seed'])
    assert.ok(g in DEFAULTS, `README lists '${g}' as a parameter group`);
});

test('the dress styling keys the README documents all do something', () => {
  const sitter = archetype({ cast: 'editorial', seed: 4 });
  for (const styling of [{ costume: 'severeBlackSuit' }, { variant: 1 }, { hat: 'beanie' }, { makeup: [] }, { marks: [] },
    { props: [] }, { expression: 'smirk' }, { smile: 0.2 }, { pose: { turn: 0.4 } }, { look: { x: 0.3, y: 0 } }, { stance: false }])
    svgOf(renderPortrait(dress(sitter, styling)));
});

test('the crowd example, one stream for everybody', () => {
  const draw = (n) => { const s = {}; seed(s, prng(n)); return Array.from({ length: 16 }, () => characterFrom(CASTS.orcs, s)); };
  const a = draw(11), b = draw(11);
  assert.deepEqual(a, b, 'the same seed gives the same crowd');
  assert.notDeepEqual(a, draw(12));
  assert.equal(new Set(a.map((c) => JSON.stringify(c))).size, 16, 'and sixteen different orcs');
  for (const c of a) svgOf(renderPortrait(c));
});

test('the tag queries in the README return parts, and the quarantine holds', () => {
  assert.equal(parts('top', { any: ['everyday'] }).length, 9, 'the README says nine ordinary tops');
  assert.ok(parts('top', { any: ['era:fantasy'] }).length > 0);
  // the README is specific about which kinds carry `everyday`, because the obvious guess is wrong
  for (const k of ['top', 'jacket', 'hair', 'facialHair', 'glasses', 'details', 'graphics']) assert.ok(parts(k, { any: ['everyday'] }).length > 0, `${k} carries everyday`);
  for (const k of ['hat', 'makeup', 'marks', 'props', 'teeth']) assert.equal(parts(k, { any: ['everyday'] }).length, 0, `${k} does not`);
  const rot = parts('makeup', { any: ['only:undead'] });
  assert.ok(rot.length > 0, 'asking for it by name finds it');
  const everyday = parts('makeup', { any: ['everyday'] });
  assert.ok(!rot.some((n) => everyday.includes(n)), 'and not asking does not');
  assert.equal(typeof tag, 'function');
});

test('the cast table in the README matches the casts that ship', () => {
  const counts = { editorial: 24, undead: 19, dwarves: 8, elves: 6, humans: 6, orcs: 6, halflings: 6, tieflings: 6, gnomes: 5, dragonborn: 5, scifi: 5, cyborgs: 6, aliens: 7, holograms: 5, wastelanders: 5, steampunks: 7, gothic: 5, noir: 5, synthwave: 5, punks: 5, robots: 7 };
  assert.deepEqual(Object.keys(CASTS).sort(), Object.keys(counts).sort(), 'twenty-one casts, the ones the table lists');
  for (const [name, n] of Object.entries(counts)) assert.equal(CASTS[name].archetypeNames.length, n, `${name} has ${n} archetypes`);
  assert.match(README, /twenty-one casts share one wardrobe/, 'and the prose says ten');
});

test('the anatomy claims: fifteen peoples, shortest to tallest, the human row all 1s', () => {
  assert.equal(Object.keys(ANATOMY).length, 15);
  const h = buildOf('human');
  for (const [k, v] of Object.entries(h)) assert.ok(Math.abs(v - 1) < 1e-9, `human.${k} should solve to 1, got ${v}`);
  const order = ['halfling', 'gnome', 'dwarf', 'greyAlien', 'greenAlien', 'human', 'tiefling', 'postApocalypticHuman', 'steampunkHuman', 'cyborg', 'elf', 'halfOrc', 'reptilianAlien', 'orc', 'dragonborn'];
  assert.deepEqual([...order].sort(), Object.keys(ANATOMY).sort(), 'the README names every row');
  const tall = order.map((r) => ANATOMY[r].height);
  for (let i = 1; i < tall.length; i++) assert.ok(tall[i] >= tall[i - 1], `${order[i]} (${tall[i]}) is not at least as tall as ${order[i - 1]} (${tall[i - 1]})`);
  assert.deepEqual([ANATOMY.halfling.height, ANATOMY.gnome.height, ANATOMY.dwarf.height, ANATOMY.dragonborn.height], [0.52, 0.52, 0.78, 1.13], 'the statures the README quotes');
  for (const row of Object.values(ANATOMY)) for (const k of ['totalHeight', 'shoulderWidth', 'torsoLength', 'armLength', 'legLength', 'handSize', 'footLength'])
    assert.ok(Array.isArray(row[k]) && row[k].length === 2, `${k} is a range, as the README says`);
});

test('the stance example, and that a stance is one body', () => {
  const st = stanceOf('swaggerLean');
  assert.ok(st && typeof st.turn === 'number');
  assert.ok(stanceOf('thrillerClaw', 'undead'), 'a themed pack is reachable by name');
  svgOf(renderPortrait(dress(archetype({ seed: 2 }), {
    pose: { headTilt: st.tilt, turn: st.turn, shoulder: st.shoulder, headX: st.headX, headY: st.headY },
    props: st.props,
  })));
  const all = Object.values(STANCES).flatMap((p) => Object.entries(p));
  assert.equal(all.length, 21, 'the README says twenty-one in two packs');
  assert.equal(Object.keys(STANCES).length, 2);
  const carriers = all.filter(([, s]) => 'dx' in s || 'dy' in s || 'k' in s).map(([n]) => n).sort();
  assert.deepEqual(carriers, ['graveReach', 'swaggerLean'], 'and names the only two that still carry placement');
});

test('the determinism example', () => {
  assert.deepEqual(person({ seed: 7 }), person({ seed: 7 }));
  const s = {}; seed(s, prng(7));
  assert.equal(typeof rand(s), 'number');
  assert.ok(rand(s) >= 0 && rand(s) < 1);
});

test('the measurements, and that they read the figure rather than the defaults', () => {
  const short = dress(archetype({ seed: 3 }), {}), tall = { ...short, build: { ...short.build, legs: 0.6 } };
  for (const f of [eyeY, feetY]) assert.equal(typeof f(short), 'number');
  assert.ok(eyeY(short) < feetY(short));
  assert.ok(feetY(tall) < feetY(short), 'shorter legs, higher feet: the measurement follows the build');
  assert.equal(CHIN_Y, 327.2); assert.equal(FEET_Y, 1078);
});

test('limner/primitives exports exactly what the README lists', () => {
  assert.deepEqual(Object.keys(P).sort(), ['ellipse', 'line', 'merge', 'mix', 'path', 'rect', 'shade', 'soft', 'stroke', 'tracePath']);
});

test('the counts quoted in the prose', () => {
  assert.equal(COSTUME_FAMILIES.length, 29, 'the README says 29 costume families');
  assert.equal(Object.keys(EXPRESSIONS).length, 18, 'and 18 expressions');
  assert.match(README, /`COSTUME_FAMILIES` \(29\)/);
  assert.match(README, /`EXPRESSIONS` \(18\)/);
});

test('every name the API section lists is actually exported', () => {
  const section = README.slice(README.indexOf('\n## API'), README.indexOf('\n## Stability'));
  const named = [...new Set([...section.matchAll(/`([A-Za-z_$][\w$]*)`/g)].map((m) => m[1]))];
  assert.ok(named.length > 50, `expected the API list, found ${named.length} names`);
  const missing = named.filter((n) => !(n in L) && !(n in P) && !['limner', 'DEFAULTS', 'kind', 'query'].includes(n));
  assert.deepEqual(missing, [], 'the API section promises these and the package does not export them');
});
