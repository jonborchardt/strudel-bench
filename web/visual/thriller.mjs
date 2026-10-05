// thriller: the tableau's zombie theme. A song asks for it with `visual: { world: 'tableau', theme: 'thriller' }`
// and gets, on the same three sets with the same cutting and the same dance, a cast of the walking dead in the
// clothes they were buried in (the 80s: a red leather jacket with chevrons, a varsity jacket, a leotard and a
// sweatband, a sweatshirt off one shoulder, a ruffled tux, a power suit with the shoulders padded, a sweater knotted
// over a polo, a hospital gown, a wedding gown and veil, leather and denim and a mullet) doing the Thriller
// choreography: the claw with both hands up, the stiff-legged shuffle with the arms out, the head snapped to one
// side, the lean, the shoulder shimmy, the line of them clawing in step, the horde closing on the camera.
//
// How it stays out of the general system: every part here (a top, a jacket, a hat, a hair style, a makeup, a mark,
// a prop, a set of teeth, a costume, an archetype, an expression) is registered into portrait.mjs's and cast.mjs's
// registries BY NAME at import, and nothing more. The lists the general generators and sheets pick from
// (`TOP_STYLES`, `COSTUME_FAMILIES`, `ARCHETYPE_NAMES` and the rest) were taken at those modules' load, so a random
// crowd, the editorial cast, the portrait editor's menus and faces.html never see a zombie part; only a shot that
// names one draws it, and only this theme names them. thriller.html is the sheet that shows them.
//
// What makes a face a zombie here is in layers, each a number or a name on the identity, never a filter over the
// drawing: the skin is one of ZOMBIE_SKINS (ashen, grey-green, a greyed warm), the eyes are milky (DEAD_EYES: a pale
// iris, a grey pupil, bags and deep sockets), the teeth are `rotten`, and the rot itself is makeup on the skin and
// face slots (bruised sockets, gaunt cheeks, grey cracked lips, veins at the temples, a gash, the jaw open to the
// teeth, stitches, peeling skin, drool, blood at the mouth) worn as the person's home makeup, so it is their face in
// every shot. The grave is on the clothes as marks (dirt, moss, blood, tears) that a phase adds more of and a snare
// cuts through. The dance is the tableau's with the amplitudes up (`motion`): the head lurches further, the kick
// drops the jaw, and the shots hold a dead stare instead of a smile.
import { TOPS, JACKETS, HATS, HAIR, MOUTHS, MAKEUP, MARKS, PROPS, TEETH, NECKLINES, JACKET_EDGE, arm, shade, mapXY, scaleAbout, soft, path, ellipse, rect, line, stroke } from './portrait.mjs';
import { COSTUMES, ARCHETYPES, EXPRESSIONS, WHITE, BLACK } from './cast.mjs';
import { rand } from './kit.mjs';

const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
const fp = (fill, op = 1) => ({ fill, op });
const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const dk = (op) => ({ fill: '#000', op }), dkl = (sw, op) => stroke('#000', sw, op, 'butt');

// --- the 80s palette, as it comes out of the ground: every colour a shade duller than it was sold ---
export const NEON = { pink: '#c23d8e', blue: '#2a5fb8', lime: '#8fbf2f', teal: '#2fb5b0', yellow: '#d9c64a', purple: '#6b3fa0', orange: '#d8742a', acid: '#9fb5c8', red: '#b3202a', ivory: '#efe8dc' };
/** The skins of the dead: ashen, grey-green, a greyed warm, one deep; no live tone among them. */
export const ZOMBIE_SKINS = ['#8e9a86', '#9aa08f', '#a7a899', '#8b9483', '#b2ac9c', '#9c9d90', '#a39a8e', '#7f8b7a', '#5f6a5e', '#b5b2a6'];
/** Milky eyes: a pale iris, a grey pupil, the sockets deep and bagged. */
export const DEAD_EYES = { iris: '#bdb9ab', pupil: '#55524c', sclera: 0.85, bags: 1, depth: 0.95 };

