// web/visual/thriller.mjs: the tableau's zombie theme. What it promises: it is off unless a song writes
// `visual: { world: 'tableau', theme: 'thriller' }` (the general cast, costumes, poses and part lists are untouched by
// its being loaded), every zombie part draws, the cast is dead in the ways the file says (ashen skin, milky eyes,
// rotten teeth, rot as home makeup in every shot), and with it on the tableau plans only its own templates and poses,
// deterministically, with no clock or randomness of its own. Human eyes judge the look (thriller.html is the sheet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ready } from './_scope.mjs';
import tableau, { TEMPLATES as EDITORIAL, layoutOf, FRAMING, previewShot } from '../web/visual/tableau.mjs';
import thriller, { ZOMBIES, ZOMBIE_NAMES, ZOMBIE_COSTUMES, ZOMBIE_COSTUME_NAMES, ZOMBIE_MAKEUP, ZOMBIE_MARKS, ZOMBIE_PROPS, ZOMBIE_EXPRESSIONS, ZOMBIE_SKINS, POSES, TEMPLATES, PHASES, SPECIAL, claw } from '../web/visual/thriller.mjs';
import { identityOf, dress, exprVals, ARCHETYPE_NAMES, COSTUME_FAMILIES, EXPRESSIONS } from 'limner';
import { portraitOps, toSvg, drawOn, TOP_STYLES, JACKET_STYLES, HAT_STYLES, HAIR_STYLES, MAKEUP_STYLES, MARK_STYLES, PROP_STYLES, TEETH_STYLES, TOPS, JACKETS, HATS, HAIR, MAKEUP, MARKS, PROPS, TEETH } from 'limner';
import { clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual, describeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
import { seed } from '../web/visual/kit.mjs';
import { prng } from '../lib/random.mjs';
import VISUAL from '../lib/visual.json' with { type: 'json' };
import { THEMES, CASTS, DANCES, PACKS, bindTheme } from '../web/visual/themes.mjs';
import { CASTS as LIMNER_CASTS } from 'limner';
const UNDEAD = LIMNER_CASTS.undead;

const clean = (o) => !/NaN|undefined|Infinity/.test(JSON.stringify(o));
const draws = (o, what) => { const ops = portraitOps(o); assert.ok(ops.length > 20 && clean(ops), what); const ctx = ctxStub(); drawOn(ctx, ops); assert.equal(ctx.calls.save, ctx.calls.restore, `${what} restores every clip`); assert.ok(toSvg(ops).startsWith('<svg')); return ops; };
const song = (g, visual, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' } }),
]).strudel;
const THEMED = { world: 'tableau', theme: 'thriller' };
const NEW_PARTS = { top: ['ruffledTux', 'leotard', 'offShoulderSweat', 'hospitalGown', 'laceGown'], jacket: ['varsityJacket', 'sweaterShoulders', 'padShoulderBlazer', 'redLeatherChevron'], hat: ['headband', 'veil'], hair: ['mullet', 'bigHair'] };

