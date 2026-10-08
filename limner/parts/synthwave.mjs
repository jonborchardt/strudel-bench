// The synthwave pack: what the synthwave cast (casts/synthwave.mjs) wears that nobody else does, tagged
// `only:synthwave`. Neon nightlife, and neon is light before it is colour: the club is dark and lit from two sides,
// magenta from the left (-x) and cyan from the right, so the one part every one of them carries is that light, laid on
// as planes that model what they fall on:
//   neonKey   the two lights: a hard-edged plane down each side of the face (the temple, the cheekbone's outer face,
//             the jaw), the ear and the side of the neck on that side, the outside of the hair and the beard, the
//             shoulder and the outside of each arm, the nose's two flanks and a coloured glint on the lip; the front
//             of the face, which neither light reaches, a shade darker; and the glow of the two sources at the frame's
//             edges, the only halo, since only a light source glows.
// Over that: mirrored shades (and a wrap visor) that reflect a sunset over a grid rather than the room, neon liner,
// a holographic lid with glitter on it, chrome drop earrings lit on their outer face, and black vinyl that throws the
// two lights back as long slivers. The cast also reaches the eighties pack (`era:80s`). parts.html?pack=synthwave is the
// sheet. The clipping to the figure's own shapes (the hair's and the beard's zones, the face outline) is the hologram
// pack's trick (parts/hologram.mjs), shared through parts/pen.mjs: one pack does not reach into another.
import { TOPS, JACKETS, MAKEUP, GLASSES, ACCESSORIES, PROPS, JACKET_EDGE, TRUNK, facePath, shade, mix, path, ellipse, rect, clip, UNCLIP, stroke, soft, eyeShape } from '../portrait.mjs';
import { tagPack, f1, torso, SHOULDERS, keyOf, hairZones, beardZones } from './pen.mjs';

const MAGENTA = '#ff2fa8', CYAN = '#2fe6ff', SUN = '#ffb03a', GOLD = '#ffe14a', VIOLET = '#5a2a8a', NIGHT = '#1c0c34', CHROME = '#c9ccd6';
const KEY = [[-1, MAGENTA], [1, CYAN]]; // [side, light]: the two lights of the one club

// --- where the figure is: the zones in pen.mjs (hairZones, beardZones), shared with the hologram pack ---

// --- the key light ---
/** One side's light on the face: a plane whose inner edge follows the bone (in at the temple, out over the cheekbone's
 *  front, in under it, then along the jaw to the chin), and a brighter rim inside the outline. `k` widens it. */
const facePlane = (p, s, k) => {
  const w = p.face.width / 2, y = p.eyes.y, top = 100, bot = 112 + p.face.height + 16 * p.face.chin + 6, X = (f) => f1(200 + s * w * f);
  return `M ${X(0.5 / k)} ${top} C ${X(0.56 / k)} ${y - 40}, ${X(0.6 / k)} ${y - 6}, ${X(0.5 / k)} ${y + 22} C ${X(0.44 / k)} ${y + 40}, ${X(0.62 / k)} ${y + 52}, ${X(0.64 / k)} ${y + 72} C ${X(0.62 / k)} ${bot - 30}, ${X(0.42 / k)} ${bot - 6}, ${X(0.14 / k)} ${bot} L ${X(1.5)} ${bot} L ${X(1.5)} ${top} Z`;
};
/** Where an ear landed: the portrait's own swing on a turned head (portrait.mjs `ears`), then the head's width. */
const earAt = (p, o) => { const t = p.pose?.turn ?? 0, a = t * t, far = o === Math.sign(t), cx = o < 0 ? 122 : 278, piv = cx - 15 * o, sq = !t ? 1 : far ? 1 - 0.55 * a : 1 + 0.2 * a, dx = !t ? 0 : far ? -o * 14 * a : o * 3 * a, k = p.face.width / 156, sz = p.ears?.size ?? 1;
  return { x: f1(200 + (piv + (cx - piv) * sq + dx - 200) * k), y: f1(212 + p.eyes.y - 196), rx: f1(15 * sq * k * sz), ry: f1(27 * sz) }; };