// --- garments: the decade's silhouettes (each a top or a jacket in the portrait's own language) ---
const wave = (x0, y, n, w, h, a) => path(`M ${x0} ${y} ` + Array.from({ length: n }, (_, i) => `Q ${x0 + w * (i + 0.5)} ${y + (i % 2 ? h : -h)} ${x0 + w * (i + 1)} ${y}`).join(' '), a); // a row of scallops: a ruffle, a lace edge
Object.assign(TOPS, {
  // a ruffled tuxedo shirt: the placket is four rows of frills down the chest under a wing collar
  ruffledTux: (p) => [torso('M 74 480 C 88 397, 131 369, 164 356 L 236 356 C 269 369, 312 397, 326 480 Z', p.top.color), path('M 195 377 L 205 377 L 220 413 L 180 413 Z', { fill: p.top.color, collar: true }), path('M 164 356 L 195 377 L 181 409 L 150 365 Z', { fill: p.top.color, collar: true }), path('M 236 356 L 205 377 L 219 409 L 250 365 Z', { fill: p.top.color, collar: true }), path('M 164 356 L 195 377 L 181 409 L 150 365 Z', { fill: '#fff', op: 0.09, collar: true }), path('M 236 356 L 205 377 L 219 409 L 250 365 Z', { fill: '#fff', op: 0.09, collar: true }), ...[396, 416, 436, 456, 476].flatMap((y) => [wave(172, y, 7, 8, 4, stroke(shade(p.top.color, 0.72), 1.6, 0.8)), wave(172, y + 2, 7, 8, 4, stroke('#fff', 1, 0.35))])],
  // a leotard: a wide scoop neck, a shine down the chest and a contrast belt at the waist
  leotard: (p) => [torso('M 76 480 C 90 398, 134 370, 166 357 L 234 357 C 266 370, 310 398, 324 480 Z', p.top.color), path('M 150 352 Q 200 404 250 352 Q 200 392 150 352 Z', dk(0.14)), path('M 186 410 C 182 440, 184 470, 190 500', stroke('#fff', 10, 0.1)), rect(86, 468, 228, 16, { fill: p.top.accent ?? NEON.teal }), rect(86, 468, 228, 3, { fill: '#fff', op: 0.25 })],
  // a sweatshirt with the neck cut out and fallen off one shoulder: the cloth's edge runs low across the right, and the shoulder shows bare above it
  offShoulderSweat: (p) => [torso('M 72 480 C 86 394, 130 365, 163 354 L 237 354 C 270 365, 314 394, 328 480 Z', p.top.color), path('M 200 388 L 234 360 C 262 370, 300 390, 316 452 L 302 452 C 292 432, 262 422, 236 420 Q 216 418 200 420 Z', { fill: p.skin }), path('M 236 420 C 262 422, 292 432, 302 452', stroke(shade(p.top.color, 0.6), 5, 0.4, 'butt')), path('M 150 358 Q 200 396 236 420', stroke(shade(p.top.color, 0.6), 5, 0.4, 'butt')), path('M 84 430 Q 200 416 316 430', stroke('#fff', 1.5, 0.04))],
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
TEETH.rotten = (d, cx, w, ty, th) => [path(d, { fill: '#c9b27a' }), ...[-0.2, -0.08, 0.05, 0.18].map((f) => line(cx + w * f, ty - th, cx + w * f + 1.5, ty + th, stroke('#3a2a18', 1.8, 0.7))), rect(cx + w * 0.1, ty - th, w * 0.07, th * 2, fp('#2a1a14', 0.9))]; // yellowed, a gap where one is gone

// --- the rot: makeup on the skin (under the features) and the face (over them), laid out by the eyes or the face ---
const GASH = (d, rim) => [path(d, stroke('#5a1216', 7, 0.92)), path(d, stroke('#1e0608', 2.6, 0.9)), path(rim, stroke('#b2584f', 1.4, 0.5))]; // a slash: the raw flesh, the dark of it, a lighter edge where the skin has pulled
const branch = (x, y, s, c, op) => [path(`M ${x} ${y} C ${x + 6 * s} ${y + 10}, ${x + 2 * s} ${y + 22}, ${x + 10 * s} ${y + 34}`, stroke(c, 2, op)), path(`M ${x + 4 * s} ${y + 14} Q ${x + 14 * s} ${y + 16} ${x + 18 * s} ${y + 26}`, stroke(c, 1.6, op)), path(`M ${x + 2 * s} ${y + 22} Q ${x - 6 * s} ${y + 30} ${x - 4 * s} ${y + 40}`, stroke(c, 1.4, op * 0.8))]; // a vein forking down from (x, y)
export const ZOMBIE_MAKEUP = {
  ashenSockets: { fit: 'eyes', skin: () => [...soft(166, 198, 32, 22, '#3b2d40', 0.8), ...soft(234, 198, 32, 22, '#3b2d40', 0.8), ...soft(166, 200, 20, 13, '#241a2a', 0.5), ...soft(234, 200, 20, 13, '#241a2a', 0.5)] }, // the sockets bruised purple-grey, deeper than any living hollow
  gauntCheeks: { fit: 'face', skin: () => [path('M 118 224 Q 160 266 186 306 Q 142 284 118 224 Z', fp('#3f4a3c', 0.6)), path('M 282 224 Q 240 266 214 306 Q 258 284 282 224 Z', fp('#3f4a3c', 0.6)), ...soft(146, 262, 20, 28, '#2e3a2c', 0.6), ...soft(254, 262, 20, 28, '#2e3a2c', 0.6)] }, // the cheeks sucked in grey-green under the bone
  blackEye: { fit: 'eyes', skin: () => [...soft(234, 200, 28, 19, '#2b1a3a', 0.95), ...soft(238, 206, 16, 10, '#160b20', 0.5)] }, // one eye blackened
  rotLips: { face: (p) => { const w = p.mouth.width / 2, y = p.mouth.y; return [path(`M ${200 - w} ${y} Q 200 ${y + 3} ${200 + w} ${y}`, stroke('#2e1f28', 5, 0.85)), path(`M ${200 - w + 2} ${y - 4} Q 200 ${y - 8} ${200 + w - 2} ${y - 4} Q 200 ${y + 10} ${200 - w + 2} ${y - 4} Z`, fp('#3a2a34', 0.55)), ...[-0.5, -0.15, 0.25, 0.6].map((f) => line(200 + w * f, y - 5, 200 + w * f + 1, y + 7, stroke('#120a10', 1.2, 0.7)))]; } }, // the lips gone grey and cracked across
  veinedTemples: { fit: 'eyes', face: () => [...branch(140, 168, -1, '#243d3d', 0.8), ...branch(260, 168, 1, '#243d3d', 0.8), ...branch(176, 214, -1, '#243d3d', 0.6), ...branch(224, 214, 1, '#243d3d', 0.6)] }, // dark veins forking down the temples and under the eyes
  cheekGash: { fit: 'face', face: () => GASH('M 138 236 L 178 278', 'M 136 233 L 180 281') },
  foreheadGash: { fit: 'face', face: () => GASH('M 164 142 Q 200 154 238 138', 'M 162 139 Q 200 151 240 135') },
  // the cheek torn open from the mouth: the opening is a wedge that starts inside the lips and widens back along the cheek to a ragged edge, this side's lips gone. It moves with the mouth: its top is the upper lip's own edge (a smile bows it, as the mouth draws it), its depth near the mouth is the mouth's own ( drops it), the corner holds as the corners do, and the teeth hang from that edge as the mouth's band does, in the mouth's own tooth colour, small where the lips were and full at the tear; the lower tips sit along the tear's bottom. No further back than the jaw
  exposedJaw: { face: (p) => { const st = MOUTHS[p.mouth.style] ?? {}, hw = (p.mouth.width * (st.wide ?? 1)) / 2, cx = 200 + hw, y = p.mouth.y - (st.asym ? 4 : 0), sm = p.mouth.smile ?? 0, op = p.mouth.open ?? 0, jawX = 200 + (p.face.width / 2) * p.face.jaw * 0.9, x1 = Math.max(cx + 24, Math.min(cx + 42, jawX - 2)), x0 = 200 + hw * 0.25; const yt0 = y + 0.47 * (18 * sm - 2 * op), yb0 = op > 0.08 ? y + 0.47 * (8 + 26 * op) : y + 1.5; const row = TEETH[p.mouth.teeth ?? 'even'] ?? TEETH.even, ivory = row('M 0 0 Z', 200, 40, 0, 2).find((o) => o.fill)?.fill ?? '#e3d9c3'; const hole = `M ${x0} ${yt0} Q ${(x0 + cx) / 2} ${(yt0 + y) / 2 - 2} ${cx - 2} ${y - 5} L ${cx + 4} ${y - 12} L ${cx + 12} ${y - 9} L ${cx + 22} ${y - 14} L ${x1 - 6} ${y - 10} L ${x1} ${y - 1} L ${x1 - 3} ${y + 9} L ${x1 - 12} ${y + 16} L ${cx + 16} ${y + 13} L ${cx + 6} ${y + 17} L ${cx - 2} ${Math.max(y + 9, yb0 + 4)} Q ${(x0 + cx) / 2} ${(yb0 + y + 9) / 2 + 2} ${x0} ${yb0} Z`; const n = Math.max(4, Math.floor((x1 - x0 - 8) / 6.5)), tw = (x1 - x0 - 8) / n, t = (x) => (x - x0) / (x1 - x0), topAt = (x) => (x < cx ? yt0 + (y - yt0) * ((x - x0) / (cx - x0)) : y - 6 + 4 * ((x - cx) / (x1 - cx))), botAt = (x) => y + 16 - 7 * ((x - cx) / (x1 - cx)); return [path(hole, fp('#2a0b0d', 0.97)), path(`M ${x0 + 2} ${topAt(x0 + 2) - 2} L ${x1 - 3} ${topAt(x1 - 3) - 4} L ${x1 - 3} ${topAt(x1 - 3) + 1} L ${x0 + 2} ${topAt(x0 + 2) + 0.5} Z`, fp('#7a3a3e', 0.85)), ...Array.from({ length: n }, (_, k) => { const x = x0 + 4 + k * tw, h = 2.5 + 6 * t(x + tw / 2); return rect(x, topAt(x + tw / 2) + 0.3, tw - 1.1, h, { rx: 1.2, fill: ivory }); }), ...Array.from({ length: n }, (_, k) => { const x = x0 + 4 + (k + 0.5) * tw; if (x < cx + 4) return null; const h = 3 + 2 * t(x); return rect(x, botAt(x + tw / 2) - h - 1, tw - 1.4, h, { rx: 1.2, fill: ivory, op: 0.85 }); }).filter(Boolean), path(`M ${x0} ${yt0} Q ${(x0 + cx) / 2} ${(yt0 + y) / 2 - 2} ${cx - 2} ${y - 5}`, stroke('#120406', 1.6, 0.9)), path(hole, stroke('#8c3a3a', 3, 0.55)), path(hole, stroke('#1a0608', 1.3, 0.85))]; } },
  stitchedBrow: { fit: 'eyes', face: () => [line(140, 177, 198, 165, stroke('#5a1216', 5, 0.8)), line(140, 177, 198, 165, stroke('#2a0c10', 2.4, 0.9)), ...[150, 162, 174, 186].map((x) => line(x - 3, 165 + (x - 142) * -0.2 + 6, x + 3, 165 + (x - 142) * -0.2 + 18, stroke('#1a1012', 2.4, 0.9)))] }, // sewn shut across the left brow
  peelingSkin: { fit: 'face', face: () => [['M 144 246 C 158 240, 172 246, 174 258 C 166 266, 150 262, 144 246 Z', 'M 144 246 C 158 240, 172 246, 174 258'], ['M 232 226 C 246 220, 256 230, 252 242 C 244 246, 234 240, 232 226 Z', 'M 232 226 C 246 220, 256 230, 252 242'], ['M 174 290 C 186 284, 198 290, 198 302 C 190 308, 178 304, 174 290 Z', 'M 174 290 C 186 284, 198 290, 198 302']].flatMap(([d, e]) => [path(d, fp('#5a2a28', 0.7)), path(d, fp('#c9a99a', 0.75)), path(e, stroke('#6a2f2a', 2, 0.9))]) }, // three flaps lifting off the cheeks and chin
  drool: { face: (p) => { const x = 200 + p.mouth.width * 0.42, y = p.mouth.y + 3; return [path(`M ${x} ${y} Q ${x + 3} ${y + 18} ${x + 1} ${y + 36}`, stroke('#e4ebe6', 4, 0.8)), ellipse(x + 1, y + 38, 3, 4, fp('#e4ebe6', 0.85))]; } },
  bloodMouth: { face: (p) => { const w = p.mouth.width / 2, y = p.mouth.y; return [path(`M ${200 - w} ${y} Q ${200 - w - 6} ${y + 12} ${200 - w - 2} ${y + 30}`, stroke('#4a0c10', 4, 0.85)), path(`M ${200 + w - 4} ${y + 2} Q ${200 + w + 2} ${y + 16} ${200 + w - 1} ${y + 40}`, stroke('#4a0c10', 3.2, 0.85)), ...soft(200, y + 2, w * 0.9, 7, '#4a0c10', 0.6), ellipse(200 + w - 1, y + 42, 2.6, 3.2, fp('#4a0c10', 0.9))]; } }, // dark blood smeared on the mouth and running from its corners
};
Object.assign(MAKEUP, ZOMBIE_MAKEUP);
/** The grave on the clothes: drawn on the body slot, over the garments. */
export const ZOMBIE_MARKS = {
  graveDirt: { body: () => [...soft(166, 442, 62, 40, '#3a2f22', 0.75), ...soft(252, 500, 52, 36, '#3a2f22', 0.6), ...soft(200, 392, 40, 22, '#3a2f22', 0.5), path('M 140 470 C 160 484, 150 510, 172 528', stroke('#2a2118', 3, 0.35)), path('M 236 414 C 254 430, 242 452, 262 470', stroke('#2a2118', 2.4, 0.35))] },
  bloodSplatter: { body: () => [...[[176, 412, 9], [192, 436, 5], [226, 402, 6], [238, 448, 11], [164, 470, 4], [214, 480, 7]].map(([x, y, r]) => ellipse(x, y, r, r * 0.8, fp('#4a0c10', 0.85))), path('M 238 456 Q 240 490 236 520', stroke('#4a0c10', 3.4, 0.8)), path('M 176 420 Q 174 450 178 468', stroke('#4a0c10', 2.4, 0.8))] },
  tornShirt: { body: (p) => [['M 146 418 L 164 408 L 178 424 L 172 444 L 152 448 L 142 432 Z', 'M 146 418 L 164 408 L 178 424 L 172 444 L 152 448 L 142 432 Z'], ['M 244 466 L 266 460 L 276 480 L 262 498 L 242 490 Z', 'M 244 466 L 266 460 L 276 480 L 262 498 L 242 490 Z']].flatMap(([d, e]) => [path(d, { fill: p.skin }), path(d, fp('#000', 0.14)), path(e, stroke('#1a1412', 1.6, 0.55))]) }, // ragged holes with the skin in them
  mossStreaks: { body: () => [path('M 130 400 C 150 430, 140 470, 160 500', stroke('#5a6e3a', 6, 0.45)), path('M 262 396 C 248 430, 268 462, 250 496', stroke('#5a6e3a', 5, 0.45)), ...soft(206, 456, 30, 18, '#5a6e3a', 0.5)] },
  dustShoulders: { body: () => [...soft(118, 390, 48, 18, '#bdb7a8', 0.55), ...soft(282, 390, 48, 18, '#bdb7a8', 0.55)] },
};
Object.assign(MARKS, ZOMBIE_MARKS);
export const EXTRA_MARKS = ['bloodSplatter', 'tornShirt', 'graveDirt', 'mossStreaks', 'dustShoulders']; // what a phase adds and a snare cuts through

// --- the hands: the Thriller claw, on arms from portrait.mjs's `arm` ---
/** A clawed hand at (x, y): the palm and four fingers hooked over, the thumb aside; `a` turns it (0: fingers up, π: hanging), `k` sizes it. */
export const claw = (p, x, y, a, k = 1.45) => {
  const col = p.props.includes('gloves') ? '#161517' : p.skin, c = Math.cos(a), sn = Math.sin(a), at = (dx, dy) => [x + (dx * c - dy * sn) * k, y + (dx * sn + dy * c) * k], P = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  const out = [ellipse(x, y, 13 * k, 15 * k, { fill: col }), ellipse(x, y + 4 * k, 9 * k, 7 * k, fp('#000', 0.1))];
  [-11, -4, 4, 11].forEach((dx, i) => { const reach = i === 0 || i === 3 ? 0.9 : 1, d = `M ${P(at(dx, -8))} Q ${P(at(dx * 1.5, -27 * reach))} ${P(at(dx * 2.3 + (dx < 0 ? -2 : 2), -15 * reach))}`; out.push(path(d, stroke(col, 6 * k)), path(d, stroke('#2a1a18', 1.1, 0.2))); });
  out.push(path(`M ${P(at(-8, 2))} Q ${P(at(-22, -4))} ${P(at(-25, -14))}`, stroke(col, 5.5 * k)));
  return out;
};
// The hands as the dance has them (a raised hand's fingers point up and curl forward, never hang: claw's angle near 0). The claw: the elbows out at shoulder height, the forearms straight up, the hands at eye level
// hooked forward; the arms leave the body, so the garment's shoulders are cut away under them as for hands up. Reaching at the
// camera: the upper arm foreshortens to a stub behind a large near hand in front of the shoulder. The side swing: the near arm up
// beside the head, the far arm across the chest under the chin with its forearm up beside the near one, both hands hooked together.
export const ZOMBIE_PROPS = {
  clawHands: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [62, 392], wrist: [80, 262], hand: false }), ...claw(p, 84, 244, -0.35, 1.6), ...arm(p, 1, { lift: 1, elbow: [338, 392], wrist: [320, 262], hand: false }), ...claw(p, 316, 244, 0.35, 1.6)] },
  clawRaisedRight: { lift: [1], front: (p) => [...arm(p, 1, { lift: 1, elbow: [318, 300], wrist: [296, 198], hand: false }), ...claw(p, 292, 182, 0.3, 1.6)] }, // one arm over the head, the hand hanging clawed
  clawRaisedLeft: { lift: [-1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [82, 300], wrist: [104, 198], hand: false }), ...claw(p, 108, 182, -0.3, 1.6)] },
  clawsUp: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [70, 300], wrist: [94, 194], hand: false }), ...claw(p, 98, 178, -0.35, 1.6), ...arm(p, 1, { lift: 1, elbow: [330, 300], wrist: [306, 194], hand: false }), ...claw(p, 302, 178, 0.35, 1.6)] }, // both arms up, the hands hanging over the head
  clawsRight: { lift: [-0.25, 1], front: (p) => [...arm(p, -1, { lift: 0.5, elbow: [262, 338], wrist: [282, 236], hand: false }), ...claw(p, 286, 220, 0.4, 1.6), ...arm(p, 1, { lift: 1, elbow: [340, 326], wrist: [326, 214], hand: false }), ...claw(p, 330, 198, 0.3, 1.6)] },
  clawsLeft: { lift: [-1, 0.25], front: (p) => [...arm(p, 1, { lift: 0.5, elbow: [138, 338], wrist: [118, 236], hand: false }), ...claw(p, 114, 220, -0.4, 1.6), ...arm(p, -1, { lift: 1, elbow: [60, 326], wrist: [74, 214], hand: false }), ...claw(p, 70, 198, -0.3, 1.6)] },
  armsForward: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 0.7, elbow: [96, 436], wrist: [126, 404], hand: false }), ...claw(p, 132, 386, -0.1, 2.1), ...arm(p, 1, { lift: 0.7, elbow: [304, 436], wrist: [274, 404], hand: false }), ...claw(p, 268, 386, 0.1, 2.1)] }, // reaching at the camera: the hands large and near, the arms stubs behind them
  reachRight: { lift: [1], front: (p) => [...arm(p, 1, { lift: 0.7, elbow: [304, 436], wrist: [272, 404], hand: false }), ...claw(p, 264, 386, 0.1, 2)] },
  veilBack: { back: () => [path('M 150 96 C 118 160, 92 260, 74 430 L 326 430 C 308 260, 282 160, 250 96 Z', fp('#f6f2ea', 0.5)), path('M 150 96 C 118 160, 92 260, 74 430', stroke('#fff', 1.5, 0.5)), path('M 250 96 C 282 160, 308 260, 326 430', stroke('#fff', 1.5, 0.5))] }, // the veil's sheet, behind the figure
};
Object.assign(PROPS, ZOMBIE_PROPS);