test('the theme is off by default: its parts are registered by name only, and no general list, cast or plan holds one', async () => {
  const g = await ready;
  for (const [k, names] of Object.entries(NEW_PARTS)) for (const n of names) assert.ok(!{ top: TOP_STYLES, jacket: JACKET_STYLES, hat: HAT_STYLES, hair: HAIR_STYLES }[k].includes(n) && ({ top: TOPS, jacket: JACKETS, hat: HATS, hair: HAIR }[k])[n], `${k} ${n}: drawable by name, absent from the list`);
  for (const n of Object.keys(ZOMBIE_MAKEUP)) assert.ok(!MAKEUP_STYLES.includes(n) && MAKEUP[n]);
  for (const n of Object.keys(ZOMBIE_MARKS)) assert.ok(!MARK_STYLES.includes(n) && MARKS[n]);
  for (const n of Object.keys(ZOMBIE_PROPS)) assert.ok(!PROP_STYLES.includes(n) && PROPS[n]);
  assert.ok(!TEETH_STYLES.includes('rotten') && TEETH.rotten);
  assert.ok(ZOMBIE_NAMES.every((n) => !ARCHETYPE_NAMES.includes(n)) && ZOMBIE_COSTUME_NAMES.every((c) => !COSTUME_FAMILIES.includes(c)), 'the editorial cast and wardrobe are the twenty-four and their families');
  assert.equal(ARCHETYPE_NAMES.length, 24);
  const plain = runWorld(tableau, song(g, 'tableau'), 4).state;
  assert.equal(plain.theme, null);
  assert.deepEqual(plain.cast.map((c) => c.name), ARCHETYPE_NAMES, 'a plain tableau casts the archetypes');
  const names = new Set(plain.plan.flat().map((x) => x.tpl)), poses = new Set(plain.plan.flat().map((x) => x.pose));
  assert.ok([...names].every((t) => EDITORIAL[t]) && [...poses].every((p) => !POSES[p]), 'and plans only editorial shots and poses');
  assert.ok(!JSON.stringify(plain.plan).includes('clawHands') && !JSON.stringify(plain.cast).includes('rotLips'), 'no zombie hand or rot anywhere in it');
  assert.ok(Object.keys(ZOMBIE_EXPRESSIONS).every((e) => EXPRESSIONS[e]) && exprVals('slackJaw').open > 0.3, 'the zombie expressions resolve by name, with the jaw open');
});

test('every zombie part draws: garments, hair, hats, teeth, the rot, the grave, the hands', () => {
  for (const n of NEW_PARTS.top) draws({ top: { style: n, color: '#c23d8e', accent: '#2fb5b0' } }, n);
  for (const n of NEW_PARTS.jacket) draws({ jacket: { style: n, color: '#2a4f8f', accent: '#e9e2d0' } }, n);
  for (const n of NEW_PARTS.hat) draws({ hat: { style: n, color: '#d9c64a', accent: '#2a5fb8' }, hair: { style: 'bigHair' } }, n);
  for (const n of NEW_PARTS.hair) draws({ hair: { style: n } }, n);
  draws({ mouth: { teeth: 'rotten', open: 0.5 } }, 'rotten teeth');
  for (const n of Object.keys(ZOMBIE_MAKEUP)) draws({ makeup: [n] }, n);
  for (const n of Object.keys(ZOMBIE_MARKS)) draws({ marks: [n] }, n);
  for (const n of Object.keys(ZOMBIE_PROPS)) draws({ props: [n] }, n);
  const hands = portraitOps({ props: ['clawHands'] }), skin = hands.filter((o) => o.stroke === '#c98e68').length; assert.ok(skin >= 8, 'two clawed hands are eight hooked fingers at least, in the skin');
  assert.ok(portraitOps({ props: ['gloves', 'clawHands'] }).some((o) => o.stroke === '#161517'), 'a gloved claw is drawn in the glove');
  const raised = portraitOps({ props: ['clawsUp'] }); assert.equal(raised.filter((o) => o.k === 'line' && o.sw === 52).length, 2, 'arms over the head: two forearms up, none hanging');
  assert.notDeepEqual(claw({ props: [], skin: '#aaa' }, 100, 100, 0), claw({ props: [], skin: '#aaa' }, 100, 100, Math.PI), 'the claw turns');
  const veiled = portraitOps({ hat: { style: 'veil' }, hair: { style: 'longStraight' }, props: ['veilBack'] }); assert.ok(veiled.findIndex((o) => o.fill === '#f6f2ea' && o.op === 0.5) < veiled.findIndex((o) => o.k === 'push'), 'the veil\'s sheet is behind the figure');
  assert.ok(portraitOps({ top: { style: 'offShoulderSweat' }, skin: '#123456' }).some((o) => o.fill === '#123456' && o.k === 'path' && o.d.startsWith('M 200 388')), 'the sweatshirt bares one shoulder in the skin');
  assert.ok(portraitOps({ top: { style: 'crewTshirt' }, jacket: { style: 'varsityJacket', color: '#111111', accent: '#eeeeee' } }).some((o) => o.fill === '#eeeeee'), 'a varsity jacket\'s sleeves take the accent');
});

