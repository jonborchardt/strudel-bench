// limner: draws one person. Parameters in, ops out, SVG or canvas from the ops.
//
//   portraitOps(params) -> ops        the one computation
//   toSvg(ops, background)            a string
//   drawOn(ctx, ops, alpha)           a canvas
//   renderPortrait(params)            the one-liner: toSvg(portraitOps(p))
//
// It knows anatomy, faces, wardrobe and stances, and it can invent a plausible person of a given people. It does not know
// that music, video, frames or multiple figures exist: where a figure stands in a scene, how big it is drawn and whether
// it puts an arm around a neighbour are the host's business, because those are facts about a composition and not about a
// body. A host draws a group by calling limner once per person and placing the boxes.
//
// Ops, not SVG, are the published output type. A video export pushes 1920x1080 at thirty frames a second through a
// canvas, and rasterising an SVG string per frame would not keep up.
export * from './portrait.mjs';
export * from './people.mjs';
export { CASTS, PACKS, CAST_MODULES } from './registry.mjs';
export { STANCES, stanceOf, stanceNames } from './stances.mjs';
export { seed, rand, prng, pick, clamp, lerp } from './rng.mjs';

// --- the seeded-person sugar ---
//
// `characterFrom` and `identityFrom` take a caller-owned PRNG state, because a whole scene of people has to come out of
// one stream: that is what makes a crowd reproducible, and it is a contract, not an implementation detail. These two are
// for a caller with no stream of its own. They live here rather than in people.mjs because they need the cast registry,
// and registry.mjs imports the casts, which import people.mjs.
import { characterFrom as _characterFrom, identityFrom as _identityFrom } from './people.mjs';
import { CASTS as _CASTS } from './registry.mjs';
import { seed as _seed, prng as _prng } from './rng.mjs';

const castOf = (cast) => (typeof cast === 'string' ? _CASTS[cast] ?? _CASTS.editorial : cast ?? _CASTS.editorial);
const stateFor = (n) => { const s = {}; _seed(s, _prng(n)); return s; };

/** A random person of a cast, from a seed: portrait parameters, ready to draw.
 *
 *    renderPortrait(person({ cast: 'dwarves', seed: 7 }))
 *
 *  Note the asymmetry with `archetype`, which is in the generators underneath and not introduced here: a *character* is
 *  already a drawable set of parameters, while an *identity* is a person plus the wardrobe they own, and has to be
 *  dressed for an occasion before it can be drawn. A crowd is characters; a recurring cast is identities.
 *
 *  Inside a scene, pass your own state to `characterFrom` instead, so every draw comes from one stream and the whole
 *  crowd is reproducible together. */
export const person = ({ cast = 'editorial', seed: sd = 1, role = 'none', energy = 0.5 } = {}) =>
  _characterFrom(castOf(cast), stateFor(sd), role, energy);

/** A named archetype of a cast, from a seed: an identity, which `dress` turns into parameters.
 *
 *    renderPortrait(dress(archetype({ cast: 'elves', seed: 3, name: 'moonsinger' }), { expression: 'deadpan' }))
 *
 *  Same seeding contract as `person`. */
export const archetype = ({ cast = 'editorial', seed: sd = 1, name, id = 0 } = {}) =>
  _identityFrom(castOf(cast), stateFor(sd), name ?? castOf(cast).archetypeNames[0], id);
