// The robot pack: what the robots cast (casts/robots.mjs) wears that nobody else does, tagged `only:robot`. The face
// itself is not here: a robot's eyes, mouth, ears and nose are the portrait's own machine modes (`eyes.mode`,
// `mouth.mode`, `ears.mode`, `nose.mode`, see machineEye in portrait.mjs), driven by the same expression dials as a
// face, and its plating is its skin colour. What is here is what makes that skin read as metal and the head as a
// made one: the plating's own light (a far side gone dark, a hard specular streak), the faceplate let into the shell,
// a jaw piece, cheek vents, a status light, and a plated torso. Every head mark is built on this face's own outline
// (`facePath`), so it fits any head the cast draws. parts.html?pack=robot is the sheet.
import { TOPS, MAKEUP, shade, mix, path, ellipse, stroke, soft, clip, UNCLIP, mapXY, scaleAbout, facePath, tag } from '../portrait.mjs';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill });
const R = (v) => Math.round(v * 10) / 10;
const dims = (p) => ({ w: p.face.width / 2, h: p.face.height, bot: 112 + p.face.height + 16 * (p.face.chin ?? 0), sd: p.light.side || -1 });
/** A groove cut between two plates: its dark gap, and the lit lip of the plate below it. */
const groove = (d, skin, sw = 1.8) => [path(d, stroke(shade(skin, 0.42), sw, 0.75)), ...mapXY([path(d, stroke(shade(skin, 1.6), 1.1, 0.5))], (x) => x, (y) => y + 1.5)];
/** A rivet: a dome with its light on top and its shadow under. */
const rivet = (x, y, skin, r = 2.6) => [ellipse(R(x), R(y + 1.2), r, r, { fill: '#000000', op: 0.3 }), ellipse(R(x), R(y), r, r, { fill: shade(skin, 0.85) }), ellipse(R(x - r * 0.3), R(y - r * 0.35), r * 0.45, r * 0.4, { fill: '#ffffff', op: 0.55 })];
/** The faceplate: the face's own outline drawn in to the front of the head, from just above the brow to just above the chin. */
const plateOf = (p) => { const { bot } = dims(p), yS = p.eyes.y - 44, yB = bot - 7;
  return mapXY([path(facePath(p))], scaleAbout(200, 0.8), (y) => yS + ((y - 112) * (yB - yS)) / (bot - 112))[0].d; };
const corners = (d) => { const n = d.match(/-?[\d.]+/g).map(Number), out = []; for (let i = 2; i + 5 < n.length; i += 6) out.push([n[i + 4], n[i + 5]]); return out; }; // each cubic's end: the plate's left cheek, left jaw, chin, right jaw, right cheek, top

/** The plating's light: metal is not modelled like skin. Its far side falls off hard into shadow, the lit side takes
 *  a narrow specular streak down the cranium and the cheek, the crown a broad sheen. Drawn on the skin, under the
 *  features, inside the head. */
MAKEUP.plating = { skin: (p) => { const { w, h, sd } = dims(p), d = facePath(p), lit = 200 + sd * w * 0.5; return [clip(d),
  ...soft(200 - sd * w * 1.1, 112 + h * 0.52, w * 0.6, h * 0.75, shade(p.skin, 0.3), 0.4), // the far side turning away
  ...soft(200, 112 + h * 1.02, w * 0.75, h * 0.16, shade(p.skin, 0.35), 0.35), // under the jaw
  ...soft(200 + sd * w * 0.2, 112 + h * 0.13, w * 0.5, h * 0.1, '#ffffff', 0.3), // the crown's sheen
  ...soft(lit, 112 + h * 0.36, w * 0.14, h * 0.28, '#ffffff', 0.32), // the specular streak, soft,
  path(`M ${R(lit - sd * 2)} ${R(112 + h * 0.1)} Q ${R(lit + sd * w * 0.12)} ${R(112 + h * 0.36)} ${R(lit - sd * 1)} ${R(112 + h * 0.62)} Q ${R(lit + sd * w * 0.04)} ${R(112 + h * 0.36)} ${R(lit - sd * 2)} ${R(112 + h * 0.1)} Z`, { fill: '#ffffff', op: 0.35 }), // and its hard core
  UNCLIP]; } };
/** The faceplate let into the shell: its groove, a seam up the crown, rivets at its cheeks and a hinge pin at each jaw corner. */
MAKEUP.panelSeams = { skin: (p) => { const d = plateOf(p), pts = corners(d), skin = p.skin, top = p.eyes.y - 44; return [clip(facePath(p)),
  path(d, { fill: shade(skin, 1.08), op: 0.45 }), ...mapXY([path(d, stroke('#000000', 3, 0.16))], (x) => x, (y) => y - 1.5), ...groove(d, skin, 2),
  ...groove(`M 200 112 L 200 ${R(top - 8)}`, skin, 1.6),
  ...[pts[0], pts[4]].filter(Boolean).flatMap(([x, y]) => rivet(x, y, skin)), // the cheek points
  ...[pts[1], pts[3]].filter(Boolean).flatMap(([x, y]) => [ellipse(R(x), R(y), 5.5, 5.5, { fill: shade(skin, 0.7) }), ellipse(R(x), R(y), 5.5, 5.5, stroke(shade(skin, 0.4), 1, 0.7)), ...rivet(x, y, skin, 2.4)]), // the jaw hinges
  UNCLIP]; } };