test('the cast: nineteen of the dead, each distinct, ashen, milky-eyed and rotten-toothed, wearing their rot and their grave in every costume', () => {
  const s = {}; seed(s, prng(7));
  assert.ok(ZOMBIE_NAMES.length >= 16);
  const cast = ZOMBIE_NAMES.map((n, i) => identityOf(s, n, i));
  assert.equal(new Set(cast.map((c) => JSON.stringify(c.base))).size, cast.length, 'no two alike');
  for (const c of cast) {
    assert.ok(ZOMBIE_SKINS.includes(c.base.skin), `${c.name}: a dead skin`);
    assert.equal(c.base.eyes.iris, '#bdb9ab'); assert.equal(c.base.mouth.teeth, 'rotten');
    assert.ok(Array.isArray(c.home.makeup) && c.home.makeup.length >= 2 && c.home.makeup.every((m) => ZOMBIE_MAKEUP[m]), `${c.name}: the rot is home makeup`);
    assert.ok(ZOMBIE_COSTUMES[c.home.costume], `${c.name}: buried in a theme costume`);
    const p = dress(c); draws(p, c.name);
    assert.ok(c.home.makeup.every((m) => p.makeup.includes(m)), 'dressed with nothing asked, the rot is on');
    for (const m of [c.home.marks].flat()) if (m !== 'none') assert.ok(p.marks.includes(m), 'and the grave');
  }
  const lead = cast[0];
  for (const fam of ZOMBIE_COSTUME_NAMES) { const p = dress(lead, { costume: fam, expression: 'hunger' }); draws(p, fam); assert.deepEqual([p.skin, p.face, p.eyes.iris], [lead.base.skin, lead.base.face, lead.base.eyes.iris], `the face stays under ${fam}`); assert.ok(p.mouth.open >= 0.5, 'the expression opens the jaw'); }
  assert.ok(dress(cast[ZOMBIE_NAMES.indexOf('bride')]).props.includes('veilBack') && dress(cast[ZOMBIE_NAMES.indexOf('bride')]).hat.style === 'veil', 'the bride wears her veil, sheet and comb');
  assert.ok(ZOMBIE_NAMES.every((n) => ZOMBIES[n].set.skin && ZOMBIES[n].makeup.length));
});

test('the switch: the song header names the theme, the score carries it, the check prints it, a wrong one or a theme on another world is refused', async () => {
  const g = await ready;
  const score = composeVisual(song(g, THEMED));
  assert.equal(score.theme, 'thriller'); assert.equal(score.world, 'tableau');
  assert.match(describeVisual(score).join(' · '), /tableau \([^)]*\), theme thriller/);
  assert.equal(composeVisual(song(g, 'tableau')).theme, undefined, 'unwritten, no theme on the score');
  assert.throws(() => song(g, { world: 'tableau', theme: 'disco' }), /visual\.theme must be one of thriller/);
  assert.throws(() => song(g, { world: 'tunnel', theme: 'thriller' }), /belongs to the tableau world/);
  assert.throws(() => song(g, { theme: 'thriller' }), /belongs to the tableau world/, 'a theme alone names no world');
  assert.equal(composeVisual(song(g, { composition: 'overlay', worlds: ['tableau', 'tunnel'], theme: 'thriller' })).theme, 'thriller', 'the theme rides a composition whose primary is the tableau');
});

