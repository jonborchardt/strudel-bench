// The gothic pack: what the gothic cast (casts/gothic.mjs) wears that nobody else does, tagged `only:gothic`. Mourning
// clothes and night, in black, oxblood, ivory and silver, modelled as tone rather than outlined:
//  - a lace blouse buttoned to a high ruffled collar, its yoke sheer lace over skin (the rosettes and the scalloped edge
//    each throw a shadow), a velvet ribbon and a cameo at the throat;
//  - a mourning gown: a satin bodice with a sweetheart neckline edged in lace, boned, the collarbones bare;
//  - a velvet frock coat, the pile catching light where the cloth turns away and dark across its face, satin lapels;
//  - a cape whose standing collar rises behind the head with its lining lit toward us and the head's shadow in it, the
//    cape itself hanging behind the arms (both drawn by the tops, flagged `hood`, so they go behind the neck and head
//    and are not cut to the trunk: `capeBack`), clasped at the throat with a chain;
//  - a wide-brimmed mourning hat with a rose and a dotted net veil down over the eyes;
//  - a velvet choker with a garnet drop and a lace jabot with a stick-pin (accessories);
//  - paint: goth liner, a trickle of blood, and the vampire's three tells -- a cold pallor with violet shadows, eyes
//    lit red from inside, and fangs (`vampireFangs`, a TEETH entry, so they show only when the mouth parts, with their
//    tips over the lower lip from `fangTips` on the mouth slot).
// parts.html?pack=gothic is the sheet.
import { TOPS, JACKETS, HATS, HAT_CROWN, MAKEUP, TEETH, ACCESSORIES, MOUTHS, facePath, shade, mix, soft, path, ellipse, line, clip, UNCLIP, stroke, eyeShape } from '../portrait.mjs';
import { tagPack, torso, SHOULDERS, f1, sideOf } from './pen.mjs';

const IVORY = '#e9e2d6', LACE = '#f2ede4', SILVER = '#b9bcc2', SILVER_LIT = '#eef0f4', SILVER_DK = '#5e6168', GARNET = '#6e0c1a', JET = '#0e0c0e';
const lit = (c, k = 0.3) => mix(c, '#ffffff', k); // a light on a dark cloth: toward white, since black times anything stays black
const hood = (ops) => ops.map((o) => ({ ...o, hood: true }));
const collar = (ops) => ops.map((o) => ({ ...o, collar: true }));
/** A point on the quadratic a -> c -> b at t. */
const q = (a, c, b, t) => [(1 - t) ** 2 * a[0] + 2 * t * (1 - t) * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * c[1] + t * t * b[1]];
/** Scallops hanging off the curve a -> c -> b: n half-moons of depth `dp`, filled, each with its shadow under it. */
const scallops = (a, c, b, n, dp, fill, shadowOp = 0.3) => { const pts = Array.from({ length: n + 1 }, (_, i) => q(a, c, b, i / n)), one = (dy) => pts.slice(0, -1).map((p0, i) => { const p1 = pts[i + 1], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2 + dp * 2; return `M ${f1(p0[0])} ${f1(p0[1] + dy)} Q ${f1(mx)} ${f1(my + dy)} ${f1(p1[0])} ${f1(p1[1] + dy)} Z`; }).join(' ');
  return [path(one(3), { fill: '#000', op: shadowOp }), path(one(0), { fill }), ...pts.slice(0, -1).map((p0, i) => ellipse(f1((p0[0] + pts[i + 1][0]) / 2), f1((p0[1] + pts[i + 1][1]) / 2 + dp * 0.55), 1.3, 1.3, { fill: '#000', op: 0.45 }))]; }; // each scallop pierced once, so it is lace and not a ruffle