const neckX = (p) => Math.min(p.neck?.width ?? 63, p.face.width * p.face.jaw * 0.8) / 2;
const OUTSIDE = (d) => clip(`M -50 -50 L 450 -50 L 450 760 L -50 760 Z ${d}`, 'evenodd');
/** The arm's lit stripe down its outside, on the arm the portrait hangs (portrait.mjs `arm`, lift 0.3); none on an arm a prop has taken. */
const ARM = (sd) => ({ s: [200 + 77.2 * sd, 395.6], e: [200 + 104 * sd, 540], w: [200 + 110 * sd, 690] });
const armed = (p, sd) => (p.props ?? []).some((n) => (PROPS[n]?.lift ?? []).some((v) => Math.sign(v) === sd) || PROPS[n]?.arms?.includes(sd));
const offset = ([x0, y0], [x1, y1], d) => { const L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L, sg = Math.sign(nx) || 1; return `M ${f1(x0 + nx * d * sg)} ${f1(y0 + ny * d * sg)} L ${f1(x1 + nx * d * sg)} ${f1(y1 + ny * d * sg)}`; };

/** The half of the sheet one light reaches: beyond a line from near the centre at the crown out to the jaw, so the light wraps the temple and the cheek and leaves the chin and the front of the face. */
const sideOf = (s, xTop, xBot, top = -50, bot = 760) => clip(`M ${f1(200 + s * xTop)} ${top} L ${200 + s * 300} ${top} L ${200 + s * 300} ${bot} L ${f1(200 + s * xBot)} ${bot} Z`);
MAKEUP.neonKey = {
  back: () => KEY.flatMap(([s, c]) => [...soft(200 + s * 236, 250, 120, 300, c, 0.32), ...soft(200 + s * 222, 250, 40, 220, mix(c, '#ffffff', 0.4), 0.24)]), // the two sources, just off the frame: the only glow there is
  neck: (p) => { const h = neckX(p), d = `M ${200 - h - 18} 236 L ${200 + h + 18} 236 L ${200 + h + 22} 450 L ${200 - h - 22} 450 Z`; return [clip(d), ...soft(200, 300, h + 12, 64, NIGHT, 0.3),
    ...KEY.flatMap(([s, c]) => soft(200 + s * (h + 4), 300, h * 0.55, 62, c, 0.5)), UNCLIP]; }, // the side of the column facing each light, falling off toward the throat; soft and gone by the collar, because a neckline (an off-shoulder top) shows the neck slot through it and a hard-ended band read as a broken neck
  skin: (p) => { const d = facePath(p), w = p.face.width / 2, bot = 112 + p.face.height + 16 * p.face.chin; return [
    clip(d), rect(100, 90, 200, 270, { fill: NIGHT, op: 0.26 }), // the front of the face, which neither light reaches
    ...KEY.flatMap(([s, c]) => [path(facePlane(p, s, 0.86), { fill: c, op: 0.2 }), sideOf(s, w * 0.05, w * 0.55, 100, bot), UNCLIP, ...soft(200 + s * w * 0.66, p.eyes.y + 28, 12, 20, mix(c, '#ffffff', 0.6), 0.3)]), // the cheek's outer face as a plane and the hot spot where the cheekbone turns into the light. No rim stroked along the outline: it ran round the whole head from the crown to the jaw and sealed the face in a glass helmet (T150)
    UNCLIP,
    OUTSIDE(d), ...KEY.flatMap(([s, c]) => { const e = earAt(p, s); return e.rx > 1 ? [ellipse(e.x, e.y, e.rx, e.ry, { fill: c, op: 0.4 }), ellipse(e.x + s * e.rx * 0.35, e.y - 2, e.rx * 0.5, e.ry * 0.8, { fill: mix(c, '#ffffff', 0.4), op: 0.35 })] : []; }), UNCLIP]; }, // the ears face the lights square on: the brightest skin there is
  face: (p) => { const y0 = p.eyes.y + 12, yt = p.eyes.y + 8 + p.nose.length, my = p.mouth.y, mw = p.mouth.width / 2; return KEY.flatMap(([s, c]) => [
    path(`M ${200 + s * 4} ${y0} L ${200 + s * 7} ${y0} L ${200 + s * 13} ${f1(yt - 4)} L ${200 + s * 6} ${f1(yt)} Z`, { fill: c, op: 0.4 }), // the flank of the nose facing this light
    path(`M ${f1(200 + s * mw * 0.25)} ${f1(my + 4)} Q ${f1(200 + s * mw * 0.6)} ${f1(my + 6)} ${f1(200 + s * mw * 0.85)} ${f1(my + 2)}`, stroke(mix(c, '#ffffff', 0.5), 1.8, 0.7)), // the glint along the lower lip
  ]); },
  over: (p) => { const w = p.face.width / 2, lit = (z) => KEY.flatMap(([s, c]) => [...soft(200 + s * (w + 80), 170, 120, 260, c, 0.75), ...soft(200 + s * (w + 70), 150, 60, 200, mix(c, '#ffffff', 0.5), 0.45)]); // falling off from the outside in: a stroked rim here outlined every curl and the cut round the face, which read as tubes
    return [...hairZones(p, { back: false }), ...beardZones(p)].flatMap((z) => [...z.map((d) => clip(d)), ...lit(z), ...z.map(() => UNCLIP)]); }, // the outside of the hair and the beard along their own edges, the crown left dark
  body: () => [clip(TRUNK(690)), rect(60, 330, 280, 400, { fill: NIGHT, op: 0.16 }),
    ...KEY.flatMap(([s, c]) => [...soft(200 + s * 140, 470, 80, 230, c, 0.55), path(`M ${200 + s * 40} 356 C ${200 + s * 74} 356, ${200 + s * 100} 366, ${200 + s * 110} 400`, stroke(mix(c, '#ffffff', 0.3), 8, 0.45))]), UNCLIP], // the chest's sides falling off toward the middle, and the tops of the shoulders
  front: (p) => KEY.flatMap(([s, c]) => { if (armed(p, s)) return []; const a = ARM(s); return [
    path(offset(a.s, a.e, 14), stroke(c, 24, 0.3, 'butt')), path(offset(a.s, a.e, 24), stroke(mix(c, '#ffffff', 0.45), 4, 0.6, 'butt')), // the outside of the upper arm
    path(offset(a.e, a.w, 12), stroke(c, 22, 0.28, 'butt')), path(offset(a.e, a.w, 21), stroke(mix(c, '#ffffff', 0.45), 4, 0.55, 'butt'))]; }),
};

