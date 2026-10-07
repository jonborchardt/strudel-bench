// The cyborg pack: what the cyborgs cast (casts/cyborgs.mjs) wears that nobody else does, tagged `only:cyborg`. The
// machine is fitted to a person, not drawn instead of one, and it is metal that has been lit: every plate carries an
// edge catching the light on the face's lit side, a shadow edge on the other, a seam where it meets the skin and a
// shadow it throws on that skin. Glow is kept for the few things that would glow (a lens, a core, a trace, an LED).
//
// The plates that lie on the face (`halfPlate`, `jawPlate`, `browPlate`) are clipped to this face's own outline, so a
// plate is the jaw and never a sticker beside it; they sit on the `skin` slot, which rides with the outline on a turned
// head, so the features (and the face's modelling) come over them. What sits on a feature (the ocular implant) rides
// with the eyes on the `face` slot. Visors are glasses; arms are props on portrait.mjs's `arm`. Each is worn, never the
// face's anatomy. parts.html?pack=cyborg is the sheet.
import { TOPS, MAKEUP, GLASSES, PROPS, arm, facePath, shade, soft, path, ellipse, rect, line, clip, UNCLIP, stroke, tag } from '../portrait.mjs';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const METAL = '#8a9099', LIT = '#e4e8ec', DARK = '#3b4048', DEEP = '#1d2126', RED = '#e0262c', GLOW = '#6fe0ff';
const fp = (fill, op = 1) => ({ fill, op });
const R = (v) => Math.round(v * 10) / 10;
const bolt = (x, y, r = 2.2) => [ellipse(x, y, r, r, fp(DEEP)), ellipse(x - r * 0.3, y - r * 0.3, r * 0.45, r * 0.45, fp('#fff', 0.55))];
const lightSide = (p) => p.light?.side || -1;

const chinOf = (p) => 112 + p.face.height + 16 * p.face.chin;
/** A plate lying on the face: `region` (closed, any size: the face clips it) in metal, its `seam` (the open edge where it meets the skin) drawn as a shadow thrown on the skin, a dark joint and a lit lip; `lines` are the plate's own joins between its pieces. */
const facePlate = (p, region, seam, lines = [], bolts = []) => {
  const sd = lightSide(p);
  return [clip(facePath(p)),
    path(seam, stroke('#000', 9, 0.13)), path(seam, stroke('#000', 4, 0.12)), // the plate stands proud: its shadow on the skin
    path(region, fp(METAL)),
    ...soft(200 - sd * 70, 250, 46, 110, DEEP, 0.4), // the far side of the head falls away into shadow on the metal too
    ...soft(200 + sd * 40, 200, 30, 50, '#fff', 0.14), // and the near cheekbone catches the light
    ...lines.flatMap((d) => [path(d, stroke(DEEP, 1.8, 0.6)), path(d, stroke('#fff', 1, 0.25))]),
    path(seam, stroke(DEEP, 2.2, 0.75)), path(seam, stroke(LIT, 1.2, 0.55)), // the joint, and the plate's edge catching the light
    ...bolts.flatMap(([x, y]) => bolt(x, y)),
    UNCLIP];
};