// --- the wardrobe: what each of them was buried in ---
export const ZOMBIE_COSTUMES = {
  thrillerRed: () => ({ top: { style: 'crewTshirt', color: '#1a1618' }, jacket: { style: 'redLeatherChevron', color: NEON.red }, pants: { style: 'trousers', color: '#1a1618' } }),
  varsity: (v) => ({ top: { style: 'crewTshirt', color: WHITE }, jacket: { style: 'varsityJacket', color: v ? '#7a2a2a' : '#2a4f8f', accent: '#e9e2d0' } }),
  aerobics: () => ({ top: { style: 'leotard', color: NEON.pink, accent: NEON.teal }, jacket: { style: 'none' }, pants: { style: 'trousers', color: NEON.teal }, hat: { style: 'headband', color: NEON.teal, accent: NEON.yellow } }),
  flashdance: () => ({ top: { style: 'offShoulderSweat', color: '#8d8c87' }, jacket: { style: 'none' } }),
  tuxedo: () => ({ top: { style: 'ruffledTux', color: NEON.ivory, accent: '#5a1a2c' }, jacket: { style: 'blazer', color: '#1b1a1f' }, pants: { style: 'trousers', color: '#1b1a1f' }, accessories: ['tie'] }),
  powerSuit: () => ({ top: { style: 'crewTshirt', color: NEON.yellow, metal: 1 }, jacket: { style: 'padShoulderBlazer', color: NEON.purple }, pants: { style: 'skirt', color: NEON.purple } }),
  preppy: () => ({ top: { style: 'polo', color: '#e8c0b6' }, jacket: { style: 'sweaterShoulders', color: '#2f5d3a' } }),
  tracksuit: () => ({ top: { style: 'trackTop', color: NEON.blue, accent: NEON.yellow }, jacket: { style: 'none' }, pants: { style: 'trousers', color: NEON.blue }, hat: { style: 'headband', color: NEON.yellow, accent: NEON.blue } }),
  hospital: () => ({ top: { style: 'hospitalGown', color: '#bfd3cf' }, jacket: { style: 'none' }, pants: { style: 'skirt', color: '#bfd3cf' } }),
  bride: () => ({ top: { style: 'laceGown', color: NEON.ivory }, jacket: { style: 'none' }, pants: { style: 'skirt', color: NEON.ivory }, hat: { style: 'veil', color: '#f6f2ea', accent: '#d9c79a' }, props: ['veilBack'] }),
  punk: () => ({ top: { style: 'crewTshirt', color: '#1a1618', graphic: 'symbol' }, jacket: { style: 'leatherJacket', color: '#1d1b1e' } }),
  metal: (v) => ({ top: { style: 'crewTshirt', color: '#1a1618', graphic: v ? 'geometric' : 'strokes' }, jacket: { style: 'denimJacket', color: NEON.acid }, pants: { style: 'trousers', color: NEON.acid } }),
  disco: () => ({ top: { style: 'openShirt', color: '#c9a53a' }, jacket: { style: 'none' }, props: ['chain'] }),
  undertaker: () => ({ top: { style: 'buttonDown', color: '#dcd6c8' }, jacket: { style: 'trenchCoat', color: '#1f1d1f' }, hat: { style: 'wideBrimFelt', color: '#1c1a1c', accent: '#3a3436' } }),
  soldier: () => ({ top: { style: 'crewTshirt', color: '#5c6b4a' }, jacket: { style: 'fieldJacket', color: '#4a5a38' }, pants: { style: 'trousers', color: '#4a5a38' } }),
  newWave: () => ({ top: { style: 'buttonDown', color: '#f1eee9', accent: '#e0237a' }, jacket: { style: 'blazer', color: NEON.teal }, accessories: ['tie'] }),
  goth: () => ({ top: { style: 'turtleneck', color: '#141216' }, jacket: { style: 'none' }, pants: { style: 'skirt', color: '#141216' } }),
  surfer: () => ({ top: { style: 'openShirt', color: '#e07a8f' }, jacket: { style: 'none' } }),
  denimDiva: () => ({ top: { style: 'crewTshirt', color: '#c96a92' }, jacket: { style: 'denimJacket', color: '#9fb5c8' }, pants: { style: 'trousers', color: '#9fb5c8' } }),
};
Object.assign(COSTUMES, ZOMBIE_COSTUMES);
export const ZOMBIE_COSTUME_NAMES = Object.keys(ZOMBIE_COSTUMES);

