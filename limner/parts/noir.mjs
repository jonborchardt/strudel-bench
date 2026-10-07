// The noir pack: what the noir cast (casts/noir.mjs) wears that nobody else does, tagged `only:noir`. The 1940s city
// at night. The look itself (hard light, the colour graded nearly to grey) is `LOOKS.noir` in people.mjs, which any
// person can be dressed in; what the look cannot do, because it is a dial and not a shape, is here as parts the cast
// wears: the key (`noirKey`: half the face in hard shadow, the brim's shadow over the eyes, a wet-street rim on the
// dark side), the light through the blinds (`noirBlinds`) and the band of light across the eyes (`noirEyeLight`).
// Then the wardrobe: a fedora with a pinched crown and its brim snapped down, a patrolman's cap, a double-breasted
// pinstripe, a trench with its collar up, a patrol tunic, an evening gown under a fur stole, pearls, a loosened tie,
// and a cigarette whose smoke curls. parts.html?pack=noir is the sheet.
import { TOPS, JACKETS, HATS, HAT_CROWN, MAKEUP, PROPS, ACCESSORIES, NECKLINES, facePath, mapX, mapXY, shade, path, ellipse, rect, line, stroke, clip, UNCLIP } from '../portrait.mjs';
import { tagPack, torso, sideOf } from './pen.mjs';

const SHOULDERS = 'M 62 480 C 76 386, 122 356, 160 346 L 240 346 C 278 356, 324 386, 338 480 Z';
const SHIRT = '#e8e4dc', INK = '#120c0a', BRASS = '#b89a52';

