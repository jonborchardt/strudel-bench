// The wasteland pack: what the wastelanders cast (casts/wastelanders.mjs) wears that nobody else does, tagged
// `only:wasteland`. After the end, in tone rather than line: grime and sun worked into the skin as irregular planes
// (clipped to the face, placed by the person, so no two smears are the same and none leaves the head), a soot band
// across the eyes, a pale goggle tan, war paint dragged down a cheek, a stitched scar, a head bandage; a respirator,
// goggles pushed up on the brow, welding goggles and dust goggles; a shemagh wound round the head and under the chin,
// a salvaged helmet; cloth wrapped and strapped for a shirt, a leather vest with a tyre for a pauldron, a road sign
// strapped on for a breastplate; dirt and patches on whatever survived. parts.html?pack=wasteland is the sheet.
import { TOPS, JACKETS, HATS, HAT_CROWN, MAKEUP, MARKS, PROPS, GLASSES, NECKLINES, facePath, shade, lcg, path, ellipse, rect, line, clip, UNCLIP, stroke, tag } from '../portrait.mjs';
import { tagPack, torso, fp, f1, poly, taper, own, SHOULDERS, sideOf } from './pen.mjs';

const DIRT = '#4a3826', DUSTLIGHT = '#cbb58c', LEATHER = '#4a3527', BRASS = '#9a7a3a', RUBBER = '#2a2a2c', STEEL = '#8d8b84', RUSTC = '#8a4a2a', OILC = '#1e1b18';
/** An irregular closed plane round (cx, cy): n jittered points joined by curves through their midpoints, so it has no corners and no clean edge. */
const blob = (rnd, cx, cy, rx, ry, n = 8, rot = 0) => {
  const pts = Array.from({ length: n }, (_, i) => { const a = rot + ((i + (rnd() - 0.5) * 0.5) / n) * Math.PI * 2, k = 0.62 + rnd() * 0.5, c = Math.cos(a), s = Math.sin(a); return [cx + (c * Math.cos(rot) - s * Math.sin(rot)) * rx * k, cy + (c * Math.sin(rot) + s * Math.cos(rot)) * ry * k]; });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(pts[n - 1], pts[0]);
  return `M ${f1(m0[0])} ${f1(m0[1])} ${pts.map((p, i) => { const m = mid(p, pts[(i + 1) % n]); return `Q ${f1(p[0])} ${f1(p[1])} ${f1(m[0])} ${f1(m[1])}`; }).join(' ')} Z`;
};
/** A row of stitches across the line from a to b: short crossing ticks, each with a dark hole at its ends. */
const stitches = ([ax, ay], [bx, by], n, len, c, sw = 1.4, op = 0.75) => Array.from({ length: n }, (_, i) => {
  const t = (i + 0.5) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, l = Math.hypot(bx - ax, by - ay) || 1, nx = (-(by - ay) / l) * len, ny = ((bx - ax) / l) * len;
  return line(f1(x - nx), f1(y - ny), f1(x + nx), f1(y + ny), stroke(c, sw, op));
});
/** Paint clipped to this face's own outline, exactly, whatever its jaw, chin and lopsidedness. */
const faceClip = (p) => clip(facePath(p));

