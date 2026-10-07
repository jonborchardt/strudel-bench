// The steampunk pack: what the steampunks cast (casts/steampunks.mjs) wears that nobody else does, tagged
// `only:steampunk`. Victorian cut and brass, and the brass is modelled: every rim, button and gear is a lit edge, a
// dark edge and a glint, never a flat disc. Four hats (a top hat with goggles strapped round its band, a bowler, an
// aviator's leather cap with its goggles pushed up, a small tilted lady's top hat with a feather), three things over
// the eyes (a monocle on a chain, brass goggles, goggles with a jeweller's loupe), three tops (a waistcoat with a cravat
// and a watch chain, a corset over a high-necked blouse, a high-collared military jacket with brass frogging), three
// coats (a frock coat with a gear pinned at the lapel, an aviator's leather coat with a fleece collar, a duster with a
// coachman's cape), goggles worn up on the forehead and a brass ear as accessories, and a brass mechanical forearm as
// a prop. parts.html?pack=steampunk is the sheet.
//
// Two tops are worn in shirtsleeves: with `vest` set, `color` is the shirt (or blouse) and so the sleeves, and `vest`
// the waistcoat or corset; without it `color` is the waistcoat and the sleeves are of a piece with it (the arms are
// always the top's colour when there is no jacket, so a crowd member reads as dressed in a suit).
import { TOPS, JACKETS, HATS, HAT_CROWN, GLASSES, ACCESSORIES, PROPS, arm, shade, path, ellipse, rect, stroke } from '../portrait.mjs';
import { tagPack, torso, SHOULDERS, f1 } from './pen.mjs';

const BRASS = '#b88a3a', BRASS_LIT = '#f0d590', BRASS_DK = '#6e4d1c', LENS = '#2a2622', SHIRT = '#ece4d6', LEATHER = '#4a3527';
/** An arc as a polyline (the path grammar has no A): from angle a0 to a1, radians, y down. */
const arc = (x, y, rx, ry, a0, a1, n = 10) => 'M ' + Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return `${f1(x + rx * Math.cos(a))} ${f1(y + ry * Math.sin(a))}`; }).join(' L ');
const UPPER_LEFT = [Math.PI * 1.05, Math.PI * 1.6], LOWER_RIGHT = [Math.PI * 0.05, Math.PI * 0.6];
/** A brass ring or disc, modelled: its shadow, the metal, the dark lower edge, the lit upper edge. */
const brass = (x, y, r, sw = Math.max(1, r * 0.22)) => [ellipse(x + r * 0.08, y + r * 0.14, r, r, { fill: '#000', op: 0.22 }), ellipse(x, y, r, r, { fill: BRASS }),
  path(arc(x, y, r - sw / 2, r - sw / 2, ...LOWER_RIGHT), stroke(BRASS_DK, sw, 0.8)), path(arc(x, y, r - sw / 2, r - sw / 2, ...UPPER_LEFT), stroke(BRASS_LIT, sw * 0.7, 0.8))];
/** A brass button: a modelled disc with a glint. */
const button = (x, y, r = 3.6) => [...brass(x, y, r, r * 0.5), ellipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.3, { fill: '#fff8e0', op: 0.8 })];
/** A gear: square teeth round a rim, a hub, a hole, lit and shadowed like the rest of the brass. */
const gear = (x, y, r, teeth = 8, fill = BRASS) => { const pts = []; for (let i = 0; i < teeth; i++) { const a = (i / teeth) * Math.PI * 2, w = Math.PI / teeth * 0.55; for (const [da, rr] of [[-w * 1.25, r * 0.78], [-w * 0.7, r], [w * 0.7, r], [w * 1.25, r * 0.78]]) pts.push(`${f1(x + rr * Math.cos(a + da))} ${f1(y + rr * Math.sin(a + da))}`); }
  const d = `M ${pts.join(' L ')} Z`; return [path(d, { fill: '#000', op: 0.25 }), path(d, { fill }), path(arc(x, y, r * 0.7, r * 0.7, ...LOWER_RIGHT), stroke(BRASS_DK, r * 0.16, 0.7)), path(arc(x, y, r * 0.7, r * 0.7, ...UPPER_LEFT), stroke(BRASS_LIT, r * 0.12, 0.8)),
    ellipse(x, y, r * 0.42, r * 0.42, { fill: shade(fill, 0.8) }), ellipse(x, y, r * 0.18, r * 0.18, { fill: '#1e1a16' })]; };
