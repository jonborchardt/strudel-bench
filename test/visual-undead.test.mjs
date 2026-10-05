// web/visual/undead.mjs: the architecture a world must honour (injected randomness only, deterministic plain state)
// and what this world promises: a lead and a horde from the cast, a routine of steps one a beat, a shot plan per
// section with the horde as big as the section is loud and a routine of its own, every shot kind drawable, the dead
// rising on a riser and freezing on a dropout, and the two seams (UNDEAD/undeadOf, STEPS/ROUTINES) built from parts
// the portrait has. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import undead, { STEPS, ROUTINES, PHASES, SHOTS, SPOTS, FRAMING, UNDEAD, undeadOf, stepAt, planSection } from '../web/visual/undead.mjs';
import { identityOf, dress, ARCHETYPE_NAMES } from '../web/visual/cast.mjs';
import { portraitOps, PROP_STYLES, MAKEUP_STYLES } from '../web/visual/portrait.mjs';
import { graveyard } from '../web/visual/sets.mjs';
import { clockOf, createPerformance, fallbackScore, STEP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { ctxStub, run as runWorld, forbid, base, KICK } from './_visual.mjs';
import { seed } from '../web/visual/kit.mjs';
import { prng } from '../lib/random.mjs';
const run = (ir, seconds = 8) => runWorld(undead, ir, seconds);
const song = (g, seed = 3) => g.song({ cps: .5, key: 'C:minor', seed, visual: 'undead' }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', dropout: 1, drums: { density: .9 }, bass: { density: .8 }, melody: { density: .7, notes: '0 2 4 7' }, pad: { arp: 'up' }, perc: { sound: 'cajon' } }),
]).strudel;
const SNARE = { ...base, layer: 'drums', kind: 'drums', voice: 'sd', role: 'impact' };
const clean = (o) => !/NaN|undefined|Infinity/.test(JSON.stringify(o));

test('the seams are built from parts the portrait has: every routine step is a STEP, every step prop a PROP, the undead makeup real, and a corpse draws', () => {
  for (const [name, steps] of Object.entries(ROUTINES)) for (const st of steps) assert.ok(STEPS[st], `${name}: unknown step ${st}`);
  for (const [name, st] of Object.entries(STEPS)) for (const p of st.props ?? []) assert.ok(PROP_STYLES.includes(p), `${name}: unknown prop ${p}`);
  for (const m of UNDEAD.makeup) assert.ok(MAKEUP_STYLES.includes(m), `unknown makeup ${m}`);
  for (const P of Object.values(PHASES)) { for (const r of P.routines) assert.ok(ROUTINES[r]); assert.ok(P.horde[1] <= SPOTS.length && P.horde[0] <= P.horde[1]); for (const k of Object.keys(P.shots)) assert.ok(SHOTS[k], `unknown shot ${k}`); }
  const s = {}; seed(s, prng(2)); const idn = identityOf(s, ARCHETYPE_NAMES[0], 0);
  const live = dress(idn, { makeup: UNDEAD.makeup, expression: UNDEAD.expression }), dead = undeadOf(dress(idn, { makeup: UNDEAD.makeup, expression: UNDEAD.expression }), 1);
  assert.notEqual(dead.skin, live.skin, 'the skin drains'); assert.ok(dead.mouth.open > 0 && dead.eyes.openness > live.eyes.openness, 'the mouth hangs open, the eyes stare');
  assert.ok(clean(portraitOps(dead)) && portraitOps(dead).length > 20);
  assert.equal(undeadOf({ skin: '#ffffff', eyes: {}, mouth: {} }, 0).skin, '#ffffff', 'decay 0 is the living face');
  const ctx = ctxStub(); graveyard(ctx, 320, 180, [{ x: 0.2, w: 0.04, h: 0.1 }, { x: 0.7, w: 0.05, h: 0.12 }], { floor: 0.9, far: 0.6 });
  assert.ok(ctx.calls.fillRect >= 5 && ctx.calls.arc >= 3 && ctx.calls.createLinearGradient >= 3, 'the set paints: sky, moon, stones, fog, ground');
});

test('one step a beat from the song clock', () => {
  const sc = fallbackScore(), at = (cycle) => stepAt('thriller', clockOf(sc, cycle));
  assert.equal(at(0), ROUTINES.thriller[0]); assert.equal(at(0.25), ROUTINES.thriller[1]); assert.equal(at(1), ROUTINES.thriller[4]); assert.equal(at(2), ROUTINES.thriller[0], 'eight steps wrap over two bars');
  assert.equal(stepAt('nope', clockOf(sc, 0)), ROUTINES.sway[0], 'an unknown routine sways');
});