// --- on the skin ------------------------------------------------------------------------------------------------
/** Grime worked into the skin: a dust wash down one side of the jaw, a darker wipe across a cheekbone, dirt at the hairline and a few flecks; irregular planes, clipped to the face, laid out by the person. */
MAKEUP.grime = { skin: (p) => {
  const r = own(p), sd = r() < 0.5 ? -1 : 1, hw = p.face.width / 2, ey = p.eyes.y, my = p.mouth.y, bot = 112 + p.face.height;
  return [faceClip(p),
    path(blob(r, 200 + sd * hw * 0.55, (my + bot) / 2, hw * 0.55, (bot - my) * 0.7, 9), fp(DIRT, 0.16)), // the jaw's dust
    path(blob(r, 200 - sd * hw * 0.3, bot - 6, hw * 0.4, 18, 7), fp(DIRT, 0.12)),
    path(taper([[200 - sd * (hw * 0.82), ey + 22 + r() * 8], [200 - sd * (hw * 0.55), ey + 28 + r() * 6], [200 - sd * (hw * 0.25), ey + 40 + r() * 8]], 14 + r() * 6, 0.25), fp(DIRT, 0.24)), // a wipe across the far cheekbone, thick where the hand started
    path(blob(r, 200 + (r() - 0.5) * hw * 0.8, 128, hw * 0.6, 20, 9), fp(DIRT, 0.13)), // at the hairline
    path(blob(r, 200 + sd * hw * 0.2, ey - 30, 16, 7, 6, 0.3), fp(DIRT, 0.14)), // dirt in the brow's furrow
    ...Array.from({ length: 4 }, () => path(blob(r, 200 + (r() - 0.5) * hw * 1.4, ey + 20 + r() * (bot - ey - 40), 2.5 + r() * 3, 2 + r() * 2.5, 5), fp(DIRT, 0.35))), // flecks
    UNCLIP];
} };
/** Sun-weathered: the forehead, the bridge of the nose and the tops of the cheeks burnt a shade darker and redder. */
MAKEUP.sunweathered = { skin: (p) => {
  const r = own(p, 1), ey = p.eyes.y, sp = p.eyes.spacing / 2, burn = '#7a2a12';
  return [faceClip(p),
    path(blob(r, 200, 136, p.face.width * 0.36, 26, 9), fp(burn, 0.12)),
    path(blob(r, 200, ey + 26, 11, 22, 7), fp(burn, 0.16)), // the bridge
    ...[-1, 1].map((s) => path(blob(r, 200 + s * (sp + 6), ey + 30, 26, 11, 8, s * 0.2), fp(burn, 0.15))), // the cheekbones
    UNCLIP];
} };
/** A goggle tan: where goggles kept the sun and the dust off, two pale lozenges round the eyes and a pale bridge between them. */
MAKEUP.goggleTan = { fit: 'eyes', skin: (p) => { const c = shade(p.skin, 1.2); return [
  ...[166, 234].map((x) => path(`M ${x - 27} 196 C ${x - 27} 178, ${x + 27} 176, ${x + 27} 194 C ${x + 27} 214, ${x - 27} 216, ${x - 27} 196 Z`, fp(c, 0.7))),
  rect(190, 188, 20, 10, { rx: 4, ...fp(c, 0.45) }),
  ...[166, 234].map((x) => path(`M ${x - 27} 196 C ${x - 27} 178, ${x + 27} 176, ${x + 27} 194 C ${x + 27} 214, ${x - 27} 216, ${x - 27} 196 Z`, stroke('#5a2a16', 2.5, 0.12)))]; } };
/** Soot smeared across the eyes in one band, ragged at both ends, with a run down one cheek; on the skin, so the eyes look out of it. */
MAKEUP.sootBand = { fit: 'eyes', skin: () => [
  path('M 134 186 L 142 180 L 156 176 C 190 172, 214 172, 244 176 L 258 179 L 268 186 L 262 189 L 270 194 L 260 197 L 266 204 L 252 206 L 256 212 C 220 216, 182 216, 150 212 L 142 214 L 146 207 L 132 205 L 140 199 L 130 194 L 140 191 Z', fp('#1d1916', 0.78)),
  path(taper([[238, 212], [240, 226], [237, 242]], 7, 0.2), fp('#1d1916', 0.55)), path(taper([[160, 213], [158, 222]], 5, 0.2), fp('#1d1916', 0.45)), // runs
  path('M 150 180 C 186 175, 216 175, 252 180', stroke('#fff', 1.4, 0.08))] };
/** War paint dragged down a cheek by three fingers, the ochre thinning as it goes, and a stripe across the bridge of the nose. */
MAKEUP.fingerStripes = { fit: 'face', skin: () => [
  ...[0, 1, 2].map((i) => path(taper([[146 + i * 10, 214 + i], [144 + i * 10, 236 + i * 2], [141 + i * 11, 262 - i * 3]], 8, 0.15), fp('#9a3a1e', 0.62))),
  path(taper([[176, 214], [200, 211], [224, 214]], 7, 0.6), fp('#9a3a1e', 0.5))] };
/** A scar from the left brow down across the cheek: a raised pale ridge with a dark seam, the stitches still across it. */
MAKEUP.scarStitched = { fit: 'face', skin: (p) => { const c = shade(p.skin, 0.55), ridge = shade(p.skin, 1.18); return [
  path(taper([[154, 166], [160, 196], [168, 230], [180, 262]], 7, 0.35), fp(ridge, 0.75)), path(taper([[154, 166], [160, 196], [168, 230], [180, 262]], 7, 0.35), fp('#8a3a30', 0.18)),
  path('M 155 168 Q 162 214 179 260', stroke(c, 1.6, 0.75)),
  ...[0, 1, 2, 3, 4].flatMap((i) => { const y = 176 + i * 18, x = 156 + i * 4.4; return [line(x - 6, y - 3, x + 6, y + 3, stroke('#2a1a16', 1.4, 0.75)), ellipse(x - 6, y - 3, 1, 1, fp('#2a1a16', 0.6)), ellipse(x + 6, y + 3, 1, 1, fp('#2a1a16', 0.6))]; })]; } };