// --- the shades: a sunset over a grid, which is the song in their heads, not the room ---
/** The scene in one lens: sky in bands, a striped sun sitting on the horizon at `hy`, a magenta grid running into it. Thin lines are filled slivers, not strokes, so the frames' shadow on the face (drawn from the strokes) stays the frames'. */
const scene = (d, x0, x1, hy, y1, sx, sr) => { const w = x1 - x0; return [clip(d),
  rect(x0 - 4, hy - 30, w + 8, 34, { fill: '#2a0f52' }), rect(x0 - 4, hy - 12, w + 8, 12, { fill: '#8a1f8a', op: 0.85 }), rect(x0 - 4, hy - 6, w + 8, 6, { fill: MAGENTA, op: 0.8 }),
  ellipse(sx, hy, sr, sr, { fill: GOLD }), rect(sx - sr, hy - sr * 0.45, sr * 2, sr * 0.45, { fill: SUN }), ...[0.62, 0.36, 0.14].map((f, i) => rect(sx - sr, f1(hy - sr * f), sr * 2, f1(0.7 + i * 0.35), { fill: '#8a1f8a' })), // the sun cut by the bands
  rect(x0 - 4, hy, w + 8, y1 - hy + 4, { fill: '#12061f' }), rect(x0 - 4, hy - 0.5, w + 8, 1.2, { fill: '#ffd6f0' }),
  ...[2.5, 5.5, 9.5, 15].map((dy) => rect(x0 - 4, f1(hy + dy), w + 8, f1(0.6 + dy * 0.04), { fill: MAGENTA, op: 0.9 })),
  ...Array.from({ length: 9 }, (_, i) => { const k = i - 4, xt = sx + k * 1.4, xb = sx + k * w * 0.32; return path(`M ${f1(xt - 0.25)} ${hy} L ${f1(xt + 0.25)} ${hy} L ${f1(xb + 0.7)} ${y1 + 2} L ${f1(xb - 0.7)} ${y1 + 2} Z`, { fill: MAGENTA, op: 0.85 }); }),
  path(`M ${x0 + w * 0.12} ${hy - 30} L ${x0 + w * 0.3} ${hy - 30} L ${x0 + w * 0.08} ${y1 + 4} L ${x0 - w * 0.1} ${y1 + 4} Z`, { fill: '#ffffff', op: 0.16 }), // the glare across the glass
  UNCLIP]; };