test('the plan: shots fill each section back to back, no cutaway twice in a row, the horde follows the energy inside the phase, each section its own routine, every shot kind drawn', async () => {
  const g = await ready;
  const ir = g.song({ cps: .5, key: 'C:minor', seed: 5, visual: 'undead' }, [
    g.section('a', 16, { role: 'establish', drums: { density: .3 } }), g.section('b', 16, { role: 'develop', drums: { density: .5 }, melody: { notes: '0 2' } }), g.section('c', 16, { role: 'develop', drums: { density: .55 }, melody: { notes: '0 2 4' } }), g.section('d', 16, { role: 'climax', drums: { density: 1 }, bass: {}, melody: { notes: '0 2 4 7' }, pad: {} }), g.section('e', 8, { role: 'release', pad: {} }),
  ]).strudel, score = composeVisual(ir), s = createPerformance(undead, score, { w: 16, h: 9 }).state;
  assert.deepEqual(s.phases, ['opening', 'development', 'escalation', 'peak', 'release']);
  assert.ok(s.hordes[0] === 0 && s.hordes[4] === 0 && s.hordes[1] >= 3 && s.hordes[1] < s.hordes[3] && s.hordes[3] >= 8, `the horde grows with the energy: ${s.hordes}`);
  for (let i = 0; i < 5; i++) { const shots = s.plan[i]; assert.ok(shots.length && Math.abs(shots.reduce((n, x) => n + x.len, 0) - score.sections[i].bars) < 1e-6, 'the shots fill the bars'); for (let k = 1; k < shots.length; k++) assert.ok(!(shots[k].kind === shots[k - 1].kind && shots[k].kind !== 'line'), 'no cutaway twice'); }
  assert.ok(s.plan.flat().length > 20 && new Set(s.plan.flat().map((x) => x.kind)).size >= 4, 'a 72-bar song is many shots of several kinds');
  assert.ok(ROUTINES[s.routines[1]] && PHASES.peak.routines.includes(s.routines[3]));
  const sp = {}; seed(sp, prng(9)); const kinds = new Set(Array.from({ length: 12 }, () => planSection(sp, 16, 'peak', 9)).flat().map((x) => x.kind));
  for (const k of Object.keys(PHASES.peak.shots)) assert.ok(kinds.has(k), `the peak plans ${k} sooner or later`);
  for (const kind of Object.keys(SHOTS)) { // every kind draws, clips balanced
    const st = JSON.parse(JSON.stringify(s)); st.section = 3; st.plan[3] = [{ at: 0, len: 16, kind, who: [0, 1, 2, 3, 4, 5, 6, 7, 8] }]; st.shotIx = 0; st.figures.forEach((f) => { f.up = 1; });
    const ctx = ctxStub(); undead.draw(st, ctx, 320, 180); assert.equal(ctx.calls.save, ctx.calls.restore, kind); assert.ok(ctx.calls.fill > 30, kind);
  }
});

test('undead is importable in Node and draws on a stub context with no randomness or clock of its own', async () => {
  const g = await ready;
  const undo = [forbid(Math, 'random'), forbid(Date, 'now'), forbid(performance, 'now')];
  try {
    const p = run(song(g)), ctx = ctxStub();
    p.draw(ctx, 320, 180);
    assert.ok(ctx.calls.fill > 30, 'portraits fill');
    assert.equal(ctx.calls.save, ctx.calls.restore, 'every transform and clip restored');
    assert.equal(p.state.cast.length, 24); assert.equal(p.state.figures.length, SPOTS.length + 1, 'the lead and one corpse per spot');
    assert.deepEqual(p.state.phases, ['opening', 'peak']);
    assert.equal(p.state.phase, 'peak'); assert.ok(p.state.wanted >= 8, 'the climax raises the horde');
    assert.ok(p.state.figures.slice(1, 1 + p.state.wanted).every((f) => f.up > 0.5), 'the horde is up four seconds into the drop');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state; assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'plain data: no functions, no NaN, no Infinity');
});

test('the music moves it: a kick nods, a snare snaps the head, alternates sides and turns the close-up to the next corpse, a dropout freezes everyone and dims, the opening stands the lead alone close up', () => {
  const sc = fallbackScore(), s = undead.init(sc, prng(1), { w: 16, h: 9 }), c0 = clockOf(sc, 0);
  undead.step(s, STEP, [], c0);
  assert.equal(s.wanted, 0, 'no horde to open'); assert.equal(s.plan[0][0].kind, 'leadClose', 'the fallback song opens close on the lead'); assert.ok(Math.abs(s.u - FRAMING.close.u) < 20);
  undead.step(s, STEP, [KICK], c0); assert.ok(s.bob > 0.9);
  undead.step(s, STEP, [SNARE], c0); const d1 = s.snapDir, v1 = s.variant; assert.ok(s.snap > 0.9);
  for (let i = 0; i < 12; i++) undead.step(s, STEP, [], c0); undead.step(s, STEP, [SNARE], c0); assert.equal(s.snapDir, -d1, 'the next snap goes the other way'); assert.equal(s.variant, v1 + 1, 'and the close-up moves on');
  for (let i = 0; i < 60; i++) undead.step(s, STEP, [], { ...c0, dropout: true });
  assert.ok(s.freeze > 0.9 && s.dark > 0.8, 'a second into a dropout: frozen and dark');
  const held = JSON.stringify(s.figures[0].cur); undead.step(s, STEP, [], { ...clockOf(sc, 0.25), dropout: true }); assert.equal(JSON.stringify(s.figures[0].cur), held, 'frozen figures hold their position across a beat');
  const ctx = ctxStub(); undead.draw(s, ctx, 320, 180); assert.equal(ctx.calls.save, ctx.calls.restore);
});