// --- over the face -----------------------------------------------------------------------------------------------
/** A respirator over the nose and the mouth: a moulded rubber cup in the light, a valve at its front, a filter canister on each cheek and the straps back to the ears. */
MAKEUP.respirator = { fit: 'face', face: (p) => { const sd = sideOf(p), cup = 'M 166 240 C 170 220, 230 220, 234 240 C 240 270, 226 302, 200 306 C 174 302, 160 270, 166 240 Z'; return [
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 30} 252 Q ${200 + s * 62} 236 ${200 + s * 84} 226`, stroke('#000', 8, 0.18)), path(`M ${200 + s * 30} 250 Q ${200 + s * 62} 234 ${200 + s * 84} 224`, stroke(RUBBER, 5, 0.95))]), // a strap back to each ear, its shadow on the cheek
  path(cup.replace(/(\d+) (\d+)/g, (m, x, y) => `${x} ${+y + 6}`), fp('#000', 0.22)), // its shadow on the chin
  path(cup, { fill: '#3a3c40' }), path(cup, stroke('#1c1d20', 2, 0.8)),
  path(`M 200 226 C ${200 - sd * 30} 232, ${200 - sd * 32} 280, 200 304 C ${200 - sd * 20} 296, ${200 - sd * 24} 256, 200 226 Z`, fp('#000', 0.28)), // its far side in shade
  path(`M ${200 + sd * 22} 236 C ${200 + sd * 28} 250, ${200 + sd * 26} 270, ${200 + sd * 16} 288`, stroke('#fff', 3, 0.16)), // a sheen on the lit side
  path('M 200 228 L 200 300', stroke('#1c1d20', 1.4, 0.5)),
  ...[-1, 1].flatMap((s) => { const x = 200 + s * 36; return [path(`M ${x - 15} 274 L ${x + 15} 274 L ${x + 15 + s * 6} 296 L ${x - 15 + s * 6} 296 Z`, { fill: RUBBER }), ellipse(x + s * 3, 296, 15, 6, { fill: '#1a1a1c' }), ellipse(x, 274, 15, 6, { fill: '#55585e' }), ellipse(x, 274, 9, 3.5, { fill: '#3a3c40' }), ...[-6, 0, 6].map((d) => line(x + d, 271, x + d, 277, stroke('#1b1b1d', 1.2, 0.8))), path(`M ${x - 13} 281 L ${x + 13} 281`, stroke('#8a8478', 3, 0.5, 'butt'))]; }), // the canisters, a scuffed band round each
  ellipse(200, 292, 9, 7, { fill: '#55585e' }), ellipse(200, 292, 5, 4, { fill: '#26272a' }), ellipse(198, 289, 2, 1.4, fp('#fff', 0.35)),
  path(blob(own(p, 2), 186, 260, 10, 6, 6), fp(DUSTLIGHT, 0.25))]; } }; // dust settled on it
/** Goggles pushed up onto the brow: the strap round the head and two brass-rimmed lenses resting on the forehead, catching the light; on the `over` slot, so they sit on a wrap or a helmet's edge too. */
MAKEUP.browGoggles = { fit: 'face', over: () => [
  path('M 118 152 Q 200 124 282 152', stroke(LEATHER, 10, 1, 'butt')), path('M 118 147 Q 200 119 282 147', stroke('#fff', 1.2, 0.12)),
  ...[-1, 1].flatMap((s) => { const x = 200 + s * 26, y = 136; return [ellipse(x, y + 4, 20, 14, fp('#000', 0.25)), ellipse(x, y, 20, 16, { fill: BRASS }), ellipse(x, y, 20, 16, stroke('#5a4420', 1.6, 0.8)), ellipse(x, y, 14, 11, { fill: '#2e3a3a' }), path(`M ${x - 10} ${y - 2} Q ${x - 4} ${y - 10} ${x + 8} ${y - 8} Q ${x} ${y - 4} ${x - 10} ${y - 2} Z`, fp('#cfe0dc', 0.4)), ellipse(x + 6, y + 5, 2, 1.4, fp('#fff', 0.5))]; }),
  path('M 186 136 L 214 136', stroke('#5a4420', 4))] };
/** A bandage wound round the head over the hair, a stain come through on one side and the knot's ends at the temple. */
MAKEUP.headBandage = { fit: 'face', over: () => { const g = '#e2d8c4'; return [
  path('M 122 142 Q 200 120 278 142 L 278 164 Q 200 142 122 164 Z', { fill: g }),
  path('M 122 156 Q 200 134 278 156 L 278 164 Q 200 142 122 164 Z', fp('#000', 0.12)), // its lower turn in shade
  ...[150, 192, 236].map((x) => path(`M ${x} ${136 - (x - 200) * 0.02} L ${x + 14} ${156 - (x - 200) * 0.01}`, stroke('#8a7e68', 1.2, 0.4))), // where the turns overlap
  path('M 152 130 Q 166 126 176 136 Q 172 148 160 148 Q 148 142 152 130 Z', fp('#7a3420', 0.5)), path('M 156 134 Q 164 132 170 138 Q 166 144 160 143 Z', fp('#5a1e14', 0.45)), // the stain
  path('M 274 146 L 296 164 L 290 172 L 272 156 Z', { fill: g }), path('M 276 150 L 286 182 L 278 184 L 272 156 Z', { fill: shade(g, 0.9) }), ellipse(276, 150, 7, 6, { fill: shade(g, 0.94) })]; } };

// --- eyewear (laid out for eyes 68 apart on y 196, fitted to the wearer's) ----------------------------------------
/** Welding goggles down over the eyes: leather cups, a brass ring screwed round each dark lens, a reflection across the glass, the strap to the sides. */
GLASSES.weldingGoggles = (c) => [path('M 136 194 L 110 188', stroke(LEATHER, 9, 1, 'butt')), path('M 264 194 L 290 188', stroke(LEATHER, 9, 1, 'butt')),
  ...[166, 234].flatMap((x) => [ellipse(x, 199, 27, 23, fp('#000', 0.25)), ellipse(x, 196, 27, 24, { fill: c }), ellipse(x, 196, 20, 17.5, { fill: BRASS }), ellipse(x, 196, 20, 17.5, stroke('#5a4420', 1.2, 0.9)), ellipse(x, 196, 15, 13, { fill: '#17211c' }),
    path(`M ${x - 12} ${192} Q ${x - 4} ${181} ${x + 10} ${185} Q ${x - 1} ${188} ${x - 12} ${192} Z`, fp('#9fb8a8', 0.35)), ellipse(x + 7, 202, 2.2, 1.6, fp('#fff', 0.45)), path(`M ${x - 22} ${206} Q ${x} ${221} ${x + 22} ${206}`, stroke('#fff', 1.4, 0.1))]),
  path('M 192 194 Q 200 190 208 194', stroke(c, 6))];
/** Dust goggles: a rubber frame round each eye with amber glass you can see the eyes through, a scratch of light across it. */
GLASSES.dustGoggles = (c) => [path('M 140 196 L 108 190', stroke(RUBBER, 11, 1, 'butt')), path('M 260 196 L 292 190', stroke(RUBBER, 11, 1, 'butt')),
  ...[166, 234].flatMap((x) => [rect(x - 26, 181, 52, 36, { rx: 16, fill: 'none', stroke: '#000', sw: 10, op: 0.2 }), rect(x - 26, 178, 52, 36, { rx: 16, fill: 'none', stroke: c, sw: 9 }), rect(x - 21, 183, 42, 26, { rx: 12, fill: 'none', stroke: '#fff', sw: 1.2, op: 0.18 }), rect(x - 21, 183, 42, 26, { rx: 12, ...fp('#c08a3a', 0.42) }), path(`M ${x - 16} 205 L ${x + 2} 185 L ${x + 10} 185 L ${x - 8} 205 Z`, fp('#fff', 0.22)), ...[-10, 0, 10].map((d) => ellipse(x + d, 175, 2, 1.4, fp('#000', 0.55)))]), // the rubber cups and their shadow, a lip of light inside them, the vents along the top
  path('M 191 196 Q 200 191 209 196', stroke(c, 5))];

// --- on the head ----------------------------------------------------------------------------------------------
/** A shemagh wound round the head: the crown and the sides covered, the folds of its turns across the top, a turn under the chin and a tail falling over one shoulder with a frayed end; the face left open, its shadow round the opening. Covers the head as a hood does (no crown line), so the hair goes under it. */
HATS.shemagh = (p) => { const c = p.hat.color, dk = shade(c, 0.74), lt = shade(c, 1.14), ch = 112 + p.face.height + 16 * (p.face.chin ?? 0), jy = ch - 46;
  const outer = `M 200 56 C 268 56, 300 100, 298 162 C 296 210, 300 ${jy - 10}, 290 ${jy + 20} C 282 ${ch + 10}, 250 ${ch + 40}, 200 ${ch + 44} C 150 ${ch + 40}, 118 ${ch + 10}, 110 ${jy + 20} C 100 ${jy - 10}, 104 210, 102 162 C 100 100, 132 56, 200 56 Z`;
  const opening = `M 200 146 C 236 146, 270 150, 276 168 C 282 200, 280 ${jy - 20}, 266 ${jy + 4} C 250 ${ch - 4}, 222 ${ch + 6}, 200 ${ch + 6} C 178 ${ch + 6}, 150 ${ch - 4}, 134 ${jy + 4} C 120 ${jy - 20}, 118 200, 124 168 C 130 150, 164 146, 200 146 Z`;
  return [path(`${opening} ${facePath({ face: { ...p.face, width: 156 } })}`, { fill: shade(c, 0.32), rule: 'evenodd' }), // the cloth's inside behind the head, as the hood's lining: where the opening is wider than the face; under the cloth, so what falls outside the opening is covered
    path(`${outer} ${opening}`, { fill: c, rule: 'evenodd' }),
    clip(`${outer} ${opening}`, 'evenodd'),
    path('M 104 150 C 150 96, 240 70, 296 120 L 298 140 C 240 92, 150 118, 106 172 Z', fp(dk, 0.7)), path('M 106 112 C 160 70, 230 60, 280 80 L 286 94 C 230 72, 160 86, 104 130 Z', fp(lt, 0.8)), // the turns across the crown
    path('M 128 76 C 190 52, 250 62, 292 104', stroke('#fff', 2, 0.12)), path('M 104 172 C 150 118, 240 94, 298 142', stroke(shade(c, 0.5), 2.5, 0.4)),
    path(`M 110 ${jy} C 140 ${ch + 30}, 260 ${ch + 30}, 290 ${jy}`, stroke(dk, 3, 0.45)), path(`M 120 ${jy + 22} C 150 ${ch + 40}, 250 ${ch + 40}, 280 ${jy + 22}`, stroke(lt, 2, 0.3)), // the turn under the chin
    path('M 286 160 C 296 200, 294 250, 284 290', stroke(dk, 4, 0.4)),
    UNCLIP,
    path(opening, stroke('#000', 9, 0.2)), path(opening, stroke(shade(c, 0.45), 2, 0.7)), // the opening's shadow on the face and its folded edge
    path(`M 118 ${jy + 10} C 96 ${jy + 60}, 86 360, 82 420 L 92 432 L 98 424 L 106 436 L 113 426 L 121 434 L 126 420 C 128 380, 134 ${jy + 70}, 150 ${jy + 36} Z`, { fill: c }), // the tail over the shoulder, frayed at its end
    path(`M 116 ${jy + 30} C 106 ${jy + 80}, 100 370, 98 420`, stroke(dk, 3, 0.5)), path(`M 132 ${jy + 40} C 122 ${jy + 80}, 118 370, 116 418`, stroke(lt, 2, 0.35)),
    ...[[84, 432], [96, 440], [108, 442], [120, 438]].map(([x, y]) => path(`M ${x} ${y - 6} L ${x + 1} ${y + 6} L ${x + 3} ${y - 6} Z`, fp(dk, 0.8)))];
};
HAT_CROWN.shemagh = 400; // like the hood: no crown line on the skull, the hair goes under it
/** A salvaged helmet: a dented dome, its paint chipped to the steel, a scrap plate riveted over a hole at the front, the rim's lip and the chin strap hanging loose. */
HATS.scrapHelmet = (p) => { const c = p.hat.color, r = lcg(7); return [path('M 124 134 C 122 80, 158 54, 200 54 C 242 54, 278 80, 276 134 Z', { fill: c }),
  path('M 124 134 C 122 80, 158 54, 200 54 C 170 66, 150 96, 148 134 Z', fp('#000', 0.16)), path('M 212 62 C 248 68, 266 92, 268 120', stroke('#fff', 5, 0.14)), // its round
  path('M 226 84 C 238 82, 250 92, 248 104 C 240 110, 226 104, 226 84 Z', fp('#000', 0.22)), path('M 228 104 C 238 110, 248 106, 250 100', stroke('#fff', 1.6, 0.25)), // a dent
  ...[[150, 96, 10, 6], [244, 120, 8, 5], [172, 70, 7, 4], [256, 84, 5, 7]].flatMap(([x, y, rx, ry]) => { const d = blob(r, x, y, rx, ry, 7); return [path(d, { fill: STEEL }), path(d, stroke(shade(c, 0.55), 1.2, 0.6))]; }), // chipped to the steel
  path('M 178 80 L 222 78 L 224 108 L 180 110 Z', { fill: RUSTC }), path('M 178 80 L 222 78 L 224 108 L 180 110 Z', stroke('#3a1e12', 1.4, 0.8)), path(blob(r, 210, 98, 9, 6, 6), fp('#5a2a14', 0.6)), ...[[182, 84], [218, 82], [220, 104], [184, 106]].map(([x, y]) => ellipse(x, y, 2.4, 2.4, { fill: '#c9c2b2' })),
  path('M 114 132 Q 200 118 286 132 L 288 144 Q 200 130 112 144 Z', { fill: shade(c, 0.7) }), path('M 114 132 Q 200 118 286 132', stroke('#fff', 1.4, 0.2)),
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 80} 140 C ${200 + s * 84} 180, ${200 + s * 80} 220, ${200 + s * 74} 250`, stroke(LEATHER, 5, 1, 'butt')), path(`M ${200 + s * 76.5} 248 L ${200 + s * 73} 257 L ${200 + s * 78} 256 Z`, { fill: LEATHER })])];
};
HAT_CROWN.scrapHelmet = 132;

