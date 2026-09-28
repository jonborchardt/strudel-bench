// web/visual/tableau.mjs: the architecture a world must honour (injected randomness only, deterministic plain state,
// every cast role wired) and what this world promises: a fixed recurring cast, a timeline of shots per section that
// opens still and escalates by phase, hard cuts on the timeline and jump-cut mutations on snares, the three sets,
// every template drawable. Human eyes judge the look (faces.html shows the cast and the wardrobe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import tableau, { TEMPLATES, PHASES, FRAMING, phaseOf, layoutOf } from '../web/visual/tableau.mjs';
import { identityOf, dress, ARCHETYPE_NAMES, COSTUMES, COSTUME_FAMILIES, METALLIC, HOODED, HOOD_MAX_WIDTH, wearable, EXPRESSIONS, exprVals, characterOf } from '../web/visual/cast.mjs';
import { portraitOps, toSvg, drawOn, MAKEUP_STYLES, MARK_STYLES, PROP_STYLES, GRAPHIC_STYLES, HAT_STYLES, TOP_STYLES, JACKET_STYLES, sheen } from '../web/visual/portrait.mjs';
import { curtain, cyclorama, voidSet, sculpture, SCULPTURES, floorShadow, vignette } from '../web/visual/sets.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
import { seed } from '../web/visual/kit.mjs';
import { prng } from '../lib/random.mjs';
const run = (ir, seconds = 8) => runWorld(tableau, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'tableau' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, melody2: { notes: '7 5 4 2' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };
const clean = (o) => !/NaN|undefined|Infinity/.test(JSON.stringify(o));

test('the editorial wardrobe draws: every makeup, mark, prop, graphic, the hood, the new tops, the open jacket, metallic sheen, and a wide body', () => {
  const cases = [...MAKEUP_STYLES.map((m) => ({ makeup: [m] })), ...MARK_STYLES.map((m) => ({ marks: [m], top: { style: 'bare' } })), ...PROP_STYLES.map((p) => ({ props: [p] })), ...GRAPHIC_STYLES.map((g) => ({ top: { style: 'tunic', graphic: g } })),
    { hat: { style: 'hood', color: '#b8892b', metal: 1 }, hair: { style: 'bald' } }, { top: { style: 'hoodieBig', color: '#b8892b', metal: 1, graphic: 'concentric' } }, { jacket: { style: 'openJacket', color: '#b8892b', metal: 1 }, top: { style: 'openShirt' } }, { top: { style: 'trackTop', accent: '#b3202a' } }, { body: { width: 1.2 }, props: ['handsUp'] }, { props: ['gloves', 'flamingFlower'] }];
  assert.ok(['bare', 'tunic', 'hoodieBig', 'trackTop', 'openShirt'].every((t) => TOP_STYLES.includes(t)) && JACKET_STYLES.includes('openJacket') && HAT_STYLES.includes('hood'), 'the garments are there');
  assert.ok(MAKEUP_STYLES.length >= 14 && MARK_STYLES.length >= 10 && PROP_STYLES.length >= 11 && GRAPHIC_STYLES.length >= 7, 'the layers are there');
  for (const o of cases) {
    const ops = portraitOps(o); assert.ok(ops.length > 20 && clean(ops), JSON.stringify(o));
    const ctx = ctxStub(); drawOn(ctx, ops); assert.equal(ctx.calls.save, ctx.calls.restore, 'every clip and group restored: ' + JSON.stringify(o));
    assert.ok(toSvg(ops).startsWith('<svg'));
  }
  const beardAt = (o) => { const ops = portraitOps({ ...o, facialHair: { style: 'fullBeard' }, hairColor: '#123123' }); return [ops.findIndex((x) => x.fill === '#123123' && !x.brow), ops.findIndex((x) => x.fill === '#f3f0ea')]; };
  assert.ok(beardAt({ makeup: ['whiteMaskBase'] })[0] < beardAt({ makeup: ['whiteMaskBase'] })[1], 'a mask goes on over the beard');
  const painted = portraitOps({ makeup: ['darkEyeSockets'], facialHair: { style: 'fullBeard' }, hairColor: '#123123' });
  assert.ok(painted.findIndex((x) => x.fill === '#123123' && !x.brow) > painted.findIndex((x) => x.fill === '#2b1c26'), 'paint that is not a mask goes on under the beard');
  assert.ok(!MAKEUP_STYLES.includes('paleCorpseBase'), 'the corpse base is gone');
  const mask = portraitOps({ makeup: ['whiteMaskBase'], facialHair: { style: 'fullBeard' }, details: ['crowsFeet'], nose: { style: 'broad' } });
  const holes = mask.findIndex((o) => o.k === 'clip' && o.d.startsWith('M 195 196') && o.d.split('M ').length === 3); // the two hole ellipses as one clip
  assert.ok(holes > 0 && mask[holes + 1].fill && mask.slice(holes).some((o) => o.k === 'unclip'), 'a masked face draws its eyes inside the mask\'s two holes and nothing outside them');
  assert.ok(!mask.some((o) => o.brow), 'no brows on a mask'); // a brow is one tapered fill, marked
  assert.ok(!mask.some((o) => o.stroke === '#6b473b'), 'no crow\'s feet on a mask');
  const gold = portraitOps({ top: { style: 'crewTshirt', color: '#b8892b', metal: 1 }, seed: 4 }), plain = portraitOps({ top: { style: 'crewTshirt', color: '#b8892b' } });
  assert.ok(gold.length > plain.length + 10 && gold.some((o) => o.fill === '#ffd443' || o.fill === '#5c4516'), 'a metallic top carries highlight and fold shapes in the gold\'s lights and darks');
  assert.notDeepEqual(sheen('M 0 0 L 10 0 L 10 10 Z', '#b8892b', 1), sheen('M 0 0 L 10 0 L 10 10 Z', '#b8892b', 2), 'the seed places the sheen');
  const hooded = portraitOps({ hat: { style: 'hood', color: '#b8892b' }, hair: { style: 'longStraight' } });
  const hp = hooded.find((o) => o.k === 'path' && o.fill === '#b8892b' && o.rule === 'evenodd');
  assert.ok(hp && hp.d.split('M ').length === 3 && hp.d.includes('L 274 355') === false, 'the hood is one even-odd path: the outer shape and the face opening');
  assert.ok(toSvg(hooded).includes('fill-rule="evenodd"') && (() => { const c = ctxStub(); drawOn(c, portraitOps({ hat: { style: 'hood', metal: 1 } })); return c.calls.clip >= 3; })(), 'printed with its rule, and the sheen clips to it');
  const printed = portraitOps({ top: { style: 'crewTshirt', graphic: 'redLabel' } }), at = printed.findIndex((o) => o.fill === '#b3202a');
  assert.ok(at > 0 && printed[at - 1].k === 'clip', 'a print is clipped to the torso');
  assert.equal(portraitOps({ makeup: ['darkEyeSockets'], eyes: { spacing: 68 } }).find((o) => o.fill === '#2b1c26').cx, 166, 'eye makeup follows the eye spacing');
  assert.equal(portraitOps({ makeup: ['darkEyeSockets'], eyes: { spacing: 34 } }).find((o) => o.fill === '#2b1c26').cx, 183);
  const raised = portraitOps({ props: ['armRaised'] }), cutAt = raised.findIndex((o) => o.k === 'clip' && o.rule === 'evenodd');
  assert.ok(cutAt >= 0 && raised[cutAt + 1].k === 'path' && raised.slice(cutAt).findIndex((o) => o.k === 'unclip') > 1, 'a raised arm clips the garment\'s shoulder away on its side before the arm is drawn');
  assert.equal(portraitOps({ props: ['flower'] }).filter((o) => o.k === 'clip' && o.rule === 'evenodd').length, 0, 'an arm held low keeps the shoulder');
  const gloved = portraitOps({ props: ['gloves', 'abstractGoldObject'] });
  assert.ok(gloved.some((o) => o.fill === '#161517') && !portraitOps({ props: ['abstractGoldObject'] }).some((o) => o.fill === '#161517'), 'a prop in a gloved hand is held in the glove');
});

test('the cast: twenty-four stable identities from the archetypes, dressed in every costume family, recognisable across costumes', () => {
  const s = {}; seed(s, prng(7));
  assert.equal(ARCHETYPE_NAMES.length, 24);
  const cast = ARCHETYPE_NAMES.map((n, i) => identityOf(s, n, i));
  assert.equal(new Set(cast.map((c) => JSON.stringify(c.base))).size, 24, 'no two alike');
  assert.ok(cast.some((c) => c.base.details.includes('crowsFeet')) && cast.some((c) => c.base.body.width > 1.15) && cast.some((c) => c.base.body.width < 0.95), 'old, heavy and lanky people among them');
  assert.ok(COSTUME_FAMILIES.length >= 15 && METALLIC.includes('goldHoodedMetallic') && METALLIC.includes('loudGoldRedFashion'));
  const who = cast[0];
  for (const fam of COSTUME_FAMILIES) {
    const p = dress(who, { costume: fam, makeup: ['clownGraphic'], props: ['flower'], expression: 'stare' });
    assert.ok(clean(portraitOps(p)), fam);
    assert.deepEqual([p.skin, p.face, p.eyes.style, p.nose, p.hairColor], [who.base.skin, who.base.face, who.base.eyes.style, who.base.nose, who.base.hairColor], `the face stays under ${fam}`);
    assert.ok(p.makeup.includes('clownGraphic') && p.props.includes('flower') && p.eyes.openness > who.base.eyes.openness, 'the styling is on');
  }
  const hood = dress(who, { costume: 'goldHoodedMetallic' });
  assert.equal(hood.hat.style, 'hood'); assert.equal(hood.hat.metal, 1); assert.equal(hood.hair.style, 'bald', 'a hood hides the hair');
  const capped = dress(cast[ARCHETYPE_NAMES.indexOf('bluntBob')], { costume: 'minimalTurtleneck', hat: 'baseballCap' });
  assert.equal(capped.hat.style, 'baseballCap');
  assert.equal(dress(who, {}).costume, undefined); assert.equal(dress(who, {}).top.style, COSTUMES[who.home.costume](0).top.style, 'unset styling is the home costume');
  const rnd = characterOf(s); assert.ok(clean(portraitOps(rnd)), 'the random generator still draws (faces)');
});

test('the sets paint on a stub context', () => {
  const ctx = ctxStub(), folds = [{ x: 0, w: 0.2, bright: 0.5 }, { x: 0.2, w: 0.3, bright: 1 }];
  curtain(ctx, 320, 180, folds, { gap: true, floor: 0.8 }); cyclorama(ctx, 320, 180, { floor: 0.75 }); voidSet(ctx, 320, 180, { color: '#fff', dir: 'h', at: 0.3, size: 0.1 });
  for (const k of SCULPTURES) sculpture(ctx, k, 100, 150, 80);
  floorShadow(ctx, 100, 150, 30); vignette(ctx, 320, 180);
  assert.ok(ctx.calls.fillRect > 8 && ctx.calls.createLinearGradient >= 4 && ctx.calls.fill >= 5 && ctx.calls.save === ctx.calls.restore);
  assert.equal(SCULPTURES.length, 5);
});

test('tableau is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 30, 'a portrait fills');
    assert.equal(ctx.calls.save, ctx.calls.restore, 'every transform restored');
    assert.equal(p.state.cast.length, 24);
    assert.ok(p.state.cuts >= 1, 'the song has cut between shots (four bars: the opening shot, then the drop)');
    assert.equal(p.state.plan.length, 2, 'a plan per section');
    assert.ok(p.state.plan.every((shots) => shots.length && Math.abs(shots.reduce((n, x) => n + x.len, 0) - 2) < 1e-6), 'each section\'s shots fill its bars back to back');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b);
  assert.notEqual(a, c);
  const st = run(song(g)).state;
  assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'plain data: no functions, no NaN, no Infinity');
});