/** One goggle eyepiece: a heavy brass rim with a dark lower edge and a lit upper one, a stepped inner rim, smoked glass with a reflection across it, rivets. */
const eyepiece = (x, y, r, rivets = 6) => [...brass(x, y, r, r * 0.2), ellipse(x, y, r * 0.76, r * 0.76, { fill: BRASS_DK }), ellipse(x, y, r * 0.68, r * 0.68, { fill: LENS }),
  path(`M ${f1(x - r * 0.5)} ${f1(y - r * 0.05)} Q ${f1(x - r * 0.3)} ${f1(y - r * 0.55)} ${f1(x + r * 0.2)} ${f1(y - r * 0.55)} Q ${f1(x - r * 0.2)} ${f1(y - r * 0.35)} ${f1(x - r * 0.5)} ${f1(y - r * 0.05)} Z`, { fill: '#fff', op: 0.35 }),
  ellipse(x + r * 0.3, y + r * 0.3, r * 0.08, r * 0.08, { fill: '#fff', op: 0.5 }),
  ...Array.from({ length: rivets }, (_, i) => { const a = i * Math.PI * 2 / rivets + 0.4; return ellipse(x + r * 0.88 * Math.cos(a), y + r * 0.88 * Math.sin(a), r * 0.07, r * 0.07, { fill: BRASS_DK }); })];
/** A pair of goggles where they sit: two eyepieces at (x0, y), (x1, y), a leather bridge, the strap from each outer rim to (sx0, sy) and (sx1, sy). */
const goggles = (x0, x1, y, r, sx0, sx1, sy) => [path(`M ${x0 - r} ${y} L ${sx0} ${sy}`, stroke(LEATHER, r * 0.45)), path(`M ${x1 + r} ${y} L ${sx1} ${sy}`, stroke(LEATHER, r * 0.45)),
  path(`M ${x0 - r} ${y - r * 0.2} L ${sx0} ${sy - r * 0.2}`, stroke('#fff', 1.2, 0.12)), path(`M ${x1 + r} ${y - r * 0.2} L ${sx1} ${sy - r * 0.2}`, stroke('#fff', 1.2, 0.12)),
  path(`M ${x0 + r * 0.8} ${y - 1} Q ${(x0 + x1) / 2} ${y - r * 0.45} ${x1 - r * 0.8} ${y - 1}`, stroke(LEATHER, r * 0.36)), ...eyepiece(x0, y, r), ...eyepiece(x1, y, r)];

// --- hats -------------------------------------------------------------------------------------------------------
/** A top hat: a tall crown, lit down one side and dark down the other, on a curled brim; the goggles strapped round the band press it in, and throw a shadow on it. */
HATS.topHatGoggles = (p) => { const c = p.hat.color, dark = shade(c, 0.55), band = p.hat.accent ?? shade(c, 0.4); return [
  path('M 108 140 Q 200 120 292 140 Q 302 154 284 156 Q 200 138 116 156 Q 98 154 108 140 Z', { fill: c }), // the brim, curled up at the sides
  path('M 116 150 Q 200 134 284 150', stroke(dark, 3, 0.7)), path('M 112 141 Q 200 122 288 141', stroke('#fff', 1.6, 0.15)),
  path('M 146 142 L 140 36 Q 200 24 260 36 L 254 142 Q 200 130 146 142 Z', { fill: c }), // the crown, flaring a little at the top
  path('M 228 32 L 236 140 L 254 142 L 260 36 Q 246 32 228 32 Z', { fill: dark, op: 0.55 }), path('M 152 40 L 156 132', stroke('#fff', 5, 0.1)), path('M 162 38 L 164 130', stroke('#fff', 1.5, 0.12)), // the shadow side, the lit side
  ellipse(200, 34, 60, 6, { fill: shade(c, 1.25) }), // the top's rim catching the light
  path('M 145 116 Q 200 106 255 116 L 255 136 Q 200 126 145 136 Z', { fill: band }),
  path('M 145 125 Q 200 115 255 125', stroke(LEATHER, 7)), path('M 145 129 Q 200 119 255 129', stroke('#000', 2, 0.3)), // the goggles' strap, sunk into the band
  ...goggles(180, 220, 124, 13, 150, 250, 126)]; };
HAT_CROWN.topHatGoggles = 142;
/** A bowler: a hard round crown with a sheen, a narrow brim rolled up at the sides, a grosgrain band. */
HATS.bowler = (p) => { const c = p.hat.color, dark = shade(c, 0.55); return [
  path('M 112 132 Q 200 116 288 132 Q 296 142 282 146 Q 200 132 118 146 Q 104 142 112 132 Z', { fill: c }),
  path('M 118 142 Q 200 128 282 142', stroke(dark, 3, 0.7)),
  path('M 138 134 C 136 82, 164 58, 200 58 C 236 58, 264 82, 262 134 Q 200 124 138 134 Z', { fill: c }),
  path('M 232 64 C 254 76, 264 104, 262 134 L 244 131 C 246 104, 242 82, 232 64 Z', { fill: dark, op: 0.5 }),
  path('M 156 108 C 156 86, 170 70, 190 64', stroke('#fff', 6, 0.12)), path('M 160 100 C 162 86, 172 74, 186 68', stroke('#fff', 2, 0.25)),
  path('M 139 118 Q 200 108 261 118 L 262 132 Q 200 122 138 132 Z', { fill: p.hat.accent ?? shade(c, 0.35) }), path('M 139 118 Q 200 108 261 118', stroke('#fff', 1, 0.15)),
  path('M 150 122 L 156 130', stroke('#000', 1.4, 0.3))]; };
