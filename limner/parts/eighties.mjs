// The eighties pack: the decade's silhouettes as parts of the portrait, registered by name into TOPS, JACKETS, HATS
// and HAIR and tagged `era:80s`. Shareable: no `only:` tag, so any cast whose pool asks for them (`parts('top',
// { all: ['era:80s'] })`, or `any: ['era:80s', 'everyday']` beside the everyday clothes) may dress in them, and no
// pool that does not ask ever sees them. The undead cast (casts/undead.mjs) was buried in these. parts.html?pack=eighties
// is the sheet.
import { TOPS, JACKETS, HATS, HAIR, NECKLINES, JACKET_EDGE, shade, mapXY, scaleAbout, path, ellipse, rect, line, stroke, tag } from '../portrait.mjs';

const fp = (fill, op = 1) => ({ fill, op });
const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const dk = (op) => ({ fill: '#000', op });

// --- the 80s palette, as it comes out of the ground: every colour a shade duller than it was sold ---
export const NEON = { pink: '#c23d8e', blue: '#2a5fb8', lime: '#8fbf2f', teal: '#2fb5b0', yellow: '#d9c64a', purple: '#6b3fa0', orange: '#d8742a', acid: '#9fb5c8', red: '#b3202a', ivory: '#efe8dc' };

// --- garments: the decade's silhouettes (each a top or a jacket in the portrait's own language) ---
const wave = (x0, y, n, w, h, a) => path(`M ${x0} ${y} ` + Array.from({ length: n }, (_, i) => `Q ${x0 + w * (i + 0.5)} ${y + (i % 2 ? h : -h)} ${x0 + w * (i + 1)} ${y}`).join(' '), a); // a row of scallops: a ruffle, a lace edge
Object.assign(TOPS, {
  // a ruffled tuxedo shirt: the placket is four rows of frills down the chest under a wing collar
  ruffledTux: (p) => [torso('M 74 480 C 88 397, 131 369, 164 356 L 236 356 C 269 369, 312 397, 326 480 Z', p.top.color), path('M 195 377 L 205 377 L 220 413 L 180 413 Z', { fill: p.top.color, collar: true }), path('M 164 356 L 195 377 L 181 409 L 150 365 Z', { fill: p.top.color, collar: true }), path('M 236 356 L 205 377 L 219 409 L 250 365 Z', { fill: p.top.color, collar: true }), path('M 164 356 L 195 377 L 181 409 L 150 365 Z', { fill: '#fff', op: 0.09, collar: true }), path('M 236 356 L 205 377 L 219 409 L 250 365 Z', { fill: '#fff', op: 0.09, collar: true }), ...[396, 416, 436, 456, 476].flatMap((y) => [wave(172, y, 7, 8, 4, stroke(shade(p.top.color, 0.72), 1.6, 0.8)), wave(172, y + 2, 7, 8, 4, stroke('#fff', 1, 0.35))])],
  // a leotard: a wide scoop neck, a shine down the chest and a contrast belt at the waist
  leotard: (p) => [torso('M 76 480 C 90 398, 134 370, 166 357 L 234 357 C 266 370, 310 398, 324 480 Z', p.top.color), path('M 150 352 Q 200 404 250 352 Q 200 392 150 352 Z', dk(0.14)), path('M 186 410 C 182 440, 184 470, 190 500', stroke('#fff', 10, 0.1)), rect(86, 468, 228, 16, { fill: p.top.accent ?? NEON.teal }), rect(86, 468, 228, 3, { fill: '#fff', op: 0.25 })],
  // a sweatshirt with the neck cut out and fallen off one shoulder: the cloth's edge runs low across the right, and the shoulder shows bare above it
  // the bare shoulder is one piece: from the neck along the shoulder line to the arm, down to the slipped edge and back
  // along the neckline, so it meets the neck the neckline shows (a patch that stopped short of the neck left a wedge of cloth between them)
  offShoulderSweat: (p) => [torso('M 72 480 C 86 394, 130 365, 163 354 L 237 354 C 270 365, 314 394, 328 480 Z', p.top.color), path('M 196 392 Q 218 408 236 420 C 262 422, 292 432, 302 452 L 318 452 C 314 402, 284 368, 240 352 L 216 348 L 196 352 Z', { fill: p.skin }), path('M 236 420 C 262 422, 292 432, 302 452', stroke(shade(p.top.color, 0.6), 5, 0.4, 'butt')), path('M 150 358 Q 200 396 236 420', stroke(shade(p.top.color, 0.6), 5, 0.4, 'butt')), path('M 84 430 Q 200 416 316 430', stroke('#fff', 1.5, 0.04))],
  // a hospital gown: a thin pale print, a wide V, the ties showing at one shoulder
  hospitalGown: (p) => [torso('M 66 480 C 80 392, 124 362, 162 350 L 238 350 C 276 362, 320 392, 334 480 Z', p.top.color), ...Array.from({ length: 36 }, (_, i) => ellipse(96 + (i % 9) * 26 + (Math.floor(i / 9) % 2) * 13, 392 + Math.floor(i / 9) * 26, 1.8, 1.8, fp('#5f7f8a', 0.45))), path('M 160 352 L 200 404 L 240 352 Q 200 376 160 352 Z', dk(0.12)), path('M 236 350 Q 252 360 246 378', stroke(shade(p.top.color, 0.6), 2.2, 0.8)), path('M 236 352 Q 258 352 262 372', stroke(shade(p.top.color, 0.6), 2.2, 0.8))],
  // a wedding gown's bodice: a sweetheart neckline edged in lace, satin down the front
  laceGown: (p) => [torso('M 72 480 C 86 394, 130 365, 162 352 L 238 352 C 270 365, 314 394, 328 480 Z', p.top.color), path('M 156 356 Q 178 376 200 366 Q 222 376 244 356 Q 200 390 156 356 Z', dk(0.1)), wave(156, 356, 11, 8, 3.5, stroke('#fff', 1.6, 0.7)), ...Array.from({ length: 24 }, (_, i) => ellipse(118 + (i % 8) * 24 + (Math.floor(i / 8) % 2) * 12, 404 + Math.floor(i / 8) * 28, 2.2, 2.2, { fill: 'none', stroke: '#fff', sw: 0.9, op: 0.5 })), path('M 196 380 C 190 420, 192 460, 198 520', stroke('#fff', 12, 0.12)), rect(82, 478, 236, 10, { fill: shade(p.top.color, 0.86) })],
});
Object.assign(NECKLINES, { ruffledTux: 'M 164 356 L 195 377 L 200 386 L 205 377 L 236 356', leotard: 'M 150 352 Q 200 404 250 352', offShoulderSweat: 'M 150 358 Q 200 396 236 420', hospitalGown: 'M 160 352 L 200 404 L 240 352', laceGown: 'M 156 356 Q 178 376 200 366 Q 222 376 244 356', varsityJacket: 'M 160 352 Q 200 382 240 352', redLeatherChevron: 'M 170 350 L 200 372 L 230 350' });
Object.assign(JACKETS, {
  // a varsity jacket: the sleeves in the second colour (`jacket.accent`), a ribbed collar, snaps down the front, a ribbed hem
  varsityJacket: (p) => { const sl = p.jacket.accent ?? '#e9e2d0'; return [torso('M 62 480 C 71 398, 120 361, 163 351 L 237 351 C 280 361, 329 398, 338 480 Z', sl), path('M 118 480 C 120 410, 136 372, 163 351 L 237 351 C 264 372, 280 410, 282 480 L 282 700 L 118 700 Z', { fill: p.jacket.color }), path('M 160 352 Q 200 382 240 352', stroke(shade(p.jacket.color, 0.6), 10, 1, 'butt')), path('M 160 352 Q 200 382 240 352', stroke(sl, 3, 0.8, 'butt')), ...[400, 424, 448, 472].map((y) => ellipse(200, y, 2.6, 2.6, { fill: '#d9d2c2', stroke: '#444', sw: 0.6 })), line(200, 384, 200, 600, stroke('#111', 1.5, 0.3, 'butt')), ...[468, 476].map((y) => line(118, y, 282, y, stroke(sl, 2.2, 0.55, 'butt')))]; },
  // a sweater knotted over the shoulders: the two sleeves cross the chest to a knot and hang from it
  // a sweater knotted over the shoulders: its back lies along both shoulders behind the neck, the two sleeves taper across the chest to a knot and hang from it in ribbed cuffs
  sweaterShoulders: (p) => { const c = p.jacket.color, dark = shade(c, 0.62), light = shade(c, 1.25); return [path('M 92 400 C 110 380, 150 362, 172 356 L 178 372 C 158 378, 124 392, 104 414 Z', { fill: dark }), path('M 308 400 C 290 380, 250 362, 228 356 L 222 372 C 242 378, 276 392, 296 414 Z', { fill: dark }), path('M 116 378 L 198 418 L 188 440 L 102 406 Z', { fill: c }), path('M 284 378 L 202 418 L 212 440 L 298 406 Z', { fill: c }), path('M 112 388 L 190 426', stroke(light, 2.4, 0.5)), path('M 288 388 L 210 426', stroke(light, 2.4, 0.5)), path('M 120 384 L 196 422', stroke(dark, 1.6, 0.4)), path('M 280 384 L 204 422', stroke(dark, 1.6, 0.4)), path('M 184 438 L 200 444 L 196 516 L 178 510 Z', { fill: c }), path('M 216 438 L 200 444 L 204 516 L 222 510 Z', { fill: c }), path('M 186 442 L 196 512', stroke(dark, 1.4, 0.4)), path('M 214 442 L 204 512', stroke(dark, 1.4, 0.4)), path('M 177 506 L 197 512 L 196 526 L 176 520 Z', { fill: dark }), path('M 223 506 L 203 512 L 204 526 L 224 520 Z', { fill: dark }), ...[181, 186, 191].map((x) => line(x, 508, x - 0.5, 522, stroke(light, 1.2, 0.5))), ...[209, 214, 219].map((x) => line(x, 508, x + 0.5, 522, stroke(light, 1.2, 0.5))), path('M 184 420 C 176 428, 178 444, 192 446 C 206 448, 218 442, 218 430 C 218 420, 206 414, 196 418 C 190 420, 186 420, 184 420 Z', { fill: c }), path('M 186 424 C 182 432, 188 442, 200 442 C 210 442, 214 434, 210 428', stroke(dark, 2.2, 0.55)), path('M 190 426 Q 200 420 208 426', stroke(light, 2, 0.5)), path('M 104 410 L 186 446', stroke('#000', 6, 0.1, 'butt')), path('M 296 410 L 214 446', stroke('#000', 6, 0.1, 'butt'))]; },
  // a power blazer: the shoulders squared and raised on pads, the lapels wide
  padShoulderBlazer: (p) => [path('M 56 480 C 58 410, 62 364, 98 348 L 161 350 L 193 480 L 200 700 L 50 700 Z', { fill: p.jacket.color }), path('M 344 480 C 342 410, 338 364, 302 348 L 239 350 L 207 480 L 200 700 L 350 700 Z', { fill: p.jacket.color }), path('M 98 348 L 161 350', stroke('#fff', 3, 0.12)), path('M 302 348 L 239 350', stroke('#fff', 3, 0.12)), path('M 160 350 L 200 392 L 172 436 L 146 368 Z', { fill: '#fff', op: 0.09 }), path('M 240 350 L 200 392 L 228 436 L 254 368 Z', { fill: '#fff', op: 0.09 })],
  // a red leather jacket zipped to the throat: a stand collar, black chevrons across the chest and the shoulders, the zip's glint
  redLeatherChevron: (p) => { const k = '#141214'; return [torso('M 63 480 C 74 392, 119 361, 160 348 L 240 348 C 281 361, 326 392, 337 480 Z', p.jacket.color), path('M 120 398 L 200 440 L 280 398 L 280 412 L 200 454 L 120 412 Z', { fill: k }), path('M 120 428 L 200 470 L 280 428 L 280 442 L 200 484 L 120 442 Z', { fill: k }), path('M 72 420 L 128 388 L 128 400 L 78 432 Z', { fill: k }), path('M 328 420 L 272 388 L 272 400 L 322 432 Z', { fill: k }), path('M 164 346 L 236 346 L 240 364 L 160 364 Z', { fill: shade(p.jacket.color, 0.8), collar: true }), line(200, 372, 200, 600, stroke('#d8d2c6', 2, 0.55, 'butt')), ...[-1, 1].map((s) => path(`M ${200 + s * 92} 388 C ${200 + s * 104} 420, ${200 + s * 108} 452, ${200 + s * 104} 484`, stroke('#fff', 2, 0.1)))]; },
});
JACKET_EDGE.padShoulderBlazer = JACKET_EDGE.blazer;
Object.assign(HATS, { // no HAT_CROWN entry: these sit on the hair rather than over it, so the hair is not clipped under them
  // a terry sweatband across the forehead, a stripe through it
  headband: (p) => [path('M 122 150 Q 200 134 278 150 L 278 166 Q 200 150 122 166 Z', { fill: p.hat.color }), path('M 122 158 Q 200 142 278 158', stroke(p.hat.accent, 3.5, 0.85, 'butt')), path('M 122 150 Q 200 134 278 150', stroke('#fff', 1.2, 0.2))],
  // a bridal veil's comb on the crown and the sheer edge falling past the temples; the sheet behind the figure is the `veilBack` prop
  veil: (p) => [path('M 156 100 Q 200 72 244 100 Q 200 92 156 100 Z', { fill: p.hat.accent }), ...[-1, 1].map((s) => path(`M ${200 + s * 44} 100 C ${200 + s * 70} 150, ${200 + s * 84} 230, ${200 + s * 78} 330 L ${200 + s * 60} 330 C ${200 + s * 66} 230, ${200 + s * 56} 150, ${200 + s * 36} 104 Z`, { fill: p.hat.color, op: 0.42 }))],
});
Object.assign(HAIR, {
  // the mullet: short and textured on top, a sheet of hair behind the neck to the shoulders either side of it
  mullet: { back: (p) => [path('M 126 170 C 118 230, 122 292, 138 334 Q 200 358 262 334 C 278 292, 282 230, 274 170 C 270 110, 130 110, 126 170 Z', { fill: shade(p.hairColor, 0.8) })], front: (p) => HAIR.shortTextured(p) },
  // teased and sprayed: the mass of a medium afro behind the head with waves over the forehead
  bigHair: { back: (p) => mapXY(HAIR.afroMedium.back(p), scaleAbout(200, 1.08), scaleAbout(112, 1.12)), front: (p) => HAIR.wavyMedium(p) },
});
// no push into HAT_HAIR: that list is what a random character's hat picks hair from, and a mullet must never land on the editorial crowd; dress keeps a theme style under a hat by checking the registry
for (const n of ['ruffledTux', 'leotard', 'offShoulderSweat', 'hospitalGown', 'laceGown']) tag('top', n, 'era:80s');
for (const n of ['varsityJacket', 'sweaterShoulders', 'padShoulderBlazer', 'redLeatherChevron']) tag('jacket', n, 'era:80s');
for (const n of ['headband', 'veil']) tag('hat', n, 'era:80s');
for (const n of ['mullet', 'bigHair']) tag('hair', n, 'era:80s');
/** The pack's own names, by kind: what its sheet shows. */
export const EIGHTIES = { tops: ['ruffledTux', 'leotard', 'offShoulderSweat', 'hospitalGown', 'laceGown'], jackets: ['varsityJacket', 'sweaterShoulders', 'padShoulderBlazer', 'redLeatherChevron'], hats: ['headband', 'veil'], hair: ['mullet', 'bigHair'] };