// --- the face ---
/** An implant where the right eye was: a housing let into the socket, recessed (a shadow under its brow, a lit lip on its lower rim), a red lens in a dark well with its glow, two bolts and a lead running back to the temple. */
MAKEUP.ocularImplant = { fit: 'eyes', face: () => {
  const x = 234, y = 197, hous = `M ${x - 24} ${y - 4} C ${x - 22} ${y - 20}, ${x + 14} ${y - 26}, ${x + 25} ${y - 8} C ${x + 30} ${y + 8}, ${x + 16} ${y + 22}, ${x - 2} ${y + 21} C ${x - 18} ${y + 20}, ${x - 26} ${y + 10}, ${x - 24} ${y - 4} Z`;
  return [
    path(`M ${x + 22} ${y - 12} C ${x + 34} ${y - 16}, ${x + 42} ${y - 18}, ${x + 48} ${y - 26}`, stroke(DEEP, 4, 0.8)), path(`M ${x + 22} ${y - 12} C ${x + 34} ${y - 16}, ${x + 42} ${y - 18}, ${x + 48} ${y - 26}`, stroke('#fff', 1, 0.25)), // the lead to the temple
    ...soft(x + 2, y + 6, 32, 26, DEEP, 0.35), // the socket's shadow round the housing
    path(hous, fp(METAL)), path(hous, stroke(DEEP, 1.6, 0.6)),
    path(`M ${x - 22} ${y - 8} C ${x - 18} ${y - 20}, ${x + 12} ${y - 24}, ${x + 22} ${y - 10}`, stroke(LIT, 2, 0.55)), // the lit upper rim
    path(`M ${x + 24} ${y + 2} C ${x + 22} ${y + 14}, ${x + 10} ${y + 20}, ${x - 4} ${y + 20}`, stroke(DEEP, 3, 0.45)), // its shadowed lower side
    ellipse(x, y, 13, 12.5, fp(DEEP)), ellipse(x, y + 1.5, 12, 10, fp('#000', 0.35)), // the well
    ellipse(x, y, 11, 11, fp(RED, 0.18)), ellipse(x, y, 7.5, 7.5, fp('#3a0608')), ellipse(x, y, 5.5, 5.5, fp(RED)), ellipse(x, y, 2.6, 2.6, fp('#ff8a70')), ellipse(x - 2.4, y - 2.6, 1.6, 1.3, fp('#fff', 0.85)),
    ...bolt(x - 17, y - 10), ...bolt(x + 17, y + 13)];
} };
/** A plate over the right half of the face, from the brow's peak down past the nose and the mouth's corner to the chin, seamed into three pieces and riveted along its edge; clipped to the face. Wear it with `ocularImplant`. */
MAKEUP.halfPlate = { skin: (p) => {
  const ey = p.eyes.y, my = p.mouth.y, ch = chinOf(p), mx = 200 + p.mouth.width / 2;
  const pts = [[214, 100], [218, ey - 40], [212, ey - 10], [226, ey + 22], [222, my - 18], [mx + 10, my - 2], [mx + 6, my + 18], [214, ch - 14], [208, ch + 10]];
  const seam = 'M ' + pts.map(([a, b]) => `${R(a)} ${R(b)}`).join(' L ');
  const region = `${seam} L 340 ${R(ch + 10)} L 340 100 Z`;
  return facePlate(p, region, seam, [`M 220 ${R(ey - 36)} L 300 ${R(ey - 46)}`, `M ${R(mx + 8)} ${R(my + 8)} L 300 ${R(my - 14)}`], [[226, ey - 30], [232, my - 22], [mx + 16, my + 14], [218, ch - 18]]);
} };
/** A plate along the left jaw from below the ear to the chin, in two pieces; clipped to the face, so it is the jaw. */
MAKEUP.jawPlate = { skin: (p) => {
  const my = p.mouth.y, ch = chinOf(p), mx = 200 - p.mouth.width / 2;
  const seam = `M 60 ${R(my - 30)} C 110 ${R(my - 26)}, ${R(mx - 18)} ${R(my - 8)}, ${R(mx - 6)} ${R(my + 22)} C ${R(mx)} ${R(my + 38)}, 196 ${R(ch - 22)}, 204 ${R(ch + 12)}`;
  const region = `${seam} L 60 ${R(ch + 30)} Z`;
  return facePlate(p, region, seam, [`M 120 ${R(my + 4)} L ${R(mx - 4)} ${R(ch - 4)}`], [[132, my - 12], [mx - 18, my + 22], [190, ch - 14]]);
} };
/** A plate over the left brow and temple, where the skull was opened: a shaved or bald head shows it; hair hides it. */
MAKEUP.browPlate = { skin: (p) => {
  const ey = p.eyes.y, bx = 200 - p.eyes.spacing / 2;
  const seam = `M 196 100 L 192 ${R(ey - 56)} C 180 ${R(ey - 40)}, ${R(bx + 6)} ${R(ey - 30)}, ${R(bx - 10)} ${R(ey - 26)} C ${R(bx - 26)} ${R(ey - 24)}, 120 ${R(ey - 14)}, 90 ${R(ey - 8)}`;
  return facePlate(p, `${seam} L 90 100 Z`, seam, [`M 150 100 L ${R(bx - 4)} ${R(ey - 30)}`], [[180, ey - 56], [bx - 18, ey - 34], [136, ey - 54]]);
} };
/** A jack in the left temple, a plug seated in it and its cable running down the cheek behind the jaw. */
MAKEUP.templePort = { skin: (p) => {
  const x = 200 - p.face.width / 2 + 13, y = p.eyes.y + 24, cab = `M ${R(x - 2)} ${R(y + 4)} C ${R(x - 14)} ${R(y + 40)}, ${R(x - 10)} ${R(y + 90)}, ${R(x + 4)} ${R(y + 150)}`;
  return [...soft(x, y + 2, 13, 13, DEEP, 0.4), ellipse(x, y, 9, 9, fp(METAL)), path(`M ${x - 8} ${y - 3} Q ${x - 6} ${y - 9} ${x + 6} ${y - 7}`, stroke(LIT, 1.6, 0.6)), ellipse(x, y, 5, 5, fp(DEEP)),
    path(cab, stroke(DEEP, 6, 0.9)), path(cab, stroke('#4a6a72', 3.4)), path(cab, stroke('#fff', 1, 0.2)),
    rect(x - 4.5, y - 1, 9, 10, fp('#2b3036')), ellipse(x, y + 1, 1.6, 1.6, fp(GLOW, 0.9))];
} };
/** The left ear replaced by a receiver: a housing over where the ear was, a grille, a lit LED and a short stub aerial. It swings out of sight with the ear on a hard turn away. */
MAKEUP.earReceiver = { skin: (p) => {
  const t = p.pose?.turn ?? 0; if (t < -0.55) return []; // the far side: the ear has gone behind the head
  const x = 200 - 78 * (p.face.width / 156) - (t < 0 ? 0 : 4 * t * t), y = 214 + p.eyes.y - 196, sd = lightSide(p);
  return [...soft(x + 6, y + 4, 20, 26, DEEP, 0.35), ellipse(x, y, 14, 21, fp(METAL)), ellipse(x + 2 * sd, y - 3, 9, 15, fp('#fff', 0.12)), ellipse(x, y, 14, 21, { fill: 'none', stroke: DEEP, sw: 1.6, op: 0.6 }),
    ellipse(x, y + 2, 8, 13, fp('#2b3036')), ...[-6, -2, 2, 6, 10].map((d) => line(x - 6, y + d, x + 6, y + d, stroke('#5a626c', 1.4, 0.8))),
    line(x - 3, y - 20, x - 8, y - 38, stroke(DEEP, 2.6)), ellipse(x - 8, y - 38, 2.4, 2.4, fp(DEEP)),
    ellipse(x + 7, y - 13, 4, 4, fp(GLOW, 0.25)), ellipse(x + 7, y - 13, 1.8, 1.8, fp(GLOW))];
} };
/** Light under the skin: traces from the right temple down the cheek, each run on a faint bloom and ending in a node. */
MAKEUP.circuitLines = { fit: 'face', skin: () => {
  const runs = ['M 268 150 L 262 176 L 270 196 L 268 236', 'M 262 176 L 248 160', 'M 270 196 L 256 246 L 236 262'];
  return [...runs.map((d) => path(d, stroke(GLOW, 5, 0.12))), ...runs.map((d, i) => path(d, stroke(GLOW, i ? 1.3 : 1.6, 0.8))),
    ...[[248, 160], [268, 236], [236, 262]].flatMap(([x, y]) => [ellipse(x, y, 5, 5, fp(GLOW, 0.2)), ellipse(x, y, 2.4, 2.4, fp('#e8fbff'))])];
} };
/** The left side of the neck opened: a recess down the column from under the jaw with three cables in it and a clamp at each end. On the
 *  `skin` slot, in the head's group, because the `neck` slot is painted over wherever a garment's neckline shows the neck again (`through`). */