// --- the cast: who they were, in `set` the same structural pins the editorial archetypes carry, plus the dead skin, the milky eyes and the rotten teeth ---
const dead = (skin, eyes = {}, mouth = {}) => ({ skin, eyes: { ...DEAD_EYES, ...eyes }, mouth: { teeth: 'rotten', ...mouth } });
export const ZOMBIES = {
  thrillerLead: { beard: 'none', family: 'squareJaw', hair: 'curlyMedium', hairColors: ['jetBlack'], costume: 'thrillerRed', makeup: ['ashenSockets', 'gauntCheeks', 'rotLips'], marks: 'none', set: { ...dead(ZOMBIE_SKINS[0], { spacing: 54, openness: 1.05 }), face: { width: 164, height: 210, chin: 0.2 }, nose: { style: 'straight', width: 20, length: 42 }, mouth: { width: 50, fullness: 0.5, teeth: 'rotten' }, neck: { width: 64, height: 74 }, body: { width: 1.05 }, pose: { turn: 0.2, shoulder: 0.3 } } },
  varsityJock: { beard: 'none', family: 'heavyBrow', hair: 'crewCut', hairColors: ['darkBlond', 'lightBrown'], costume: 'varsity', makeup: ['exposedJaw', 'ashenSockets'], marks: 'graveDirt', set: { ...dead(ZOMBIE_SKINS[1], { spacing: 44, depth: 1, openness: 0.8 }), face: { width: 186, height: 196, corner: 46, jaw: 0.72 }, nose: { style: 'broad', width: 30, length: 36 }, mouth: { style: 'wide', width: 54, fullness: 0.2, teeth: 'rotten' }, neck: { width: 92, height: 52 }, body: { width: 1.45 }, pose: { turn: 0.4, shoulder: -0.6, headTilt: -0.08 } } },
  aerobicsInstructor: { beard: 'none', family: 'wideCheek', hair: 'bigHair', hairColors: ['auburn', 'blond'], costume: 'aerobics', makeup: ['veinedTemples', 'drool', 'ashenSockets'], marks: 'none', set: { ...dead(ZOMBIE_SKINS[2], { spacing: 60, openness: 1.25 }, { open: 0.3 }), face: { width: 168, height: 190, chin: 0.1 }, nose: { style: 'upturned', width: 20, length: 28 }, mouth: { style: 'wide', width: 52, fullness: 0.6, teeth: 'rotten' }, neck: { width: 60, height: 60 }, body: { width: 0.9 }, pose: { turn: -0.3, headTilt: 0.14, bodyTilt: -0.06 } } },
  flashdancer: { beard: 'none', family: 'fineBoned', hair: 'wavyMedium', hairColors: ['darkBrown', 'espresso'], costume: 'flashdance', makeup: ['gauntCheeks', 'cheekGash', 'rotLips'], marks: 'graveDirt', set: { ...dead(ZOMBIE_SKINS[5], { spacing: 56, openness: 1.1 }), face: { width: 150, height: 214, chin: 0.26 }, nose: { style: 'narrow', width: 15, length: 44 }, mouth: { width: 44, fullness: 0.7, teeth: 'rotten' }, neck: { width: 52, height: 92 }, body: { width: 0.84 }, pose: { turn: 0.5, shoulder: 0.7, headTilt: 0.12 } } },
  tuxGroom: { family: 'longMidface', hair: 'middlePart', hairColors: ['espresso', 'jetBlack'], beard: 'mustache', costume: 'tuxedo', makeup: ['rotLips', 'bloodMouth', 'ashenSockets'], marks: 'bloodSplatter', set: { ...dead(ZOMBIE_SKINS[3], { spacing: 48, openness: 0.9 }), face: { width: 146, height: 230, chin: 0.25 }, nose: { style: 'long', width: 16, length: 52 }, mouth: { style: 'thin', width: 42, fullness: 0.15, teeth: 'rotten' }, neck: { width: 54, height: 96 }, body: { width: 1 }, pose: { turn: 0.3, shoulder: 0.6, headTilt: 0.14 } } },
  powerExec: { beard: 'none', family: 'squareJaw', hair: 'bluntBob', hairColors: ['platinum'], costume: 'powerSuit', makeup: ['stitchedBrow', 'peelingSkin', 'ashenSockets'], marks: 'none', set: { ...dead(ZOMBIE_SKINS[4], { spacing: 62, openness: 1 }), face: { width: 170, height: 196, chin: 0.3 }, nose: { style: 'straight', width: 18, length: 38 }, mouth: { style: 'full', width: 50, fullness: 0.9, teeth: 'rotten' }, neck: { width: 60, height: 70 }, body: { width: 1.3 }, pose: { turn: -0.35, headTilt: -0.1, shoulder: -0.4 } } },
  preppy: { beard: 'none', family: 'roundSoft', hair: 'sidePart', hairColors: ['lightBrown', 'darkBlond'], costume: 'preppy', makeup: ['gauntCheeks', 'drool'], marks: 'mossStreaks', set: { ...dead(ZOMBIE_SKINS[1], { spacing: 58, openness: 0.85 }, { open: 0.2 }), face: { width: 176, height: 190, chin: 0.06, jaw: 0.95 }, nose: { style: 'roundedTip', width: 26, length: 32 }, mouth: { width: 44, fullness: 0.6, teeth: 'rotten' }, neck: { width: 78, height: 50 }, body: { width: 1.1 }, pose: { turn: 0.25, bodyTilt: 0.07, headTilt: 0.06 } } },
  jogger: { beard: 'none', family: 'wideCheek', hair: 'afroShort', hairColors: ['jetBlack'], costume: 'tracksuit', makeup: ['veinedTemples', 'ashenSockets', 'foreheadGash'], marks: 'none', set: { ...dead(ZOMBIE_SKINS[8], { spacing: 64, openness: 1.1 }), face: { width: 160, height: 204 }, nose: { style: 'short', width: 22, length: 30 }, mouth: { style: 'wide', width: 46, fullness: 0.6, teeth: 'rotten' }, neck: { width: 56, height: 72 }, body: { width: 0.95 }, pose: { turn: -0.45, shoulder: 0.5, headTilt: 0.1 } } },
  patient: { family: 'longMidface', hair: 'shavedHead', hairColors: ['gray', 'saltPepper'], age: 'old', costume: 'hospital', makeup: ['ashenSockets', 'stitchedBrow', 'drool', 'gauntCheeks'], marks: 'bloodSplatter', set: { ...dead(ZOMBIE_SKINS[6], { spacing: 54, openness: 0.8 }, { open: 0.25 }), face: { width: 142, height: 226, chin: 0.24 }, nose: { style: 'aquiline', width: 20, length: 54 }, mouth: { style: 'thin', width: 40, fullness: 0.15, teeth: 'rotten' }, neck: { width: 48, height: 86 }, body: { width: 0.9 }, pose: { headTilt: 0.18, shoulder: -0.5, turn: 0.2 } } },
  bride: { beard: 'none', family: 'fineBoned', hair: 'bigHair', hairColors: ['platinum', 'white'], costume: 'bride', makeup: ['ashenSockets', 'rotLips', 'cheekGash'], marks: 'graveDirt', set: { ...dead(ZOMBIE_SKINS[9], { spacing: 62, openness: 1.15 }), face: { width: 158, height: 206, chin: 0.3 }, nose: { style: 'short', width: 17, length: 30 }, mouth: { style: 'cupidBow', width: 46, fullness: 0.8, teeth: 'rotten' }, neck: { width: 50, height: 84 }, body: { width: 0.8 }, pose: { turn: 0.3, headTilt: -0.14, shoulder: 0.3 } } },
  punk: { family: 'heavyBrow', hair: 'shortMohawk', hairColors: ['jetBlack'], beard: 'lightStubble', costume: 'punk', makeup: ['exposedJaw', 'veinedTemples', 'blackEye'], marks: 'tornShirt', set: { ...dead(ZOMBIE_SKINS[7], { spacing: 46, depth: 1, openness: 0.85 }), face: { width: 168, height: 206, corner: 40 }, nose: { style: 'broad', width: 26, length: 38 }, mouth: { style: 'asym', width: 48, fullness: 0.4, teeth: 'rotten' }, neck: { width: 70, height: 66 }, body: { width: 1.1 }, pose: { turn: 0.55, shoulder: -0.6, headTilt: -0.06 } } },
  metalhead: { family: 'squareJaw', hair: 'mullet', hairColors: ['darkBrown', 'brown'], beard: 'heavyStubble', costume: 'metal', makeup: ['peelingSkin', 'ashenSockets', 'rotLips'], marks: ['tornShirt', 'graveDirt'], set: { ...dead(ZOMBIE_SKINS[3], { spacing: 50, openness: 0.9 }), face: { width: 178, height: 200, corner: 44, chin: 0.05 }, nose: { style: 'straight', width: 22, length: 40 }, mouth: { style: 'wide', width: 52, fullness: 0.4, teeth: 'rotten' }, neck: { width: 76, height: 62 }, body: { width: 1.2 }, pose: { turn: -0.5, shoulder: 0.6, headTilt: 0.08 } } },
  discoGhoul: { family: 'wideCheek', hair: 'sweptBack', hairColors: ['espresso'], beard: 'mustache', costume: 'disco', makeup: ['gauntCheeks', 'rotLips', 'bloodMouth'], marks: 'none', set: { ...dead(ZOMBIE_SKINS[5], { spacing: 56, openness: 0.95 }), face: { width: 164, height: 206, chin: 0.22 }, nose: { style: 'aquiline', width: 18, length: 46 }, mouth: { width: 48, fullness: 0.5, teeth: 'rotten' }, neck: { width: 62, height: 76 }, body: { width: 1 }, pose: { turn: 0.6, shoulder: -0.5, headTilt: 0.06 } } },
  undertaker: { family: 'longMidface', hair: 'receding', hairColors: ['saltPepper', 'gray'], beard: 'garibaldi', age: 'old', costume: 'undertaker', makeup: ['ashenSockets', 'gauntCheeks', 'veinedTemples'], marks: 'dustShoulders', set: { ...dead(ZOMBIE_SKINS[7], { spacing: 52, depth: 1, openness: 0.8 }), face: { width: 148, height: 232, chin: 0.24 }, nose: { style: 'aquiline', width: 20, length: 56 }, mouth: { style: 'thin', width: 40, fullness: 0.15, teeth: 'rotten' }, neck: { width: 50, height: 100 }, body: { width: 1 }, pose: { headTilt: 0.1, shoulder: -0.4, turn: 0.25 } } },
  soldier: { family: 'squareJaw', hair: 'crewCut', hairColors: ['brown', 'darkBrown'], costume: 'soldier', makeup: ['foreheadGash', 'ashenSockets', 'exposedJaw'], marks: ['bloodSplatter', 'graveDirt'], set: { ...dead(ZOMBIE_SKINS[0], { spacing: 50, openness: 0.95 }), face: { width: 180, height: 204, corner: 44, chin: 0.08 }, nose: { style: 'straight', width: 22, length: 40 }, mouth: { width: 48, fullness: 0.35, teeth: 'rotten' }, neck: { width: 80, height: 60 }, body: { width: 1.3 }, pose: { turn: 0.2, shoulder: 0.3 } } },
  newWaver: { beard: 'none', family: 'fineBoned', hair: 'shortTextured', hairColors: ['platinum', 'lightBlond'], costume: 'newWave', makeup: ['cheekGash', 'rotLips', 'veinedTemples'], marks: 'none', set: { ...dead(ZOMBIE_SKINS[2], { spacing: 58, openness: 1.1 }), face: { width: 156, height: 212, chin: 0.26 }, nose: { style: 'narrow', width: 15, length: 42 }, mouth: { width: 44, fullness: 0.5, teeth: 'rotten' }, neck: { width: 56, height: 80 }, body: { width: 0.92 }, pose: { turn: -0.4, headTilt: 0.12, shoulder: 0.5 } } },
  goth: { beard: 'none', family: 'longMidface', hair: 'bluntBob', hairColors: ['jetBlack'], costume: 'goth', makeup: ['ashenSockets', 'rotLips', 'peelingSkin'], marks: 'none', set: { ...dead(ZOMBIE_SKINS[4], { spacing: 50, openness: 1.05 }), face: { width: 148, height: 222, chin: 0.24 }, nose: { style: 'long', width: 16, length: 48 }, mouth: { style: 'full', width: 42, fullness: 0.8, teeth: 'rotten' }, neck: { width: 50, height: 94 }, body: { width: 0.88 }, pose: { headTilt: -0.12, turn: 0.35, shoulder: -0.3 } } },
  surfer: { beard: 'none', family: 'wideCheek', hair: 'longStraight', hairColors: ['lightBlond', 'blond'], costume: 'surfer', makeup: ['gauntCheeks', 'drool', 'veinedTemples'], marks: 'mossStreaks', set: { ...dead(ZOMBIE_SKINS[1], { spacing: 60, openness: 0.9 }, { open: 0.2 }), face: { width: 170, height: 200, chin: 0.1 }, nose: { style: 'short', width: 22, length: 32 }, mouth: { style: 'wide', width: 50, fullness: 0.55, teeth: 'rotten' }, neck: { width: 66, height: 66 }, body: { width: 1.15 }, pose: { turn: -0.3, bodyTilt: -0.08, headTilt: 0.1 } } },
  denimDiva: { beard: 'none', family: 'wideCheek', hair: 'bigHair', hairColors: ['auburn', 'copper'], accessories: ['hoopLeft', 'hoopRight'], costume: 'denimDiva', makeup: ['ashenSockets', 'cheekGash', 'rotLips'], marks: 'dustShoulders', set: { ...dead(ZOMBIE_SKINS[6], { spacing: 60, openness: 1.2 }), face: { width: 172, height: 198, chin: 0.3 }, nose: { style: 'short', width: 19, length: 28 }, mouth: { style: 'full', width: 54, fullness: 1, teeth: 'rotten' }, neck: { width: 56, height: 72 }, body: { width: 0.95 }, pose: { bodyTilt: -0.09, turn: 0.45, headTilt: -0.1 } } },
};
Object.assign(ARCHETYPES, ZOMBIES);
export const ZOMBIE_NAMES = Object.keys(ZOMBIES);