// --- the key light ----------------------------------------------------------------------------------------------
// Hard light from one side: a single shadow shape over the far half of the face, its edge running down the forehead,
// round the far brow, down the nose's ridge, under its tip and through the mouth to the chin -- the edge is drawn, so
// it is hard, not a wash. Under any brimmed hat the brim's shadow comes down to the eye line and the eyes look out of
// it; the dark side's jaw catches a thin rim of light from the street below. Drawn on the `face` slot, so it rides
// with the features on a turn; its clip is the head's outline taken back to where the head is (the features slide 8
// further than the outline on a full turn).
const BRIMMED = new Set(['fedora', 'noirCap', 'wideBrimFelt', 'cowboy', 'bucketHat', 'sunHat', 'feltTravelHat', 'flatCap', 'baseballCap', 'dadCap', 'snapback', 'truckerCap']);
const headOutline = (p) => mapX([path(facePath(p))], (x) => x - 8 * (p.pose?.turn ?? 0))[0].d;
const keyShadow = (p) => {
  const f = -sideOf(p), X = (d) => 200 + f * d, ey = p.eyes.y, my = p.mouth.y, nt = ey + 8 + p.nose.length, bot = 112 + p.face.height + 16 * p.face.chin + 30;
  const edge = `M ${X(20)} 60 C ${X(14)} 100, ${X(4)} ${ey - 44}, ${X(3)} ${ey - 22} C ${X(2)} ${ey - 12}, ${X(9)} ${ey - 6}, ${X(7)} ${ey + 8} C ${X(5)} ${ey + 22}, ${X(9)} ${nt - 16}, ${X(13)} ${nt - 4} C ${X(15)} ${nt + 4}, ${X(-4)} ${nt + 4}, ${X(-14)} ${nt + 9} C ${X(-6)} ${nt + 14}, ${X(4)} ${my - 8}, ${X(4)} ${my} C ${X(4)} ${my + 16}, ${X(10)} ${my + 34}, ${X(22)} ${bot}`; // the terminator: bowed round the forehead, round the far brow and down the nose's far side, the nose's own shadow thrown across the upper lip, and out again round the chin
  return [path(`${edge} L ${X(240)} ${bot} L ${X(240)} 60 Z`, { fill: INK, op: 0.52 }), path(`${edge} L ${X(-240)} ${bot} L ${X(-240)} 60 Z`, { fill: '#ffffff', op: 0.07 })]; // the dark side, and the lit side a step brighter
};
const brimShadow = (p) => { const ey = p.eyes.y; return [path(`M 0 40 L 400 40 L 400 ${ey - 4} C 300 ${ey - 6}, 260 ${ey + 9}, 200 ${ey + 9} C 140 ${ey + 9}, 100 ${ey - 6}, 0 ${ey - 4} Z`, { fill: INK, op: 0.42 })]; };
const rim = (p) => { const f = -sideOf(p), w = p.face.width / 2, ey = p.eyes.y, X = (d) => 200 + f * d; return [clip(`M ${X(w * 0.5)} ${ey + 4} L ${X(260)} ${ey + 4} L ${X(260)} 480 L ${X(w * 0.5)} 480 Z`), path(headOutline(p), stroke('#ffffff', 5, 0.5)), UNCLIP]; };
// the far ear is outside the outline's clip, so it gets its own shade, put where ears() puts it on a turn (the ears ride
// 4 and swing behind the head; this slot rides 12)
const earShade = (p, o, dy = 0, ry = 27) => { const t = p.pose?.turn ?? 0, a = t * t, k = p.face.width / 156, z = p.ears?.size ?? 1, back = o === Math.sign(t), squash = back ? 1 - 0.55 * a : 1 + 0.2 * a, cx = 200 + o * 78 - 15 * o * (1 - squash) + (back ? -o * 14 * a : o * 3 * a); return ellipse(200 + k * (cx - 200) - 8 * t, 212 + p.eyes.y - 196 + dy, 15 * k * squash * z, ry * z, { fill: INK, op: 0.5 }); }; // where ears() puts the ear on side o, fitted to the face
const outside = (p, ops) => [clip(`M -100 -100 L 500 -100 L 500 600 L -100 600 Z ${headOutline(p)}`, 'evenodd'), ...ops, UNCLIP]; // only what shows past the head: an ear swung behind it is not shaded through the cheek
const farEar = (p) => outside(p, [earShade(p, -sideOf(p))]);
MAKEUP.noirKey = {
  face: (p) => [...farEar(p), clip(headOutline(p)), ...keyShadow(p), ...(BRIMMED.has(p.hat?.style) ? brimShadow(p) : []), ...rim(p), UNCLIP],
  neck: (p) => { const f = -sideOf(p), w = Math.min(p.neck.width, p.face.width * p.face.jaw * 0.8) / 2; return [path(`M ${200 + f * 2} 260 L ${200 + f * w} 260 L ${200 + f * w} 346 L ${200 + f * (w + 14)} 400 L ${200 + f * 2} 400 Z`, { fill: INK, op: 0.45 })]; }, // the neck's far half, flaring with it into the shoulder: garments come over its base
};
// The light through a venetian blind: the room in shadow and slanted bars of light across the figure and the wall behind.
MAKEUP.noirBlinds = { front: () => { const bars = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const y = 30 + i * 62; return `M -60 ${y + 60} L 460 ${y - 50} L 460 ${y - 20} L -60 ${y + 90} Z`; }).join(' '); return [path(`M -60 -60 L 460 -60 L 460 560 L -60 560 Z ${bars}`, { fill: INK, op: 0.3, rule: 'evenodd' })]; } }; // the room dark, and the bars of light through the slats
// The other noir face: everything dark but a band of light across the eyes.
MAKEUP.noirEyeLight = { face: (p) => { const ey = p.eyes.y; return [...outside(p, [-1, 1].map((o) => earShade(p, o, 12, 16))), clip(headOutline(p)), path(`M 0 0 L 400 0 L 400 ${ey - 16} C 300 ${ey - 20}, 100 ${ey - 12}, 0 ${ey - 16} Z M 0 ${ey + 14} C 100 ${ey + 18}, 300 ${ey + 10}, 400 ${ey + 14} L 400 520 L 0 520 Z`, { fill: INK, op: 0.46 }), UNCLIP]; } };