/** Mirrored shades: two lenses, each with the sunset in it, a hard frame, and the frame's outer corner catching its side's light. */
GLASSES.mirrorShades = (c) => [-1, 1].flatMap((s) => { const x = 200 + s * 34, lens = `M ${x - 25} 183 L ${x + 25} 183 Q ${x + 27} 207 ${x + 13} 213 L ${x - 13} 213 Q ${x - 27} 207 ${x - 25} 183 Z`; return [
  ...scene(lens, x - 26, x + 26, 199, 213, x - s * 5, 8), path(lens, stroke(c, 2.6)),
  path(`M ${x + s * 4} 182 L ${x + s * 25} 183 Q ${x + s * 27} 200 ${x + s * 22} 208`, stroke(s < 0 ? MAGENTA : CYAN, 1.4, 0.9))]; }).concat([path('M 190 189 Q 200 185 210 189', stroke(c, 3))]);
/** A wrap visor: one lens from temple to temple, one sun in the middle of it. */
const VISOR = 'M 136 182 C 170 176, 230 176, 264 182 C 266 194, 262 204, 252 210 C 232 216, 214 212, 200 204 C 186 212, 168 216, 148 210 C 138 204, 134 194, 136 182 Z';
GLASSES.wrapVisor = (c) => [...scene(VISOR, 136, 264, 197, 214, 200, 13), path(VISOR, stroke(c, 2.4)), path('M 136 182 C 170 176, 230 176, 264 182', stroke(c, 4)),
  path('M 138 186 C 150 181, 170 179, 186 179', stroke(MAGENTA, 1.4, 0.9)), path('M 262 186 C 250 181, 230 179, 214 179', stroke(CYAN, 1.4, 0.9))];

// --- paint ---
/** Neon liner: a flick along each upper lid out past the corner, glowing (the liner is a light of its own). */
MAKEUP.neonLiner = { face: (p) => [-1, 1].flatMap((s) => { const E = eyeShape(p, s), k = E.k, wx = E.xo + s * 12 * k, wy = E.yo - 7 * k, d = `M ${E.cx - s * E.w * 0.4} ${E.y - E.th * 0.85} Q ${E.px + s * E.w * 0.6} ${E.y - E.th - 1} ${wx} ${wy}`; return [ // on each eye's own lid (eyeShape), out of its own corner
  ...soft(E.xo + s * 4 * k, E.yo - 5 * k, 14 * k, 6 * k, MAGENTA, 0.4), path(d, stroke(MAGENTA, 2.6, 0.95)), path(d, stroke('#ffd0ee', 0.9, 0.9))]; }) };
/** A holographic lid: the colour shifting across it, cyan at the inner corner through violet to magenta at the outer,
 *  and glitter over the lid and up onto the cheekbone, placed by the face's own numbers so one face sparkles the same way every time. */
MAKEUP.holoGlitter = { fit: 'eyes',
  skin: () => [-1, 1].flatMap((s) => { const X = (d) => 200 + s * d; return [
    path(`M ${X(19)} 191 C ${X(22)} 178, ${X(42)} 172, ${X(54)} 182 C ${X(44)} 183, ${X(30)} 186, ${X(19)} 191 Z`, { fill: CYAN, op: 0.55 }),
    path(`M ${X(28)} 186 C ${X(32)} 176, ${X(44)} 173, ${X(54)} 182 C ${X(46)} 182, ${X(36)} 184, ${X(28)} 186 Z`, { fill: '#9a5cff', op: 0.6 }),
    path(`M ${X(38)} 183.5 C ${X(42)} 176, ${X(50)} 176, ${X(55)} 182 C ${X(50)} 182, ${X(44)} 182.5, ${X(38)} 183.5 Z`, { fill: MAGENTA, op: 0.7 })]; }),
  face: (p) => { const k = keyOf(p); return Array.from({ length: 22 }, (_, i) => { const s = i % 2 ? 1 : -1, j = (k * 17 + i * 37) % 100, x = 200 + s * (22 + (j % 34)), y = 176 + ((k * 7 + i * 23) % 14) + (i % 5 === 0 ? 30 + (j % 12) : 0), r = 0.6 + (i % 3) * 0.35; return ellipse(x, y, r, r, { fill: ['#ffffff', CYAN, '#ffc0ec'][i % 3], op: 0.95 }); }); } };

// --- jewellery ---
/** Chrome drops: a long triangle off each lobe, its outer face lit by the light on that side and its inner face dark. */
ACCESSORIES.chromeDrops = { at: 'ear', ops: (p) => { const dy = p.eyes.y - 196; return KEY.flatMap(([s, c]) => { const x = 200 + s * 81, y = 230 + dy; return [
  ellipse(x, y, 2.2, 2.2, { fill: CHROME }), path(`M ${x} ${y + 2} L ${x + s * 7} ${y + 30} L ${x - s * 5} ${y + 30} Z`, { fill: '#3a3446' }),
  path(`M ${x} ${y + 2} L ${x + s * 7} ${y + 30} L ${x + s * 1} ${y + 30} Z`, { fill: c }), path(`M ${x} ${y + 4} L ${x + s * 5} ${y + 26}`, stroke('#ffffff', 1, 0.9))]; }); } };