/** Lace over a sheer ground: a fine mesh both ways, and in it rows of small flowers, five petals round a heart, each throwing a shadow on the skin under it. */
const rosettes = (x0, x1, y0, rows, step, c) => [
  ...Array.from({ length: 24 }, (_, i) => [line(x0 - 60 + i * 7, y0 - 20, x0 + 20 + i * 7, y0 + 80, stroke(c, 0.6, 0.6)), line(x0 + 20 + i * 7, y0 - 20, x0 - 60 + i * 7, y0 + 80, stroke(c, 0.6, 0.6))]).flat(),
  ...Array.from({ length: rows }, (_, j) => Array.from({ length: Math.floor((x1 - x0) / step) + 1 }, (_, i) => { const x = x0 + i * step + (j % 2) * step / 2, y = y0 + j * step * 0.9, pr = step * 0.17;
    const petals = (dx, dy, fill, op) => Array.from({ length: 5 }, (_, k) => { const a = k * 1.2566 - 1.5708; return ellipse(f1(x + dx + Math.cos(a) * pr), f1(y + dy + Math.sin(a) * pr), pr * 0.62, pr * 0.62, { fill, op }); });
    return [...petals(0.8, 1.4, '#000', 0.22), ...petals(0, 0, c, 0.95), ellipse(x, y, pr * 0.45, pr * 0.45, { fill: lit(c, 0.25) })]; }).flat()).flat()];

// --- the cape behind ----------------------------------------------------------------------------------------------
const DRAPE = 'M 200 338 C 146 338, 92 350, 66 398 C 44 470, 34 600, 26 700 L 374 700 C 366 600, 356 470, 334 398 C 308 350, 254 338, 200 338 Z';
const COLLAR = 'M 154 356 C 104 348, 76 300, 60 160 C 88 192, 118 236, 160 258 Q 200 268 240 258 C 282 236, 312 192, 340 160 C 324 300, 296 348, 246 356 Z';
const LINING = 'M 158 352 C 112 342, 86 298, 72 182 C 96 210, 124 246, 162 266 Q 200 276 238 266 C 276 246, 304 210, 328 182 C 314 298, 288 342, 242 352 Z';
/** What a cape puts behind the figure: its back hanging past the arms, and the standing collar framing the head, its lining toward us, lit on the light's side, the head's shadow across it, stiffened with ribs. Every gothic top draws it when the jacket is the cape, since a jacket is cut to the trunk and a top's `hood` ops are not. */
const capeBack = (p) => { if (p.jacket?.style !== 'highCollarCape') return []; const c = p.jacket.color, ln = p.jacket.accent ?? '#6a1424', sd = sideOf(p); return hood([
  path(DRAPE, { fill: shade(c, 0.9) }),
  ...[[54, -1], [80, -1], [320, 1], [346, 1]].flatMap(([x, s]) => [path(`M ${x} 420 Q ${x + s * 6} 560 ${x + s * 14} 700`, stroke('#000', 7, 0.35)), path(`M ${x + 5} 420 Q ${x + 5 + s * 6} 560 ${x + 5 + s * 14} 700`, stroke(lit(c, 0.25), 2.4, 0.35))]), // the folds it hangs in
  path(COLLAR, { fill: c }), path(LINING, { fill: ln }),
  clip(LINING), ...soft(200 + sd * 108, 236, 34, 90, lit(ln, 0.45), 0.7), ...soft(200 - sd * 100, 260, 40, 100, '#000', 0.35), ...soft(200, 300, 120, 80, '#000', 0.6), // lit on one wing, shaded on the other, the head's shadow in the middle
  ...[-1, 1].flatMap((s) => [0.3, 0.6, 0.88].flatMap((k) => { const bx = 200 + s * (48 + k * 56), by = 350 - k * 14, tx = 200 + s * (42 + k * 96), ty = 262 - k * 92;
    return [path(`M ${f1(bx)} ${f1(by)} Q ${f1((bx + tx) / 2 + s * 10)} ${f1((by + ty) / 2)} ${f1(tx)} ${f1(ty)}`, stroke('#000', 2.6, 0.35)), path(`M ${f1(bx - s * 3)} ${f1(by)} Q ${f1((bx + tx) / 2 + s * 7)} ${f1((by + ty) / 2)} ${f1(tx - s * 3)} ${f1(ty)}`, stroke(lit(ln, 0.5), 1.4, 0.3))]; })), // the ribs that hold it up
  UNCLIP,
  path('M 72 182 C 96 210, 124 246, 162 266', stroke(lit(ln, 0.55), 1.6, 0.6)), path('M 328 182 C 304 210, 276 246, 238 266', stroke(lit(ln, 0.55), 1.6, 0.6)), // its top edge catching the light
  path('M 60 160 C 76 300, 104 348, 154 356', stroke(lit(c, 0.3), 1.4, 0.5)), path('M 340 160 C 324 300, 296 348, 246 356', stroke(lit(c, 0.3), 1.4, 0.5))]); };