// --- the cigarette and its smoke -------------------------------------------------------------------------------
// The cigarette hangs from the corner of the mouth (the `mouth` slot, over the lips); its smoke goes up past the hat
// (the `over` slot), so it is drawn twice in two groups, and the smoke is put back where the ember is on a turn
// (the features slide 8 further than the hat's layer). The smoke is one ribbon that rises, leans away from the face,
// curls over once and thins out, drawn as a wide faint body under a bright core, with a second, finer wisp beside it.
const ember = (p) => [200 + p.mouth.width * 0.34 + 25, p.mouth.y + 7];
MAKEUP.cigarette = {
  mouth: (p) => { const x = 200 + p.mouth.width * 0.34, y = p.mouth.y + 1; return [
    path(`M ${x} ${y} L ${x + 24} ${y + 6}`, stroke('#ece8e0', 3.6, 1, 'butt')), path(`M ${x} ${y} L ${x + 5} ${y + 1.2}`, stroke('#b89a6a', 3.6, 1, 'butt')),
    ellipse(x + 25, y + 6.3, 2.2, 2.2, { fill: '#e0581c' }), ellipse(x + 25, y + 6.3, 4.5, 4.5, { fill: '#ff9a40', op: 0.25 })]; },
  over: (p) => { const [x0, y0] = ember(p), dx = 8 * (p.pose?.turn ?? 0), x = x0 + dx, y = y0 - 2;
    const seg = [`M ${x} ${y} C ${x + 4} ${y - 18}, ${x - 8} ${y - 30}, ${x + 2} ${y - 48} C ${x + 12} ${y - 66}, ${x + 30} ${y - 64}, ${x + 30} ${y - 82}`, `M ${x + 30} ${y - 82} C ${x + 30} ${y - 98}, ${x + 12} ${y - 100}, ${x + 14} ${y - 88} C ${x + 16} ${y - 78}, ${x + 32} ${y - 86}, ${x + 42} ${y - 104}`, `M ${x + 42} ${y - 104} C ${x + 52} ${y - 122}, ${x + 40} ${y - 140}, ${x + 56} ${y - 160} C ${x + 66} ${y - 172}, ${x + 72} ${y - 176}, ${x + 70} ${y - 196}`]; // three stretches, each wider and fainter than the one below: the smoke spreads as it climbs
    const wisp = `M ${x + 2} ${y - 46} C ${x + 18} ${y - 52}, ${x + 6} ${y - 72}, ${x + 22} ${y - 80} C ${x + 36} ${y - 88}, ${x + 22} ${y - 112}, ${x + 30} ${y - 128}`;
    return [...seg.flatMap((d, i) => [path(d, stroke('#a8a8a8', 5 + i * 7, 0.1 - i * 0.02)), path(d, stroke('#e8e8e8', 2 + i * 3, 0.3 - i * 0.07)), path(d, stroke('#ffffff', 1.2 + i * 0.4, 0.5 - i * 0.14))]), path(wisp, stroke('#e8e8e8', 2.4, 0.18)), path(wisp, stroke('#ffffff', 0.9, 0.35))]; },
};

// --- hats ---------------------------------------------------------------------------------------------------------
/** A fedora: a crown that tapers to a teardrop pinch with a crease down its top, a grosgrain band with its bow at
 *  the side, and a wide brim snapped down at the front (its front edge dips below the crown) and turned up at the
 *  sides. The crown's far side is in shadow, the brim's top edge catches the light. */
HATS.fedora = (p) => { const c = p.hat.color, dark = shade(c, 0.55), f = -sideOf(p); return mapXY([ // authored 8 high, worn low
  path('M 140 134 C 138 110, 148 88, 162 78 C 170 71, 184 68, 192 72 Q 200 80 208 72 C 216 68, 230 71, 238 78 C 252 88, 262 110, 260 134 Z', { fill: c }), // the crown, pinched in at the top front
  path(`M ${200 + f * 4} 76 Q ${200 + f * 30} 66 ${200 + f * 38} 78 C ${200 + f * 52} 88, ${200 + f * 62} 110, ${200 + f * 60} 134 L ${200 + f * 4} 134 Z`, { fill: '#000000', op: 0.3 }), // its far side, out of the light
  path('M 192 74 Q 200 82 208 74 Q 204 98 200 104 Q 196 98 192 74 Z', { fill: dark, op: 0.8 }), // the crease down the top
  path('M 168 80 Q 176 92 172 110', stroke(dark, 4, 0.6)), path('M 232 80 Q 224 92 228 110', stroke(dark, 4, 0.6)), // the two pinches either side of it
  path('M 166 82 Q 172 92 168 104', stroke('#ffffff', 1.6, 0.18)),
  path('M 141 118 Q 200 112 259 118 L 260 134 Q 200 130 140 134 Z', { fill: p.hat.accent ?? dark }), // the band
  path(`M ${200 - f * 50} 120 L ${200 - f * 40} 118 L ${200 - f * 38} 132 L ${200 - f * 50} 132 Z`, { fill: shade(p.hat.accent ?? dark, 0.7) }), // its bow, on the lit side
  path('M 98 124 C 120 129, 150 133, 200 133 C 250 133, 280 129, 302 124 C 300 134, 284 142, 252 147 C 230 151, 214 157, 200 158 C 186 157, 170 151, 148 147 C 116 142, 100 134, 98 124 Z', { fill: c }), // the brim, snapped down at the front
  path('M 98 124 C 120 129, 150 133, 200 133 C 250 133, 280 129, 302 124', stroke('#ffffff', 2, 0.22)), // its top edge in the light
  path('M 108 133 C 130 142, 164 148, 200 155 C 236 148, 270 142, 292 133', stroke('#000000', 3, 0.3))], (x) => x, (y) => y + 8); }; // and its underside