MAKEUP.neckCabling = { skin: (p) => {
  const w = Math.min(p.neck.width, p.face.width * p.face.jaw * 0.8), c = chinOf(p), Y = (o) => c + 1 + (o + 8) * 0.6, x = 200 - w / 2 + 2, T = [x + 2, Y(-8)], B = [x + 18, Y(20)]; // Y: the recess squeezed into the bare neck between the jaw and a collar
  const hole = `M ${T.join(' ')} C ${x - 6} ${Y(4)}, ${x + 4} ${Y(20)}, ${B.join(' ')} C ${x + 22} ${Y(8)}, ${x + 14} ${Y(-4)}, ${T.join(' ')} Z`;
  const cable = (dx, col) => { const d = `M ${T[0] + dx * 0.4} ${T[1] + 2} Q ${x + 4 + dx} ${Y(8)} ${B[0] - 4 + dx} ${B[1] - 1}`; return [path(d, stroke(DEEP, 4.6)), path(d, stroke(col, 3)), path(d, stroke('#fff', 0.8, 0.3))]; };
  return [path(hole, stroke('#000', 7, 0.12)), path(hole, fp('#121518')), ...cable(-2, '#7a2e2e'), ...cable(3, '#4a7a84'), ...cable(8, '#6a7078'),
    path(`M ${B.join(' ')} C ${x + 22} ${Y(8)}, ${x + 14} ${Y(-4)}, ${T.join(' ')}`, stroke(LIT, 1.4, 0.4)), path(`M ${T.join(' ')} C ${x - 6} ${Y(4)}, ${x + 4} ${Y(20)}, ${B.join(' ')}`, stroke('#000', 1.6, 0.35)), // the skin's lip: lit on one side, the recess's shadow on the other
    ...[T, B].map(([a, b]) => ellipse(a, b, 3.6, 2.4, fp(METAL)))];
} };

