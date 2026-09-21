// The seeded generator every deterministic choice in lib/ and gen/ draws from: a song's generated lines (lib/layers.mjs),
// a form's key and kit (gen/form.mjs), a visual world (lib/visual.mjs). Its own module so a consumer that wants only
// numbers does not import the layers (and register them) to get them.
/** An LCG over `seed`: () => a number in [0, 1). Its top bits barely move between neighbouring seeds, so pick from a list with the middle bits (`pick`). */
export const prng = (seed) => { let x = (seed * 2654435761) >>> 0; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
/** One of `list` by the generator's middle bits, so seeds 1, 2, 3 land on different entries. */
export const pick = (rnd, list) => list[Math.floor(rnd() * 2 ** 16) % list.length];