HAT_CROWN.bowler = 134;
/** An aviator's leather cap: panels with stitched seams, ear flaps down over the ears with a fleece edge and a buckle, and the goggles pushed up on its front. */
HATS.aviatorCap = (p) => { const c = p.hat.color, dark = shade(c, 0.6), fleece = '#e6dcc6'; return [
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 62} 124 Q ${200 + s * 84} 160 ${200 + s * 80} 236 Q ${200 + s * 66} 244 ${200 + s * 58} 230 Q ${200 + s * 56} 180 ${200 + s * 50} 140 Z`, { fill: c }),
    path(`M ${200 + s * 80} 236 Q ${200 + s * 66} 244 ${200 + s * 58} 230`, stroke(fleece, 6)),
    path(`M ${200 + s * 70} 150 Q ${200 + s * 76} 190 ${200 + s * 70} 226`, stroke(dark, 1.4, 0.6)), ...brass(200 + s * 70, 214, 4)]), // the flaps, buckled
  path('M 122 140 C 124 86, 158 64, 200 64 C 242 64, 276 86, 278 140 Q 200 128 122 140 Z', { fill: c }),
  path('M 122 140 Q 200 128 278 140', stroke(fleece, 7)), path('M 122 143 Q 200 131 278 143', stroke('#000', 1.4, 0.18)), // the fleece rolled out under its edge
  path('M 200 66 L 200 128', stroke(dark, 2, 0.6)), path('M 168 72 Q 160 100 162 132', stroke(dark, 1.5, 0.5)), path('M 232 72 Q 240 100 238 132', stroke(dark, 1.5, 0.5)),
  path('M 150 86 Q 176 70 196 70', stroke('#fff', 4, 0.14)), path('M 236 76 C 256 88, 270 110, 274 136', stroke('#000', 8, 0.18)),
  ...goggles(176, 224, 104, 15, 130, 270, 112)]; };
HAT_CROWN.aviatorCap = 140;
/** A small lady's top hat, perched and tilted on one side of the head: a crown and brim, a ribbon, a curling feather over the top, a gear pinned to the ribbon. No crown line: it sits on the hair as drawn. */
HATS.ladyTopHat = (p) => { const c = p.hat.color, dark = shade(c, 0.55), rib = p.hat.accent ?? '#6a2a2a', R = (x, y) => { const a = 0.22, dx = x - 228, dy = y - 86; return `${f1(228 + dx * Math.cos(a) - dy * Math.sin(a))} ${f1(86 + dx * Math.sin(a) + dy * Math.cos(a))}`; };
  const d = (s) => s.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => R(+x, +y));
  return [
    path(d('M 222 64 C 246 30, 296 22, 318 6 C 300 34, 262 52, 236 68 Z'), { fill: '#2a2a28' }), path(d('M 230 62 C 256 36, 290 26, 316 8'), stroke('#fff', 1, 0.3)), // the feather, raked back
    ...[0, 1, 2, 3, 4].map((i) => path(d(`M ${246 + i * 14} ${46 - i * 8} L ${252 + i * 14} ${58 - i * 8}`), stroke('#2a2a28', 1.4, 0.8))),
    path(d('M 176 96 Q 228 84 280 96 Q 286 104 276 106 Q 228 96 180 106 Q 170 104 176 96 Z'), { fill: c }),
    path(d('M 196 98 L 194 50 Q 228 42 262 50 L 260 98 Q 228 92 196 98 Z'), { fill: c }), path(d('M 246 48 L 250 96 L 260 98 L 262 50 Z'), { fill: dark, op: 0.6 }), path(d('M 202 54 L 204 92'), stroke('#fff', 3, 0.14)),
    path(d('M 195 82 Q 228 76 261 82 L 261 94 Q 228 88 195 94 Z'), { fill: rib }), ...gear(+R(206, 88).split(' ')[0], +R(206, 88).split(' ')[1], 7, 8),
  ];
};

// --- over the eyes (drawn for eyes 68 apart on y 196) ---------------------------------------------------------
/** A monocle over the right eye: a brass rim modelled, a faint lens with a glint, and its chain down off the cheek. */
GLASSES.monocle = (c) => [ellipse(234, 196, 21, 21, { fill: '#cfe3ea', op: 0.14 }), path('M 220 186 Q 230 180 242 182', stroke('#fff', 3, 0.4)),
  ellipse(235, 198, 21, 21, stroke('#000', 4, 0.2)), ellipse(234, 196, 21, 21, stroke(BRASS, 4)), path(arc(234, 196, 21, 21, ...LOWER_RIGHT), stroke(BRASS_DK, 2.4, 0.9)), path(arc(234, 196, 21, 21, ...UPPER_LEFT), stroke(BRASS_LIT, 1.6, 0.9)),
  ...button(254, 208, 2.4), path('M 255 210 Q 274 254 262 300 Q 256 322 244 336', stroke(c === '#1d1b1a' ? BRASS : c, 1.6, 0.9)), path('M 256 212 Q 272 254 261 298', stroke(BRASS_LIT, 0.6, 0.6))];
/** Brass goggles down over the eyes: heavy modelled eyepieces, a leather bridge, the strap going round the head. */
GLASSES.aeroGoggles = () => [path('M 144 194 L 112 190', stroke('#000', 10, 0.2)), path('M 256 194 L 288 190', stroke('#000', 10, 0.2)), ...goggles(166, 234, 196, 24, 112, 288, 190)];
/** Goggles with a jeweller's loupe: the right eyepiece carries a brass barrel standing out at the viewer, the left a spare lens swung up on a hinge. */
GLASSES.loupeGoggles = () => [...GLASSES.aeroGoggles(),
  path('M 146 178 L 128 156', stroke(BRASS_DK, 3)), path('M 146 178 L 128 156', stroke(BRASS_LIT, 1, 0.6)), ...eyepiece(124, 150, 10, 4), // the spare lens, swung up
  path('M 214 192 L 220 176 L 262 176 L 256 192 Z', { fill: BRASS_DK }), // the barrel's side
  ...brass(240, 180, 22, 4), ellipse(240, 180, 16, 16, { fill: LENS }), ...brass(242, 176, 16, 3), ellipse(242, 176, 11, 11, { fill: '#3e4a48' }),
  path('M 234 170 Q 240 164 248 166', stroke('#fff', 3, 0.6)), ellipse(246, 180, 2, 2, { fill: '#fff', op: 0.6 })];

// --- tops ---------------------------------------------------------------------------------------------------------
const pull = (x, y, s, c) => [path(`M ${x + s * 4} ${y} Q ${x + s * 18} ${y - 4} ${x + s * 32} ${y - 14}`, stroke(shade(c, 0.6), 2, 0.5)), path(`M ${x + s * 5} ${y + 2} Q ${x + s * 18} ${y - 1} ${x + s * 32} ${y - 10}`, stroke('#fff', 1, 0.12))]; // the cloth pulled from a button: a fold and its lit ridge
/** A waistcoat over a shirt: notched lapels with a lit edge and a shadow under them, the shirt's collar points and a puffed cravat with a stickpin in the V, brass buttons pulling the cloth, a watch chain to a pocket with a gear fob. */
TOPS.waistcoat = (p) => { const vest = p.top.vest ?? p.top.color, shirt = p.top.vest ? p.top.color : p.top.shirt ?? SHIRT, dark = shade(vest, 0.55), cravat = p.top.cravat ?? p.top.accent ?? '#6a2a2a'; return [
  torso(SHOULDERS, shirt),
  path('M 180 352 L 200 436 L 220 352 Z', { fill: '#000', op: 0.08 }),
  path('M 168 352 L 186 368 L 200 352 L 214 368 L 232 352 L 214 342 L 186 342 Z', { fill: shirt, collar: true }), path('M 168 352 L 186 368 L 200 352 M 200 352 L 214 368 L 232 352', { ...stroke('#000', 1, 0.2), collar: true }), // the collar's points
  path('M 188 352 Q 200 346 212 352 L 220 384 Q 214 404 200 410 Q 186 404 180 384 Z', { fill: cravat }), path('M 192 360 Q 196 384 200 404', stroke(shade(cravat, 0.6), 1.6, 0.6)), path('M 208 362 Q 206 384 204 402', stroke('#fff', 1.6, 0.15)), // the cravat, puffed
  ellipse(200, 354, 9, 6, { fill: shade(cravat, 0.8) }), ...button(200, 384, 2.6), // its knot and the stickpin
  path('M 104 700 L 102 404 C 112 378, 132 362, 156 352 L 170 350 L 198 438 L 198 700 Z', { fill: vest }), path('M 296 700 L 298 404 C 288 378, 268 362, 244 352 L 230 350 L 202 438 L 202 700 Z', { fill: vest }), // the two fronts
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 30} 350 L ${200 + s * 2} 438 L ${200 + s * 12} 438 L ${200 + s * 34} 382 L ${200 + s * 46} 376 L ${200 + s * 40} 356 Z`, { fill: shade(vest, 1.12) }), // the lapel, turned back
    path(`M ${200 + s * 30} 350 L ${200 + s * 2} 438`, stroke('#fff', 1.4, 0.2)), path(`M ${200 + s * 12} 438 L ${200 + s * 34} 382 L ${200 + s * 46} 376`, stroke('#000', 3, 0.25))]), // its lit fold and the shadow its thickness throws
  path('M 198 438 L 198 700', stroke(dark, 2, 0.6)), ...[446, 470].flatMap((y) => [...pull(204, y, 1, vest), ...pull(196, y, -1, vest), ...button(200, y)]),
  path('M 236 450 L 268 446', stroke(dark, 3, 0.7)), // the pocket's welt
  path('M 204 470 Q 230 488 254 452', stroke(BRASS_DK, 2.6, 0.9)), path('M 204 469 Q 230 486 254 451', stroke(BRASS_LIT, 1, 0.7)), ...gear(226, 482, 6, 7)]; };