// --- tops -----------------------------------------------------------------------------------------------------------
const YOKE = 'M 150 352 Q 200 362 250 352 L 262 360 Q 268 396 256 418 Q 200 436 144 418 Q 132 396 138 360 Z';
/** A cameo on a ribbon: a silver bezel, a coloured field, an ivory profile. */
const cameo = (x, y, field) => [ellipse(x + 1, y + 2, 9, 11, { fill: '#000', op: 0.3 }), ellipse(x, y, 8.5, 10.5, { fill: SILVER }), path(`M ${x - 7} ${y - 4} Q ${x - 5} ${y - 10} ${x + 1} ${y - 10}`, stroke(SILVER_LIT, 1.4, 0.8)), path(`M ${x + 7} ${y + 4} Q ${x + 5} ${y + 10} ${x - 1} ${y + 10}`, stroke(SILVER_DK, 1.4, 0.8)),
  ellipse(x, y, 6, 8, { fill: field }), path(`M ${x - 1} ${y + 6} Q ${x - 4} ${y + 1} ${x - 2} ${y - 2} Q ${x - 3} ${y - 6} ${x + 1} ${y - 6} Q ${x + 4} ${y - 5} ${x + 3} ${y - 1} Q ${x + 2} ${y + 2} ${x + 3} ${y + 6} Z`, { fill: IVORY })];
/** A lace blouse buttoned to the throat: a standing collar with a ruffle along its top and a velvet ribbon round it pinned with a cameo, a yoke of sheer lace over the skin with a scalloped edge, pintucks and jet buttons below. */
TOPS.laceHighCollar = (p) => { const c = p.top.color, dark = shade(c, 0.6), lace = mix(c, '#000000', 0.1); return [
  torso(SHOULDERS, c),
  path(YOKE, { fill: p.skin }), ...soft(200, 372, 70, 22, '#000', 0.25), path(YOKE, { fill: c, op: 0.45 }), // the skin through it, in the collar's shadow
  clip(YOKE), ...rosettes(136, 264, 362, 4, 15, lace), UNCLIP,
  ...scallops([140, 414], [200, 438], [260, 414], 9, 5, lace),
  ...[-1, 1].flatMap((s) => [8, 15, 22].flatMap((dx) => [path(`M ${200 + s * dx} 432 L ${200 + s * (dx + 2)} 700`, stroke(dark, 1.6, 0.5)), path(`M ${200 + s * (dx + 2)} 432 L ${200 + s * (dx + 4)} 700`, stroke(lit(c, 0.25), 1, 0.35))])), // pintucks
  ...[452, 476, 500].flatMap((y) => [ellipse(200, y, 3.4, 3.4, { fill: JET }), ellipse(199, y - 1.2, 1.1, 1.1, { fill: '#fff', op: 0.6 })]),
  ...collar([path('M 160 354 L 162 316 Q 200 324 238 316 L 240 354 Q 200 364 160 354 Z', { fill: c }), path('M 214 320 L 238 316 L 240 354 L 220 360 Z', { fill: '#000', op: 0.18 }), path('M 166 322 L 166 352', stroke(lit(c, 0.3), 3, 0.25)),
    path('M 161 330 Q 200 340 239 330 L 239 342 Q 200 352 161 342 Z', { fill: p.top.accent ?? '#5a1622' }), path('M 161 331 Q 200 341 239 331', stroke(lit(p.top.accent ?? '#5a1622', 0.35), 1.2, 0.6)), // the velvet ribbon round it
    ...Array.from({ length: 11 }, (_, i) => { const x = 160 + i * 8, y = 317 + Math.abs(i - 5) * 0.5; return path(`M ${x - 5} ${y + 3} Q ${x - 4} ${y - 7} ${x} ${y - 6} Q ${x + 4} ${y - 7} ${x + 5} ${y + 3} Z`, { fill: i % 2 ? lace : lit(c, 0.12) }); }), // the ruffle, its flutes alternating lit and shadowed
    path('M 158 318 Q 200 326 242 318', stroke('#000', 2, 0.25)),
    ...cameo(200, 338, p.top.accent ?? '#5a1622')]),
  ...capeBack(p)]; };