HAT_CROWN.fedora = 140;
/** A patrolman's cap: a stiff flat crown wider than the head, a dark band with a brass shield on the front, and a
 *  glossy black visor pulled low. */
HATS.noirCap = (p) => { const c = p.hat.color, band = p.hat.accent ?? shade(c, 0.5); return [
  path('M 142 136 L 140 112 C 112 108, 104 96, 120 88 C 150 76, 250 76, 280 88 C 296 96, 288 108, 260 112 L 258 136 Z', { fill: c }), // the crown, standing out past the band
  path('M 120 88 C 150 76, 250 76, 280 88 C 270 94, 230 98, 200 98 C 170 98, 130 94, 120 88 Z', { fill: shade(c, 1.25) }), // its flat top, catching the light
  path('M 140 112 C 170 116, 230 116, 260 112', stroke('#000000', 3, 0.3)),
  path('M 141 116 Q 200 112 259 116 L 259 136 Q 200 132 141 136 Z', { fill: band }), // the band
  path('M 200 94 L 212 100 L 210 116 L 200 124 L 190 116 L 188 100 Z', { fill: BRASS }), path('M 200 98 L 206 102 L 205 113 L 200 118', stroke('#fff3c8', 1.4, 0.6)), // the shield
  path('M 144 134 C 170 132, 230 132, 256 134 C 250 148, 226 156, 200 157 C 174 156, 150 148, 144 134 Z', { fill: '#0e0e10' }), // the visor
  path('M 160 140 C 180 145, 220 145, 240 140', stroke('#ffffff', 2.4, 0.3))]; };
HAT_CROWN.noirCap = 134;
/** A little tilted hat perched on one side of the head, and its net veil falling over the eyes: no crown line, it sits
 *  on the hair as drawn. The net is two sets of fine diagonals clipped to the veil, with a dot at every other crossing. */
HATS.noirVeil = (p) => { const c = p.hat.color, f = sideOf(p), X = (d) => 200 + f * d, ey = p.eyes.y, veil = `M ${X(-6)} 96 C ${X(-44)} 100, ${X(-74)} 128, ${X(-76)} 168 C ${X(-78)} ${ey + 4}, ${X(-60)} ${ey + 20}, ${X(-40)} ${ey + 24} Q ${X(20)} ${ey + 34} ${X(80)} ${ey + 14} L ${X(78)} 100 Z`;
  const net = []; for (let i = -20; i < 30; i++) { const x = 60 + i * 9; net.push(line(x, 60, x + 200, 260, stroke('#101010', 0.8, 0.5)), line(x + 200, 60, x, 260, stroke('#101010', 0.8, 0.5))); }
  return [
    path(`M ${X(-8)} 94 C ${X(-4)} 74, ${X(58)} 62, ${X(76)} 78 L ${X(80)} 96 C ${X(62)} 106, ${X(8)} 110, ${X(-8)} 104 Z`, { fill: c }), // the hat, tipped toward the light
    path(`M ${X(-4)} 86 C ${X(10)} 72, ${X(60)} 66, ${X(76)} 80`, stroke('#ffffff', 2, 0.25)),
    path(`M ${X(54)} 74 C ${X(80)} 46, ${X(110)} 40, ${X(128)} 46 C ${X(104)} 50, ${X(84)} 62, ${X(66)} 80 Z`, { fill: shade(c, 0.7) }), // a feather swept back off it
    clip(veil), ...net, UNCLIP, path(veil, stroke('#101010', 1.2, 0.35))]; };

// --- tops ---------------------------------------------------------------------------------------------------------
const pin = (d, color, step = 11, op = 0.22) => [clip(d), ...Array.from({ length: 30 }, (_, i) => line(40 + i * step, 330, 40 + i * step, 700, stroke(color, 0.9, op, 'butt'))), UNCLIP]; // chalk pinstripes, inside the cloth
/** A double-breasted suit buttoned up, chalk-striped: wide peaked lapels pointing up past the shoulders' line, the
 *  front wrapped across to a second row of buttons, a white shirt and a tie at the throat, a pocket square. */