/** A corset over a blouse: the blouse's standing collar with a lace edge and a cameo at the throat, a frill down its front, and the corset's sweetheart edge, its boning curving in to the waist, a brass busk. */
TOPS.corset = (p) => { const body = p.top.vest ?? p.top.color, blouse = p.top.vest ? p.top.color : p.top.shirt ?? SHIRT, dark = shade(body, 0.55); return [
  torso('M 68 480 C 82 390, 126 360, 162 348 L 238 348 C 274 360, 318 390, 332 480 Z', blouse),
  path('M 160 352 Q 200 370 240 352', stroke('#000', 6, 0.08)),
  ...[-1, 1].map((s) => path(`M ${200 + s * 4} 352 Q ${200 + s * 14} 372 ${200 + s * 6} 392 Q ${200 + s * 16} 406 ${200 + s * 8} 420`, stroke(shade(blouse, 0.8), 2.2, 0.7))), // the frill
  path('M 100 404 Q 146 372 194 392 Q 200 402 206 392 Q 254 372 300 404 L 300 700 L 100 700 Z', { fill: body }), // the corset
  path('M 100 404 Q 146 372 194 392 Q 200 402 206 392 Q 254 372 300 404', stroke(dark, 4)), path('M 102 401 Q 146 370 194 389', stroke('#fff', 1.2, 0.2)), // its bound edge
  ...[[140, 0.32], [168, 0.18], [232, -0.18], [260, -0.32]].map(([x, k]) => path(`M ${x} ${x < 200 ? 382 + (x - 140) * 0.3 : 382 + (260 - x) * 0.3} Q ${x + k * 40} 450 ${x + k * 70} 520`, stroke(dark, 2.2, 0.6))), // the boning, drawing in to the waist
  path('M 150 410 Q 158 450 152 500', stroke('#fff', 7, 0.07)), path('M 250 410 Q 242 450 248 500', stroke('#000', 9, 0.08)), // a satin sheen, the far panel in shade
  path('M 200 400 L 200 700', stroke(dark, 3)), ...[416, 436, 456, 476].flatMap((y) => [rect(195, y - 2.5, 10, 5, { rx: 1.5, fill: BRASS }), path(`M 196 ${y - 2} L 204 ${y - 2}`, stroke(BRASS_LIT, 1, 0.8))]), // the busk's clasps
  path('M 156 348 L 160 322 L 240 322 L 244 348 Q 200 356 156 348 Z', { fill: blouse, collar: true }), path('M 156 348 Q 200 356 244 348', { ...stroke('#000', 2, 0.15), collar: true }), // a standing collar
  ...Array.from({ length: 9 }, (_, i) => ellipse(164 + i * 9, 321, 5, 3.4, { fill: shade(blouse, 1.04), collar: true })), // its lace edge
  { ...ellipse(200, 340, 8, 10, { fill: BRASS }), collar: true }, { ...ellipse(200, 340, 6, 8, { fill: '#3a4a5a' }), collar: true }, { ...ellipse(201, 340, 3, 5, { fill: '#ece4d6' }), collar: true }, { ...path('M 194 334 Q 196 330 200 330', stroke(BRASS_LIT, 1.2, 0.8)), collar: true }]; }; // a cameo at the throat