// --- glasses: drawn for eyes 68 apart on the line y = 196, as portrait.mjs's are ---
/** A band of dark glass across both eyes in a frame of `c`, a scan line lit along it. */
GLASSES.visorBar = (c) => [
  path('M 134 184 Q 200 174 266 184 L 262 210 Q 200 218 138 210 Z', fp('#14232a', 0.86)),
  path('M 140 197 Q 200 191 260 197', stroke(GLOW, 4, 0.18)), path('M 140 197 Q 200 191 260 197', stroke(GLOW, 1.2, 0.85)),
  path('M 138 187 Q 200 178 262 187', stroke('#fff', 1.6, 0.3)), // the light along its top
  path('M 134 184 Q 200 174 266 184 L 262 210 Q 200 218 138 210 Z', stroke(c, 2.6)),
  rect(124, 186, 12, 18, { rx: 3, fill: c }), rect(264, 186, 12, 18, { rx: 3, fill: c }), ellipse(270, 195, 1.6, 1.6, fp(RED))];
/** A single lens rig over the left eye: a ring in `c`, tinted glass with two smaller rings stacked in it, an arm back to the temple. */
GLASSES.lensRig = (c) => [
  line(144, 188, 120, 184, stroke(c, 4)), rect(112, 178, 12, 12, { rx: 2, fill: c }),
  ellipse(166, 196, 21, 21, fp('#7fb8c8', 0.22)), ellipse(166, 196, 21, 21, { fill: 'none', stroke: c, sw: 4.4 }), ellipse(166, 196, 13, 13, { fill: 'none', stroke: c, sw: 1.6, op: 0.7 }), ellipse(170, 199, 6, 6, { fill: 'none', stroke: GLOW, sw: 1.2, op: 0.7 }),
  path('M 150 186 Q 156 176 172 176', stroke('#fff', 1.8, 0.5)), ellipse(186, 182, 2.2, 2.2, fp(GLOW))];

