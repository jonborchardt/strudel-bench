// The seeded generators limner draws from, and the two bits of arithmetic every part of it clamps with, copied verbatim
// out of the host they came from (web/visual/kit.mjs and lib/random.mjs). Verbatim is the point: limner owns its own
// determinism now, and every golden in its suite is a statement about these exact bit patterns.
//
// `rand` keeps its cursor in a caller-owned object rather than in a closure, because a whole scene of people has to come
// out of one stream: the generators take that object, and `person()` in index.mjs is the sugar for a caller who has no
// stream of their own.

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * clamp(t);

/** A generator in a state object: `seed(s, rng)` puts the first value from the injected rng, `rand(s)` steps it (mulberry32) and returns [0, 1). */
export const seed = (s, rng) => { s.rnd = Math.floor(rng() * 2 ** 31); };
export const rand = (s) => { s.rnd = (s.rnd + 0x6d2b79f5) | 0; let t = Math.imul(s.rnd ^ (s.rnd >>> 15), 1 | s.rnd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** An LCG over `seed`: () => a number in [0, 1). Its top bits barely move between neighbouring seeds, so pick from a list with the middle bits (`pick`). */
export const prng = (seed) => { let x = (seed * 2654435761) >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
/** One of `list` by the generator's middle bits, so seeds 1, 2, 3 land on different entries. */
export const pick = (rnd, list) => list[Math.floor(rnd() * 2 ** 16) % list.length];