// --- on the body ------------------------------------------------------------------------------------------------
/** Cloth wrapped and strapped for a shirt: turns of it across the body, each a tone of its own with a torn end, threads hanging from the tears, a patch sewn on, and a leather strap across the chest pressing into the cloth. */
TOPS.ragWrap = (p) => { const c = p.top.color, dark = shade(c, 0.68), lite = shade(c, 1.16), r = lcg(3); return [
  torso(SHOULDERS, c),
  path('M 70 430 C 120 398, 230 378, 336 392 L 338 434 C 290 422, 220 428, 160 452 L 150 444 L 140 460 L 130 448 L 118 466 L 108 452 L 68 476 Z', fp(lite, 0.9)), // a turn across the chest, torn at its lower edge
  path('M 70 430 C 120 398, 230 378, 336 392', stroke(dark, 3, 0.35)),
  path('M 334 470 C 260 452, 150 470, 66 516 L 66 560 C 140 516, 230 502, 280 508 L 290 498 L 298 514 L 310 502 L 318 518 L 334 510 Z', fp(dark, 0.5)), // a lower turn, darker
  ...[[132, 450], [112, 460], [300, 508], [316, 514]].map(([x, y]) => path(`M ${x} ${y} L ${x + 2} ${y + 14 + r() * 8} L ${x + 4} ${y} Z`, fp(dark, 0.75))), // threads off the tears
  ...((q) => [path(poly(q.map(([x, y]) => [x + 2, y + 3])), fp('#000', 0.2)), path(poly(q), { fill: shade(c, 0.6) }), ...q.flatMap((pt, i) => stitches(pt, q[(i + 1) % 4], 4, 3, '#2a2420'))])([[236, 404], [270, 400], [273, 436], [239, 440]]), // a patch
  path('M 106 378 L 300 528', stroke('#000', 22, 0.16, 'butt')), path('M 112 372 L 304 520', stroke('#000', 18, 0.18, 'butt')), // the strap's shadow: the cloth pressed in beside it
  path('M 108 370 L 302 520', stroke(LEATHER, 14, 1, 'butt')), path('M 110 365 L 305 515', stroke('#fff', 1.6, 0.16)),
  path('M 140 386 Q 128 404 132 424', stroke(dark, 3, 0.35)), path('M 254 476 Q 270 486 282 506', stroke(dark, 3, 0.35)), // the cloth bunched at the strap
  rect(193, 427, 18, 18, { rx: 2, fill: 'none', stroke: BRASS, sw: 3 }), line(202, 427, 202, 445, stroke(BRASS, 2)), path('M 194 428 L 210 428', stroke('#fff', 1, 0.4))]; };