// --- the torso ---
/** A chassis for a torso: the head's shadow at the throat, a collar ring, shoulder plates lapping over the chest with a lit top edge and a shadow beneath, a bevelled chest plate with the core let into it, and the abdomen in overlapping bands. */
TOPS.chassis = (p) => { const c = p.top.color, dark = shade(c, 0.55), lite = shade(c, 1.28), core = p.top.accent ?? GLOW, sd = lightSide(p); return [
  torso('M 62 480 C 76 384, 122 354, 158 344 L 242 344 C 278 354, 324 384, 338 480 Z', c),
  ...soft(200 - sd * 110, 470, 70, 150, '#000', 0.3), // the far side of the trunk turns away from the light
  ...[0, 1, 2, 3].flatMap((i) => { const y = 466 + i * 26, d = `M ${152 - i * 3} ${y} Q 200 ${y + 8} ${248 + i * 3} ${y}`; return [path(`${d} L ${248 + i * 3} ${y + 24} Q 200 ${y + 32} ${152 - i * 3} ${y + 24} Z`, fp(shade(c, 0.9 - i * 0.04))), path(d, stroke('#000', 5, 0.2)), path(d, stroke(LIT, 1.2, 0.35))]; }), // the abdomen's bands, each lapping the one below
  path('M 150 386 L 250 386 L 240 452 Q 200 462 160 452 Z', fp(dark)), path('M 150 386 L 250 386', stroke(LIT, 1.6, 0.5)), path('M 160 452 Q 200 462 240 452', stroke('#000', 4, 0.3)), path('M 200 392 L 200 404', stroke('#000', 1.6, 0.4)), // the chest plate: lit top bevel, shadow below
  ...[-1, 1].flatMap((s) => { const x = (k) => 200 + s * k, d = `M ${x(44)} 352 C ${x(94)} 348, ${x(138)} 372, ${x(150)} 422 L ${x(114)} 434 C ${x(104)} 400, ${x(78)} 388, ${x(46)} 386 Z`; return [
    path(`M ${x(46)} 390 C ${x(78)} 392, ${x(104)} 404, ${x(112)} 440`, stroke('#000', 8, 0.18)), path(d, fp(lite)), // the shoulder plate's shadow on the chest, the plate
    path(`M ${x(46)} 354 C ${x(94)} 350, ${x(136)} 374, ${x(148)} 420`, stroke(s === sd ? '#fff' : LIT, 2, s === sd ? 0.55 : 0.2)), path(`M ${x(114)} 434 C ${x(104)} 400, ${x(78)} 388, ${x(46)} 386`, stroke(DEEP, 1.6, 0.6)),
    ...bolt(x(70), 372), ...bolt(x(122), 400)]; }),
  path('M 156 350 Q 200 368 244 350 L 240 338 Q 200 352 160 338 Z', fp(dark)), path('M 158 351 Q 200 369 242 351', stroke(LIT, 1.2, 0.4)), // the ring at the neck
  ...soft(200, 362, 56, 16, '#000', 0.4), // the head's shadow at the throat
  ellipse(200, 420, 20, 20, fp(DEEP)), ellipse(200, 420, 20, 20, { fill: 'none', stroke: lite, sw: 2, op: 0.6 }), ellipse(200, 420, 16, 16, fp(core, 0.25)), ellipse(200, 420, 9, 9, fp(core)), ellipse(200, 420, 4.5, 4.5, fp('#f2fdff', 0.85)), ellipse(196, 416, 2, 2, fp('#fff', 0.9))]; };

