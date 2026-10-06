// The dragonborn pack: what the dragonborn cast (casts/dragonborn.mjs) wears that nobody else does, tagged
// `only:dragonborn`; the plain kit it shares with the other fantasy casts is parts/fantasy.mjs. The muzzle is **not**
// here: a snout is the face's own nose, so it is the portrait's `nose.muzzle` dial (the bridge carried down into a
// nostril pad, the mouth widened and thinned with it), which the cast pins, exactly as the elves pin `ears.pointed`.
// A pack may only register parts, and a nose is not a part. What is here: the fangs that muzzle shows (a TEETH entry),
// scale rows over the brow and the cheeks, and two horns swept back off the temples on the `over` slot. A dragonborn
// has no hair worth drawing, so the cast's hair pool is the shaved styles alone. parts.html?pack=dragonborn is the sheet.
import { TOPS, JACKETS, MAKEUP, TEETH, NECKLINES, shade, path, ellipse, line, stroke, tag } from 'limner';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const SPIKE = '#4a4038';
const scale = (x, y, w, h = w * 0.6) => `M ${x} ${y} Q ${x + w / 2} ${y - h} ${x + w} ${y}`; // one scale's arc, written absolute: `fit` and the body's width map a path's numbers as x,y pairs, so a relative q would have its deltas scaled as points and shoot off the head

/** The teeth a muzzle shows when it opens or grins: a pale band with a long canine each side and the gaps between the
 *  front teeth. Clipped to the band by the caller, as every TEETH entry is, so the canines are cut to the lips. */
TEETH.fangs = (d, cx, w, ty, th) => [path(d, { fill: '#efe6d4' }),
  ...[-0.26, 0.26].map((f) => path(`M ${cx + w * f - 5} ${ty - th} L ${cx + w * f + 5} ${ty - th} L ${cx + w * f} ${ty + th * 1.5} Z`, { fill: '#f8f2e4' })),
  ...[-0.14, -0.05, 0.05, 0.14].map((f) => line(cx + w * f, ty - th, cx + w * f, ty + th, stroke('#3a1f1c', 1.2, 0.35)))];
/** Scale rows over the brow and the cheekbones, laid out by this face's width and kept inside its outline. */
MAKEUP.scaleHide = { fit: 'face', skin: (p) => { const dark = shade(p.skin, 0.66); return [
  ...[0, 1].flatMap((r) => [-2, -1, 0, 1, 2].map((k) => path(scale(194 + k * 22, 146 + r * 15, 12, 8), stroke(dark, 1.6, 0.4)))), // the brow
  ...[-1, 1].flatMap((sd) => [0, 1, 2].flatMap((r) => [0, 1].map((k) => path(scale(200 + sd * (30 + k * 14) - 6, 232 + r * 15, 12, 8), stroke(dark, 1.5, 0.35)))))]; } }; // and the cheeks, kept well inside the outline: `fit: 'face'` scales them out with the head's width, and a broad head threw the outer row past the cheek
/** Two horns swept back off the temples, ridged, with three small spines on the crown between them; on the `over` slot, so they come through whatever is on the head. A row of spikes standing up off the skull read as a mohawk of cones, which is why these lie back along it. */
MAKEUP.hornCrest = { fit: 'face', over: () => [-1, 1].flatMap((sd) => [
  path(`M ${200 + sd * 46} 162 C ${200 + sd * 64} 138, ${200 + sd * 80} 110, ${200 + sd * 92} 74` // the upper edge, back and up to the tip
    + ` C ${200 + sd * 76} 106, ${200 + sd * 58} 132, ${200 + sd * 36} 150 Z`, { fill: SPIKE, horn: true }), // and the lower edge home, so it tapers to a point
  path(`M ${200 + sd * 50} 156 C ${200 + sd * 66} 134, ${200 + sd * 80} 108, ${200 + sd * 90} 78`, stroke('#9a8b7e', 2, 0.35)), // the light along its back
  ...[0, 1, 2].map((i) => path(`M ${200 + sd * (44 + i * 14)} ${154 - i * 24} L ${200 + sd * (56 + i * 13)} ${146 - i * 22}`, stroke('#2b2220', 1.8, 0.45))), // growth ridges across it
  ...(sd > 0 ? [-1, 0, 1].map((k) => path(`M ${200 + k * 17 - 7} 120 L ${200 + k * 17} ${104 - (k ? 4 : 0)} L ${200 + k * 17 + 7} 120 Z`, { fill: SPIKE, op: 0.9, spike: true })) : [])]) }; // three low spines on the crown between them

TOPS.scaleMailShirt = (p) => { const c = p.top.color, dark = shade(c, 0.6); return [
  torso('M 66 480 C 80 388, 126 358, 162 346 L 238 346 C 274 358, 320 388, 334 480 Z', c),
  ...Array.from({ length: 11 }, (_, r) => Array.from({ length: 9 }, (_, i) => path(scale(92 + i * 24 + (r % 2) * 12 - 10, 382 + r * 22, 20, 12), stroke(dark, 1.6, 0.6)))).flat(), // rows of overlapping scales, each row offset half a scale
  path('M 162 348 Q 200 380 238 348', stroke(dark, 7, 0.7, 'butt')),
  path('M 96 462 Q 200 450 304 462', stroke('#fff', 1.6, 0.06))]; };
NECKLINES.scaleMailShirt = 'M 162 348 Q 200 380 238 348';
JACKETS.wingMantle = (p) => { const c = p.jacket.color, dark = shade(c, 0.58); return [
  path('M 48 700 L 44 440 C 52 384, 110 352, 168 348 L 158 700 Z', { fill: c }), path('M 352 700 L 356 440 C 348 384, 290 352, 232 348 L 242 700 Z', { fill: c }),
  ...[-1, 1].flatMap((s) => [0, 1, 2].map((i) => path(`M ${200 + s * (74 + i * 10)} ${372 + i * 14} Q ${200 + s * (96 + i * 14)} ${500 + i * 40} ${200 + s * (86 + i * 10)} ${690}`, stroke(dark, 3, 0.4)))), // the ribs of a wing, fanning down the panels
  path('M 168 350 Q 200 374 232 350', stroke(dark, 4, 0.5)), ellipse(200, 358, 7, 7, { fill: '#8d7f60' })]; };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const DRAGONBORN = { makeup: ['scaleHide', 'hornCrest'], tops: ['scaleMailShirt'], jackets: ['wingMantle'], teeth: ['fangs'] };
for (const n of DRAGONBORN.makeup) tag('makeup', n, 'only:dragonborn');
for (const n of DRAGONBORN.tops) tag('top', n, 'only:dragonborn');
for (const n of DRAGONBORN.jackets) tag('jacket', n, 'only:dragonborn');
for (const n of DRAGONBORN.teeth) tag('teeth', n, 'only:dragonborn');