// --- cloth ---
/** A mesh top: the body's colour under a grid of fine lines. */
TOPS.neonMesh = (p) => { const c = p.top.color, line = shade(c, 0.45); return [torso(SHOULDERS, c),
  ...Array.from({ length: 14 }, (_, i) => path(`M ${60 + i * 22} 346 L ${20 + i * 22} 700`, stroke(line, 1.2, 0.55))), ...Array.from({ length: 14 }, (_, i) => path(`M ${60 + i * 22} 346 L ${100 + i * 22} 700`, stroke(line, 1.2, 0.55)))]; };
/** A padded jacket with big shoulders, worn open, neon piping down its front edges (the piping is lit, so it glows). */
JACKETS.neonPaddedJacket = (p) => { const c = p.jacket.color, glow = p.jacket.accent ?? CYAN; return [
  path('M 40 700 L 38 440 C 44 376, 104 350, 168 350 L 174 700 Z', { fill: c }), path('M 360 700 L 362 440 C 356 376, 296 350, 232 350 L 226 700 Z', { fill: c }),
  ...[-1, 1].map((s) => path(`M ${200 + s * 32} 354 C ${200 + s * 100} 340, ${200 + s * 156} 360, ${200 + s * 162} 420`, stroke(shade(c, 1.3), 10, 0.5))), // the padded shoulders
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 32} 352 L ${200 + s * 26} 700`, stroke(glow, 9, 0.22)), path(`M ${200 + s * 32} 352 L ${200 + s * 26} 700`, stroke(glow, 2.6, 1)), path(`M ${200 + s * 32} 352 L ${200 + s * 26} 700`, stroke('#ffffff', 0.9, 0.8))])]; };
/** Black vinyl, worn open with wide lapels: the gloss throws each light back as long slivers down the panel nearer it, and a white line where the vinyl turns. */
JACKETS.vinylJacket = (p) => { const c = p.jacket.color; return [
  path('M 66 480 C 76 400, 108 372, 158 352 L 174 480 L 170 700 L 56 700 Z', { fill: c }), path('M 334 480 C 324 400, 292 372, 242 352 L 226 480 L 230 700 L 344 700 Z', { fill: c }),
  ...[-1, 1].map((s) => path(`M ${200 - s * 42} 352 L ${200 - s * 22} 410 L ${200 - s * 58} 452 L ${200 - s * 78} 372 Z`, { fill: shade(c, 0.6) })), // the lapels
  ...KEY.flatMap(([s, col]) => [
    path(`M ${200 + s * 40} 452 C ${200 + s * 38} 520, ${200 + s * 33} 600, ${200 + s * 34} 700 L ${200 + s * 42} 700 C ${200 + s * 41} 600, ${200 + s * 46} 520, ${200 + s * 50} 456 Z`, { fill: col, op: 0.8 }), // down the panel beside the opening, the part of it the arms leave in view
    path(`M ${200 + s * 46} 470 C ${200 + s * 44} 540, ${200 + s * 41} 610, ${200 + s * 41} 700`, stroke(mix(col, '#ffffff', 0.6), 1.4, 0.9)),
    path(`M ${200 + s * 74} 378 L ${200 + s * 60} 448 L ${200 + s * 54} 446 Z`, { fill: col, op: 0.55 }),
    path(`M ${200 + s * 62} 380 L ${200 + s * 76} 446`, stroke(mix(col, '#ffffff', 0.4), 2, 0.8))]), // the lapel's edge catching it
  ...[-1, 1].map((s) => path(`M ${200 + s * 40} 356 L ${200 + s * 27} 480 L ${200 + s * 30} 700`, stroke('#ffffff', 1.2, 0.35)))]; };
JACKET_EDGE.vinylJacket = JACKET_EDGE.openJacket;

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const SYNTHWAVE = { glasses: ['mirrorShades', 'wrapVisor'], makeup: ['neonKey', 'neonLiner', 'holoGlitter'], accessories: ['chromeDrops'], tops: ['neonMesh'], jackets: ['neonPaddedJacket', 'vinylJacket'] };
tagPack(SYNTHWAVE, 'only:synthwave');