NECKLINES.ragWrap = 'M 160 350 Q 200 382 240 350';
/** One section of a tyre laid over a shoulder as a pauldron: the rubber band, its tread blocks, two bolts with a spike each. `s`: the side (-1 the figure's right on the sheet's left). */
const tyre = (s) => { const P0 = [200 + s * 132, 452], C = [200 + s * 118, 352], P1 = [200 + s * 36, 346], at = (t) => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P1[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P1[1]];
  const nrm = (t) => { const dx = 2 * (1 - t) * (C[0] - P0[0]) + 2 * t * (P1[0] - C[0]), dy = 2 * (1 - t) * (C[1] - P0[1]) + 2 * t * (P1[1] - C[1]), l = Math.hypot(dx, dy); return [dy / l * -s, -dx / l * -s]; };
  const d = `M ${P0[0]} ${P0[1]} Q ${C[0]} ${C[1]} ${P1[0]} ${P1[1]}`;
  return [path(d, stroke('#000', 38, 0.22, 'butt')), path(d, stroke('#2e2c2a', 32, 1, 'butt')), path(d, stroke('#46423d', 16, 1, 'butt')),
    ...Array.from({ length: 9 }, (_, i) => { const t = 0.06 + i * 0.105, [x, y] = at(t), [nx, ny] = nrm(t), [x2, y2] = at(t + 0.05); return path(poly([[x + nx * 4, y + ny * 4], [x + nx * 15, y + ny * 15], [x2 + nx * 15, y2 + ny * 15], [x2 + nx * 4, y2 + ny * 4]]), { fill: '#1a1918' }); }), // the tread
    path(d, stroke('#fff', 2, 0.1)),
    ...[0.35, 0.7].flatMap((t) => { const [x, y] = at(t), [nx, ny] = nrm(t); return [ellipse(x, y, 5, 5, { fill: STEEL }), path(poly([[x - ny * 5, y + nx * 5], [x + nx * 26, y + ny * 26], [x + ny * 5, y - nx * 5]]), { fill: '#b9b5ad' }), path(poly([[x, y], [x + nx * 26, y + ny * 26], [x + ny * 5, y - nx * 5]]), fp('#000', 0.25))]; })];
};
/** A leather vest worn open, scuffed pale where it rubs, its edges worn and its seams stitched. The raider wears a tyre over it (`tyrePauldronLeft`). */
JACKETS.spikedVest = (p) => { const c = p.jacket.color, r = lcg(5), L = 'M 64 700 L 62 452 C 70 396, 118 360, 168 350 L 182 470 L 176 700 Z', R = 'M 336 700 L 338 452 C 330 396, 282 360, 232 350 L 218 470 L 224 700 Z'; return [
  path(L, { fill: c }), path(R, { fill: c }),
  ...[[110, 470, 30, 40], [290, 520, 26, 36], [150, 600, 22, 30]].map(([x, y, rx, ry]) => path(blob(r, x, y, rx, ry, 8), fp('#fff', 0.08))), // scuffed where it rubs
  ...[[168, 350, 182, 470], [182, 470, 176, 700], [232, 350, 218, 470], [218, 470, 224, 700]].map(([a, b, x, y]) => line(a, b, x, y, stroke(shade(c, 1.5), 1.6, 0.35))), // its edges worn pale
  ...stitches([150, 380], [164, 690], 16, 2.5, shade(c, 1.6), 1, 0.5), ...stitches([250, 380], [236, 690], 16, 2.5, shade(c, 1.6), 1, 0.5),
  ...[0, 1, 2].map((i) => ellipse(214, 420 + i * 40, 3.2, 3.2, { fill: BRASS }))]; };
