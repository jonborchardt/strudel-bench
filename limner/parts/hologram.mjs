// The hologram pack: what the holograms cast (casts/holograms.mjs) wears that nobody else does, tagged
// `only:hologram`. A hologram is a person drawn in one light: the cast's palette does most of it (every skin, hair and
// cloth a tint of one light, cyan or phosphor green or amber or rose or violet), and this pack adds what says
// *projected*. Every part reads the light off the wearer's own skin, so one part serves every light:
//   holoBeam  (back)  the light it is thrown in: a cone flaring up from below and a halo behind the head;
//   holoScan          interlace, the figure ruled by dark rows, with a few rows dropped out and torn sideways;
//   holoGhost (skin)  the colour split: a magenta and a cyan copy of the face's edge, pulled apart;
//   holoRim   (skin)  the bright rim on the lit side, where the projection is thickest.
// The torn rows come from the face's own numbers, so one person always glitches in the same places and two people do
// not. parts.html?pack=hologram is the sheet.
import { TOPS, MAKEUP, DEFAULTS, facePath, shade, mix, path, rect, clip, UNCLIP, stroke, soft } from '../portrait.mjs';
import { tagPack, torso, SHOULDERS, keyOf, hairZones, beardZones } from './pen.mjs';

const glow = (p) => mix(p.skin, '#ffffff', 0.55), deep = (p) => shade(p.skin, 0.3); // the light itself, and the dark between its rows
const MAGENTA = '#ff3dbb', CYAN = '#33eeff';
const FACE = facePath(DEFAULTS); // the default head's outline, fitted to this one by the `face` fit
// Where the figure is, in pieces that ride with what they cover: the face (fitted, over the features), the hair and
// the beard (their own filled shapes, over everything on the head; pen.mjs zones) and the shoulders down (in the
// body's group). The rows are clipped to these so they rule the figure and never the host's background.
const BODY = 'M 178 300 L 222 300 L 226 346 L 238 348 C 274 358, 314 386, 322 440 L 316 700 L 84 700 L 78 440 C 86 386, 126 358, 162 348 L 174 346 Z'; // the neck and the shoulders, a little inside the cloth's own edge

/** The interlace and the dropouts inside one zone: a dark row every 7 units, and the rows this face drops, each a dark
 *  band with the row of light that should have been there thrown sideways off it. */
const scan = (p, clips, y0, y1, drops) => [...clips.map((d) => clip(d)),
  ...Array.from({ length: Math.ceil((y1 - y0) / 7) }, (_, i) => path(`M 20 ${y0 + i * 7} L 380 ${y0 + i * 7}`, stroke(deep(p), 2.6, 0.28, 'butt'))),
  ...drops.flatMap(([y, h]) => [rect(20, y, 360, h, { fill: deep(p), op: 0.55 }), rect(20, y + h, 360, 1.6, { fill: glow(p), op: 0.9 })]),
  ...clips.map(() => UNCLIP)];
/** The dropped rows, three per person: [y, height, sideways throw]. */
const dropsOf = (p) => { const k = keyOf(p); return [0, 1, 2].map((j) => [[150, 236, 392][j] + ((k + j * 31) % 40), 4 + ((k + j * 7) % 7), ((k + j) % 2 ? 1 : -1) * (14 + ((k * 3 + j * 13) % 18))]); };
const headDrops = (p) => dropsOf(p).filter(([y]) => y < 330).map(([y, h]) => [y, h]);
MAKEUP.holoScan = { fit: { skin: 'face', face: 'face' },
  skin: (p) => scan(p, [FACE], 100, 340, []), // the rows on the face ride with its outline on a turned head (the features slide further, and rows that slid with them would leave a bare edge)
  face: (p) => scan(p, [FACE], 0, 0, headDrops(p)), // the dropped rows go over the eyes, the nose and the mouth: a dropout takes them too
  over: (p) => [...hairZones(p).flatMap((z) => scan(p, z, 30, 470, headDrops(p))), ...beardZones(p).flatMap((z) => scan(p, z, 200, 420, headDrops(p)))], // on the hair and the beard, which go on after the face
  body: (p) => scan(p, [BODY], 322, 700, dropsOf(p).filter(([y]) => y >= 330).map(([y, h]) => [y, h])), // on the clothes
  front: (p) => dropsOf(p).flatMap(([y, h, dx]) => { const x0 = dx > 0 ? 260 : 70; return [rect(x0 + dx, y + 1, 70, h - 1, { fill: glow(p), op: 0.5 }), rect(x0 + dx * 1.6, y + h, 46, 1.6, { fill: glow(p), op: 0.85 })]; }), // the torn row: a sliver of the figure thrown off its edge
};
/** A signal failing: two wide bands gone dark, one through the jaw and one through the chest, each with its row of
 *  light thrown far off the figure. For one whose projection is giving out (the echo). */