/** A high-collared military jacket: a standing collar edged in brass, two rows of brass buttons with braided frogging across, a gear medal on a ribbon. */
TOPS.waistcoat.sleeve = TOPS.corset.sleeve = (p) => (p.top.vest ? p.top.color : p.top.shirt ?? SHIRT); // worn over a shirt: the arms are the shirt's sleeves, for an archetype's `vest` and a crowd member's plain colour alike
TOPS.militaryJacket = (p) => { const c = p.top.color, dark = shade(c, 0.55), trim = p.top.accent ?? '#c9a03c'; return [
  torso('M 64 480 C 78 390, 124 358, 160 346 L 240 346 C 276 358, 322 390, 336 480 Z', c),
  path('M 198 350 L 194 700', stroke(dark, 2.4, 0.7)), path('M 202 352 L 206 700', stroke('#fff', 1, 0.1)),
  ...[386, 414, 442, 470].flatMap((y, i) => { const w = 30 - i * 2; return [
    path(`M ${200 - w} ${y} Q 200 ${y + 5} ${200 + w} ${y}`, stroke('#000', 4, 0.25)), path(`M ${200 - w} ${y - 1} Q 200 ${y + 4} ${200 + w} ${y - 1}`, stroke(trim, 2.6)), // a cord across, its shadow under it
    ...[-1, 1].flatMap((s) => [path(`M ${200 + s * w} ${y - 1} Q ${200 + s * (w + 14)} ${y - 9} ${200 + s * (w + 8)} ${y + 2} Q ${200 + s * (w + 2)} ${y + 6} ${200 + s * w} ${y - 1}`, stroke(trim, 2)), ...button(200 + s * w, y, 3.4)])]; }), // a loop at each end round a button
  rect(136, 400, 22, 8, { fill: '#7a2a2a' }), rect(143, 400, 8, 8, { fill: '#e0d4b8' }), path('M 140 408 L 146 420 M 154 408 L 148 420', stroke(BRASS_DK, 1.4)), ...gear(147, 428, 9, 9), // the medal
  path('M 156 346 L 160 316 L 240 316 L 244 346 Q 200 356 156 346 Z', { fill: c, collar: true }), path('M 160 318 L 240 318', { ...stroke(trim, 3), collar: true }), path('M 157 344 Q 200 354 243 344', { ...stroke(dark, 2), collar: true }), path('M 196 318 L 196 350', { ...stroke(dark, 2), collar: true }), // the standing collar, open a crack
  { ...ellipse(184, 334, 5, 5, { fill: trim, op: 0.9 }), collar: true }, { ...ellipse(216, 334, 5, 5, { fill: trim, op: 0.9 }), collar: true }]; };