test('with the theme on, the tableau casts the dead and plans only Thriller shots and poses, deterministically, with no clock or randomness of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = runWorld(tableau, song(g, THEMED), 8), s = p.state, ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 30 && ctx.calls.save === ctx.calls.restore);
    assert.equal(s.theme, 'thriller');
    assert.deepEqual(s.cast.map((c) => c.name), ZOMBIE_NAMES);
    const all = s.plan.flat();
    assert.ok(all.length >= 2 && all.every((x) => TEMPLATES[x.tpl] && (POSES[x.pose] || x.pose === 'none')), 'every shot is a theme template in a theme pose: ' + all.map((x) => `${x.tpl}/${x.pose}`).join(' '));
    assert.ok(all[0].tpl === 'riseSolo' && all[0].pose === 'graveReach' && all[0].ids[0] === s.leads[0] && all[0].alts[0][0].expression === 'slackJaw' && all[0].alts[0][0].makeup.length >= 2, 'the song opens on a lead rising, its rot on');
    const last = s.plan.at(-1).at(-1); assert.ok(last.tpl === 'clawDuo' && last.pose === 'clawDuo' && last.ids.length === 2, 'and closes on the leads clawing');
    assert.ok(all.every((x) => x.alts.every((alt) => alt.every((st) => st.makeup.length >= 2 && st.props.length === 0 && ZOMBIE_COSTUMES[st.costume]))), 'in every shot and mutation the rot is on, the hands are the pose\'s, the outfit is the grave\'s');
    assert.ok(all.every((x) => x.alts.every((alt) => alt.every((st) => !/deadpan|grin|smile/.test(st.expression)))), 'no smiles');
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, 'plain data');
  } finally { for (const u of undo) u(); }
  const a = JSON.stringify(runWorld(tableau, song(g, THEMED), 4).state), b = JSON.stringify(runWorld(tableau, song(g, THEMED), 4).state), c = JSON.stringify(runWorld(tableau, song(g, THEMED, 4), 4).state);
  assert.equal(a, b); assert.notEqual(a, c);
  assert.notEqual(a, JSON.stringify(runWorld(tableau, song(g, 'tableau'), 4).state), 'the theme is a different world');
});

test('the binding: lib/visual.json names the theme\'s cast, packs and dance, themes.mjs binds them, and a row missing one is refused at song()', async () => {
  const g = await ready;
  assert.deepEqual([VISUAL.themes.thriller.cast, VISUAL.themes.thriller.packs, VISUAL.themes.thriller.dance], ['undead', ['eighties', 'undead'], 'thriller']);
  assert.deepEqual(THEMES.thriller.cast, UNDEAD.archetypeNames, 'the bound theme\'s cast is the cast file\'s archetypes');
  assert.ok(CASTS.undead === UNDEAD && DANCES.thriller.templates === TEMPLATES && THEMES.thriller.templates === TEMPLATES);
  for (const k of Object.keys(VISUAL.themes)) assert.ok(VISUAL.themes[k].cast && VISUAL.themes[k].packs && VISUAL.themes[k].dance && VISUAL.themes[k].world && VISUAL.themes[k].about, `${k} is a whole row`);
  // the row's packs are read, not decoration: every pack a theme names is a loaded pack module, and a misspelt one is refused where the cast and the dance are
  for (const k of Object.keys(VISUAL.themes)) for (const p of VISUAL.themes[k].packs) assert.ok(PACKS[p], `${k} names the pack ${p}, which is loaded`);
  assert.throws(() => bindTheme('x', { cast: 'undead', packs: ['eightees'], dance: 'thriller' }), /theme x: unknown pack "eightees"/);
  assert.throws(() => bindTheme('x', { cast: 'nobody', packs: ['eighties'], dance: 'thriller' }), /unknown cast "nobody"/);
  assert.ok(CASTS.editorial && CASTS.editorial.name === 'editorial', 'the editorial cast is listed with the others (the sheets list casts from here)');
  VISUAL.themes._broken = { world: 'tableau', about: 'a row with no cast' }; // the same json object lib/song.mjs reads (one module instance)
  try { assert.throws(() => song(g, { world: 'tableau', theme: '_broken' }), /theme _broken in lib\/visual\.json lacks cast/, 'a theme that would draw a blank tableau fails at song() naming the missing thing'); } finally { delete VISUAL.themes._broken; }
});

