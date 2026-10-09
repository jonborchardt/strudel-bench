// The alien pack: what the aliens cast (casts/aliens.mjs) wears that nobody else does, tagged `only:alien`. The heads
// themselves are not here: a grey's eye black from corner to corner, a reptile's slit pupil and its short snout are the
// portrait's own dials (`eyes.size`, `eyes.white`, `eyes.slit`, `nose.muzzle`, the `none` brow), which the archetypes
// pin. What is here is drawn on, the way the tieflings' horns are, and most of it is tone rather than line: the light
// on a grey's cranium and the wet gloss on its eye, a green's brain lobes and antennae, a reptile's scales (a field of
// lit and shadowed plates, not arcs) and the bony ridges over its eyes, an insect's chitin plates, compound facets,
// mandibles and feelers. And five things to wear. parts.html?pack=alien is the sheet.
import { TOPS, MAKEUP, EYES, NECKLINES, featureScale, eyeShape, shade, mix, soft, path, ellipse, stroke, clip, UNCLIP, facePath } from '../portrait.mjs';
import { tagPack, torso, SHOULDERS, f1, sideOf } from './pen.mjs';
const onHead = (p, ops) => [clip(facePath(p)), ...ops, UNCLIP]; // skull tones stay inside the outline: a soft shadow laid out on the face's width spills past a head that narrows to the jaw, a grey smudge beside it

const DARK = '#141418'; // the tone every shadow here is laid in: a neutral dark, so it deepens a skin without tinting it (a violet one bruised the greys)
const unit = (v) => Math.max(0, Math.min(1, v ?? 0));

/** One eye's outline: the portrait's own (`eyeShape`), so a gloss or a facet field is clipped to exactly the eye drawn, tilt and all. */
function lidOf(p, side) { const E = eyeShape(p, side); return { d: E.lid, cx: E.cx, y: E.y, w: E.w, th: E.th, bh: E.bh, xo: E.xo, yo: E.yo, k: E.k }; }

/** A grey's head as a volume: the cranium's dome lit on one side, the temples hollowed under it, the cheeks sunk under
 *  the eyes and a long soft shadow down the far side to the narrow chin. Laid out on this face, under the modelling. */
MAKEUP.greyCranium = { skin: (p) => { const w = p.face.width / 2, h = p.face.height, t = 112, sd = sideOf(p), ey = p.eyes.y; return onHead(p, [
  ...soft(200 + sd * w * 0.22, t + h * 0.2, w * 0.62, h * 0.17, '#ffffff', 0.34), // the dome catching the light
  ...soft(200 + sd * w * 0.34, t + h * 0.16, w * 0.22, h * 0.07, '#ffffff', 0.3), // and its hottest point
  ...[-1, 1].flatMap((s) => soft(200 + s * w * 0.86, t + h * 0.46, w * 0.2, h * 0.16, DARK, s === sd ? 0.12 : 0.22)), // the temples, where the skull narrows into the face
  ...[-1, 1].flatMap((s) => soft(200 + s * w * 0.4, ey + 34, w * 0.18, 12, DARK, s === sd ? 0.05 : 0.1)), // the hollow cheeks under the eyes
  ...soft(200, t + h * 0.05, w * 0.5, h * 0.06, DARK, 0.06)]); } };
/** The black eye's wet gloss: a cool reflected light along the lower lid, a sky window on the upper curve and one hard
 *  glint, all on the lit side and clipped to the eye, so the black reads as a convex lens and not a hole. */
MAKEUP.eyeGloss = { face: (p) => { const sd = sideOf(p); return [-1, 1].flatMap((side) => { const L = lidOf(p, side); if (L.th + L.bh < 2) return []; return [
  clip(L.d),
  ...soft(L.cx, L.y + L.bh * 0.55, L.w * 0.75, L.bh * 0.55 + 2, '#7d8fb0', 0.5), // the light bounced up off the cheek
  path(`M ${f1(L.cx + sd * L.w * 0.75)} ${f1(L.y - L.th * 0.1)} Q ${f1(L.cx + sd * L.w * 0.35)} ${f1(L.y - L.th * 0.62)} ${f1(L.cx - sd * L.w * 0.25)} ${f1(L.y - L.th * 0.42)}`, stroke('#dfe8f4', 2.6 * L.k, 0.32)), // the window along the top
  ellipse(f1(L.cx + sd * L.w * 0.42), f1(L.y - L.th * 0.2), 2.4 * L.k, 1.7 * L.k, { fill: '#ffffff', op: 0.9 }), // the glint
  UNCLIP]; }); } };