// --- coats --------------------------------------------------------------------------------------------------------
/** A frock coat worn open: long panels, wide lapels turned back with their thickness lit along the fold and shadowed under, a brass gear pinned at one, brass buttons down the edges. */
JACKETS.frockCoat = (p) => { const c = p.jacket.color, dark = shade(c, 0.55), facing = p.jacket.accent ?? shade(c, 0.68); return [ // the lapels faced in a darker silk
  path('M 100 700 L 100 404 C 104 376, 130 358, 160 350 L 172 350 L 184 480 L 180 700 Z', { fill: c }), path('M 300 700 L 300 404 C 296 376, 270 358, 240 350 L 228 350 L 216 480 L 220 700 Z', { fill: c }),
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 28} 350 L ${200 + s * 60} 352 L ${200 + s * 64} 392 L ${200 + s * 54} 396 L ${200 + s * 60} 414 L ${200 + s * 18} 482 Z`, { fill: facing }), // the lapel, notched
    path(`M ${200 + s * 60} 414 L ${200 + s * 18} 482 L ${200 + s * 15} 486`, stroke('#000', 4, 0.3)), path(`M ${200 + s * 28} 350 L ${200 + s * 18} 482`, stroke(shade(c, 1.5), 2.2, 0.7)), path(`M ${200 + s * 44} 360 L ${200 + s * 34} 440`, stroke('#fff', 5, 0.08)), path(`M ${200 + s * 62} 394 L ${200 + s * 54} 396`, stroke(dark, 2, 0.8)), // its shadow, its lit roll, the notch
    path(`M ${200 + s * 18} 482 L ${200 + s * 16} 700`, stroke('#000', 8, 0.15))]),
  ...gear(152, 402, 10, 9), ...gear(162, 416, 6, 7), path('M 162 422 Q 160 440 176 454', stroke(BRASS_DK, 1.6, 0.8)), path('M 162 421 Q 160 439 176 453', stroke(BRASS_LIT, 0.7, 0.6)), // a gear in the buttonhole, its chain down behind the lapel
  ...[-1, 1].flatMap((s) => button(200 + s * 34, 472, 4))]; };
/** An aviator's leather coat: a big fleece collar over the shoulders, a crossed front buttoned on the diagonal, the leather's sheen in long streaks. */
JACKETS.aviatorCoat = (p) => { const c = p.jacket.color, dark = shade(c, 0.55), fleece = p.jacket.accent ?? '#e6dcc6', fd = shade(fleece, 0.78); return [
  torso('M 62 480 C 72 392, 118 360, 158 348 L 242 348 C 282 360, 328 392, 338 480 Z', c),
  path('M 226 370 L 168 700 L 100 700 L 100 420 Z', { fill: shade(c, 1.08) }), path('M 226 370 L 168 700', stroke('#000', 5, 0.3)), path('M 224 372 L 166 698', stroke('#fff', 1.4, 0.15)), // the crossed front's edge
  ...[[214, 410], [200, 450]].flatMap(([x, y]) => [...button(x, y, 4.4), ...button(x - 40, y - 6, 4.4)]),
  path('M 120 400 Q 130 440 126 480', stroke('#fff', 6, 0.08)), path('M 274 400 Q 270 440 276 480', stroke('#fff', 4, 0.06)), path('M 300 420 Q 296 460 300 500', stroke('#000', 14, 0.12)), // the sheen
  path('M 116 384 C 120 352, 160 338, 200 346 C 240 338, 280 352, 284 384 L 264 414 C 250 392, 232 376, 214 378 L 200 392 L 186 378 C 168 376, 150 392, 136 414 Z', { fill: fleece }), // the fleece collar
  path('M 136 414 C 150 392, 168 376, 186 378 L 200 392 L 214 378 C 232 376, 250 392, 264 414', stroke(fd, 3)),
  ...Array.from({ length: 22 }, (_, i) => { const t = i / 21, x = 124 + t * 152, y = 368 + Math.abs(t - 0.5) * 30 + Math.sin(i * 2.1) * 6; return path(`M ${f1(x)} ${f1(y)} Q ${f1(x + 3)} ${f1(y - 4)} ${f1(x + 6)} ${f1(y)} Q ${f1(x + 9)} ${f1(y + 4)} ${f1(x + 12)} ${f1(y)}`, stroke(fd, 1.6, 0.6)); }), // its curl
  path('M 130 380 C 150 360, 176 352, 196 354', stroke('#fff', 3, 0.3))]; };
/** A duster: a long canvas coat hanging open, a coachman's cape over the shoulders to mid-chest, its collar turned up behind the jaw. */
JACKETS.duster = (p) => { const c = p.jacket.color, dark = shade(c, 0.6); return [
  path('M 100 700 L 100 404 C 104 376, 130 358, 160 350 L 174 350 L 182 700 Z', { fill: c }), path('M 300 700 L 300 404 C 296 376, 270 358, 240 350 L 226 350 L 218 700 Z', { fill: c }),
  ...[-1, 1].map((s) => path(`M ${200 + s * 18} 420 L ${200 + s * 18} 700`, stroke('#000', 10, 0.16))),
  path('M 100 404 C 104 372, 140 352, 176 348 L 180 456 Q 140 470 100 452 Z', { fill: c }), path('M 300 404 C 296 372, 260 352, 224 348 L 220 456 Q 260 470 300 452 Z', { fill: c }), // the cape
  path('M 180 456 Q 140 470 100 452', stroke('#000', 5, 0.3)), path('M 220 456 Q 260 470 300 452', stroke('#000', 5, 0.3)), path('M 180 452 Q 140 466 100 448', stroke('#fff', 1.4, 0.15)),
  path('M 180 476 Q 140 490 100 472', stroke('#000', 8, 0.12)), path('M 220 476 Q 260 490 300 472', stroke('#000', 8, 0.12)), // the shadow it throws
  path('M 132 380 Q 140 420 138 456', stroke(dark, 1.6, 0.5)), path('M 268 380 Q 260 420 262 456', stroke(dark, 1.6, 0.5)),
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 22} 352 L ${200 + s * 36} 312 L ${200 + s * 60} 330 L ${200 + s * 54} 352 Z`, { fill: shade(c, 0.85) }), path(`M ${200 + s * 36} 312 L ${200 + s * 60} 330`, stroke('#fff', 1.4, 0.2))]), // the collar, turned up
  ...button(180, 380, 4)]; };

