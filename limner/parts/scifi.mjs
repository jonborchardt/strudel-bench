// The sci-fi pack: what the scifi cast (casts/scifi.mjs) wears that nobody else does, tagged `only:scifi`. A crew's
// gear, modelled as cloth and plate (a lit edge and a shadow edge on every seam, a bevel on every plate) and lit from
// inside: whatever is emissive carries a halo (`glow`, `strip`). Three tops: a quilted flight suit with a ribbed
// collar, a wrap-front uniform tunic with a lit insignia, and an orange pressure suit with a metal neck-seal ring and
// harness straps; three outer layers: a hard shell jacket worn open with lit piping, a long command coat closed on
// the diagonal, a padded armour shell with chest plates and a power cell. One hat, an open-face flight helmet with
// its visor raised; a HUD visor band; a comm link over the ear; and a temple implant strip, the one face detail.
// parts.html?pack=scifi is the sheet.
import { TOPS, JACKETS, HATS, HAT_CROWN, GLASSES, ACCESSORIES, MAKEUP, NECKLINES, JACKET_EDGE, shade, mix, soft, path, rect, ellipse, stroke, tag } from '../portrait.mjs';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const GLOW = '#7fe3ff', AMBER = '#ffc45a', PALE = '#d8dde3', METAL = '#9aa3ad';
const SHOULDERS = 'M 64 480 C 78 386, 124 356, 160 346 L 240 346 C 276 356, 322 386, 336 480 Z';
const r1 = (v) => Math.round(v * 10) / 10;
/** An ellipse as a path (M/C only, so it maps and clips like any other outline). */
const oval = (cx, cy, rx, ry) => { const k = 0.5523, P = (x, y) => `${r1(x)} ${r1(y)}`; return `M ${P(cx - rx, cy)} C ${P(cx - rx, cy - k * ry)}, ${P(cx - k * rx, cy - ry)}, ${P(cx, cy - ry)} C ${P(cx + k * rx, cy - ry)}, ${P(cx + rx, cy - k * ry)}, ${P(cx + rx, cy)} C ${P(cx + rx, cy + k * ry)}, ${P(cx + k * rx, cy + ry)}, ${P(cx, cy + ry)} C ${P(cx - k * rx, cy + ry)}, ${P(cx - rx, cy + k * ry)}, ${P(cx - rx, cy)} Z`; };
/** A point light: a halo, the lamp, a hot core. */
const glow = (cx, cy, r, c) => [...soft(cx, cy, r * 3.2, r * 3.2, c, 0.5), ellipse(cx, cy, r, r, { fill: c }), ellipse(cx - r * 0.25, cy - r * 0.25, r * 0.45, r * 0.45, { fill: '#ffffff', op: 0.85 })];
/** A light strip along `d`: a wide faint halo, the tube, a white-hot line down its middle. */
const strip = (d, c, w = 1) => [path(d, stroke(c, 9 * w, 0.14)), path(d, stroke(c, 3.4 * w, 0.6)), path(d, stroke('#ffffff', 1.2 * w, 0.85))];
/** A seam: a dark valley and the lit lip beside it (dx, dy away from the light). */
const seam = (d, dark, op = 0.5, dx = 1.6, dy = 1.2) => [path(d, stroke(dark, 2.2, op, 'butt')), path(d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => `${r1(+x + dx)} ${r1(+y + dy)}`), stroke('#ffffff', 1, op * 0.35, 'butt'))];
/** A plate: its face, a lit top edge, a shadow under it on what it sits on. */
const plate = (d, fill, dark) => [path(d.replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => `${r1(+x + 2)} ${r1(+y + 4)}`), { fill: '#000000', op: 0.22 }), path(d, { fill }), path(d, stroke(dark, 1.6, 0.7)), path(d, stroke('#ffffff', 1, 0.18))];

