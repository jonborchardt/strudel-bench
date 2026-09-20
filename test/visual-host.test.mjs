// web/visual/host.mjs: events from haps, the clock from the score, the fixed-step performance. No world here: a
// counting test world shows what a real one is handed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { eventOf, clockOf, createPerformance, fallbackScore, STEP, MAX_CATCHUP } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';

const hapsOf = (pat, cycles = 1) => pat.queryArc(0, cycles).filter((h) => h.hasOnset()).sort((a, b) => a.whole.begin.valueOf() - b.whole.begin.valueOf());

test('eventOf: a tapped hap becomes an event with its part, what classifyHap reads, the controls a world uses and its two times', async () => {
  const g = await ready;
  const [h] = hapsOf(g.s('bd').bank('RolandTR909').gain(.8).pan(.3).lpf(900));
  const e = eventOf(h, 'drums', 'drums', 12.5);
  assert.deepEqual(e, { t: 12.5, cycle: 0, dur: 1, layer: 'drums', kind: 'drums', voice: 'bd', role: 'pulse', note: null, gain: .8, velocity: 1, pan: .3, cutoff: 900, room: 0 });
  const [m] = hapsOf(g.note('c3').s('piano').late(.25));
  const e2 = eventOf(m, 'melody', 'melody', 3);
  assert.equal(e2.cycle, .25); assert.equal(e2.note, 48); assert.equal(e2.kind, 'melody');
  assert.deepEqual([e2.gain, e2.velocity, e2.pan, e2.cutoff, e2.room], [1, 1, .5, null, 0], 'defaults where the hap sets nothing');
  const plain = eventOf(m, null, null, 3);
  assert.deepEqual([plain.layer, plain.kind], [null, 'pitched'], 'no tap on a part: the kind is what the value says');
  const probe = eventOf(hapsOf(g.pure(.7))[0], null, null, 0);
  assert.equal(probe.kind, 'none');
});

test('clockOf: section, bar, beat and phases in song cycles, the riser and dropout tails, the boundary flag, and the song wrapping', async () => {
  const g = await ready;
  const score = composeVisual(g.song({ cps: .5, key: 'C:minor', seed: 1 }, [
    g.section('a', 4, { drums: {}, fx: { riser: 2 } }),
    g.section('b', 4, { bpm: 60, dropout: 1, drums: {} }), // 4 bars over 8 song cycles
  ]).strudel);
  const c0 = clockOf(score, 0);
  assert.deepEqual([c0.section, c0.index, c0.bar, c0.beat, c0.energy, c0.riser, c0.dropout, c0.boundary], ['a', 0, 0, 0, score.sections[0].energy, 0, false, false]);
  const c1 = clockOf(score, 1.5, c0);
  assert.deepEqual([c1.bar, c1.beat, c1.barPhase, c1.beatPhase], [1, 2, .5, 0]);
  assert.equal(c1.boundary, false);
  const c2 = clockOf(score, 2.25, c1);
  assert.ok(Math.abs(c2.riser - 1.75) < 1e-9, 'bars of riser left'); assert.equal(c2.riserBars, 2);
  const c3 = clockOf(score, 4, c2);
  assert.deepEqual([c3.section, c3.boundary, c3.riser, c3.bar], ['b', true, 0, 0]);
  const c4 = clockOf(score, 6, c3);
  assert.deepEqual([c4.bar, c4.dropout, c4.boundary], [1, false, false], 'b at half tempo: song cycle 6 is its bar 1');
  assert.equal(clockOf(score, 11.5).dropout, true, 'the last bar of b');
  const wrapped = clockOf(score, 12.5, c4);
  assert.deepEqual([wrapped.cycle, wrapped.section, wrapped.boundary], [.5, 'a', true], 'the song loops at total');
  assert.equal(clockOf(fallbackScore(), 3.25).section, null);
  assert.deepEqual([clockOf(fallbackScore(), 3.25).bar, clockOf(fallbackScore(), 3.25).energy], [3, .5]);
});

// a world that records what it is handed
const counting = () => ({
  name: 'counting',
  init: (score, rng, size) => ({ seed: rng(), size, steps: 0, events: [], clocks: [] }),
  step: (st, dt, events, clock) => { st.steps++; st.events.push(...events.map((e) => e.layer)); st.clocks.push(clock.cycle); assert.equal(dt, STEP); },
  draw: (st, ctx) => { ctx.drawn = st.steps; },
});

test('createPerformance: fixed steps from wall time, events delivered on the step their audio time passes, the clock per step, reset and rebase', () => {
  const score = { ...fallbackScore(0.5), seed: 7 };
  const p = createPerformance(counting(), score, { w: 4, h: 3 });
  const first = p.state.seed;
  assert.ok(first > 0 && first < 1, 'init gets the seeded generator');
  p.push({ t: 10.05, layer: 'late' }); p.push({ t: 10.0, layer: 'early' }); p.push({ t: 10.2, layer: 'future' });
  assert.equal(p.advance(10, 5), 0, 'the first call only sets the origin');
  assert.equal(p.advance(10.1, 5.05), 2, 'six steps: early at 10.0, late at 10.05, future not yet');
  assert.equal(p.state.steps, 6);
  assert.deepEqual(p.state.events, ['early', 'late']);
  assert.equal(p.pending, 1);
  assert.ok(Math.abs(p.state.clocks.at(-1) - 5.05) < 1e-9, 'the last step sits at now');
  assert.ok(p.state.clocks[0] < p.state.clocks.at(-1), 'earlier steps get earlier cycles');
  p.advance(10.1 + 3, 6.55); // a 3 s stall
  assert.ok(p.state.steps <= 6 + MAX_CATCHUP / STEP + 1, 'a stall is capped');
  const ctx = {}; p.draw(ctx, 4, 3); assert.equal(ctx.drawn, p.state.steps);
  p.rebase(); const before = p.state.steps; p.advance(100, 6.55); assert.equal(p.state.steps, before, 'after a rebase the gap is not simulated');
  p.push({ t: 100.01, layer: 'stale' }); p.flush(); p.advance(100.1, 6.6); assert.ok(!p.state.events.includes('stale'), 'a flush drops what was queued ahead');
  p.reset();
  assert.deepEqual([p.state.steps, p.state.events, p.pending, p.state.seed], [0, [], 0, first], 'reset is a fresh init from the same seed');
  p.setScore({ ...score, total: 8, sections: [{ name: 'only', at: 0, until: 8, bars: 8, energy: 1, riser: 0, dropout: 0 }] });
  p.advance(200, 1); p.advance(200.1, 1.05);
  assert.equal(p.clock.section, 'only', 'the clock reads the new score; the state was kept');
});

test('createPerformance is deterministic: the same score and event stream give the same state; a different seed does not', () => {
  const run = (seed) => {
    const p = createPerformance(counting(), { ...fallbackScore(), seed });
    p.advance(0, 0); p.push({ t: .02, layer: 'x' }); p.advance(.1, .05); p.advance(.25, .125);
    return JSON.stringify(p.state);
  };
  assert.equal(run(3), run(3));
  assert.notEqual(run(3), run(4));
});