test('the themed state is what it was before the theme file was split (test/fixtures/thriller-state.json)', async () => {
  const g = await ready;
  const pinned = JSON.parse(readFileSync(new URL('./fixtures/thriller-state.json', import.meta.url), 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(runWorld(tableau, song(g, THEMED), 8).state)), pinned);
});

test('every theme template draws in every pose it allows, on every set, and the phases, specials and fallbacks are consistent', async () => {
  const g = await ready;
  const score = composeVisual(song(g, THEMED)), clock = clockOf(score, 0), fresh = () => createPerformance(tableau, score, { w: 16, h: 9 }).state;
  for (const ph of Object.values(PHASES)) for (const t of Object.keys(ph.tpls)) assert.ok(TEMPLATES[t], `phase template ${t} exists`);
  for (const t of SPECIAL) assert.ok(TEMPLATES[t]); assert.ok(TEMPLATES[thriller.fallback.red] && TEMPLATES[thriller.fallback.white] && !SPECIAL.has(thriller.fallback.red));
  for (const [name, tpl] of Object.entries(TEMPLATES)) {
    assert.ok(tpl.n > 0 && tpl.poses.every((p) => POSES[p]) && (!tpl.expression || ZOMBIE_EXPRESSIONS[tpl.expression]), name);
    for (const pose of tpl.poses) for (const set of tpl.set === 'any' ? ['white', 'red'] : [tpl.set]) {
      assert.equal(layoutOf(pose, tpl.n, FRAMING.full, thriller).length, tpl.n, `${pose} places ${tpl.n}`);
      const st = fresh(); st.plan = [[{ ...st.plan[0][0], tpl: name, set, framing: tpl.framing ?? 'close', pose, ids: st.plan[0][0].ids.concat([1, 2]).slice(0, tpl.n), layout: layoutOf(pose, tpl.n, FRAMING[tpl.framing ?? 'close'], thriller), alts: [Array.from({ length: tpl.n }, () => ({ costume: 'thrillerRed', makeup: ['rotLips'], marks: [], props: [], expression: tpl.expression ?? 'slackJaw' }))], fx: tpl.fx ?? null, grid: tpl.grid ?? 0, band: tpl.band ? { color: '#fff', dir: 'v', at: 0.3, size: 0.1 } : null, sculptures: [], gap: false }]];
      st.section = 0; st.shotIx = 0; tableau.step(st, STEP, [KICK], clock);
      const ctx = ctxStub(); tableau.draw(st, ctx, 320, 180);
      assert.equal(ctx.calls.save, ctx.calls.restore, `${name} ${pose} ${set} restores`); assert.ok(ctx.calls.fill > 10, `${name} ${pose} ${set} draws a figure`);
    }
  }
  const sheet = fresh(); sheet.plan = [[previewShot(sheet, { pose: 'hordeLine', n: 3, framing: 'wide', set: 'white' })]]; sheet.section = 0; sheet.shotIx = -1; tableau.step(sheet, STEP, [], clock);
  assert.ok(sheet.plan[0][0].alts[0].every((st) => st.makeup === undefined && st.expression === 'slackJaw'), 'a themed preview keeps the cast\'s own rot (dress falls back to home makeup) and holds a dead face');
  const ctx = ctxStub(); tableau.draw(sheet, ctx, 320, 180); assert.equal(ctx.calls.save, ctx.calls.restore);
  assert.ok(layoutOf('thrillerClaw', 1, FRAMING.full, thriller)[0].props.includes('clawHands') && layoutOf('thrillerClaw', 1, FRAMING.full, thriller)[0].dx === 0 && layoutOf('thrillerClaw', 1, FRAMING.full).length === 1 && !layoutOf('thrillerClaw', 1, FRAMING.full)[0].props.length, 'a theme pose lays out through the theme and is the default stance without it');
  assert.ok(thriller.motion.jaw > 0 && thriller.motion.sway > 1, 'the lurch is bigger than the editorial sway and the kick drops the jaw');
  const plain = createPerformance(tableau, fallbackScore(0.5), { w: 16, h: 9 }).state; assert.equal(plain.theme, null, 'the fallback score has no theme');
});