// --- tops ---
/** A one-piece flight suit: a high ribbed collar, a quilted yoke across the shoulders, the zip from the collar to the hip, a chest panel with three lights. */
TOPS.crewSuit = (p) => { const c = p.top.color, a = p.top.accent ?? PALE, dark = shade(c, 0.6), lite = shade(c, 1.35); return [
  torso(SHOULDERS, c),
  path('M 100 410 C 116 374, 146 356, 168 350 L 232 350 C 254 356, 284 374, 300 410 Q 200 392 100 410 Z', { fill: dark, op: 0.45 }), // the quilted yoke, a darker plane over the shoulders
  ...[0, 1, 2].flatMap((i) => seam(`M ${112 + i * 6} ${400 - i * 12} Q 200 ${384 - i * 12} ${288 - i * 6} ${400 - i * 12}`, '#000000', 0.32)), // its stitched channels
  path('M 100 410 Q 200 392 300 410', stroke(lite, 1.6, 0.45)),
  path('M 222 352 L 186 480', stroke('#000000', 6, 0.18, 'butt')), path('M 222 352 L 186 480', stroke(dark, 2.6, 0.9)), path('M 224 352 L 188 480', stroke(a, 1, 0.6)), ellipse(219, 364, 2.6, 4, { fill: METAL }), // the zip: the overlap's shadow, the teeth, a lit edge, the pull
  ...plate('M 234 404 L 274 404 L 274 430 L 234 430 Z', shade(c, 0.45), '#000000'), ...glow(244, 417, 2.6, GLOW), ...glow(255, 417, 2.6, AMBER), ...glow(266, 417, 2, a), // the chest panel and its lights
  path('M 158 350 L 162 322 L 238 322 L 242 350 Q 200 362 158 350 Z', { fill: dark, collar: true }), // a high ribbed collar
  ...[0, 1, 2, 3].map((i) => ({ ...path(`M 163 ${328 + i * 6} Q 200 ${331 + i * 6} 237 ${328 + i * 6}`, stroke('#000000', 1.2, 0.3)), collar: true })),
  { ...path('M 162 323 L 238 323', stroke(lite, 1.6, 0.6)), collar: true }, { ...path('M 158 350 Q 200 362 242 350', stroke('#000000', 3, 0.3)), collar: true }]; };
/** A uniform tunic: a standing collar, closed on a raised diagonal placket with the overlap's shadow beside it, an insignia lit from within and two rank bars. */
TOPS.uniformTunic = (p) => { const c = p.top.color, a = p.top.accent ?? AMBER, dark = shade(c, 0.55), lite = shade(c, 1.3); return [
  torso(SHOULDERS, c),
  ...[-1, 1].flatMap((s) => seam(`M ${200 + s * 40} 354 C ${200 + s * 52} 384, ${200 + s * 70} 396, ${200 + s * 98} 404`, dark, 0.55, 0, 1.4)), // the yoke seams, collar to armpit
  path('M 216 352 C 202 400, 178 440, 152 480', stroke('#000000', 12, 0.16, 'butt')), // the placket's shadow on the under panel
  path('M 214 352 C 200 400, 176 440, 150 480', stroke(dark, 7, 1, 'butt')), path('M 211 352 C 197 400, 173 440, 147 480', stroke(lite, 1.4, 0.7)), // the raised placket and its lit edge
  ...[372, 404, 436].map((y, i) => ellipse(206 - i * 12 - (i ? 4 : 0), y, 2.2, 2.2, { fill: METAL })), // its fasteners
  path('M 256 390 L 270 420 L 256 412 L 242 420 Z', { fill: shade(a, 0.7) }), path('M 256 394 L 266 415 L 256 409 L 246 415 Z', { fill: a }), ...glow(256, 406, 2, '#fff2c8'), // the insignia, a delta lit from inside
  ...[0, 1].flatMap((i) => [rect(140 + i * 13, 398, 9, 5, { rx: 1.5, fill: a }), rect(140 + i * 13, 398, 9, 2, { rx: 1, fill: '#ffffff', op: 0.5 })]), // two rank bars
  path('M 158 350 L 163 328 L 237 328 L 242 350 Q 200 360 158 350 Z', { fill: dark, collar: true }),
  { ...path('M 163 329 L 237 329', stroke(lite, 1.6, 0.55)), collar: true }, { ...path('M 158 350 Q 200 360 242 350', stroke('#000000', 3, 0.3)), collar: true }]; };