// --- the faces they hold: no smile among them; `open` is the jaw, which the kick drops further (tableau's `motion.jaw`) ---
export const ZOMBIE_EXPRESSIONS = {
  slackJaw: { eyes: { openness: 0.9, browLift: 1 }, mouth: { smile: -0.25, open: 0.35 } },
  deadStare: { eyes: { openness: 1.2, browLift: -1 }, mouth: { smile: -0.15, open: 0.08 } },
  hunger: { eyes: { openness: 1.1, browLift: 3 }, mouth: { smile: 0.1, open: 0.5 } },
  snarl: { eyes: { openness: 0.75, browLift: -4, browSkew: 0.3 }, mouth: { style: 'asym', smile: -0.3, open: 0.25 } },
  moan: { eyes: { openness: 0.55, browLift: 4 }, mouth: { smile: -0.1, open: 0.6 } },
  lidsHalf: { eyes: { openness: 0.45 }, mouth: { smile: -0.2, open: 0.15 } },
};
Object.assign(EXPRESSIONS, ZOMBIE_EXPRESSIONS);
const EXPR_POOL = ['slackJaw', 'slackJaw', 'deadStare', 'hunger', 'snarl', 'moan', 'lidsHalf'], EMOTES = ['slackJaw', 'deadStare', 'hunger', 'moan', 'lidsHalf'];

