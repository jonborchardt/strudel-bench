// web/visual/undead.mjs: the architecture a world must honour (injected randomness only, deterministic plain state)
// and what this world promises: a lead and a horde from the cast, a routine of steps one a beat, the horde's size and
// routine by phase, the dead rising on a riser and freezing on a dropout, and the two seams (UNDEAD/undeadOf, STEPS/
// ROUTINES) built from parts the portrait has. Human eyes judge the look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import undead, { STEPS, ROUTINES, PHASES, SPOTS, FRAMING, UNDEAD, undeadOf, stepAt } from '../web/visual/undead.mjs';
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
  for (const P of Object.values(PHASES)) { assert.ok(ROUTINES[P.routine]); assert.ok(P.horde <= SPOTS.length); }
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
    assert.equal(p.state.phase, 'peak'); assert.equal(p.state.wanted, 9, 'the climax raises the whole horde');
    assert.ok(p.state.figures.slice(1).every((f) => f.up > 0.5), 'the horde is up four seconds into the drop');
    assert.ok(p.state.figures[0].props.length || ROUTINES.thriller.includes(p.state.figures[0].step), 'the lead is on a thriller step');
  } finally { for (const u of undo) u(); }
});

test('the same score and stream give the same state; another seed gives another; plain data', async () => {
  const g = await ready;
  const a = JSON.stringify(run(song(g)).state), b = JSON.stringify(run(song(g)).state), c = JSON.stringify(run(song(g, 4)).state);
  assert.equal(a, b); assert.notEqual(a, c);
  const st = run(song(g)).state; assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'plain data: no functions, no NaN, no Infinity');
});

test('the music moves it: a kick nods, a snare snaps the head and alternates sides, a dropout freezes everyone and dims, the opening stands the lead alone close up', () => {
  const sc = fallbackScore(), s = undead.init(sc, prng(1), { w: 16, h: 9 }), c0 = clockOf(sc, 0);
  assert.equal(s.wanted, 0, 'no horde to open'); assert.equal(s.u, FRAMING.close.u);
  undead.step(s, STEP, [KICK], c0); assert.ok(s.bob > 0.9);
  undead.step(s, STEP, [SNARE], c0); const d1 = s.snapDir; assert.ok(s.snap > 0.9);
  for (let i = 0; i < 12; i++) undead.step(s, STEP, [], c0); undead.step(s, STEP, [SNARE], c0); assert.equal(s.snapDir, -d1, 'the next snap goes the other way');
  for (let i = 0; i < 60; i++) undead.step(s, STEP, [], { ...c0, dropout: true });
  assert.ok(s.freeze > 0.9 && s.dark > 0.8, 'a second into a dropout: frozen and dark');
  const held = JSON.stringify(s.figures[0].cur); undead.step(s, STEP, [], { ...clockOf(sc, 0.25), dropout: true }); assert.equal(JSON.stringify(s.figures[0].cur), held, 'frozen figures hold their position across a beat');
  const ctx = ctxStub(); undead.draw(s, ctx, 320, 180); assert.equal(ctx.calls.save, ctx.calls.restore);
});