const FAIL = [[276, 14, -38], [292, 4, 26], [410, 18, 44], [432, 5, -30]];
MAKEUP.holoFail = { fit: { face: 'face' },
  face: (p) => scan(p, [FACE], 0, 0, FAIL.filter(([y]) => y < 330)),
  over: (p) => beardZones(p).flatMap((z) => scan(p, z, 0, 0, FAIL.filter(([y]) => y < 330))),
  body: (p) => scan(p, [BODY], 0, 0, FAIL.filter(([y]) => y >= 330)),
  front: (p) => FAIL.flatMap(([y, h, dx]) => [rect((dx > 0 ? 250 : 60) + dx, y, 90, h, { fill: glow(p), op: 0.45 }), rect((dx > 0 ? 230 : 90) + dx * 1.5, y + h, 80, 2, { fill: glow(p), op: 0.9 })]) };
/** The light it is thrown in, behind everything: a cone flaring up from the emitter below the frame, its two edges
 *  ruled, a halo behind the head, and a few loose pixels in the beam. */
MAKEUP.holoBeam = { back: (p) => { const g = glow(p), k = keyOf(p); return [
  path('M 168 700 L 232 700 L 372 0 L 28 0 Z', { fill: g, op: 0.1 }),
  path('M 186 700 L 214 700 L 306 0 L 94 0 Z', { fill: g, op: 0.1 }),
  ...[-1, 1].map((sd) => path(`M ${200 + sd * 32} 700 L ${200 + sd * 172} 0`, stroke(g, 1.4, 0.35))),
  ...soft(200, 230, 190, 230, g, 0.25), ...soft(200, 196, 130, 140, g, 0.3),
  ...Array.from({ length: 7 }, (_, i) => { const x = 70 + ((k * 13 + i * 47) % 260), y = 30 + ((k * 7 + i * 61) % 150); return rect(x, y, 4, 4, { fill: g, op: 0.25 + (i % 3) * 0.2 }); })]; } };
/** The colour split: the face's edge twice more, a magenta copy pulled one way and a cyan the other. */
const shifted = (d, dx) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${Math.round((+x + dx) * 10) / 10} ${y}`);
const SHOULDER_LINE = 'M 70 480 C 82 390, 126 360, 162 350 M 238 350 C 274 360, 318 390, 330 480'; // the line of the shoulders, a little inside where the cloth ends
const split = (d) => [path(shifted(d, -4), stroke(MAGENTA, 2.2, 0.55)), path(shifted(d, 4), stroke(CYAN, 2.2, 0.55))];
MAKEUP.holoGhost = { fit: { skin: 'face' }, skin: () => split(FACE), body: () => split(SHOULDER_LINE) };
/** A brighter rim down the lit side of the face and over the skull: where the projection is thickest. */
MAKEUP.holoRim = { fit: 'face', skin: (p) => [path('M 270 160 C 280 200, 278 260, 252 310', stroke(glow(p), 3.4, 0.7)), path('M 150 120 C 176 100, 224 100, 250 120', stroke(glow(p), 2.6, 0.5))] };
/** A plain tunic ruled in a projection grid. */
TOPS.gridTunic = (p) => { const c = p.top.color, line = shade(c, 1.35); return [
  torso(SHOULDERS, c),
  path('M 162 350 Q 200 376 238 350', stroke(line, 3, 0.8)),
  ...Array.from({ length: 6 }, (_, i) => path(`M ${90 + i * 44} 380 L ${82 + i * 47} 700`, stroke(line, 1, 0.35))),
  ...Array.from({ length: 7 }, (_, i) => path(`M 60 ${400 + i * 42} L 340 ${400 + i * 42}`, stroke(line, 1, 0.3)))]; };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const HOLOGRAM = { makeup: ['holoBeam', 'holoScan', 'holoGhost', 'holoRim', 'holoFail'], tops: ['gridTunic'] };
tagPack(HOLOGRAM, 'only:hologram');