// --- the poses: the Thriller choreography as it reads on a bust (tableau's layout fields, partial; `sw` is the stage's width in sheet units) ---
export const POSES = {
  thrillerClaw: () => [{ props: ['clawHands'], turn: 0.2, tilt: 0.1, headY: 6, shoulder: 0.3 }], // both hands up beside the shoulders, hooked
  clawSweep: () => [{ props: ['clawRaisedRight'], turn: -0.5, tilt: -0.14, shoulder: -0.6, headY: 4 }], // one arm over the head, the body under it
  clawsUp: () => [{ props: ['clawsUp'], headY: -4, tilt: 0.06, turn: 0.1 }],
  armsRight: () => [{ props: ['clawsRight'], tilt: 0.12, headX: 6, turn: 0.5, shoulder: -0.4, bodyTilt: 0.03 }], // the side swing: both hands up on the right, the head going with them
  armsLeft: () => [{ props: ['clawsLeft'], tilt: -0.12, headX: -6, turn: -0.5, shoulder: 0.4, bodyTilt: -0.03 }], // and then the left
  swingDuoRight: (n, sw) => [{ dx: -sw * 0.34, props: ['clawsRight'], tilt: 0.1, turn: 0.4, shoulder: -0.3 }, { dx: sw * 0.34, props: ['clawsRight'], tilt: 0.1, turn: 0.4, shoulder: -0.3 }],
  swingDuoLeft: (n, sw) => [{ dx: -sw * 0.34, props: ['clawsLeft'], tilt: -0.1, turn: -0.4, shoulder: 0.3 }, { dx: sw * 0.34, props: ['clawsLeft'], tilt: -0.1, turn: -0.4, shoulder: 0.3 }],
  swingLineRight: (n, sw) => [{ props: ['clawsRight'], tilt: 0.1, turn: 0.45, shoulder: -0.3 }, { dx: -sw * 0.74, props: ['clawsRight'], tilt: 0.12, turn: 0.5, shoulder: -0.35, k: 0.96 }, { dx: sw * 0.74, props: ['clawsRight'], tilt: 0.08, turn: 0.4, shoulder: -0.25, k: 0.96 }], // the line, every pair of hands to the right in step
  swingLineLeft: (n, sw) => [{ props: ['clawsLeft'], tilt: -0.1, turn: -0.45, shoulder: 0.3 }, { dx: -sw * 0.74, props: ['clawsLeft'], tilt: -0.08, turn: -0.4, shoulder: 0.25, k: 0.96 }, { dx: sw * 0.74, props: ['clawsLeft'], tilt: -0.12, turn: -0.5, shoulder: 0.35, k: 0.96 }],
  zombieShuffle: () => [{ props: ['armsForward'], bodyTilt: 0.05, headY: 14, tilt: 0.12, turn: 0.3, shoulder: 0.5 }], // the stiff walk: arms out at the camera, the head forward
  hunchedLurch: () => [{ props: ['reachRight'], headY: 18, tilt: 0.2, turn: -0.4, shoulder: 0.8, bodyTilt: -0.06, headX: -6 }],
  graveReach: () => [{ props: ['clawsUp'], headY: 10, tilt: -0.16, turn: 0.5, dy: 0.08 }], // rising: lower in the frame, the arms up first
  headSnapLeft: () => [{ turn: -0.95, tilt: 0.02 }], headSnapRight: () => [{ turn: 0.95, tilt: -0.02 }], // the head snapped round, the shoulders square
  theLean: () => [{ props: ['clawHands'], bodyTilt: 0.13, tilt: -0.18, headX: 10, turn: 0.35, shoulder: -0.8 }],
  shoulderShimmy: () => [{ shoulder: 0.95, tilt: -0.06, turn: 0.1 }],
  deadStill: () => [{ headY: 2 }], // the moment they all stop and look: nothing moves (the theme's still pose)
  clawDuo: (n, sw) => [{ dx: -sw * 0.34, props: ['clawHands'], turn: 0.3, tilt: 0.08, shoulder: 0.3 }, { dx: sw * 0.34, props: ['clawHands'], turn: -0.3, tilt: -0.08, shoulder: -0.3 }],
  stalkingPair: (n, sw) => [{ dx: -sw * 0.1, dy: 0.04, props: ['armsForward'], turn: 0.4, headY: 10, tilt: 0.1 }, { dx: sw * 0.28, dy: -0.1, k: 0.86, props: ['clawRaisedLeft'], turn: -0.5, tilt: -0.1 }],
  faceOff: (n, sw) => [{ dx: -sw * 0.3, turn: 0.9, props: ['reachRight'], tilt: 0.1 }, { dx: sw * 0.3, turn: -0.9, tilt: -0.1, props: ['clawHands'] }], // turned on each other
  overShoulderDuo: (n, sw) => [{ dx: sw * 0.08, dy: 0.05, k: 0.95, turn: -0.2, headY: 8, props: ['clawHands'] }, { dx: -sw * 0.2, dy: -0.06, k: 1.02, arm: 0, over: true, turn: 0.4, tilt: 0.08 }], // one's arm over the other's shoulders, the way the tableau draws it
  hordeLine: (n, sw) => [{ turn: 0.15, props: ['clawHands'], tilt: 0.05 }, { dx: -sw * 0.72, turn: 0.45, tilt: 0.1, shoulder: 0.4, props: ['clawHands'] }, { dx: sw * 0.72, turn: -0.45, tilt: -0.1, shoulder: -0.4, props: ['clawHands'] }], // the line, every hand up
  closingIn: (n, sw) => [{ dy: 0.06, k: 1.2, props: ['armsForward'], turn: 0.2, headY: 10, tilt: 0.08 }, { dx: -sw * 0.46, dy: -0.08, k: 0.86, props: ['clawRaisedRight'], turn: 0.5, tilt: 0.14 }, { dx: sw * 0.46, dy: -0.08, k: 0.86, props: ['clawRaisedLeft'], turn: -0.5, tilt: -0.14 }], // the nearest reaching, two behind with an arm up
  shimmyLine: (n, sw) => [{ shoulder: 0.9, tilt: -0.05 }, { dx: -sw * 0.7, shoulder: -0.9, tilt: 0.05, turn: 0.3 }, { dx: sw * 0.7, shoulder: 0.9, tilt: -0.05, turn: -0.3 }],
  lurchLine: (n, sw) => [{ props: ['armsForward'], headY: 12, tilt: 0.1, turn: 0.2 }, { dx: -sw * 0.74, props: ['armsForward'], headY: 14, tilt: 0.14, turn: 0.4, k: 0.96 }, { dx: sw * 0.74, props: ['armsForward'], headY: 12, tilt: -0.12, turn: -0.4, k: 0.96 }],
};