test('the timeline: phases from role and energy, the first shot a long still red-curtain portrait of a lead, the last a duo of the leads, punctuation never twice in a row, every template drawn, every framing and pose laid out', async () => {
  const g = await ready;
  const secs = (e) => e.map((energy, i) => ({ name: 's' + i, role: null, energy, bars: 8 }));
  assert.deepEqual(secs([0.3, 0.5, 0.8, 1, 0.4]).map((_, i, a) => phaseOf(a, i, null)), ['opening', 'development', 'escalation', 'peak', 'release']);
  assert.deepEqual([{ role: 'establish', energy: 1 }, { role: 'develop', energy: 0.2 }, { role: 'climax', energy: 0.5 }, { role: 'release', energy: 1 }].map((s, i, a) => phaseOf(a, i, null)), ['opening', 'escalation', 'peak', 'release'], 'roles win: the section before the climax escalates');
  const ir = g.song({ cps: .5, key: 'C:minor', seed: 5, visual: 'tableau' }, [
    g.section('a', 16, { role: 'establish', drums: { density: .3 } }), g.section('b', 16, { role: 'develop', drums: { density: .6 }, melody: { notes: '0 2' } }), g.section('c', 16, { role: 'develop', drums: { density: .8 }, bass: {} }), g.section('d', 16, { role: 'climax', drums: { density: 1 }, bass: {}, melody: { notes: '0 4' } }), g.section('e', 16, { role: 'release', pad: {} }),
  ]).strudel, score = composeVisual(ir), s = createPerformance(tableau, score, { w: 16, h: 9 }).state;
  assert.deepEqual(s.phases, ['opening', 'development', 'escalation', 'peak', 'release']);
  const first = s.plan[0][0], last = s.plan[4].at(-1);
  assert.ok(first.tpl === 'redCurtainSoloPortrait' && first.len === 8 && first.pose === 'statueStill' && first.ids[0] === s.leads[0] && !first.mutate, 'the opening shot');
  assert.ok(last.tpl === 'redCurtainDuo' && last.len >= 8 && last.ids.length === 2 && s.leads.includes(last.ids[0]) && s.leads.includes(last.ids[1]) && !last.mutate, 'the closing duo');
  const all = s.plan.flat(); assert.ok(all.length > 20, 'an 80-bar song is many shots');
  for (const shots of s.plan) for (let i = 1; i < shots.length; i++) assert.ok(!(['mirroredFace', 'splitFace', 'duplicateGrid', 'repeatedCharacterGrid', 'blackVoidPortrait', 'eyesCrop', 'extremeFaceCrop'].includes(shots[i].tpl) && ['mirroredFace', 'splitFace', 'duplicateGrid', 'repeatedCharacterGrid', 'blackVoidPortrait', 'eyesCrop', 'extremeFaceCrop'].includes(shots[i - 1].tpl)), 'punctuation is never two in a row');
  assert.ok(all.every((x) => x.ids.length > 0) && Object.values(TEMPLATES).every((t) => t.n > 0), 'every shot holds somebody: there is no empty graphic frame to cut to');
  const sp = all.find((x) => x.fx === 'split'); if (sp) assert.ok(sp.layout.every((l) => l.dx === 0 && l.turn === sp.layout[0].turn && l.tilt === sp.layout[0].tilt && l.k === sp.layout[0].k), 'both halves of a split face stand the same way, centred');
  const mean = (i) => s.plan[i].reduce((n, x) => n + x.len, 0) / s.plan[i].length;
  assert.ok(mean(0) > mean(3) && mean(4) > mean(3), 'the peak cuts faster than the opening and the release');
  assert.ok(all.some((x) => x.mutate || x.cascade) && all.some((x) => x.alts.length > 1), 'some shots mutate');
  assert.ok(all.every((x) => x.ids.every((id) => id >= 0 && id < 24)), 'every id is a cast member');
  assert.ok(all.every((x) => x.alts.every((alt) => alt.every((st, i) => !HOODED.includes(st.costume) || s.cast[x.ids[i]].base.face.width <= HOOD_MAX_WIDTH))), 'no hood on a wide face, in any shot or mutation');
  assert.ok(HOODED.includes('goldHoodedMetallic') && !wearable(s.cast[ARCHETYPE_NAMES.indexOf('severeShaved')], 'goldHoodedMetallic') && wearable(s.cast[ARCHETYPE_NAMES.indexOf('goldHood')], 'goldHoodedMetallic'));
  assert.ok(s.plan[3].some((x) => x.set === 'white') && s.plan[3].some((x) => x.set === 'red'), 'the peak alternates the worlds');
  // every template renders on a stub, with every pose and framing it allows
  const clock = clockOf(score, 0), fresh = () => createPerformance(tableau, score, { w: 16, h: 9 }).state;
  for (const [name, tpl] of Object.entries(TEMPLATES)) {
    for (const pose of tpl.poses ?? ['none']) {
      const st = fresh(); st.plan = [[{ ...st.plan[0][0], tpl: name, set: tpl.set === 'any' ? 'white' : tpl.set, framing: tpl.framing ?? 'close', pose, ids: st.plan[0][0].ids.concat([1, 2]).slice(0, tpl.n), layout: layoutOf(pose, tpl.n, FRAMING[tpl.framing ?? 'close']), alts: [[{}, {}, {}].slice(0, tpl.n).map((_, i) => ({ costume: tpl.costume ?? 'plainTee', makeup: [], marks: [], props: [] }))], fx: tpl.fx ?? null, grid: tpl.grid ?? 0, band: tpl.band ? { color: '#fff', dir: 'v', at: 0.3, size: 0.1 } : null, sculptures: tpl.sculptures ? [{ kind: 'bust', x: -0.6, size: 0.5 }] : [], gap: !!tpl.gap }]];
      st.section = 0; st.shotIx = 0; tableau.step(st, STEP, [], clock);
      const ctx = ctxStub(); tableau.draw(st, ctx, 320, 180);
      assert.equal(ctx.calls.save, ctx.calls.restore, `${name} ${pose} restores`); assert.ok(ctx.calls.fillRect > 0, `${name} ${pose} paints`);
      if (tpl.n) assert.ok(ctx.calls.fill > 10, `${name} ${pose} draws a figure`);
    }
  }
  for (const fr of Object.keys(FRAMING)) assert.ok(layoutOf('rowFrontal', 3, FRAMING[fr]).length === 3 && layoutOf('directFrontal', 1, FRAMING[fr]).length === 1);
  assert.equal(layoutOf('linkedArmDuo', 2, FRAMING.medium)[0].arm, 1, 'the linked arm reaches the second figure');
});

