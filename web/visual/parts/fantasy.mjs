// The fantasy pack: the adventurer's kit every D&D cast wears, tagged `era:fantasy` and nothing else, so it is
// shared the way `era:80s` is shared between the eighties and undead packs. The humans, orcs, halflings, gnomes,
// tieflings and dragonborn all reach it through their pools (`any: ['only:<cast>', 'era:fantasy']`) and their own
// packs carry only what is theirs. Two tops (a homespun tunic laced at the throat, a studded leather jerkin), a
// cloak with a cowl low on the chest, a felt travelling hat and two stripes of war paint. A tapered ear is not here:
// it is the portrait's own `ears.pointed`, which every cast that has one pins. parts.html?pack=fantasy is the sheet.
import { TOPS, JACKETS, HATS, HAT_CROWN, MAKEUP, NECKLINES, shade, path, ellipse, rect, stroke, tag } from 'limner';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const GOLD = '#b9a06a', LACE = '#d8c9a8';

// --- tops ---
TOPS.roughTunic = (p) => [torso('M 70 480 C 84 392, 128 364, 164 350 L 236 350 C 272 364, 316 392, 330 480 Z', p.top.color),
  path('M 166 352 Q 200 374 234 352', stroke(shade(p.top.color, 0.6), 3, 0.5)),
  ...[0, 1, 2, 3].flatMap((i) => [path(`M 192 ${382 + i * 13} L 208 ${389 + i * 13}`, stroke(LACE, 1.8, 0.75)), path(`M 208 ${382 + i * 13} L 192 ${389 + i * 13}`, stroke(LACE, 1.8, 0.75))]), // the slit laced shut, below the opening (the neckline is a hole: anything above the curve is skin)
  path('M 92 452 Q 200 440 308 452', stroke('#fff', 1.5, 0.05)),
  rect(96, 556, 208, 20, { fill: shade(p.top.color, 0.45) }), rect(188, 556, 24, 20, { rx: 3, fill: GOLD })]; // a belt on the hem
NECKLINES.roughTunic = 'M 166 352 Q 200 374 234 352';
TOPS.leatherJerkin = (p) => [torso('M 68 480 C 82 388, 126 360, 162 348 L 238 348 C 274 360, 318 388, 332 480 Z', p.top.color),
  path('M 162 350 Q 200 380 238 350', stroke(shade(p.top.color, 0.55), 6, 0.8, 'butt')),
  ...[396, 440, 484].flatMap((y, r) => Array.from({ length: 9 }, (_, i) => ellipse(120 + i * 20 + (r % 2) * 10, y, 2.6, 2.6, { fill: '#cfc6b4', op: 0.8 }))), // the studs, each row offset half a stud
  path('M 118 436 L 282 500', stroke(shade(p.top.color, 0.5), 14, 1, 'butt')), ellipse(200, 468, 7, 7, { fill: GOLD }),
  path('M 96 462 Q 200 450 304 462', stroke('#fff', 1.6, 0.06))];
NECKLINES.leatherJerkin = 'M 162 350 Q 200 380 238 350';

// --- a cloak: two panels hanging from the shoulders with a rolled cowl low on the chest, nothing of it in front of the neck ---
JACKETS.hoodedCloak = (p) => { const c = p.jacket.color, dark = shade(c, 0.6), light = shade(c, 1.25); return [
  path('M 60 700 L 54 432 C 58 378, 108 350, 162 346 L 150 700 Z', { fill: c }), path('M 340 700 L 346 432 C 342 378, 292 350, 238 346 L 250 700 Z', { fill: c }),
  path('M 150 348 C 160 396, 240 396, 250 348 C 236 336, 164 336, 150 348 Z', { fill: dark }), path('M 158 356 C 168 388, 232 388, 242 356', stroke(light, 3, 0.45)),
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 100} 424 Q ${200 + s * 96} 544 ${200 + s * 102} 690`, stroke(dark, 3, 0.25)), path(`M ${200 + s * 72} 390 Q ${200 + s * 76} 524 ${200 + s * 80} 690`, stroke('#fff', 2, 0.05))]),
  ellipse(200, 352, 7, 7, { fill: GOLD }), ellipse(198, 350, 2.4, 2.4, { fill: '#fff3c8', op: 0.7 })]; };

// --- a travelling hat: a felt crown with a band and a wide brim, its underside shaded ---
HATS.feltTravelHat = (p) => [path('M 60 132 C 110 118, 290 118, 340 132 C 300 160, 240 166, 200 166 C 160 166, 100 160, 60 132 Z', { fill: shade(p.hat.color, 0.72) }),
  path('M 58 130 C 108 104, 292 104, 342 130 C 292 150, 108 150, 58 130 Z', { fill: p.hat.color }),
  path('M 132 132 C 134 72, 166 52, 200 52 C 234 52, 266 72, 268 132 Z', { fill: p.hat.color }),
  path('M 132 128 Q 200 142 268 128', stroke(p.hat.accent, 8, 0.95, 'butt')),
  path('M 160 70 Q 200 58 240 70', stroke('#fff', 2.5, 0.14))];
HAT_CROWN.feltTravelHat = 132;

// --- the face ---
/** Two stripes across the cheekbones and a bar between the brows, laid out by the eyes. */
MAKEUP.warPaint = { fit: 'eyes', face: () => [rect(140, 214, 52, 10, { fill: '#5b1f1c', op: 0.72 }), rect(208, 214, 52, 10, { fill: '#5b1f1c', op: 0.72 }), rect(191, 150, 18, 42, { fill: '#5b1f1c', op: 0.6 })] };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const FANTASY = { tops: ['roughTunic', 'leatherJerkin'], jackets: ['hoodedCloak'], hats: ['feltTravelHat'], makeup: ['warPaint'] };
for (const n of FANTASY.tops) tag('top', n, 'era:fantasy');
for (const n of FANTASY.jackets) tag('jacket', n, 'era:fantasy');
for (const n of FANTASY.hats) tag('hat', n, 'era:fantasy');
for (const n of FANTASY.makeup) tag('makeup', n, 'era:fantasy');