/** A road sign strapped on for a breastplate: harness straps over both shoulders, the faded sign dented and rusting at its corners with a hole punched through it, riveted. */
JACKETS.scrapArmor = (p) => { const c = p.jacket.color, r = lcg(9), plate = [[134, 404], [266, 396], [272, 512], [140, 522]], d = poly(plate); return [
  ...[-1, 1].flatMap((s) => [path(`M ${200 + s * 46} 350 L ${200 + s * 58} 404`, stroke('#000', 18, 0.2, 'butt')), path(`M ${200 + s * 44} 346 L ${200 + s * 56} 402`, stroke(c, 14, 1, 'butt')), path(`M ${200 + s * 92} 470 L ${200 + s * 70} 500`, stroke(c, 12, 1, 'butt'))]), // the harness
  path(poly(plate.map(([x, y]) => [x + 4, y + 8])), fp('#000', 0.25)), // its shadow on the shirt
  path(d, { fill: '#b39548' }), path(poly([[144, 414], [256, 406], [262, 502], [150, 511]]), stroke('#2a2622', 4, 0.85)), // the sign and its border
  path('M 172 470 L 200 440 L 228 468 L 228 488 L 200 460 L 172 490 Z', fp('#2a2622', 0.85)), // a chevron
  path(blob(r, 226, 432, 22, 14, 8), fp('#000', 0.16)), path('M 210 444 Q 228 450 246 440', stroke('#fff', 2, 0.25)), // a dent
  ...plate.map(([x, y]) => path(blob(r, x + (x < 200 ? 14 : -14), y + (y < 460 ? 12 : -12), 20, 15, 7), fp(RUSTC, 0.6))), // rust at the corners
  path(blob(r, 176, 430, 30, 14, 8), fp('#fff', 0.12)), path(blob(r, 236, 470, 22, 10, 7), fp('#fff', 0.08)), // sun-faded
  ellipse(250, 486, 5, 4.5, { fill: OILC }), ellipse(250, 486, 7.5, 7, stroke(STEEL, 1.6, 0.8)), // a hole
  ...plate.map(([x, y]) => ellipse(x + (x < 200 ? 8 : -8), y + (y < 460 ? 8 : -8), 3, 3, { fill: '#d9d2c2' }))]; };