// --- the shots and the phases: the same grammar as the tableau's, on the same three sets ---
export const TEMPLATES = {
  riseSolo: { set: 'void', n: 1, framing: 'medium', poses: ['graveReach', 'hunchedLurch'], expression: 'slackJaw', band: true },
  theatreStare: { set: 'red', n: 1, framing: 'medium', poses: ['deadStill', 'headSnapLeft', 'headSnapRight'], expression: 'deadStare' },
  lurchSolo: { set: 'red', n: 1, framing: 'figure', poses: ['zombieShuffle', 'hunchedLurch', 'theLean'] },
  clawSolo: { set: 'white', n: 1, framing: 'full', poses: ['thrillerClaw', 'clawSweep', 'clawsUp', 'armsRight', 'armsLeft'] },
  sideSwing: { set: 'white', n: 3, framing: 'figure', poses: ['swingLineRight', 'swingLineLeft'] }, // the line swinging both hands to one side; cut short and often at the peak, so the plan alternates the sides across cuts
  headSnap: { set: 'any', n: 1, framing: 'close', poses: ['headSnapLeft', 'headSnapRight'], expression: 'deadStare' },
  hungerClose: { set: 'any', n: 1, framing: 'close', poses: ['deadStill'], expression: 'hunger' },
  snarlExtreme: { set: 'any', n: 1, framing: 'extreme', poses: ['deadStill'], expression: 'snarl' },
  eyesCrop: { set: 'void', n: 1, framing: 'eyes', poses: ['deadStill'], expression: 'deadStare' },
  clawDuo: { set: 'white', n: 2, framing: 'full', poses: ['clawDuo', 'faceOff', 'swingDuoRight', 'swingDuoLeft'] },
  stalkDuo: { set: 'void', n: 2, framing: 'full', poses: ['stalkingPair', 'overShoulderDuo'] },
  hordeLine: { set: 'white', n: 3, framing: 'figure', poses: ['hordeLine', 'shimmyLine', 'lurchLine'] },
  closingIn: { set: 'red', n: 3, framing: 'full', poses: ['closingIn', 'hordeLine'] },
  mirroredZombie: { set: 'void', n: 1, framing: 'close', fx: 'mirror', poses: ['deadStill'], expression: 'hunger' },
  splitZombie: { set: 'void', n: 2, framing: 'close', fx: 'split', poses: ['deadStill'] },
  hordeGrid: { set: 'red', n: 1, framing: 'close', fx: 'grid', grid: 3, poses: ['deadStill'], expression: 'deadStare' },
};
export const SPECIAL = new Set(['mirroredZombie', 'splitZombie', 'hordeGrid', 'eyesCrop', 'snarlExtreme']); // punctuation: never two in a row
export const PHASES = {
  opening: { lens: [8, 4, 8, 4], cascade: 0, mutate: 0.05, marks: 0.2, punch: 0.01, emote: 0.4, tpls: { riseSolo: 4, theatreStare: 3, eyesCrop: 1, hungerClose: 1 } },
  development: { lens: [2, 4, 4, 2], cascade: 0.05, mutate: 0.2, marks: 0.4, punch: 0.02, emote: 0.6, tpls: { lurchSolo: 3, stalkDuo: 2, theatreStare: 1, headSnap: 2, hungerClose: 1, clawSolo: 1, closingIn: 1 } },
  escalation: { lens: [1, 2, 2, 4], cascade: 0.2, mutate: 0.5, marks: 0.6, punch: 0.04, emote: 0.7, tpls: { clawSolo: 3, clawDuo: 2, hordeLine: 2, sideSwing: 2, closingIn: 2, headSnap: 1, snarlExtreme: 1, stalkDuo: 1 } },
  peak: { lens: [0.5, 1, 1, 2, 0.5], cascade: 0.3, mutate: 0.7, marks: 0.7, punch: 0.08, emote: 0.8, tpls: { clawSolo: 2, clawDuo: 2, hordeLine: 2, sideSwing: 4, closingIn: 2, headSnap: 2, mirroredZombie: 1, splitZombie: 1, hordeGrid: 1, snarlExtreme: 1, eyesCrop: 1 } },
  release: { lens: [8, 16, 8], cascade: 0, mutate: 0, marks: 0.2, punch: 0, emote: 0.3, tpls: { theatreStare: 3, lurchSolo: 2, riseSolo: 1, hungerClose: 1 } },
};