/** An insect's compound eye: rows of facets over the whole eye, each a lit ring, with a green-gold sheen across them. */
MAKEUP.compoundEyes = { face: (p) => { const sd = sideOf(p); return [-1, 1].flatMap((side) => { const L = lidOf(p, side), step = 3.6 * L.k, out = [clip(L.d), ...soft(L.cx + sd * L.w * 0.3, L.y - L.th * 0.2, L.w * 0.7, L.th * 0.7 + 2, '#8fae5a', 0.45)];
  for (let r = 0, y = L.y - L.th; y < L.y + L.bh + step; r++, y += step * 0.86) for (let x = L.cx - L.w - step + (r % 2) * step / 2; x < L.cx + L.w + step; x += step) out.push(ellipse(f1(x), f1(y), f1(step * 0.42), f1(step * 0.42), stroke('#d8e6b0', 0.7, 0.28)));
  out.push(ellipse(f1(L.cx + sd * L.w * 0.4), f1(L.y - L.th * 0.25), 2.2 * L.k, 1.6 * L.k, { fill: '#ffffff', op: 0.7 }), UNCLIP); return out; }); } };

/** Two antennae off the crown, curving out, each ending in a bulb; on the `over` slot, so nothing on the head hides them. */
MAKEUP.antennae = { fit: 'face', over: (p) => { const dark = shade(p.skin, 0.6), light = mix(p.skin, '#ffffff', 0.4); return [-1, 1].flatMap((s) => [
  path(`M ${200 + s * 20} 104 C ${200 + s * 24} 70, ${200 + s * 44} 46, ${200 + s * 60} 30`, stroke(dark, 5, 1)),
  path(`M ${200 + s * 19} 100 C ${200 + s * 23} 70, ${200 + s * 42} 48, ${200 + s * 57} 33`, stroke(light, 1.6, 0.5)),
  ellipse(200 + s * 62, 27, 9, 9, { fill: p.skin }), ellipse(200 + s * 63, 29, 9, 9, { fill: dark, op: 0.35 }), ellipse(200 + s * 59, 24, 3, 3, { fill: '#ffffff', op: 0.75 })]); } };
/** A green's swollen cranium: two lobes either side of a groove down the middle of the forehead, each lit on its crown. */
MAKEUP.craniumLobes = { skin: (p) => { const w = p.face.width / 2, h = p.face.height, t = 112, sd = sideOf(p); return onHead(p, [
  path(`M 200 ${t + 4} C 197 ${t + h * 0.12}, 203 ${t + h * 0.22}, 200 ${t + h * 0.32}`, stroke(DARK, 6, 0.1)), path(`M 200 ${t + 6} C 197 ${t + h * 0.12}, 203 ${t + h * 0.2}, 200 ${t + h * 0.28}`, stroke(DARK, 1.2, 0.16)), // the groove
  ...[-1, 1].flatMap((s) => soft(200 + s * w * 0.42, t + h * 0.16, w * 0.36, h * 0.14, '#ffffff', s === sd ? 0.5 : 0.26)), // a lobe each side, the lit one brighter
  ...[-1, 1].flatMap((s) => [0, 1].map((i) => path(`M ${f1(200 + s * w * (0.2 + i * 0.3))} ${f1(t + h * (0.1 + i * 0.05))} q ${f1(s * w * 0.12)} ${f1(h * 0.06)} ${f1(s * w * 0.06)} ${f1(h * 0.14)}`, stroke(DARK, 1.4, 0.12)))), // the folds of the lobes, faint
  ...soft(200 - sd * w * 0.6, t + h * 0.6, w * 0.32, h * 0.28, DARK, 0.1)]); } };

/** A reptile's hide as tone: a field of overlapping scales over the crown, the temples and the cheeks, each lit along its
 *  top and shadowed under its lip, thinning out toward the centre of the face where the skin is smoother, and a pale
 *  belly-scale throat under the jaw. Laid out on this face, under the modelling, so the planes still model it. */