// --- accessories and a prop -----------------------------------------------------------------------------------------
/** Goggles pushed up off the eyes onto the forehead, the strap round the head over the hair. */
ACCESSORIES.foreheadGoggles = { at: 'over', ops: () => [path('M 116 152 Q 200 108 284 152', stroke('#000', 10, 0.18)), path('M 116 148 Q 200 104 284 148', stroke(LEATHER, 8)), path('M 120 144 Q 200 102 280 144', stroke('#fff', 1.2, 0.15)), ...goggles(176, 224, 126, 17, 146, 254, 120)] };
/** A brass ear: a cup over the right ear, riveted, and a little horn curling up from it. */
ACCESSORIES.brassEar = { at: 'ear', ops: () => [path('M 286 210 C 296 196, 300 176, 316 168', stroke(BRASS_DK, 7)), path('M 286 210 C 296 196, 300 176, 316 168', stroke(BRASS_LIT, 2, 0.6)),
  path('M 308 160 L 330 152 L 326 180 Z', { fill: BRASS }), ellipse(328, 166, 5, 14, { fill: BRASS_DK }), ellipse(328, 166, 3, 10, { fill: '#2a2218' }),
  ellipse(284, 222, 13, 20, { fill: '#000', op: 0.2 }), ellipse(282, 220, 12, 19, { fill: BRASS }), path(arc(282, 220, 10, 17, ...UPPER_LEFT), stroke(BRASS_LIT, 2, 0.7)), path(arc(282, 220, 10, 17, ...LOWER_RIGHT), stroke(BRASS_DK, 2.6, 0.8)),
  ...[0, 1, 2, 3].map((i) => ellipse(282 + 8 * Math.cos(i * 1.57), 220 + 14 * Math.sin(i * 1.57), 1.4, 1.4, { fill: BRASS_DK })), ...gear(282, 220, 5, 7)] };