test('every cast job reaches the state: a snare jump-cuts a mutating shot and never within the gap, a kick is a rare punch, hats blink one actor every few seconds, the melody moves the eyes, the impact flashes, the riser pushes in, the dropout darkens, a new bar past a shot cuts on the timeline, a boundary restarts the section\'s plan', async () => {
  const g = await ready;
  const ir = song(g), score = composeVisual(ir), clock = clockOf(score, 0);
  const fresh = () => { const s = createPerformance(tableau, score, { w: 16, h: 9 }).state; for (let i = 0; i < 12; i++) tableau.step(s, STEP, [], clock); return s; };
  const one = (ev, s = fresh()) => { tableau.step(s, STEP, [ev], clock); return s; };
  const still = fresh(), sh = still.plan[still.section][still.shotIx];
  sh.mutate = true; sh.alts = [[{ costume: 'plainTee', makeup: [], marks: [], props: [] }], [{ costume: 'severeBlackSuit', makeup: [], marks: [], props: [] }]];
  let cut = null; for (let i = 0; i < 20 && !cut; i++) { const s = fresh(); s.plan[s.section][s.shotIx].mutate = true; s.plan[s.section][s.shotIx].alts = sh.alts; s.rnd = i * 1000 + 1; tableau.step(s, STEP, [SNARE], clock); if (s.variant === 1) cut = s; }
  assert.ok(cut, 'a snare jump-cuts a mutating shot');
  tableau.step(cut, STEP, [SNARE], clock); assert.equal(cut.variant, 1, 'not again within the gap');
  const held = fresh(); held.plan[held.section][held.shotIx].mutate = false; for (let i = 0; i < 20; i++) tableau.step(held, STEP, [SNARE], clock);
  assert.equal(held.variant, 0, 'a still shot never mutates');
  const kicks = fresh(); const before = kicks.punch; for (let i = 0; i < 300; i++) { tableau.step(kicks, STEP, [KICK], clock); }
  assert.ok(kicks.punch >= before, 'a kick may punch in and never pulls out');
  assert.ok(one(KICK).pulse > 0.9, 'a kick pulses the face (the mouth parts, the eyes and brows lift a touch)');
  assert.ok(one(KICK).bob > 0.9, 'and nods the body: the music is danced with the head and shoulders, not the brows');
  const swayed = fresh(); tableau.step(swayed, STEP, [], clockOf(score, 0.25));
  assert.ok(Math.abs(swayed.sway) > 0.05 && swayed.swayAmp > 0, 'the cast sways with the bar, from the song\'s own clock');
  const emoting = fresh(); emoting.plan[emoting.section][emoting.shotIx].emote = true; emoting.plan[emoting.section][emoting.shotIx].mutate = false;
  const was = JSON.stringify(emoting.exprTo); let moved = false; for (let i = 0; i < 12 && !moved; i++) { tableau.step(emoting, STEP, [SNARE], clock); for (let k = 0; k < 30; k++) tableau.step(emoting, STEP, [], clock); moved = JSON.stringify(emoting.exprTo) !== was; }
  assert.ok(moved, 'on an emoting shot a snare moves the actor to another expression');
  const mid = JSON.stringify(emoting.expr); tableau.step(emoting, STEP, [], clock); assert.notEqual(JSON.stringify(emoting.expr), mid, 'the expression eases there: an animation, not a cut');
  const stiff = fresh(); stiff.plan[stiff.section][stiff.shotIx].emote = false; const w2 = JSON.stringify(stiff.exprTo); for (let i = 0; i < 20; i++) { tableau.step(stiff, STEP, [SNARE], clock); for (let k = 0; k < 30; k++) tableau.step(stiff, STEP, [], clock); }
  assert.equal(JSON.stringify(stiff.exprTo), w2, 'a shot that does not emote holds its expression');
  assert.ok(Object.keys(EXPRESSIONS).length >= 12 && exprVals('grin').smile > 0.7 && exprVals('pout').smile < -0.2, 'a range of smiles to pick from');
  const ctx2 = ctxStub(); tableau.draw(kicks, ctx2, 320, 180); assert.equal(ctx2.calls.save, ctx2.calls.restore);
  assert.ok(['grin', 'smirk', 'pout', 'squint', 'wideEyed'].every((e) => exprVals(e).open === 0), 'no expression an actor moves to opens the mouth');
  const HAT = { ...base, layer: 'drums', kind: 'drums', voice: 'hh', role: 'grain' }, hat = one(HAT);
  assert.ok(hat.blink.some((b) => b > 0.9), 'a hat blinks an actor');
  for (let i = 0; i < 30; i++) tableau.step(hat, STEP, [], clock); tableau.step(hat, STEP, [HAT], clock); tableau.step(hat, STEP, [HAT], clock); tableau.step(hat, STEP, [HAT], clock);
  assert.ok(hat.blink.filter((b) => b > 0.9).length <= 2, 'the next hats half a second later cannot blink the same actor again');
  const mel = one({ ...base, layer: 'melody', kind: 'melody', note: 84, pan: 0.9 });
  assert.ok(mel.lookTo.x > 0.3 && mel.lookTo.y < 0, 'a high note on the right: the eyes go up and right, a little');
  assert.ok(one({ ...base, layer: 'fx', kind: 'fx', role: 'pulse', dur: 2 }).flash > 0.9, 'the impact is the flash frame');
  const rising = fresh(); for (let i = 0; i < 60; i++) tableau.step(rising, STEP, [], clockOf(score, 1.5));
  assert.ok(rising.riser > 0.3, 'the riser pushes in');
  const shut = fresh(); for (let i = 0; i < 90; i++) tableau.step(shut, STEP, [], clockOf(score, 3.5));
  assert.ok(shut.dark > 0.8, 'the dropout darkens');
  const later = fresh(), n0 = later.cuts; later.plan[0] = [{ ...later.plan[0][0], len: 0.5 }, { ...later.plan[0][0], at: 0.5, len: 1.5 }]; tableau.step(later, STEP, [], clockOf(score, 0.6));
  assert.equal(later.cuts, n0 + 1, 'the timeline cuts when the shot\'s bars are up');
  const bound = fresh(); tableau.step(bound, STEP, [], clockOf(score, 2, clockOf(score, 1.9)));
  assert.equal(bound.section, 1); assert.equal(bound.shotIx, 0, 'a boundary starts the next section\'s plan');
  const ctx = ctxStub(); tableau.draw(shut, ctx, 320, 180); assert.equal(ctx.calls.save, ctx.calls.restore);
});

test('a plain pattern (no song) runs on the fallback score', async () => {
  const g = await ready;
  const p = createPerformance(tableau, fallbackScore(0.5), { w: 16, h: 9 });
  const [h] = g.s('bd').queryArc(0, 1);
  p.push(eventOf(h, null, null, 0.1)); p.advance(0, 0); p.advance(0.5, 0.25);
  assert.ok(p.state.plan.length === 1 && p.state.plan[0].length > 1, 'one planned section of 64 bars');
  p.draw(ctxStub(), 320, 180);
});