const on = (x) => x && x !== 'none';
export default {
  name: 'thriller',
  cast: ZOMBIE_NAMES, templates: TEMPLATES, phases: PHASES, special: SPECIAL, fallback: { red: 'lurchSolo', white: 'clawSolo' },
  open: { tpl: 'riseSolo', set: 'void', pose: 'graveReach', framing: 'medium', expression: 'slackJaw' }, // the song opens on one rising out of the ground
  close: { tpl: 'clawDuo', set: 'white', pose: 'clawDuo', framing: 'full' }, // and ends on the two leads clawing at the camera
  poses: POSES, expressions: EXPR_POOL, emotes: EMOTES, still: 'deadStill',
  motion: { sway: 1.6, tilt: 2.2, nod: 1.8, jaw: 0.35 }, // the lurch: the head rides further, the kick drops the jaw
  /** A zombie keeps its outfit and its rot in every shot; a phase adds dirt and blood by its odds, the template its own expression. */
  styling(s, idn, P, tpl, i) {
    return { costume: tpl.costumes?.[i] ?? tpl.costume ?? idn.home.costume, variant: rand(s) < 0.3 ? 1 : 0, expression: tpl.expression ?? pick(s, EXPR_POOL), smile: (rand(s) - 0.5) * 0.16, makeup: [...[idn.home.makeup].flat().filter(on), ...(tpl.makeup ?? [])], marks: [...[idn.home.marks].flat().filter(on), ...(rand(s) < P.marks ? [pick(s, EXTRA_MARKS)] : [])], props: [] };
  },
  /** What a snare cuts through on a mutating shot: more of the grave on the clothes, or the face moving through hunger, a snarl and a moan. */
  alts(s, base) {
    const kind = pick(s, ['marks', 'marks', 'expression']), out = [base];
    for (let k = 1; k < 4; k++) { const st = { ...base[0] }; if (kind === 'marks') st.marks = [...new Set([...base[0].marks, EXTRA_MARKS[k - 1]])]; else st.expression = ['hunger', 'snarl', 'moan'][k - 1]; out.push([st, ...base.slice(1)]); }
    return out;
  },
  /** A grid's odd cell: the same one snarling, blood on the shirt. */
  odd: (s, st) => ({ ...st, expression: 'snarl', marks: [...new Set([...st.marks, 'bloodSplatter'])] }),
};
