// The halfling pack: what the halflings cast (casts/halflings.mjs) wears that nobody else does, tagged
// `only:halfling`; the tapered ears, the tunic and the cloak it shares with the other fantasy casts are
// parts/fantasy.mjs. A patchwork waistcoat over a shirt (squares of other cloth, horn buttons), a quilted coat
// stitched in diamonds, and a straw cap with a short brim. parts.html?pack=halfling is the sheet.
import { TOPS, JACKETS, HATS, HAT_CROWN, NECKLINES, shade, path, ellipse, rect, stroke, tag } from 'limner';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom

TOPS.patchworkVest = (p) => { const c = p.top.color, shirt = shade(c, 1.45); return [
  torso('M 72 480 C 86 394, 130 366, 166 352 L 234 352 C 270 366, 314 394, 328 480 Z', shirt),
  path('M 150 360 C 118 378, 96 420, 90 480 L 90 700 L 166 700 L 176 400 Z', { fill: c }), path('M 250 360 C 282 378, 304 420, 310 480 L 310 700 L 234 700 L 224 400 Z', { fill: c }), // the waistcoat's two fronts, the shirt showing between them
  ...[[104, 414], [258, 436], [112, 500], [266, 520]].map(([x, y], i) => rect(x, y, 34, 30, { fill: shade(c, i % 2 ? 1.22 : 0.78), op: 0.9 })), // patches of other cloth
  ...[0, 1, 2, 3].map((i) => ellipse(200, 428 + i * 38, 4.5, 4.5, { fill: '#8d7046' })),
  path('M 168 356 Q 200 380 232 356', stroke(shade(shirt, 0.65), 3, 0.5))]; };
NECKLINES.patchworkVest = 'M 168 356 Q 200 380 232 356';
JACKETS.quiltedCoat = (p) => { const c = p.jacket.color, dark = shade(c, 0.62); return [
  path('M 62 700 L 58 434 C 62 382, 112 354, 164 350 L 154 700 Z', { fill: c }), path('M 338 700 L 342 434 C 338 382, 288 354, 236 350 L 246 700 Z', { fill: c }),
  ...[0, 1, 2, 3, 4].flatMap((r) => [-1, 1].map((s) => path(`M ${200 + s * 70} ${392 + r * 56} L ${200 + s * 100} ${420 + r * 56} L ${200 + s * 70} ${448 + r * 56} L ${200 + s * 40} ${420 + r * 56} Z`, { fill: 'none', stroke: dark, sw: 1.6, op: 0.45 }))), // the quilting
  path('M 164 352 Q 200 376 236 352', stroke(dark, 4, 0.5)), ellipse(200, 360, 5, 5, { fill: '#8d7046' })]; };
HATS.strawCap = (p) => [path('M 92 140 C 130 126, 270 126, 308 140 C 272 158, 240 162, 200 162 C 160 162, 128 158, 92 140 Z', { fill: shade(p.hat.color, 0.74) }),
  path('M 90 138 C 128 118, 272 118, 310 138 C 272 152, 128 152, 90 138 Z', { fill: p.hat.color }),
  path('M 134 138 C 136 86, 166 66, 200 66 C 234 66, 264 86, 266 138 Z', { fill: p.hat.color }),
  ...[0, 1, 2, 3].map((i) => path(`M ${140 + i * 2} ${126 - i * 16} Q 200 ${112 - i * 18} ${260 - i * 2} ${126 - i * 16}`, stroke(shade(p.hat.color, 0.8), 1.4, 0.55))), // the straw's coiled rows
  path('M 134 134 Q 200 148 266 134', stroke(p.hat.accent, 7, 0.9, 'butt'))];
HAT_CROWN.strawCap = 138;

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const HALFLING = { tops: ['patchworkVest'], jackets: ['quiltedCoat'], hats: ['strawCap'] };
for (const n of HALFLING.tops) tag('top', n, 'only:halfling');
for (const n of HALFLING.jackets) tag('jacket', n, 'only:halfling');
for (const n of HALFLING.hats) tag('hat', n, 'only:halfling');