const BODICE = 'M 152 362 Q 174 404 200 410 Q 226 404 248 362';
/** A mourning gown: a boned satin bodice with a sweetheart neckline edged in lace, the collarbones and the throat bare, the satin's light running down the boning. */
TOPS.mourningGown = (p) => { const c = p.top.color, dark = shade(c, 0.55), sd = sideOf(p), sk = p.skin; return [
  torso(SHOULDERS, c),
  ...[[152, 0.3, 378], [174, 0.15, 406], [226, -0.15, 406], [248, -0.3, 378]].flatMap(([x, k, y0]) => { return [path(`M ${x} ${f1(y0)} Q ${f1(x + k * 30)} 500 ${f1(x + k * 60)} 700`, stroke(dark, 2.4, 0.7)), path(`M ${x + 3} ${f1(y0)} Q ${f1(x + 3 + k * 30)} 500 ${f1(x + 3 + k * 60)} 700`, stroke(lit(c, 0.4), 1.6, 0.45))]; }), // the boning, each seam's lit edge
  ...soft(200 + sd * 52, 470, 18, 80, lit(c, 0.5), 0.5), ...soft(200 - sd * 60, 480, 30, 120, '#000', 0.3), // the satin's sheen and its far side
  ...collar([ // the bare chest goes on with the collars, over the cloth's own shading and the cape's fronts, so it is shaded as skin and not as satin
    path('M 156 348 Q 200 343 244 348 L 250 360 Q 226 404 200 410 Q 174 404 150 360 Z', { fill: sk }), clip('M 156 348 Q 200 343 244 348 L 250 360 Q 226 404 200 410 Q 174 404 150 360 Z'),
    ...soft(200, 346, 46, 16, '#000', 0.4), ...soft(200 - sd * 44, 384, 26, 34, '#000', 0.22), ...soft(200 + sd * 22, 386, 26, 20, '#fff', 0.14), // the head's shadow, the far side, the lit breastbone
    ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 8} 364 Q ${200 + s * 26} 370 ${200 + s * 50} 362`, stroke(shade(sk, 0.72), 1.8, 0.5)), path(`M ${200 + s * 9} 367 Q ${200 + s * 27} 373 ${200 + s * 50} 366`, stroke('#fff', 1.2, 0.18))]), // the collarbones
    path('M 200 380 L 200 404', stroke(shade(sk, 0.75), 1.4, 0.25)), UNCLIP,
    path(`M 150 360 ${BODICE.slice(BODICE.indexOf('Q'))} L 250 360`, stroke(dark, 3)),
    ...scallops([150, 360], [174, 404], [200, 410], 5, 3.4, LACE, 0.25), ...scallops([200, 410], [226, 404], [250, 360], 5, 3.4, LACE, 0.25)]), // the lace edging the neckline
  ...capeBack(p)]; };

// --- coats ----------------------------------------------------------------------------------------------------------
/** A velvet frock coat worn open: velvet is dark across its face and lit where it turns away, so each panel is a broad light along its edges and a deep core; satin lapels with a lit roll, jet buttons. */
JACKETS.velvetFrock = (p) => { const c = p.jacket.color, sat = shade(c, 0.5), sd = sideOf(p);
  const panel = (s) => `M ${200 + s * 150} 700 L ${200 + s * 152} 450 C ${200 + s * 144} 392, ${200 + s * 88} 356, ${200 + s * 32} 350 L ${200 + s * 24} 700 Z`;
  return [...[-1, 1].flatMap((s) => [path(panel(s), { fill: c }), clip(panel(s)),
    ...soft(200 + s * 98, 470, 18, 200, lit(c, 0.4), s === sd ? 0.9 : 0.45), ...soft(200 + s * 34, 520, 14, 180, lit(c, 0.3), 0.5), ...soft(200 + s * 66, 500, 26, 180, '#000', 0.4), // the pile: lit at both turns, dark across the face
    path(`M ${200 + s * 92} 380 C ${200 + s * 80} 420, ${200 + s * 84} 520, ${200 + s * 76} 700`, stroke('#000', 5, 0.25)), UNCLIP]), // a fold down the front
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 34} 356 L ${200 + s * 60} 358 L ${200 + s * 70} 392 L ${200 + s * 58} 398 L ${200 + s * 62} 418 L ${200 + s * 26} 494 Z`, { fill: sat }), // the lapel, notched, faced in satin
    path(`M ${200 + s * 34} 356 L ${200 + s * 26} 494`, stroke(lit(sat, 0.5), 2, 0.8)), path(`M ${200 + s * 44} 362 L ${200 + s * 38} 448`, stroke('#fff', 4, 0.12)), // its lit roll, the satin's streak
    path(`M ${200 + s * 62} 418 L ${200 + s * 26} 494 L ${200 + s * 24} 500`, stroke('#000', 4, 0.35)), path(`M ${200 + s * 70} 392 L ${200 + s * 58} 398`, stroke('#000', 2, 0.5)),
    path(`M ${200 + s * 25} 494 L ${200 + s * 24} 700`, stroke('#000', 8, 0.2))]),
  ...[514, 548, 582].flatMap((y) => [-1, 1].flatMap((s) => [ellipse(200 + s * 34, y, 4.2, 4.2, { fill: JET }), ellipse(200 + s * 34 - 1.3, y - 1.3, 1.3, 1.3, { fill: '#fff', op: 0.55 })]))]; };