/** A brass forearm: the sleeve rolled to the elbow, then a riveted casing with two pistons along it, a brass hand of three jointed fingers raised in front of the chest. */
PROPS.brassArm = { arms: [1], front: (p) => { const ex = 308, ey = 482, wx = 258, wy = 400, L = Math.hypot(wx - ex, wy - ey), ux = (wx - ex) / L, uy = (wy - ey) / L, nx = -uy, ny = ux;
  const at = (t, w) => `${f1(ex + (wx - ex) * t + nx * w)} ${f1(ey + (wy - ey) * t + ny * w)}`, W = (t) => 25 - 8 * t; // a point along the forearm, t from the elbow to the wrist, w across it
  const hand = (dx, dy, len, a) => { const x1 = wx + ux * 14 + dx, y1 = wy + uy * 14 + dy, x2 = x1 + Math.cos(a) * len, y2 = y1 + Math.sin(a) * len, x3 = x2 + Math.cos(a - 0.35) * len * 0.7, y3 = y2 + Math.sin(a - 0.35) * len * 0.7;
    return [path(`M ${f1(x1)} ${f1(y1)} L ${f1(x2)} ${f1(y2)} L ${f1(x3)} ${f1(y3)}`, stroke(BRASS_DK, 9)), path(`M ${f1(x1)} ${f1(y1)} L ${f1(x2)} ${f1(y2)} L ${f1(x3)} ${f1(y3)}`, stroke(BRASS, 6)), ellipse(x2, y2, 3.6, 3.6, { fill: BRASS_DK }), ellipse(x2 - 1, y2 - 1, 1.4, 1.4, { fill: BRASS_LIT })]; }; // a finger: two jointed segments, curling
  return [
  ...arm(p, 1, { lift: 0.35, elbow: [ex, ey], wrist: [ex - 6, ey - 8], hand: false }), // the sleeve to the elbow
  ellipse(ex - 2, ey - 2, 32, 22, { fill: shade(p.top.color, 0.88) }), path(`M ${ex - 30} ${ey - 8} Q ${ex} ${ey - 22} ${ex + 28} ${ey - 12}`, stroke('#000', 2, 0.25)), // its roll
  path(`M ${at(0, -W(0))} L ${at(1, -W(1))} L ${at(1, W(1))} L ${at(0, W(0))} Z`, { fill: '#000', op: 0.2 }), // the casing's shadow on the chest
  path(`M ${at(0.04, -W(0))} L ${at(1, -W(1))} L ${at(1, W(1))} L ${at(0.04, W(0))} Z`, { fill: BRASS }),
  path(`M ${at(0.04, -W(0) + 3)} L ${at(1, -W(1) + 3)}`, stroke(BRASS_DK, 5, 0.8)), path(`M ${at(0.04, W(0) - 3)} L ${at(1, W(1) - 3)}`, stroke(BRASS_LIT, 3, 0.7)), // the dark edge, the lit edge
  ...[0.3, 0.62].flatMap((t) => [path(`M ${at(t, -W(t))} L ${at(t, W(t))}`, stroke(BRASS_DK, 3.4, 0.8)), path(`M ${at(t + 0.02, -W(t))} L ${at(t + 0.02, W(t))}`, stroke(BRASS_LIT, 1.2, 0.6)), ...[-0.6, 0, 0.6].map((k) => ellipse(...at(t + 0.06, W(t) * k).split(' ').map(Number), 1.6, 1.6, { fill: BRASS_DK }))]), // riveted bands
  path(`M ${at(0.12, 6)} L ${at(0.9, 4)}`, stroke('#5e5e5a', 6)), path(`M ${at(0.12, 6)} L ${at(0.9, 4)}`, stroke('#d8d8d2', 1.6, 0.6)), // a steel piston
  ...gear(...at(0.1, -4).split(' ').map(Number), 12, 10), // the elbow's gear
  ...hand(-14, 4, 16, Math.atan2(uy, ux) - 0.7), ...hand(-6, -2, 19, Math.atan2(uy, ux) - 0.25), ...hand(4, -4, 19, Math.atan2(uy, ux) + 0.1), ...hand(12, 0, 15, Math.atan2(uy, ux) + 0.5), // the fingers, spread
  ...brass(wx + ux * 8, wy + uy * 8, 16, 4), ellipse(wx + ux * 8, wy + uy * 8, 6, 6, { fill: BRASS_DK })]; } }; // the wrist's joint, over the knuckles

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const STEAMPUNK = { hats: ['topHatGoggles', 'bowler', 'aviatorCap', 'ladyTopHat'], glasses: ['monocle', 'aeroGoggles', 'loupeGoggles'], tops: ['waistcoat', 'corset', 'militaryJacket'], jackets: ['frockCoat', 'aviatorCoat', 'duster'], props: ['brassArm'], accessories: ['foreheadGoggles', 'brassEar'] };
tagPack(STEAMPUNK, 'only:steampunk');