MAKEUP.reptileScales = { skin: (p) => { const w = p.face.width / 2, h = p.face.height, t = 112, lite = mix(p.skin, '#fff6d0', 0.3), dk = shade(p.skin, 0.55), out = [];
  for (let r = 0; r < 20; r++) { const y = t + 4 + r * 10.5, sw = 14; for (let c = -8; c <= 8; c++) {
    const x = 200 + c * 12 + (r % 2) * 6, nx = (x - 200) / (w * 0.9), ny = (y - (t + h * 0.5)) / (h * 0.52); if (nx * nx + ny * ny > 0.86) continue; // inside the head
    const centre = Math.abs(x - 200) < w * 0.3 && y > p.eyes.y - 16; if (centre) continue; // the eyes, the snout and the mouth are smooth
    const a = 0.2 + 0.3 * Math.min(1, Math.abs(nx) + Math.max(0, -ny) * 0.8), j = Math.sin(r * 12.9898 + c * 78.233) * 0.5 + 0.5; // stronger toward the edges and the crown; j a fixed per-scale jitter, so no two neighbours are one tone
    out.push(path(`M ${f1(x - sw / 2)} ${f1(y)} C ${f1(x - sw / 2)} ${f1(y + sw * 0.7)}, ${f1(x + sw / 2)} ${f1(y + sw * 0.7)}, ${f1(x + sw / 2)} ${f1(y)} Z`, { fill: j > 0.5 ? lite : dk, op: f1(a * (0.25 + 0.35 * Math.abs(j - 0.5)) * 100) / 100 }), // the plate, a shade off its neighbours
      path(`M ${f1(x - sw / 2)} ${f1(y)} C ${f1(x - sw / 2)} ${f1(y + sw * 0.7)}, ${f1(x + sw / 2)} ${f1(y + sw * 0.7)}, ${f1(x + sw / 2)} ${f1(y)}`, stroke(dk, 1.2, f1(a * 100) / 100)));  // and its lower lip in shadow
  } }
  return [...out, ...soft(200, t + h * 0.93, w * 0.4, h * 0.08, '#f2e6b0', 0.22)]; } }; // the throat
/** Bony ridges over a reptile's eyes and a row of studs up the midline of the skull: heavy brows lit along the top and
 *  casting a shadow over the eye, and studs that shrink toward the crown. Drawn on the face (over the eyes, so the
 *  ridge's shadow falls on them), laid out on this face. Replaced the first pass's crest of stacked fins, which read as
 *  a small pine tree on the head. */
MAKEUP.browRidge = { face: (p) => { const w = p.face.width / 2, h = p.face.height, t = 112, ey = p.eyes.y, sp = p.eyes.spacing / 2, sk = p.skin, dk = shade(sk, 0.5), lt = mix(sk, '#ffffff', 0.32), sd = sideOf(p); return [
  ...[-1, 1].flatMap((s) => { const x0 = 200 + s * (sp - 22), x1 = 200 + s * (sp + 30), y = ey - 14; return [
    ...soft(200 + s * sp, ey - 4, 30, 9, DARK, 0.3), // the shadow the ridge drops into the socket
    path(`M ${x0} ${y + 4} Q ${200 + s * sp} ${y - 16} ${x1} ${y - 2} Q ${200 + s * (sp + 6)} ${y - 4} ${x0} ${y + 4} Z`, { fill: shade(sk, 1.08) }), // the ridge
    path(`M ${x0 + s * 4} ${y} Q ${200 + s * sp} ${y - 15} ${x1 - s * 4} ${y - 3}`, stroke(lt, 2.4, s === sd ? 0.6 : 0.3)), // lit along its top
    path(`M ${x0} ${y + 4} Q ${200 + s * (sp + 6)} ${y - 3} ${x1} ${y - 2}`, stroke(dk, 1.6, 0.5))]; }), // and dark under its lip
  ...[0, 1, 2, 3, 4].filter((i) => ey - 40 - i * h * 0.075 > t + 12).flatMap((i) => { const y = ey - 40 - i * h * 0.075, r = 5 - i * 0.6; return [ellipse(200, f1(y), f1(r * 1.1), f1(r), { fill: shade(sk, 0.82) }), ellipse(200 + sd * 1.2, f1(y - 1), f1(r * 0.64), f1(r * 0.45), { fill: lt, op: 0.55 })]; })]; } }; // the studs stop short of the crown: one standing on the skyline reads as a bead on a wire
/** An insect's head as plates of chitin: a seam down the middle of the brow, a plate over each eye and one down each
 *  cheek, every plate lit on its upper edge and darkened along the lower, so the head reads as a shell. */