/** A cape over the shoulders, open down the front: its fronts with the lining turned back along the edge, a silver clasp and chain at the throat. The collar and the back are drawn behind the figure by the top (`capeBack`). */
JACKETS.highCollarCape = (p) => { const c = p.jacket.color, ln = p.jacket.accent ?? '#6a1424', sd = sideOf(p);
  const front = (s) => `M ${200 + s * 104} 700 L ${200 + s * 104} 404 C ${200 + s * 102} 378, ${200 + s * 88} 360, ${200 + s * 62} 352 L ${200 + s * 40} 350 C ${200 + s * 50} 420, ${200 + s * 54} 560, ${200 + s * 58} 700 Z`;
  return [...[-1, 1].flatMap((s) => [path(front(s), { fill: c }), clip(front(s)), ...soft(200 + s * 84, 450, 16, 150, lit(c, 0.3), s === sd ? 0.7 : 0.3), UNCLIP,
    path(`M ${200 + s * 40} 350 C ${200 + s * 50} 420, ${200 + s * 54} 560, ${200 + s * 58} 700 L ${200 + s * 70} 700 C ${200 + s * 66} 560, ${200 + s * 62} 420, ${200 + s * 54} 352 Z`, { fill: ln }), // the lining turned back down the edge
    path(`M ${200 + s * 54} 352 C ${200 + s * 62} 420, ${200 + s * 66} 560, ${200 + s * 70} 700`, stroke('#000', 3, 0.4)), path(`M ${200 + s * 41} 352 C ${200 + s * 51} 420, ${200 + s * 55} 560, ${200 + s * 59} 700`, stroke(lit(ln, 0.4), 1.4, 0.6))]),
  path('M 160 368 Q 200 392 240 368', stroke('#000', 3, 0.3)), path('M 160 366 Q 200 390 240 366', stroke(SILVER, 1.8)), path('M 160 365 Q 200 389 240 365', stroke(SILVER_LIT, 0.7, 0.7)), // the chain
  ...[-1, 1].flatMap((s) => [ellipse(200 + s * 42, 366, 8, 8, { fill: SILVER }), path(`M ${200 + s * 42 - 6} 362 Q ${200 + s * 42 - 3} 359 ${200 + s * 42 + 2} 359`, stroke(SILVER_LIT, 1.4, 0.8)), ellipse(200 + s * 42, 366, 4.4, 4.4, { fill: GARNET }), ellipse(200 + s * 42 - 1.4, 364.6, 1.3, 1.3, { fill: '#fff', op: 0.6 })])]; }; // the clasps, a garnet set in each