TOPS.noirDoubleBreasted = (p) => { const c = p.top.color, dark = shade(c, 0.55), tie = p.top.accent ?? '#3a2a2a', T = SHOULDERS.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'); return [
  torso(SHOULDERS, c), ...pin(T, shade(c, 2.4)),
  path('M 172 348 L 200 412 L 228 348 Z', { fill: SHIRT }), path('M 194 354 L 206 354 L 210 404 L 200 414 L 190 404 Z', { fill: tie }), path('M 194 354 L 206 354 L 204 364 L 196 364 Z', { fill: '#000000', op: 0.3 }), // the shirt and the tie
  path('M 172 348 L 186 372 L 196 352 Z', { fill: SHIRT, collar: true }), path('M 228 348 L 214 372 L 204 352 Z', { fill: SHIRT, collar: true }), // the collar points
  ...[-1, 1].map((s) => path(`M ${200 + s * 26} 346 L ${200 + s * 58} 350 L ${200 + s * 76} 360 L ${200 + s * 62} 384 L ${200 + s * 50} 380 L ${200 + s * 10} 448 L ${200 + s * 2} 448 Z`, { fill: dark })), // the peaked lapels, the point standing up and out
  ...[-1, 1].map((s) => path(`M ${200 + s * 50} 380 L ${200 + s * 62} 384`, stroke('#000000', 2, 0.5))), // the gorge notch
  path('M 202 448 L 232 470 L 232 700', stroke('#000000', 3, 0.35, 'butt')), path('M 205 448 L 235 470 L 235 700', stroke('#ffffff', 1, 0.12, 'butt')), // the wrapped front's edge
  ...[0, 1, 2].flatMap((r) => [-1, 1].map((s) => ellipse(200 + s * (24 - r * 2), 462 + r * 30, 3.6, 3.6, { fill: shade(c, 0.35) }))), // two rows of three buttons
  path('M 250 412 L 262 400 L 268 408 L 276 398 L 278 414 Z', { fill: SHIRT }), path('M 248 414 L 282 414', stroke(dark, 2, 0.8))]; }; // the pocket square, peaked
NECKLINES.noirDoubleBreasted = 'M 172 348 L 200 412 L 228 348';
/** A patrolman's tunic: dark wool, a shirt collar and a black tie, one row of brass buttons, a shield on the chest and
 *  the cross-strap of the belt over one shoulder. */
TOPS.noirTunic = (p) => { const c = p.top.color, dark = shade(c, 0.55); return [
  torso('M 66 480 C 78 390, 120 358, 160 348 L 240 348 C 280 358, 322 390, 334 480 Z', c),
  path('M 176 350 L 200 392 L 224 350 Z', { fill: '#c8c4bc' }), path('M 195 356 L 205 356 L 208 392 L 200 400 L 192 392 Z', { fill: '#141414' }), // the shirt and the tie
  ...[-1, 1].map((s) => path(`M ${200 + s * 24} 348 L ${200 + s * 54} 352 L ${200 + s * 46} 380 L ${200 + s * 4} 400 Z`, { fill: dark })), // the tunic's collar laid open
  path('M 200 400 L 200 700', stroke('#000000', 2.5, 0.35, 'butt')), ...[424, 458, 492, 526].map((y) => ellipse(200, y, 4, 4, { fill: BRASS })), // the front, buttoned
  path('M 112 372 L 290 640 L 272 650 L 96 384 Z', { fill: '#141210', op: 0.85 }), // the cross-strap
  path('M 246 404 L 270 404 L 272 420 C 270 436, 262 442, 258 446 C 254 442, 246 436, 244 420 Z', { fill: BRASS }), path('M 251 410 L 265 410 L 266 421 C 264 432, 260 436, 258 438', stroke('#fff3c8', 1.4, 0.55)), // the shield
  path('M 236 456 L 286 452 L 286 470 L 236 472 Z', { fill: dark })]; }; // the pocket flap
NECKLINES.noirTunic = 'M 176 350 L 200 392 L 224 350';
/** An evening gown: bare shoulders and a sweetheart bodice in black satin, its sheen in long bright folds. The arms are
 *  the gown's colour, the long gloves of the evening, and a stole (`noirStole`) goes over the shoulders. */