// The tyre is worn over the arm as well as the shoulder, so it is a prop on the `front` slot (drawn after the arms), not part of a jacket, which the arm would cover.
PROPS.tyrePauldronLeft = { front: () => [...tyre(-1), path('M 86 452 L 132 560', stroke(LEATHER, 7, 1, 'butt'))] }; // with its strap under the arm
PROPS.tyrePauldronRight = { front: () => [...tyre(1), path('M 314 452 L 268 560', stroke(LEATHER, 7, 1, 'butt'))] };

/** Dirt on the clothes: dust settled on the shoulders, an oily wipe at the waist where hands go, a dark plane under the chest. Over whatever is worn. */
MARKS.clothGrime = { body: (p) => { const r = own(p, 3); return [clip(SHOULDERS.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z')),
  ...[-1, 1].map((s) => path(blob(r, 200 + s * 96, 392, 46, 16, 9, s * 0.4), fp(DUSTLIGHT, 0.2))),
  path(taper([[140 + r() * 20, 452], [180, 462], [226, 458]], 14, 0.3), fp(OILC, 0.22)), path(taper([[150 + r() * 20, 472], [190, 480], [222, 476]], 9, 0.3), fp(OILC, 0.18)), // a hand wiped on it
  path(blob(r, 200 + (r() - 0.5) * 100, 420, 36, 22, 8), fp(DIRT, 0.16)), UNCLIP]; } };
/** Patches sewn over the holes: two squares of another cloth, stitched round, one with its corner come loose. */
MARKS.patched = { body: (p) => { const r = own(p, 4), a = [[148, 404], [182, 399], [186, 432], [151, 437]], b = [[226, 440], [258, 444], [255, 474], [223, 470]]; return [ // inside the arms, which hang over the trunk's sides
  ...[[a, '#a8966c'], [b, '#7a4630']].flatMap(([q, c]) => [path(poly(q.map(([x, y]) => [x + 2, y + 3])), fp('#000', 0.22)), path(poly(q), { fill: c }), path(blob(r, q[0][0] + 14, q[0][1] + 16, 12, 9, 6), fp('#000', 0.1)), ...q.flatMap((pt, i) => stitches(pt, q[(i + 1) % 4], 4, 2.4, '#2a2420', 1.1, 0.6))]),
  path(`M 258 444 L 249 ${452 + r() * 4} L 243 445 Z`, fp('#000', 0.35))]; } };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const WASTELAND = { makeup: ['grime', 'sunweathered', 'goggleTan', 'sootBand', 'fingerStripes', 'scarStitched', 'respirator', 'browGoggles', 'headBandage'], glasses: ['weldingGoggles', 'dustGoggles'], hats: ['shemagh', 'scrapHelmet'], tops: ['ragWrap'], jackets: ['spikedVest', 'scrapArmor'], marks: ['clothGrime', 'patched'], props: ['tyrePauldronLeft', 'tyrePauldronRight'] };
tagPack(WASTELAND, 'only:wasteland');
tag('glasses', 'weldingGoggles', 'workshop'); // a welder's: an archetype's, not the crowd's