// --- a hat ----------------------------------------------------------------------------------------------------------
const VEIL = 'M 120 130 Q 200 148 280 130 C 286 174, 282 210, 268 234 Q 200 248 132 234 C 118 210, 114 174, 120 130 Z';
/** A mourning hat: a low crown and a wide brim seen from a little above, its underside in shade, a ribbon and a silk rose at the band, and a net veil down over the eyes, dotted. */
HATS.mourningHat = (p) => { const c = p.hat.color, rib = p.hat.accent ?? '#3a1f30'; return [
  path('M 150 122 L 157 78 Q 200 64 243 78 L 250 122 Z', { fill: c }), // the crown (the first op: what the hat's width is read from)
  path('M 222 70 Q 240 72 243 78 L 250 122 L 230 122 Z', { fill: '#000', op: 0.3 }), path('M 162 80 L 158 116', stroke(lit(c, 0.35), 4, 0.35)),
  path('M 152 104 Q 200 96 248 104 L 249 120 Q 200 112 151 120 Z', { fill: rib }), path('M 152 105 Q 200 97 248 105', stroke(lit(rib, 0.35), 1.2, 0.6)),
  clip(VEIL), path(VEIL, { fill: c, op: 0.24 }),
  ...Array.from({ length: 28 }, (_, i) => line(40 + i * 9, 120, 180 + i * 9, 270, stroke(c, 0.6, 0.5))), ...Array.from({ length: 28 }, (_, i) => line(220 + i * 9 - 140, 120, 80 + i * 9 - 140, 270, stroke(c, 0.6, 0.5))), // the net, both ways
  ...Array.from({ length: 6 }, (_, j) => Array.from({ length: 8 }, (_, i) => ellipse(118 + i * 24 + (j % 2) * 12, 146 + j * 20, 1.8, 1.8, { fill: c, op: 0.85 }))).flat(), // the chenille dots
  UNCLIP, path('M 132 234 Q 200 248 268 234', stroke(c, 1.2, 0.6)),
  path('M 68 126 Q 200 102 332 126 Q 200 154 68 126 Z', { fill: c }), path('M 86 131 Q 200 152 314 131', stroke('#000', 5, 0.25)), path('M 72 125 Q 200 103 328 125', stroke(lit(c, 0.35), 1.6, 0.6)), // the brim, its far edge lit
  ...[[236, 106, 11], [244, 112, 8], [229, 113, 8]].map(([x, y, r]) => ellipse(x, y, r, r * 0.85, { fill: shade(rib, 1.15) })), path('M 230 106 Q 236 100 242 106 Q 238 112 232 108', stroke(lit(rib, 0.4), 1.4, 0.7)), path('M 236 112 Q 244 114 246 106', stroke('#000', 1.4, 0.4)), // the silk rose
]; };
HAT_CROWN.mourningHat = 122;

// --- paint --------------------------------------------------------------------------------------------------------
/** Dark liner: a band along each upper lid, thickening to a wing out of the outer corner, and the lower lid smudged;
 *  on each eye's own outline (eyeShape), so the wing leaves the corner this eye has. */
MAKEUP.gothLiner = { face: (p) => [-1, 1].flatMap((s) => { const E = eyeShape(p, s), k = E.k, wx = E.xo + s * 11 * k, wy = E.yo - 8 * k; return [
  path(`M ${E.xi} ${E.yi} Q ${E.px} ${E.y - E.th - 4 * k} ${E.xo + s * 1.5} ${E.yo - 2.5 * k} L ${wx} ${wy} L ${E.xo} ${E.yo} Q ${E.px} ${E.y - E.th} ${E.xi} ${E.yi} Z`, { fill: '#121014', op: 0.85 }),
  path(`M ${E.xi + s * 2} ${E.yi + 2} Q ${E.cx - s} ${E.y + E.bh + 3} ${E.xo - s} ${E.yo + 1.5}`, stroke('#121014', 2.6, 0.45))]; }) };