// --- arms: on portrait.mjs's `arm`, the garment's shoulder kept and the machine from there down ---
const at = (A, B, along, across) => { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, u = [dx / L, dy / L]; return [B[0] + u[0] * along - u[1] * across, B[1] + u[1] * along + u[0] * across]; };
/** A metal segment from A to B, `w0` wide at A and `w1` at B: the plate, a dark edge on the side away from the light, a lit stripe on the near side. */
const limb = (A, B, w0, w1, sd) => {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, n = [-dy / L, dx / L], off = (P, w) => [P[0] + n[0] * w, P[1] + n[1] * w], q = (P, w) => off(P, w).map(R).join(' '), lit = Math.sign(n[0]) === sd ? 1 : -1;
  return [path(`M ${q(A, w0 / 2)} L ${q(B, w1 / 2)} L ${q(B, -w1 / 2)} L ${q(A, -w0 / 2)} Z`, fp(METAL)),
    line(...off(A, -lit * w0 * 0.36), ...off(B, -lit * w1 * 0.36), stroke(DEEP, 7, 0.4)), // the edge turned from the light
    line(...off(A, lit * w0 * 0.28), ...off(B, lit * w1 * 0.28), stroke('#fff', 3, 0.35))]; // the lit stripe
};
const joint = (x, y, r) => [ellipse(x, y, r, r, fp(DARK)), ellipse(x, y, r * 0.55, r * 0.55, fp(METAL)), ellipse(x - r * 0.2, y - r * 0.25, r * 0.22, r * 0.22, fp('#fff', 0.6))];
const reach = (p, side, lift, P) => { const ak = Math.max(0.3, Math.min(3, +(p.build?.arms ?? 1) || 1)), sx = 200 + 86 * side - (16 - 24 * lift) * side, sy = 398 - 8 * lift; return [sx + (P[0] - sx) * ak, sy + (P[1] - sy) * ak]; }; // where `arm` puts a joint for this build
/** A mechanical hand at wrist W, pointing on from the forearm E→W: a palm plate, four jointed fingers, a thumb on the `thumb` side. */
const mechHand = (E, W, thumb, sd, k = 1) => {
  const pt = (a, c) => at(E, W, a * k, c * k), P = (v) => `${R(v[0])} ${R(v[1])}`, out = [];
  out.push(path(`M ${P(pt(-4, -15))} L ${P(pt(30, -16))} L ${P(pt(32, 15))} L ${P(pt(-4, 14))} Z`, fp(METAL)), path(`M ${P(pt(30, -16))} L ${P(pt(32, 15))}`, stroke(DEEP, 2, 0.5)), ...soft(...pt(14, 0), 8 * k, 8 * k, DEEP, 0.4));
  [-11.5, -4, 3.5, 11].forEach((c, i) => { const len = i === 0 || i === 3 ? 22 : 27, a = pt(31, c), m = pt(31 + len * 0.5, c * 1.05), b = pt(31 + len, c * 1.1); for (const [w, col, op] of [[8.5, DEEP, 1], [6, METAL, 1]]) out.push(path(`M ${P(a)} L ${P(m)} L ${P(b)}`, stroke(col, w * k, op))); out.push(...[a, m].map((v) => ellipse(v[0], v[1], 2.2 * k, 2.2 * k, fp(DARK))), ellipse(b[0], b[1], 1.4 * k, 1.4 * k, fp('#fff', 0.4))); });
  const t0 = pt(4, thumb * 13), tm = pt(14, thumb * 22), t1 = pt(26, thumb * 25); for (const [w, col] of [[9, DEEP], [6.5, METAL]]) out.push(path(`M ${P(t0)} L ${P(tm)} L ${P(t1)}`, stroke(col, w * k))); out.push(...[t0, tm].map((v) => ellipse(v[0], v[1], 2.3 * k, 2.3 * k, fp(DARK))));
  return out;
};
/** A metal forearm from the elbow E to the wrist W: the tube, a band at each third, a piston along its inner side and the two joints. */
const forearm = (E, W, sd) => { const len = Math.hypot(W[0] - E[0], W[1] - E[1]), piston = [at(E, W, 12 - len, 13), at(E, W, -14, 13)]; return [...limb(E, W, 46, 36, sd), ...[0.33, 0.66].map((t) => { const a = at(E, W, -(1 - t) * Math.hypot(W[0] - E[0], W[1] - E[1]), -18), b = at(E, W, -(1 - t) * Math.hypot(W[0] - E[0], W[1] - E[1]), 18); return line(a[0], a[1], b[0], b[1], stroke(DEEP, 2, 0.6)); }), line(...piston[0], ...piston[1], stroke(DEEP, 5)), line(...piston[0], ...piston[1], stroke(LIT, 1.4, 0.6)), ...joint(...E, 15), ...joint(...W, 10)]; };
export const CYBORG_PROPS = {
  /** The right forearm and hand are machine, raised beside the face with the hand open: the sleeve to the elbow, the metal from there. */
  mechHand: { lift: [1], front: (p) => { const sd = lightSide(p), E = reach(p, 1, 1, [326, 478]), W = reach(p, 1, 1, [294, 362]); return [...arm(p, 1, { lift: 1, elbow: [326, 478], wrist: [325, 472], hand: false }), ...forearm(E, W, sd), ...mechHand(E, W, -1, sd, 1.3)]; } },
  /** The whole left arm is machine, hanging: the garment's shoulder cap, then a plated upper arm, the elbow, the forearm and a hand at the hip. */
  mechArm: { arms: [-1], front: (p) => {
    const sd = lightSide(p), k = p.build?.trunk ?? 1, ty = (y) => 356 + (y - 356) * k, S = [122.8, 395.6] /* the left shoulder joint at lift .3, as `arm` has it */,e0 = [96, ty(540)], E = reach(p, -1, 0.3, e0), W = reach(p, -1, 0.3, [90, ty(690)]), cap = [S[0] + (E[0] - S[0]) * 0.28, S[1] + (E[1] - S[1]) * 0.28];
    const stub = (t) => [S[0] + (e0[0] - S[0]) * t, S[1] + (e0[1] - S[1]) * t]; // the sleeve to a cap a quarter down the upper arm, as `arm` would place it for this build
    return [...arm(p, -1, { lift: 0.3, elbow: stub(0.28), wrist: stub(0.29), hand: false }),
      ...limb(cap, E, 46, 40, sd), ...[0.35, 0.7].map((t) => { const a = [cap[0] + (E[0] - cap[0]) * t - 22, cap[1] + (E[1] - cap[1]) * t], b = [a[0] + 44, a[1] + 2]; return line(...a, ...b, stroke(DEEP, 2, 0.6)); }), ...bolt(cap[0] + 12, cap[1] + 34), ...bolt(cap[0] - 12, cap[1] + 36),
      ...forearm(E, W, sd), ...mechHand(E, W, 1, sd, 1.1)];
  } },
};
Object.assign(PROPS, CYBORG_PROPS);

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const CYBORG = { makeup: ['ocularImplant', 'halfPlate', 'jawPlate', 'browPlate', 'templePort', 'earReceiver', 'circuitLines', 'neckCabling'], tops: ['chassis'], glasses: ['visorBar', 'lensRig'], props: Object.keys(CYBORG_PROPS) };
for (const n of CYBORG.makeup) tag('makeup', n, 'only:cyborg');
for (const n of CYBORG.tops) tag('top', n, 'only:cyborg');
for (const n of CYBORG.glasses) tag('glasses', n, 'only:cyborg');
for (const n of CYBORG.props) tag('props', n, 'only:cyborg');