MAKEUP.carapace = { skin: (p) => { const w = p.face.width / 2, h = p.face.height, t = 112, ey = p.eyes.y, dk = shade(p.skin, 0.5), lt = mix(p.skin, '#ffffff', 0.35), sd = sideOf(p); return onHead(p, [
  path(`M 200 ${t + 2} L 200 ${ey - 14}`, stroke(dk, 2.4, 0.5)), path(`M ${200 + sd * 2} ${t + 4} L ${200 + sd * 2} ${ey - 16}`, stroke(lt, 1.2, 0.4)), // the seam
  ...[-1, 1].flatMap((s) => [
    path(`M ${200 + s * 6} ${ey - 26} Q ${200 + s * w * 0.55} ${ey - 52} ${200 + s * w * 0.92} ${ey - 20}`, stroke(dk, 2, 0.45)), // the brow plate's edge
    path(`M ${200 + s * 6} ${ey - 28} Q ${200 + s * w * 0.55} ${ey - 54} ${200 + s * w * 0.9} ${ey - 23}`, stroke(lt, 1.2, s === sd ? 0.5 : 0.25)),
    path(`M ${200 + s * w * 0.34} ${ey + 26} Q ${200 + s * w * 0.62} ${ey + 30} ${200 + s * w * 0.46} ${t + h * 0.74}`, stroke(dk, 2, 0.4)), // the cheek plate's seam
    ...soft(200 + s * w * 0.55, t + h * 0.22, w * 0.3, h * 0.1, '#ffffff', s === sd ? 0.26 : 0.1)]), // each brow plate lit on its dome
  ...soft(200 - sd * w * 0.58, t + h * 0.66, w * 0.3, h * 0.25, DARK, 0.14)]); } };
/** An insect's mouthparts: a hooked mandible either side of the mouth, closing toward the chin, lit on its outer curve. */
MAKEUP.mandibles = { mouth: (p) => { const my = p.mouth.y, hw = Math.max(p.mouth.width, 24) / 2, c = shade(p.skin, 0.42), lt = mix(p.skin, '#ffffff', 0.55); return [-1, 1].flatMap((s) => { const x0 = 200 + s * (hw + 18), x1 = 200 + s * 7, y1 = my + 50; return [ // the tips hang past the chin: inside the face they read as a mouth
  path(`M ${x0 + s * 7} ${my - 10} C ${x0 + s * 12} ${my + 14}, ${x1 + s * 14} ${y1 - 4}, ${x1} ${y1} C ${x1 + s * 6} ${y1 - 14}, ${x0 - s * 2} ${my + 12}, ${x0 - s * 6} ${my - 6} Z`, { fill: c }), // the mandible: a blade from the cheek curving down and in to a point under the chin, dark and glossy
  path(`M ${x0 + s * 6} ${my - 6} C ${x0 + s * 10} ${my + 14}, ${x1 + s * 13} ${y1 - 7}, ${x1 + s * 3} ${y1 - 3}`, stroke(lt, 1.4, 0.55)), // its outer curve catching the light
  ...[0, 1, 2].map((i) => { const u = 0.3 + i * 0.2, x = x0 - s * 6 + (x1 - x0 + s * 6) * u, y = my - 6 + (y1 - my + 6) * u ** 1.3; return path(`M ${f1(x)} ${f1(y)} l ${-s * 3} ${-2}`, stroke(lt, 1.2, 0.5)); })]; }); } }; // and the teeth on its inner edge
/** An insect's feelers: long, thin and jointed, swept back off the brow and over the head. */
MAKEUP.feelers = { fit: 'face', over: (p) => { const dk = shade(p.skin, 0.45); return [-1, 1].flatMap((s) => [
  path(`M ${200 + s * 14} 138 C ${200 + s * 18} 90, ${200 + s * 60} 50, ${200 + s * 110} 40`, stroke(dk, 2.6, 1)),
  ...[0.2, 0.36, 0.52, 0.68, 0.84].map((u) => { const v = 1 - u, bz = (a, b, c, d) => v ** 3 * a + 3 * v * v * u * b + 3 * v * u * u * c + u ** 3 * d; return ellipse(f1(200 + s * bz(14, 18, 60, 110)), f1(bz(138, 90, 50, 40)), 2.6, 2.6, { fill: dk }); }), // the joints, on the curve
  ellipse(200 + s * 112, 40, 3, 2.2, { fill: dk })]); } };