/** A pressure suit: pale or orange, a metal neck-seal ring the helmet locks onto, harness straps pressing into the padding, a hose port lit at its centre. */
TOPS.pressureSuit = (p) => { const c = p.top.color, a = p.top.accent ?? '#2a2d33', dark = shade(c, 0.62), lite = shade(c, 1.25); return [
  torso(SHOULDERS, c),
  ...[396, 430, 464].flatMap((y) => [path(`M 100 ${y} Q 200 ${y - 10} 300 ${y}`, stroke(dark, 3, 0.35)), path(`M 100 ${y - 8} Q 200 ${y - 18} 300 ${y - 8}`, stroke(lite, 4, 0.25))]), // the padding, tubes with a lit top and a shaded crease
  ...[-1, 1].flatMap((s) => { const d = `M ${200 + s * 54} 352 C ${200 + s * 50} 400, ${200 + s * 40} 440, ${200 + s * 30} 480`; return [path(d, stroke('#000000', 22, 0.2)), path(d, stroke(a, 15, 1, 'butt')), path(d.replace(/(\d+) 352/, (_, x) => `${+x - s * 6} 352`), stroke('#ffffff', 1, 0.2)), ...[392, 432].map((y) => rect(200 + s * (48 - (y - 392) / 5) - 8, y, 16, 9, { rx: 2, fill: METAL }))]; }), // two straps, their shadow, their buckles
  ...plate(oval(158, 446, 13, 13), METAL, '#3a3f46'), ellipse(158, 446, 7, 7, { fill: '#2a2f36' }), ...glow(158, 446, 3, GLOW), // the hose port
  path(`M 148 342 C 148 334, 172 326, 200 326 C 228 326, 252 334, 252 342 L 252 350 C 252 360, 228 370, 200 370 C 172 370, 148 360, 148 350 Z ${oval(200, 339, 36, 9)}`, { fill: shade(METAL, 0.6), rule: 'evenodd', collar: true }), // the ring's depth, its front face; the neck shows through the hole
  { ...path(`${oval(200, 342, 52, 16)} ${oval(200, 339, 36, 9)}`, { fill: METAL, rule: 'evenodd' }), collar: true }, // its top face round the neck
  { ...path('M 150 340 C 154 332, 176 326, 200 326 C 224 326, 244 330, 250 338', stroke('#ffffff', 2, 0.5)), collar: true }, { ...path(oval(200, 339, 36, 9), stroke('#000000', 3, 0.35)), collar: true }, // the lit rim, the shadow it throws on the neck
  { ...path('M 150 352 C 160 362, 180 368, 200 368 C 220 368, 240 362, 250 352', stroke('#000000', 2, 0.3)), collar: true }, { ...rect(168, 354, 10, 8, { rx: 1.5, fill: '#3a3f46' }), collar: true }, { ...rect(222, 354, 10, 8, { rx: 1.5, fill: '#3a3f46' }), collar: true }]; }; // the latches
NECKLINES.pressureSuit = 'M 162 340 Q 200 356 238 340';

