// What every world shares: a palette from the score, easing and decay, a seeded generator that lives inside a
// world's state (step() gets no rng: the state must hold everything, so an offline render replays it exactly), and
// a few canvas strokes. Units are the canvas height, never pixels, so a 320-wide stage and a 1080p export agree.
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * clamp(t);
/** x after `dt` seconds of exponential decay at `rate` per second. */
export const decay = (x, rate, dt) => x * Math.exp(-rate * dt);
/** x eased toward `to` with time constant 1/rate: the same result whatever the step size. */
export const ease = (x, to, rate, dt) => to + (x - to) * Math.exp(-rate * dt);
export const hsla = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360} ${clamp(s, 0, 100)}% ${clamp(l, 0, 100)}% / ${clamp(a)})`;

/** A generator in a state object: `seed(s, rng)` puts the first value from the injected rng, `rand(s)` steps it (mulberry32) and returns [0, 1). */
export const seed = (s, rng) => { s.rnd = Math.floor(rng() * 2 ** 31); };
export const rand = (s) => { s.rnd = (s.rnd + 0x6d2b79f5) | 0; let t = Math.imul(s.rnd ^ (s.rnd >>> 15), 1 | s.rnd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the temperature words lib/visual.json uses, as hue bands; a world may read them or not
const HUES = { cool: 215, warm: 28, dim: 272, pale: 172 };
/** The look a score asks for: a base hue inside its temperature's band (the seed picks where), saturation by temperature, lightness by luminance, and two related hues for a line and a field. */
export function paletteOf(score, rng) {
  const p = score.palette;
  const hue = (HUES[p.temperature] ?? HUES.cool) + (rng() - 0.5) * 36;
  const sat = p.temperature === 'pale' ? 34 : p.temperature === 'dim' ? 44 : 72;
  return { hue, sat, light: lerp(40, 66, p.luminance), line: hue + 150, field: hue - 38, bg: [hue, 28, 4] };
}

/** One frame's fade: paint the background at `alpha` over the last frame, so what was drawn persists as a trail. */
export function fadeFrame(ctx, w, h, [hh, s, l], alpha) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = hsla(hh, s, l, alpha);
  ctx.fillRect(0, 0, w, h);
}

/** A closed ring path at (cx, cy): a circle when `sides` is 0, else a polygon, with radius `r(theta)` so a wall can wobble or dent. */
export function ring(ctx, cx, cy, sides, r, sx = 1, sy = 1, rot = 0) {
  const n = sides || 64;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * Math.PI * 2, rr = r(a);
    const x = cx + Math.cos(a) * rr * sx, y = cy + Math.sin(a) * rr * sy;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