/** A nordic's circlet: a fine silver band across the brow over the hair, a pale stone at its centre. */
MAKEUP.circlet = { fit: 'face', over: () => [
  path('M 122 158 Q 200 132 278 158', stroke('#5a6470', 3.4, 0.5)), path('M 122 157 Q 200 131 278 157', stroke('#e8eef4', 1.8, 0.95)),
  path('M 200 136 L 207 146 L 200 158 L 193 146 Z', { fill: '#8fd0f0' }), path('M 200 136 L 207 146 L 200 158 L 193 146 Z', stroke('#4a6f88', 1, 0.6)), ellipse(198, 143, 1.8, 2.4, { fill: '#ffffff', op: 0.8 })] };
/** A close silver suit: a ring for a collar, a seam down the centre and a disc on the chest of three rings, pale panels on the shoulders. */
TOPS.silverSuit = (p) => { const c = p.top.color, a = p.top.accent ?? '#c9d2d8', dark = shade(c, 0.6); return [
  torso(SHOULDERS, c),
  ...[-1, 1].map((s) => path(`M ${200 + s * 40} 352 C ${200 + s * 90} 362, ${200 + s * 120} 390, ${200 + s * 132} 450 L ${200 + s * 108} 452 C ${200 + s * 100} 410, ${200 + s * 80} 384, ${200 + s * 36} 372 Z`, { fill: shade(c, 1.12) })), // the shoulder panels
  ...[-1, 1].map((s) => path(`M ${200 + s * 36} 372 C ${200 + s * 80} 384, ${200 + s * 100} 410, ${200 + s * 108} 452`, stroke(dark, 1.6, 0.5))),
  path('M 158 346 Q 200 366 242 346 L 238 334 Q 200 352 162 334 Z', { fill: a }), path('M 160 344 Q 200 362 240 344', stroke(dark, 1.4, 0.5)),
  path('M 200 362 L 200 700', stroke(dark, 2, 0.5)),
  ...[16, 10, 4].map((r, i) => ellipse(200, 418, r, r, i === 2 ? { fill: a } : stroke(a, 2, 0.8))), ellipse(201, 420, 17, 17, stroke('#000000', 1.4, 0.15))]; };
/** An envoy's robe: a collar that flares up and out past the shoulders, and a band down the front. */
TOPS.envoyRobe = (p) => { const c = p.top.color, a = p.top.accent ?? '#c9a03c', dark = shade(c, 0.6), lt = shade(c, 1.35); return [
  torso(SHOULDERS, c),
  ...[-1, 1].map((s) => path(`M ${200 + s * 30} 350 C ${200 + s * 70} 340, ${200 + s * 120} 310, ${200 + s * 150} 270 C ${200 + s * 140} 330, ${200 + s * 108} 372, ${200 + s * 60} 384 Z`, { fill: dark, collar: true })), // the flared collar, marked so it is drawn over the shoulders' line and not cut by the trunk
  ...[-1, 1].map((s) => path(`M ${200 + s * 36} 352 C ${200 + s * 74} 344, ${200 + s * 118} 316, ${200 + s * 146} 278`, { ...stroke(lt, 2, 0.45), collar: true })), // its lit inner rim
  ...[-1, 1].map((s) => path(`M ${200 + s * 60} 384 C ${200 + s * 108} 372, ${200 + s * 140} 330, ${200 + s * 150} 270`, { ...stroke(a, 2, 0.8), collar: true })), // its gold edge
  path('M 186 360 L 214 360 L 214 700 L 186 700 Z', { fill: a, op: 0.85 }), path('M 186 360 L 186 700', stroke(dark, 1.4, 0.4)),
  ...[0, 1, 2].map((i) => ellipse(200, 400 + i * 30, 5, 5, { fill: dark }))]; };
/** A flight suit: a dark one-piece with a diagonal chest panel, a stand collar, piping down the arms and a rank bar. */
TOPS.flightSuit = (p) => { const c = p.top.color, a = p.top.accent ?? '#6fe0ff', dark = shade(c, 0.6), lt = mix(c, '#ffffff', 0.35); return [
  torso(SHOULDERS, c),
  path('M 150 356 L 262 356 L 300 470 L 300 700 L 220 700 L 220 470 Z', { fill: mix(c, '#ffffff', 0.13) }), // the panel crossing the chest
  path('M 150 356 L 220 470 L 220 700', stroke(dark, 2, 0.6)), path('M 152 356 L 222 468', stroke(lt, 1, 0.35)),
  ...[-1, 1].map((s) => path(`M ${200 + s * 104} 410 C ${200 + s * 112} 450, ${200 + s * 118} 520, ${200 + s * 120} 700`, stroke(a, 2.4, 0.75))), // piping down the arms
  path('M 162 350 Q 200 364 238 350 L 240 336 Q 200 352 160 336 Z', { fill: dark }), path('M 162 338 Q 200 354 238 338', stroke(a, 1.4, 0.7)), // the stand collar
  path('M 112 404 L 148 404 L 148 412 L 112 412 Z', { fill: a, op: 0.9 }), ...[0, 1, 2].map((i) => ellipse(118 + i * 10, 422, 2, 2, { fill: lt }))]; }; // the rank bar and three pips
