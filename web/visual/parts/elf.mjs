// The elf pack: what the elves cast (casts/elves.mjs) wears that nobody else does, registered by name into the
// portrait's registries and tagged `only:elf`. The pointed ears are makeup on the `over` slot (drawn after the hair,
// so the tips poke through it), laid out by the face's width so they sit on the ears of any head; the vine marks a
// tracery at one temple; a leaf circlet that sits on the hair (no HAT_CROWN); a high-collared tunic with leaves
// embroidered along the neckline; a travelling cloak open at the front with a leaf clasp. parts.html?pack=elf is the sheet.
import { HATS, TOPS, JACKETS, MAKEUP, NECKLINES, shade, path, ellipse, line, stroke, tag } from '../portrait.mjs';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const leaf = (x, y, s, fill, op = 1) => path(`M ${x} ${y} Q ${x + 6 * s} ${y - 9} ${x + 15 * s} ${y - 2} Q ${x + 7 * s} ${y + 6} ${x} ${y} Z`, { fill, op }); // one leaf from (x, y) toward +x (s 1) or -x (s -1)
const GOLD = '#c9a03c';

// --- the face ---
/** Pointed ears: a tip rising from each ear's top and leaning outward, in the skin with a shadow along its inner edge. Drawn for the default head (ears at 122 and 278, tops at 185) and fitted to this face's width. */
MAKEUP.pointedEars = { fit: 'face', over: (p) => [-1, 1].flatMap((sd) => { const cx = 200 + sd * 78; return [path(`M ${cx - sd * 12} 194 L ${cx + sd * 9} 144 L ${cx + sd * 15} 192 Z`, { fill: p.skin, ear: true }), path(`M ${cx - sd * 6} 190 L ${cx + sd * 8} 150`, stroke(shade(p.skin, 0.72), 2.2, 0.5)), path(`M ${cx + sd * 9} 148 L ${cx + sd * 12} 186`, stroke('#fff', 1.5, 0.16))]; }) };
/** A vine up the left temple with three leaves, laid out by the eyes. */
MAKEUP.vineMarks = { fit: 'eyes', face: () => [path('M 136 232 C 128 212, 140 196, 132 176 C 128 166, 134 160, 138 152', stroke('#3f5a3f', 1.6, 0.75)), leaf(134, 214, -1, '#4f6e49', 0.85), leaf(136, 190, 1, '#4f6e49', 0.85), leaf(134, 168, -1, '#4f6e49', 0.85)] };

// --- a circlet: no crown line, it sits on the hair as drawn ---
HATS.leafCirclet = (p) => [path('M 124 158 Q 200 140 276 158', stroke(p.hat.color, 3.5, 1, 'butt')), path('M 124 157 Q 200 139 276 157', stroke('#fff', 1.2, 0.35)), leaf(200, 146, -1, p.hat.accent), leaf(200, 146, 1, p.hat.accent), ellipse(200, 146, 2.6, 2.6, { fill: p.hat.color })];

// --- clothes ---
TOPS.elvenTunic = (p) => [torso('M 70 480 C 84 392, 128 362, 164 350 L 236 350 C 272 362, 316 392, 330 480 Z', p.top.color), path('M 166 352 Q 200 376 234 352 Q 220 344 200 342 Q 180 344 166 352 Z', { fill: '#000', op: 0.12 }), path('M 160 350 L 166 332 L 234 332 L 240 350 Z', { fill: shade(p.top.color, 0.85), collar: true }), ...[-2, -1, 0, 1, 2].map((i) => leaf(200 + i * 22 - (i < 0 ? 0 : 14), 392 + Math.abs(i) * 3, i < 0 ? 1 : -1, p.top.accent ?? GOLD, 0.9)), line(200, 400, 200, 520, stroke(p.top.accent ?? GOLD, 1.4, 0.5)), path('M 92 460 Q 200 448 308 460', stroke('#fff', 1.5, 0.04))]; // a standing collar, leaves embroidered along the neckline, a seam down the chest
NECKLINES.elvenTunic = 'M 166 352 Q 200 376 234 352';
JACKETS.travelCloak = (p) => { const c = p.jacket.color, dark = shade(c, 0.6); return [path('M 60 700 L 56 430 C 60 380, 110 352, 164 348 L 152 700 Z', { fill: c }), path('M 340 700 L 344 430 C 340 380, 290 352, 236 348 L 248 700 Z', { fill: c }), path('M 164 348 Q 200 372 236 348', stroke(dark, 4, 0.5)), ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 100} 420 Q ${200 + s * 96} 540 ${200 + s * 102} 690`, stroke(dark, 3, 0.25)), path(`M ${200 + s * 70} 380 Q ${200 + s * 74} 520 ${200 + s * 78} 690`, stroke('#fff', 2, 0.05))]), leaf(200, 362, -1, GOLD), leaf(200, 362, 1, GOLD), ellipse(200, 362, 3, 3, { fill: shade(GOLD, 0.7) })]; }; // two panels hanging from the shoulders, open down the front, a leaf clasp at the throat

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const ELF = { makeup: ['pointedEars', 'vineMarks'], hats: ['leafCirclet'], tops: ['elvenTunic'], jackets: ['travelCloak'] };
for (const n of ELF.makeup) tag('makeup', n, 'only:elf');
for (const n of ELF.hats) tag('hat', n, 'only:elf');
for (const n of ELF.tops) tag('top', n, 'only:elf');
for (const n of ELF.jackets) tag('jacket', n, 'only:elf');