TOPS.noirGown = (p) => { const c = p.top.color, bodice = 'M 98 700 L 104 440 C 118 420, 146 404, 170 402 C 186 402, 196 410, 200 418 C 204 410, 214 402, 230 402 C 254 404, 282 420, 296 440 L 302 700 Z'; return [
  torso('M 72 480 C 86 396, 132 368, 166 357 L 234 357 C 268 368, 314 396, 328 480 Z', p.skin), // the shoulders and the chest, bare
  path('M 156 382 Q 176 376 194 386', stroke('#000000', 2, 0.12)), path('M 244 382 Q 224 376 206 386', stroke('#000000', 2, 0.12)), // the collarbones
  path(bodice, { fill: c }),
  path('M 170 402 C 186 402, 196 410, 200 418 C 204 410, 214 402, 230 402', stroke('#ffffff', 1.6, 0.3)), // the bodice's edge in the light
  path('M 150 430 C 160 500, 150 580, 158 700', stroke('#ffffff', 7, 0.1)), path('M 152 440 C 160 500, 152 580, 158 700', stroke('#ffffff', 2, 0.25)), path('M 246 432 C 236 520, 248 600, 240 700', stroke('#ffffff', 4, 0.08)), // the satin's sheen
  path('M 200 420 L 200 520', stroke('#000000', 3, 0.25))]; };

// --- jackets ------------------------------------------------------------------------------------------------------
/** A trench coat with its collar turned up against the rain: the collar standing either side of the neck, wide
 *  lapels, the storm flap over one side of the chest, epaulettes, a belt with its buckle. */
JACKETS.noirTrench = (p) => { const c = p.jacket.color, dark = shade(c, 0.6), lit = shade(c, 1.2), f = -sideOf(p); return [
  torso('M 56 480 C 66 386, 114 356, 158 346 L 242 346 C 286 356, 334 386, 344 480 Z', c),
  path('M 158 347 L 202 400 L 172 456 L 132 364 Z', { fill: lit }), path('M 242 347 L 198 400 L 228 456 L 268 364 Z', { fill: lit }), // the lapels
  path('M 158 347 L 202 400 L 172 456', stroke(dark, 2.5, 0.9, 'butt')), path('M 242 347 L 198 400 L 228 456', stroke(dark, 2.5, 0.9, 'butt')),
  path('M 146 352 L 150 306 L 170 318 L 178 352 Z', { fill: c }), path('M 254 352 L 250 306 L 230 318 L 222 352 Z', { fill: c }), // the collar, turned up
  path('M 150 306 L 170 318 L 176 350', stroke(lit, 2, 0.6)), path('M 250 306 L 230 318 L 224 350', stroke(lit, 2, 0.6)),
  path(`M ${200 + f * 66} 368 L ${200 + f * 118} 392 L ${200 + f * 124} 448 L ${200 + f * 76} 440 Z`, { fill: shade(c, 1.08) }), path(`M ${200 + f * 76} 440 L ${200 + f * 124} 448`, stroke(dark, 2.5, 0.8)), // the storm flap
  ...[-1, 1].map((s) => path(`M ${200 + s * 92} 366 L ${200 + s * 128} 384 L ${200 + s * 124} 394 L ${200 + s * 88} 378 Z`, { fill: dark })), // the epaulettes
  rect(62, 462, 276, 24, { fill: shade(c, 0.62) }), rect(184, 456, 32, 36, { rx: 3, fill: 'none', stroke: shade(c, 0.35), sw: 4 }), line(200, 460, 200, 488, stroke(shade(c, 0.35), 3)), // the belt and its buckle
  ...[[176, 418], [224, 418], [176, 444], [224, 444]].map(([x, y]) => ellipse(x, y, 3.4, 3.4, { fill: '#1d1c1a', op: 0.6 }))]; };
NECKLINES.noirTrench = 'M 158 346 L 200 400 L 242 346';