// --- outer layers ---
/** A hard shell jacket worn open: a yoke plate over each shoulder, lit piping down the front edges, its edges thick enough to throw a shadow on the suit. */
JACKETS.shellJacket = (p) => { const c = p.jacket.color, a = p.jacket.accent ?? GLOW, dark = shade(c, 0.6), lite = mix(c, '#ffffff', 0.14); return [
  path('M 52 700 L 50 450 C 58 392, 112 358, 164 350 L 178 480 L 172 700 Z', { fill: c }), path('M 348 700 L 350 450 C 342 392, 288 358, 236 350 L 222 480 L 228 700 Z', { fill: c }),
  ...[-1, 1].flatMap((s) => plate(`M ${200 + s * 38} 352 C ${200 + s * 70} 354, ${200 + s * 100} 368, ${200 + s * 112} 392 L ${200 + s * 96} 404 C ${200 + s * 82} 388, ${200 + s * 62} 380, ${200 + s * 44} 380 Z`, lite, dark)), // the shoulder plates
  ...[-1, 1].flatMap((s) => seam(`M ${200 + s * 74} 410 L ${200 + s * 78} 700`, dark, 0.6, -s * 1.6, 0)),
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 36} 351 L ${200 + s * 22} 480 L ${200 + s * 28} 700`, stroke(dark, 6, 1, 'butt')), ...strip(`M ${200 + s * 33} 360 L ${200 + s * 20} 480`, a, 0.6)])]; }; // the front edges' thickness, lit piping along them
JACKET_EDGE.shellJacket = ['M 164 350 L 178 480 L 172 700', 'M 236 350 L 222 480 L 228 700'];
/** A long command coat closed on the diagonal: a V at the throat showing the tunic, lapel facings, the overlap's shadow, fastening tabs, a belt with a lit buckle. */
JACKETS.commandCoat = (p) => { const c = p.jacket.color, a = p.jacket.accent ?? AMBER, dark = shade(c, 0.55), lite = mix(c, '#ffffff', 0.16); return [
  path('M 64 480 C 76 400, 112 370, 160 352 L 216 432 L 240 700 L 60 700 Z', { fill: c }), path('M 336 480 C 324 400, 288 370, 240 352 L 216 432 L 240 700 L 340 700 Z', { fill: shade(c, 0.9) }),
  path('M 160 352 L 216 432 L 220 446 L 150 362 Z', { fill: lite }), path('M 240 352 L 216 432 L 226 434 L 252 358 Z', { fill: lite, op: 0.7 }), // the lapel facings
  path('M 218 436 L 242 700', stroke('#000000', 10, 0.25, 'butt')), path('M 216 432 L 240 700', stroke(dark, 2.4, 1)), path('M 214 434 L 238 700', stroke(lite, 1.2, 0.6)), // the overlap
  ...[452, 478].map((y) => rect(216 + (y - 432) / 11, y, 12, 5, { rx: 2, fill: a })), // fastening tabs
  ...[-1, 1].map((s) => path(`M ${200 + s * 34} 356 L ${200 + s * 62} 362 L ${200 + s * 60} 372 L ${200 + s * 36} 366 Z`, { fill: a, op: 0.85 })), // shoulder tabs
  path('M 100 466 Q 200 456 300 466 L 300 480 Q 200 470 100 480 Z', { fill: dark }), ...plate('M 188 458 L 212 458 L 212 478 L 188 478 Z', METAL, '#3a3f46'), ...strip('M 194 468 L 206 468', a, 0.6)]; }; // the belt and its buckle
JACKET_EDGE.commandCoat = ['M 160 352 L 216 432', 'M 240 352 L 216 432'];
/** A padded armour shell: a rolled collar, two bevelled chest plates over the padding, a power cell between them, segmented lames at the waist. */
JACKETS.padArmour = (p) => { const c = p.jacket.color, a = p.jacket.accent ?? AMBER, dark = shade(c, 0.55), lite = mix(c, METAL, 0.45); return [
  torso('M 62 480 C 72 394, 120 360, 160 350 L 240 350 C 280 360, 328 394, 338 480 Z', c),
  ...[-1, 1].flatMap((s) => plate(`M ${200 + s * 10} 386 L ${200 + s * 74} 380 C ${200 + s * 84} 400, ${200 + s * 80} 424, ${200 + s * 70} 440 Q ${200 + s * 40} 450 ${200 + s * 10} 444 Z`, lite, dark)), // the chest plates
  ...[-1, 1].map((s) => path(`M ${200 + s * 16} 392 L ${200 + s * 66} 388`, stroke('#ffffff', 2, 0.25))),
  ...plate('M 192 392 L 208 392 L 208 438 L 192 438 Z', '#1d2026', '#000000'), ...strip('M 200 398 L 200 432', a, 0.8), // the power cell
  ...[454, 468].flatMap((y) => [path(`M 104 ${y} Q 200 ${y - 8} 296 ${y}`, stroke(dark, 3, 0.7)), path(`M 104 ${y + 3} Q 200 ${y - 5} 296 ${y + 3}`, stroke(lite, 1.4, 0.35))]),
  path('M 158 352 Q 200 382 242 352', stroke(dark, 13, 1)), path('M 160 349 Q 200 377 240 349', stroke(lite, 3, 0.5))]; }; // the rolled collar
NECKLINES.padArmour = 'M 162 352 Q 200 376 238 352';

// --- the head ---
/** An open-face flight helmet: a shell over the crown and down over the ears, a rubber rim round the face, the tinted visor raised on top, a status light at the temple. */
HATS.flightHelmet = (p) => { const c = p.hat.color, a = p.hat.accent ?? '#c4472c', dark = shade(c, 0.6); return [
  path('M 116 146 C 112 74, 152 38, 200 38 C 248 38, 288 74, 284 146 L 288 214 Q 290 240 270 242 L 262 242 L 262 164 Q 200 136 138 164 L 138 242 L 130 242 Q 110 240 112 214 Z', { fill: c }),
  path('M 284 146 L 288 214 Q 290 240 270 242 L 262 242 L 262 164 Q 270 150 284 146 Z', { fill: '#000000', op: 0.18 }), path('M 116 146 L 112 214 Q 110 240 130 242 L 138 242 L 138 164 Q 130 150 116 146 Z', { fill: '#000000', op: 0.08 }), // the side pieces turn away from the light
  path('M 200 40 L 200 60', stroke(a, 10, 1, 'butt')), path('M 140 70 Q 200 30 260 70', stroke('#ffffff', 5, 0.18)),
  path('M 136 236 L 138 164 Q 200 136 262 164 L 264 236', stroke('#1c1e22', 6, 1, 'butt')), // the rim
  path('M 128 120 C 134 72, 166 52, 200 52 C 234 52, 266 72, 272 120 Q 200 100 128 120 Z', { fill: '#1d2a33' }), path('M 128 120 Q 200 100 272 120', stroke(dark, 4, 1, 'butt')), path('M 150 92 Q 176 68 214 64', stroke(GLOW, 3, 0.45)), path('M 154 98 Q 178 76 208 72', stroke('#ffffff', 1.4, 0.6)), // the visor up, its glint
  ...[-1, 1].flatMap((s) => [ellipse(200 + s * 74, 126, 7, 7, { fill: dark }), ellipse(200 + s * 74, 126, 3, 3, { fill: METAL })]), ...glow(276, 196, 2.4, GLOW)]; };
HAT_CROWN.flightHelmet = 150;
/** A HUD visor across both eyes: a dark tint, a cyan wash, a lit top rim, readouts in the glass and the light it throws on the cheeks. Drawn for the default eyes; the glasses fit moves it with this face's. */
GLASSES.visorBand = (c) => { const V = 'M 126 184 Q 200 170 274 184 L 268 210 Q 200 220 132 210 Z'; return [
  ...soft(166, 226, 40, 14, GLOW, 0.22), ...soft(234, 226, 40, 14, GLOW, 0.22), // its light on the cheeks
  path(V, { fill: '#10202a', op: 0.55 }), path(V, { fill: GLOW, op: 0.3 }), path(V, stroke(c, 2.6)), path('M 128 185 Q 200 171 272 185', stroke(GLOW, 1.6, 0.8)),
  path('M 222 192 L 252 192', stroke(GLOW, 1.2, 0.8)), path('M 222 198 L 242 198', stroke(GLOW, 1.2, 0.6)), path('M 150 190 Q 180 182 206 184', stroke('#ffffff', 2, 0.45)),
  ...[-1, 1].map((s) => rect(s < 0 ? 116 : 272, 186, 12, 20, { rx: 3, fill: c })), ...glow(278, 196, 1.8, GLOW)]; };
/** A comm link worn over the ear: a hook behind it, the bud, a boom along the cheek to the mouth with a lit tip. */
ACCESSORIES.commLink = { at: 'over', ops: () => [path('M 276 204 C 290 196, 296 222, 284 238', stroke('#2b2f36', 3.4)), ellipse(281, 222, 7, 10, { fill: '#2b2f36' }), ellipse(279, 219, 2.6, 4, { fill: '#ffffff', op: 0.25 }), path('M 280 230 Q 276 262 240 272', stroke('#000000', 4, 0.15)), path('M 281 230 Q 278 260 242 270', stroke('#2b2f36', 2.4)), ...glow(241, 270, 2.2, GLOW)] };
/** A temple implant: a short lit strip down the side of the brow and three ports beneath it, on the face's own outline. */
MAKEUP.templeLight = { fit: 'face', face: () => [path('M 133 176 Q 129 194 133 212', stroke('#000000', 5, 0.2)), ...strip('M 134 176 Q 130 194 134 212', GLOW, 0.7), ...[220, 228, 236].map((y) => ellipse(136 + (y - 220) / 6, y, 1.6, 1.6, { fill: '#1d2a33', op: 0.7 }))] };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const SCIFI = { tops: ['crewSuit', 'uniformTunic', 'pressureSuit'], jackets: ['shellJacket', 'commandCoat', 'padArmour'], hats: ['flightHelmet'], glasses: ['visorBand'], accessories: ['commLink'], makeup: ['templeLight'] };
for (const n of SCIFI.tops) tag('top', n, 'only:scifi');
for (const n of SCIFI.jackets) tag('jacket', n, 'only:scifi');
for (const n of SCIFI.hats) tag('hat', n, 'only:scifi');
for (const n of SCIFI.glasses) tag('glasses', n, 'only:scifi');
for (const n of SCIFI.accessories) tag('accessories', n, 'only:scifi');
for (const n of SCIFI.makeup) tag('makeup', n, 'only:scifi');
