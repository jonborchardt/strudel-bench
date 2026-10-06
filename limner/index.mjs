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
export { seed, rand, prng, pick, clamp, lerp } from './rng.mjs';
