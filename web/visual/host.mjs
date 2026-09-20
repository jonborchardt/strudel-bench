// The stage's DOM-free core: what a hap becomes as a visual event, what the world is told about the musical moment,
// and the fixed-step performance that drives a world from a stream of events. The canvas, the frame loop and the
// transport hooks are the page's (index.html); this file runs in Node too, so the tests and, later, an offline
// render can drive a world exactly as the live page does.
import { classifyHap } from '../../lib/visual.mjs';
import { prng } from '../../lib/random.mjs';

export const STEP = 1 / 60; // the simulation's fixed step, live and offline alike
export const MAX_CATCHUP = 0.5; // seconds a stalled frame may replay at once (a hidden tab does not simulate an hour)

const num = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/**
 * A hap as a visual event: its part (`layer`, from the tap the page put on that layer; null for a plain pattern), its
 * kind (the layer's, else what classifyHap reads from the value), the voice and note classifyHap finds, the controls
 * a world reads, and its time: `t` on the audio clock (the scheduler's targetTime, when it sounds), `cycle` the
 * pattern's own position (song cycles, or a pinned section's bars).
 */
export function eventOf(hap, layer, kind, targetTime) {
  const v = hap.value && typeof hap.value === 'object' ? hap.value : {};
  const c = classifyHap(hap.value);
  return {
    t: targetTime, cycle: hap.whole ? hap.whole.begin.valueOf() : hap.part.begin.valueOf(), dur: hap.duration.valueOf(),
    layer: layer ?? null, kind: kind ?? c.kind, voice: c.voice, role: c.role, note: c.note,
    gain: num(v.gain, 1), velocity: num(v.velocity, 1), pan: num(v.pan, 0.5), cutoff: num(v.cutoff, null), room: num(v.room, 0),
  };
}

/** A score for a pattern with no song() behind it: one neutral tunnel, no sections, so the world still has an identity. */
export const fallbackScore = (cps = 0.5) => ({
  seed: 1, mood: 'neutral', world: 'tunnel',
  palette: { temperature: 'cool', luminance: 0.5, mass: 0.5, edge: 0.5, jitter: 0.5, persistence: 0.5, spread: 0.5, motion: 0.5 },
  cps, total: 0, meter: '4/4', key: 'C:minor', cast: {}, sections: [], peak: null, climax: null,
});

/**
 * The musical moment at song cycle `cycle` (wrapped into the song, which loops): the section and where in it (bar,
 * beat, phases in 0..1), its energy, how many bars of riser tail remain (0 outside one), whether the dropout tail is
 * on, and whether this is the first moment of a new section (`prev` is the last clock). No sections: bars from the
 * cycle alone, energy .5.
 */
export function clockOf(score, cycle, prev = null) {
  const beats = +String(score.meter ?? '4/4').split('/')[0] || 4;
  const c = score.total > 0 ? ((cycle % score.total) + score.total) % score.total : Math.max(0, cycle);
  const i = score.sections.findLastIndex((s) => s.at <= c);
  const s = i >= 0 ? score.sections[i] : null;
  const local = s ? ((c - s.at) * s.bars) / (s.until - s.at) : c; // bars into the section (its own tempo)
  const bar = Math.floor(local), barPhase = local - bar, beat = Math.floor(barPhase * beats), beatPhase = (barPhase * beats) % 1;
  const left = s ? s.bars - local : Infinity;
  return {
    cycle: c, section: s?.name ?? null, index: i, bar, barPhase, beat, beatPhase, beats,
    energy: s ? s.energy : 0.5,
    riser: s?.riser && left <= s.riser ? left : 0, riserBars: s?.riser ?? 0,
    dropout: !!(s?.dropout && left <= s.dropout),
    boundary: prev !== null && prev.section !== (s?.name ?? null),
  };
}

/**
 * A world run at a fixed step from an event stream. `push` queues events (any order; they are due at their audio
 * time `t`); `advance(now, cycle)` (audio seconds and the song cycle sounding at that instant, both from the page's
 * clock) replays the fixed steps since the last call, giving each step the events due by then and the clock at that
 * step; `draw` hands the state to the world; `reset` starts the world again from the score's seed, the
 * discontinuity path (stop, seek, pin). `rebase` after a pause so the pause is not simulated as a stall.
 */
export function createPerformance(world, score, size = { w: 16, h: 9 }) {
  let state, queue, acc, last, clock;
  const init = () => { state = world.init(score, prng(score.seed ?? 1), size); queue = []; acc = 0; last = null; clock = null; };
  init();
  return {
    get state() { return state; },
    get clock() { return clock; },
    get pending() { return queue.length; },
    push(ev) { queue.push(ev); },
    flush() { queue.length = 0; }, // on a pause: the scheduler re-queries from the paused cycle on resume, so what was queued ahead would sound twice
    rebase() { last = null; },
    reset: init,
    setScore(next) { score = next; }, // a re-evaluation with the same identity: the sections may have moved, the world keeps its state
    advance(now, cycle) {
      if (last === null) last = now;
      acc += Math.min(Math.max(0, now - last), MAX_CATCHUP); last = now;
      const steps = Math.floor(acc / STEP + 1e-9); acc = Math.max(0, acc - steps * STEP); // the epsilon: 0.1 / (1/60) floors to 5 without it
      if (!steps) return 0;
      queue.sort((a, b) => a.t - b.t);
      let fired = 0;
      for (let k = 0; k < steps; k++) {
        const ahead = acc + (steps - 1 - k) * STEP; // how far this step sits before `now`
        const at = now - ahead;
        let n = 0; while (n < queue.length && queue[n].t <= at) n++;
        const due = queue.splice(0, n); fired += n;
        clock = clockOf(score, cycle - ahead * score.cps, clock);
        world.step(state, STEP, due, clock);
      }
      return fired;
    },
    draw(ctx, w, h) { world.draw(state, ctx, w, h); },
  };
}