/** A trickle of blood from the corner of the mouth down the chin. */
MAKEUP.bloodTrickle = { mouth: (p) => { const x = 200 + p.mouth.width * 0.32, y = p.mouth.y + 2; return [path(`M ${x - 2} ${y} Q ${x + 1} ${y + 18} ${x - 1} ${y + 34} Q ${x + 3} ${y + 38} ${x + 3} ${y + 32} Q ${x + 3} ${y + 16} ${x + 2} ${y}`, { fill: '#7a0c16', op: 0.9 }), ellipse(x + 1, y + 34, 2.4, 3, { fill: '#7a0c16' }), ellipse(x - 0.4, y + 12, 0.8, 4, { fill: '#fff', op: 0.35 })]; } };
/** A vampire's pallor: the shadows go cold. Violet in the sockets, under the cheekbones and down the shadow side, a cold light on the brow; the face's own modelling goes on over it. */
MAKEUP.vampirePallor = { skin: (p) => { const sd = sideOf(p), ex = p.eyes.spacing / 2, ey = p.eyes.y, w = p.face.width / 156; return [clip(facePath(p)),
  ...soft(200 - sd * 62 * w, 250, 34 * w, 90, '#3e3a6a', 0.4), // the shadow side, cooled
  ...[-1, 1].flatMap((s) => [...soft(200 + s * ex, ey + 2, 28, 19, '#3a2448', 0.55), ]), // the sockets bruised violet
  ...soft(200, 140, 50 * w, 22, '#f4f6ff', 0.3), ...soft(200 + sd * 40 * w, ey + 40, 16, 12, '#f4f6ff', 0.2), UNCLIP]; } };
/** A vampire's eyes lit from inside: a red bloom in each socket round the eye, a hot point in the iris. */
MAKEUP.vampireEyes = { fit: 'eyes', skin: () => [-1, 1].flatMap((s) => soft(200 + s * 34, 197, 26, 16, '#c0182a', 0.38)), face: () => [-1, 1].flatMap((s) => [...soft(200 + s * 34, 197, 9, 9, '#ff3030', 0.5), ellipse(200 + s * 34 + 2, 195, 1.4, 1.4, { fill: '#ffe0d0', op: 0.9 })]) };
/** The fang tips: where the mouth parts, the two canines come down past the band of teeth and over the lower lip. On the mouth slot, so over the lips; the geometry is the mouth's own (the parting at the canines, the band's depth). */
MAKEUP.fangTips = { mouth: (p) => { const m = p.mouth, sm = m.smile ?? 0, o = m.open ?? 0, pr = Math.max(0, Math.min(1, m.press ?? 0)); if (!(o > 0.08 || sm > 0.6)) return [];
  const w = m.width * (MOUTHS[m.style]?.wide ?? 1) * (1 + 0.14 * Math.max(0, sm) - 0.16 * o - 0.08 * pr), lift = 9 * sm, yl = m.y - lift, mid = m.y + 9 * sm - 14 * o, inside = o > 0.08 ? mid + 6 + 50 * o : mid + 16 * Math.max(0, Math.min(1, (sm - 0.6) / 0.4));
  const band = o > 0.08 ? Math.min(8, (inside - mid) * 0.3) : inside - 1 - mid, len = band + 6;
  return [-1, 1].flatMap((s) => { const t = 0.5 + s * 0.22, x = 200 + s * w * 0.22, y = (1 - t) ** 2 * yl + 2 * t * (1 - t) * mid + t * t * yl + 1;
    return [path(`M ${f1(x - 3.4)} ${f1(y)} L ${f1(x + 3.4)} ${f1(y)} L ${f1(x + s * 0.6)} ${f1(y + len)} Z`, { fill: '#f6f1e8' }), path(`M ${f1(x + s * 3.4)} ${f1(y)} L ${f1(x + s * 0.6)} ${f1(y + len)}`, stroke('#8a6a60', 0.8, 0.5))]; }); } };