NECKLINES.flightSuit = 'M 162 350 Q 200 364 238 350';
/** War plate: overlapping bands of shell across the chest, each lit along its top edge, with a heavy gorget at the throat. */
TOPS.warPlate = (p) => { const c = p.top.color, a = p.top.accent ?? '#c9a03c', dark = shade(c, 0.5), lt = shade(c, 1.45); return [
  torso(SHOULDERS, c),
  ...[0, 1, 2, 3, 4, 5].flatMap((i) => { const y = 400 + i * 34, bow = 16; return [
    path(`M 70 ${y} Q 200 ${y + bow} 330 ${y} L 330 ${y + 30} Q 200 ${y + bow + 30} 70 ${y + 30} Z`, { fill: i % 2 ? c : shade(c, 1.08) }),
    path(`M 70 ${y} Q 200 ${y + bow} 330 ${y}`, stroke(lt, 2, 0.45)), path(`M 70 ${y + 30} Q 200 ${y + bow + 30} 330 ${y + 30}`, stroke(dark, 3, 0.55))]; }),
  ...[-1, 1].map((s) => path(`M ${200 + s * 40} 352 C ${200 + s * 96} 352, ${200 + s * 130} 380, ${200 + s * 140} 430 C ${200 + s * 110} 420, ${200 + s * 80} 404, ${200 + s * 30} 398 Z`, { fill: shade(c, 1.15) })), // the pauldrons' near edges
  path('M 156 346 Q 200 372 244 346 L 248 384 Q 200 410 152 384 Z', { fill: dark }), path('M 154 384 Q 200 410 246 384', stroke(a, 2.4, 0.8)), // the gorget, gold at the rim
  ellipse(200, 392, 7, 7, { fill: a }), ellipse(198, 390, 2.4, 2.4, { fill: '#ffffff', op: 0.6 })]; };
/** A tall pale tunic with a stiff collar standing up behind the head's line and one stone at the clasp. */
TOPS.highCollar = (p) => { const c = p.top.color, a = p.top.accent ?? '#7fb8d8', dark = shade(c, 0.72), lt = mix(c, '#ffffff', 0.5); return [
  torso(SHOULDERS, c),
  ...[-1, 1].map((s) => path(`M ${200 + s * 22} 372 C ${200 + s * 40} 350, ${200 + s * 56} 320, ${200 + s * 58} 290 C ${200 + s * 72} 318, ${200 + s * 82} 348, ${200 + s * 84} 372 Z`, { fill: shade(c, 0.9), collar: true })), // the collar's two wings, standing above the shoulders
  ...[-1, 1].map((s) => path(`M ${200 + s * 24} 370 C ${200 + s * 42} 348, ${200 + s * 56} 320, ${200 + s * 58} 292`, { ...stroke(lt, 1.6, 0.6), collar: true })),
  path('M 200 380 L 200 700', stroke(dark, 1.6, 0.5)), ...[-1, 1].map((s) => path(`M ${200 + s * 6} 400 C ${200 + s * 40} 470, ${200 + s * 70} 560, ${200 + s * 80} 700`, stroke(dark, 1.4, 0.3))), // the seams the cut falls along
  path('M 200 378 L 210 390 L 200 404 L 190 390 Z', { fill: a }), path('M 196 386 L 200 382 L 204 386', stroke('#ffffff', 1, 0.7))]; };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const ALIEN = { makeup: ['greyCranium', 'eyeGloss', 'compoundEyes', 'antennae', 'craniumLobes', 'reptileScales', 'browRidge', 'carapace', 'mandibles', 'feelers', 'circlet'], tops: ['silverSuit', 'envoyRobe', 'flightSuit', 'warPlate', 'highCollar'] };
tagPack(ALIEN, 'only:alien');
