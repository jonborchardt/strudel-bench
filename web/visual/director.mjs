// The director: a world that runs two worlds and composes them into one frame, the base full and a second breathing
// in and out over it, without either knowing. It has the world shape, { name, init, step, draw }, so createPerformance,
// the stage's loop, renderFrames and exportVideo drive it exactly as they drive a bare world; a single-world score
// never comes here (stage.mjs worldOf returns the bare world). State is plain data: the two children's states and
// the breath. Both children are stepped every step, so a cumulative second world keeps the whole history even while
// it is faded out; each draws into a target canvas of its own (created by `createCanvas`, kept in the closure like
// ink keeps `paint`: never state), and the compositor draws the second over the base at its breath. The breath comes
// from the song's own cycle, so live and offline agree. The base gets the score's own generator: alone, it is the
// bare world. Randomness only from the injected generator.
import { prng } from '../../lib/random.mjs';
import { lerp, ease } from './kit.mjs';
import POLICY from '../../lib/visual.json' with { type: 'json' };

export const PRESETS = Object.keys(POLICY.compositions);
export const BREATH = 8; // bars: the second world fades in over half of it and out over the other half, so the two worlds trade places
const PEAK = [0.45, 0.95]; // the breath's top by the section's energy: a quiet section barely shows the second world, a loud one lets it take the frame

/**
 * The breath at song cycle `c`: 0 at the start of every `bars`, 1 half way. With `every` longer than `bars` (the song's
 * `visual.every`), the visit comes once per `every` bars, at their start, and the second world stays out between visits.
 */
export const breathAt = (c, bars = BREATH, every = bars) => {
  const p = ((c % every) + every) % every;
  return p < bars ? 0.5 - 0.5 * Math.cos((2 * Math.PI * p) / bars) : 0;
};

/** The director for `WORLDS` (name -> world) over a score whose composition lists the base and the second world. `createCanvas(w, h)` makes a target (OffscreenCanvas in the page; a stub in tests). The result is a world. */
export function createDirector(WORLDS, { createCanvas = defaultCanvas } = {}) {
  const targets = {}; // base, over -> { canvas, ctx, w, h }: draw's own, never state
  const target = (key, w, h) => {
    let t = targets[key];
    if (!t) { const canvas = createCanvas(w, h); t = targets[key] = { canvas, ctx: canvas.getContext('2d'), w, h }; }
    if (t.w !== w || t.h !== h) { t.canvas.width = w; t.canvas.height = h; t.w = w; t.h = h; } // a resize clears it: the world paints the whole frame again (its contract)
    return t;
  };
  const worldOf = (name) => WORLDS[name] ?? WORLDS.tunnel;
  return {
    name: 'director',
    init(score, rng, size) {
      const [base, over] = score.composition?.worlds ?? [score.world];
      for (const k of Object.keys(targets)) delete targets[k];
      return { base, over: over ?? null, every: score.composition?.every ?? BREATH, children: { base: worldOf(base).init(score, rng, size), ...(over ? { over: worldOf(over).init(score, prng((score.seed ?? 1) * 1000 + 1), size) } : {}) }, breath: 0, peak: PEAK[0] };
    },
    step(s, dt, events, clock) {
      s.breath = breathAt(clock.cycle, BREATH, s.every);
      s.peak = ease(s.peak, lerp(PEAK[0], PEAK[1], clock.energy), 1, dt); // the top follows the section's energy over a second or so, never a jump at the boundary
      worldOf(s.base).step(s.children.base, dt, events, clock);
      if (s.over) worldOf(s.over).step(s.children.over, dt, events, clock);
    },
    draw(s, ctx, w, h) {
      const b = target('base', w, h);
      worldOf(s.base).draw(s.children.base, b.ctx, b.w, b.h);
      ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.drawImage(b.canvas, 0, 0, w, h);
      const a = s.over ? s.peak * s.breath : 0;
      if (a > 0.003) { const o = target('over', w, h); worldOf(s.over).draw(s.children.over, o.ctx, o.w, o.h); ctx.globalAlpha = a; ctx.drawImage(o.canvas, 0, 0, w, h); }
      ctx.restore();
    },
  };
}

function defaultCanvas(w, h) {
  if (typeof OffscreenCanvas === 'undefined') throw new Error('createDirector needs createCanvas outside a browser');
  return new OffscreenCanvas(w, h);
}