/** A vampire's teeth: an even pale row, the canines longer and pointed with dark gaps beside them. Clipped to the band by the caller; `fangTips` carries them past it. */
TEETH.vampireFangs = (d, cx, w, ty, th) => [path(d, { fill: '#efe8dc' }), ...[-0.22, 0.22].flatMap((f) => [path(`M ${cx + w * f - 6} ${ty - th} L ${cx + w * f - 3} ${ty + th} M ${cx + w * f + 6} ${ty - th} L ${cx + w * f + 3} ${ty + th}`, stroke('#3a1f1c', 1.2, 0.45))]), ...[-0.1, 0, 0.1].map((f) => line(cx + w * f, ty - th, cx + w * f, ty + th, stroke('#3a1f1c', 1, 0.25)))];

// --- jewellery ------------------------------------------------------------------------------------------------------
/** A velvet choker high on the neck, its sheen along the top, a garnet drop in a silver bezel. */
ACCESSORIES.velvetChoker = { at: 'tie', /* over the collars: the gown's bare chest is drawn with them, and the garnet hangs over it */ ops: (p) => { const w = (p.neck?.width ?? 56) / 2 + 2, y = 340; return [
  path(`M ${200 - w} ${y - 5} Q 200 ${y + 1} ${200 + w} ${y - 5} L ${200 + w} ${y + 3} Q 200 ${y + 9} ${200 - w} ${y + 3} Z`, { fill: JET }), path(`M ${200 - w + 2} ${y - 3} Q 200 ${y + 2} ${200 + w - 2} ${y - 3}`, stroke('#fff', 1.2, 0.25)),
  path(`M ${200 - w} ${y + 5} Q 200 ${y + 12} ${200 + w} ${y + 5}`, stroke('#000', 3, 0.15)), // its shadow on the neck
  line(200, y + 6, 200, y + 11, stroke(SILVER, 1.2)), ellipse(200.6, y + 19, 5, 7, { fill: '#000', op: 0.25 }), ellipse(200, y + 18, 5, 7, { fill: SILVER }), ellipse(200, y + 18, 3.4, 5.2, { fill: GARNET }), ellipse(199, y + 16, 1.1, 1.6, { fill: '#fff', op: 0.6 })]; } };
/** A lace jabot falling from the throat in tiers, each scalloped and shadowing the one under it, a stick-pin with a garnet through the top. */
ACCESSORIES.cravatPin = { at: 'tie', ops: () => [...[3, 2, 1, 0].flatMap((k) => { const y = 352 + k * 20, w = 26 - k * 3;
  return [path(`M ${200 - w + 4} ${y} L ${200 - w} ${y + 24} L ${200 + w} ${y + 24} L ${200 + w - 4} ${y} Z`, { fill: '#000', op: 0.2 }), path(`M ${200 - w + 4} ${y - 2} L ${200 - w} ${y + 20} L ${200 + w} ${y + 20} L ${200 + w - 4} ${y - 2} Z`, { fill: LACE }),
    ...scallops([200 - w, y + 20], [200, y + 23], [200 + w, y + 20], 6, 2.6, LACE, 0.25),
    ...[-0.5, 0, 0.5].map((f) => path(`M ${f1(200 + w * f * 0.8)} ${y} Q ${f1(200 + w * f)} ${y + 12} ${f1(200 + w * f * 1.1)} ${y + 22}`, stroke('#8a8278', 1, 0.4))), // its gathers
    path(`M ${200 + w - 6} ${y} L ${200 + w - 2} ${y + 20}`, stroke('#000', 4, 0.12))]; }),
  line(193, 360, 208, 374, stroke(SILVER_DK, 1.4)), ellipse(200, 366, 4.4, 5.2, { fill: SILVER }), ellipse(200, 366, 3, 3.8, { fill: GARNET }), ellipse(199, 364.6, 1, 1.3, { fill: '#fff', op: 0.7 })] };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const GOTHIC = { tops: ['laceHighCollar', 'mourningGown'], jackets: ['velvetFrock', 'highCollarCape'], hats: ['mourningHat'], makeup: ['gothLiner', 'bloodTrickle', 'vampirePallor', 'vampireEyes', 'fangTips'], teeth: ['vampireFangs'], accessories: ['velvetChoker', 'cravatPin'] };
tagPack(GOTHIC, 'only:gothic');