// --- worn over the clothes: the stole; on the neck: pearls and a loosened tie --------------------------------------
const furEdge = (pts) => pts.map(([x, y], i) => (i ? `Q ${x + (i % 2 ? 5 : -5)} ${y + (i % 2 ? -6 : 6)} ${x} ${y}` : `M ${x} ${y}`)).join(' ');
/** A fur stole: white fox across the shoulders and down the front, its edges ruffled, worn over the arms. */
PROPS.noirStole = { front: (p) => { const fur = '#e4e0d8', d = shade(fur, 0.62); const L = `${furEdge([[166, 348], [144, 344], [120, 346], [98, 356], [80, 378], [66, 410], [60, 448], [64, 494]])} L 96 520 ${furEdge([[96, 520], [114, 500], [130, 472], [142, 444], [152, 420], [160, 398], [168, 378], [172, 360]]).replace(/^M [\d.]+ [\d.]+/, '')} Z`;
  const R = `${furEdge([[234, 348], [256, 344], [280, 346], [302, 356], [320, 378], [334, 410], [340, 448], [336, 494]])} L 290 560 ${furEdge([[290, 560], [276, 520], [262, 480], [250, 446], [240, 414], [232, 386], [228, 360]]).replace(/^M [\d.]+ [\d.]+/, '')} Z`;
  return [path(L, { fill: fur }), path(R, { fill: fur }), ...[[86, 440, 120, 470], [104, 410, 140, 430], [300, 430, 266, 470], [282, 400, 250, 420], [288, 500, 262, 520]].map(([a, b, x, y]) => path(`M ${a} ${b} Q ${(a + x) / 2} ${(b + y) / 2 - 10} ${x} ${y}`, stroke(d, 2, 0.4))), path('M 76 470 C 84 500, 92 512, 96 520', stroke(d, 6, 0.3)), path('M 300 520 C 296 540, 292 552, 290 560', stroke(d, 6, 0.3)), path('M 126 362 C 150 352, 160 352, 166 352', stroke('#ffffff', 3, 0.4)), path('M 274 362 C 250 352, 240 352, 234 352', stroke('#ffffff', 3, 0.4))]; } };
/** A trench coat's collar turned up against the rain, standing either side of the neck: drawn over the coat (a jacket
 *  is cut to the trunk, and the collar stands above it). */
PROPS.noirCollarUp = { body: (p) => { const c = p.jacket.style !== 'none' ? p.jacket.color : p.top.color, w = Math.min(p.neck.width, p.face.width * p.face.jaw * 0.8) / 2; return [-1, 1].flatMap((s) => { const X = (d) => 200 + s * d; return [path(`M ${X(w + 34)} 362 L ${X(w + 18)} 304 C ${X(w + 8)} 304, ${X(w - 2)} 310, ${X(w - 6)} 318 L ${X(w - 8)} 352 Z`, { fill: c }), path(`M ${X(w + 18)} 304 C ${X(w + 8)} 304, ${X(w - 2)} 310, ${X(w - 6)} 318 L ${X(w - 8)} 352`, stroke(shade(c, 1.25), 2, 0.7)), path(`M ${X(w + 30)} 356 L ${X(w + 16)} 312`, stroke(shade(c, 0.55), 2.5, 0.5))]; }); } };
/** A string of pearls lying on the collarbones. */
ACCESSORIES.noirPearls = { at: 'neck', ops: () => Array.from({ length: 15 }, (_, i) => { const t = i / 14, x = 168 + 64 * t, y = 360 + 28 * Math.sin(Math.PI * t); return [ellipse(x, y, 3.4, 3.4, { fill: '#ece8e0' }), ellipse(x - 1, y - 1, 1.2, 1.2, { fill: '#ffffff', op: 0.9 })]; }).flat() };
/** A tie pulled loose: the collar open at the throat, the knot slipped down and off to one side. */
ACCESSORIES.noirLooseTie = { at: 'tie', ops: (p) => [path('M 192 376 L 200 396 L 208 376 Z', { fill: p.skin }), path('M 192 376 L 200 396 L 208 376', stroke('#000000', 1.5, 0.25)),
  path('M 195 398 L 209 396 L 211 410 L 199 412 Z', { fill: p.top.accent ?? '#5a1a22' }), path('M 199 412 L 211 410 L 218 446 L 211 456 L 204 447 Z', { fill: p.top.accent ?? '#5a1a22' }), path('M 199 412 L 211 410 L 210 418 L 200 419 Z', { fill: '#000000', op: 0.3 })] };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const NOIR = { hats: ['fedora', 'noirCap', 'noirVeil'], tops: ['noirDoubleBreasted', 'noirTunic', 'noirGown'], jackets: ['noirTrench'], makeup: ['noirKey', 'noirBlinds', 'noirEyeLight', 'cigarette'], props: ['noirStole', 'noirCollarUp'], accessories: ['noirPearls', 'noirLooseTie'] };
tagPack(NOIR, 'only:noir');