/** A jaw piece: a seam across under the mouth, from hinge to hinge, so the chin reads as the plate that drops when it talks. */
MAKEUP.jawSeam = { skin: (p) => { const pts = corners(plateOf(p)), a = pts[1], b = pts[3]; if (!a || !b) return []; const y = Math.max(p.mouth.y + 30, (a[1] + b[1]) / 2 + 8);
  return [clip(facePath(p)), ...groove(`M ${R(a[0])} ${R(a[1])} Q 200 ${R(2 * y - (a[1] + b[1]) / 2)} ${R(b[0])} ${R(b[1])}`, p.skin, 1.8), UNCLIP]; } };
/** Cheek vents: three louvred slots on each cheek, sunk in the plate, their lower lips lit. */
MAKEUP.cheekVents = { skin: (p) => { const { w } = dims(p), y = p.eyes.y + 30, dark = shade(p.skin, 0.25), lit = shade(p.skin, 1.6);
  return [clip(facePath(p)), ...[-1, 1].flatMap((s) => [0, 1, 2].flatMap((i) => { const x = 200 + s * w * 0.6, d = `M ${R(x - 9)} ${R(y + i * 6)} L ${R(x + 9)} ${R(y + i * 6)}`; return [path(d, stroke(dark, 3.2, 0.85)), ...mapXY([path(d, stroke(lit, 1, 0.5))], (v) => v, (v) => v + 2)]; })), UNCLIP]; } };
/** A status light in the middle of the brow, in the eyes' light. */
MAKEUP.statusLight = { face: (p) => { const c = p.eyes.iris ?? '#6fe0ff', y = p.eyes.y - 30; return [ellipse(200, y + 1, 5.5, 5.5, { fill: '#000000', op: 0.3 }), ellipse(200, y, 5.5, 5.5, { fill: shade(p.skin, 0.55) }), ...soft(200, y, 11, 11, c, 0.45), ellipse(200, y, 3.4, 3.4, { fill: c }), ellipse(199, y - 1, 1.2, 1.2, { fill: mix(c, '#ffffff', 0.8) })]; } };
/** A plate standing proud: the shadow it drops, a lit top edge, a dark bottom one, its rim (portrait.mjs's machine faces build theirs the same way). */
const plate = (d, fill) => [...mapXY([path(d, { fill: '#000000', op: 0.25 })], (x) => x, (y) => y + 3), path(d, { fill }), clip(d), ...mapXY([path(d, stroke(shade(fill, 1.7), 2.6, 0.6))], (x) => x, (y) => y + 2), ...mapXY([path(d, stroke(shade(fill, 0.45), 2.6, 0.55))], (x) => x, (y) => y - 2), UNCLIP, path(d, stroke(shade(fill, 0.4), 1, 0.8))];
/** A plated torso: a collar of rings at the neck, a chest plate with a light at its core in the eyes' colour, the abdomen in bands; lit from the light's side. */
TOPS.robotTorso = (p) => { const c = p.top.color, dark = shade(c, 0.55), sd = p.light.side || -1, glow = p.eyes.iris ?? '#6fe0ff', chest = 'M 146 378 L 254 378 Q 258 378 257 383 L 244 452 Q 243 456 238 456 L 162 456 Q 157 456 156 452 L 143 383 Q 142 378 146 378 Z'; return [
  torso('M 64 480 C 78 386, 124 356, 160 346 L 240 346 C 276 356, 322 386, 336 480 Z', c),
  ...soft(200 - sd * 120, 520, 70, 200, shade(c, 0.35), 0.5), ...soft(200 + sd * 70, 430, 40, 120, '#ffffff', 0.18), // the far side turning away, a sheen on the near
  ...[0, 1, 2].flatMap((i) => groove(`M ${170 - i * 2} ${340 - i * 8} Q 200 ${348 - i * 8} ${230 + i * 2} ${340 - i * 8}`, c, 2.6)), // the neck's rings
  ...plate(chest, shade(c, 1.12)), ellipse(200, 413, 13, 13, { fill: shade(c, 0.5) }), ellipse(200, 413, 13, 13, stroke(shade(c, 1.6), 1.2, 0.5)), ...soft(200, 413, 22, 22, glow, 0.4), ellipse(200, 413, 7, 7, { fill: glow }), ellipse(198, 411, 2.4, 2, { fill: '#ffffff', op: 0.7 }), // the chest plate and its core
  ...[0, 1, 2, 3].flatMap((i) => groove(`M ${164 - i * 2} ${478 + i * 22} Q 200 ${484 + i * 22} ${236 + i * 2} ${478 + i * 22}`, c, 2.6)), // the abdomen's bands
  ...[0, 1, 2].map((i) => ellipse(200, 488 + i * 22, 2.2, 2.2, { fill: dark }))]; };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const ROBOT = { makeup: ['plating', 'panelSeams', 'jawSeam', 'cheekVents', 'statusLight'], tops: ['robotTorso'] };
for (const n of ROBOT.makeup) tag('makeup', n, 'only:robot');
for (const n of ROBOT.tops) tag('top', n, 'only:robot');
