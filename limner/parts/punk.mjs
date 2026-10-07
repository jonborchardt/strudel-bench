// The punk pack: what the punks cast (casts/punks.mjs) wears that nobody else does, tagged `only:punk`. In tone
// rather than line. Hair: liberty spikes and a tall mohawk fin, each spike a cone gelled stiff with a lit side and a
// shadow side and the dye grown out to a dark root, standing round the skull in three dimensions so the crest turns
// with the head (and the spikes that go behind it are drawn behind it); a chelsea, shaved but for the fringe and the
// side locks, bleached over dark roots; a bleached crop with leopard rosettes dyed on it. A studded leather jacket (a perfecto: wide lapels, epaulettes, pyramid studs
// that each catch the light and throw a shadow, hard highlights on the leather, a patch, a badge, a safety pin); a band
// tee with its collar cut off, its print cracked and real rips the skin shows through; a tartan shirt. On the body: a
// studded dog collar, a padlock on a chain, a bullet belt slung across the chest. Ear and nose hardware that rides with
// the ear's own swing on a turned head and with this face's own nose. Heavy liner, smudged. No words, no logos.
// parts.html?pack=punk is the sheet.
import { TOPS, JACKETS, HAIR, ACCESSORIES, MAKEUP, MARKS, NOSES, EAR_TURN, CHIN_Y, facePath, shade, mix, soft, lcg, mapXY, scaleAbout, path, ellipse, line, clip, UNCLIP, stroke, tag, eyeShape } from '../portrait.mjs';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const f1 = (v) => Math.round(v * 10) / 10;
const poly = (pts) => `M ${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L ')} Z`;
const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const fp = (fill, op = 1) => ({ fill, op });
const sideOf = (p) => p.light?.side || -1; // where the light comes from: -1 the viewer's left, as portrait.mjs reads it
const D = Math.PI / 180;
const STEEL = '#b4b9c1', STEEL_HI = '#f3f5f7', STEEL_LO = '#4e535b', BRASS = '#b08a3a', BRASS_HI = '#f0dc9a', BRASS_LO = '#5e4618';
/** One person's own generator (wasteland.mjs's `own`): from what a turn of the head does not change, so a rip or a patch stays put while the head moves, and two people who share a seed still differ. */
const own = (p, k = 0) => { let h = 7 + k; for (const ch of `${p.skin}${p.hairColor}${p.face?.height}${p.mouth?.width}`) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return lcg((p.seed ?? 1) * 17 + h); };
const rootOf = (c) => mix(c, '#1e1813', 0.72); // the hair as it grows, under the dye
/** A stroke as a shape: a band along `pts`, `w` wide at its start narrowing to `w * end` (a highlight on leather, a strap). */
const taper = (pts, w, end = 0.1) => {
  const n = pts.length, side = (sgn) => pts.map(([x, y], i) => { const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n - 1, i + 1)], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, h = (w / 2) * (1 - (1 - end) * (i / (n - 1))); return [x - (dy / l) * h * sgn, y + (dx / l) * h * sgn]; });
  return poly([...side(1), ...side(-1).reverse()]);
};
/** A quadratic's points, so a curve can be walked (studs along an edge, links down a chain). */
const qpts = (a, c, b, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });
/** Points every `gap` along a polyline, starting `gap / 2` in. */
const along = (pts, gap) => { const out = []; let carry = gap / 2; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); let d = carry; while (d <= l) { out.push(at(a, b, d / l)); d += gap; } carry = d - l; } return out; };

// --- metal --------------------------------------------------------------------------------------------------------
/** A pyramid stud seen from the front: four facets round an apex, the one facing the light near white, the one away near black, a hard shadow on the leather under it. */
const stud = (x, y, r, sd) => {
  const T = [x, y - r], R = [x + r, y], B = [x, y + r], L = [x - r, y], A = [x, y];
  const tl = sd < 0 ? STEEL_HI : STEEL, tr = sd < 0 ? STEEL : STEEL_HI, br = STEEL_LO, bl = sd < 0 ? '#7d828a' : STEEL_LO; // the facets toward the light lit, the lower ones dark
  return [path(poly([[x - r + 1.4, y + 1.6], [x + 1.4, y - r + 1.6], [x + r + 1.4, y + 1.6], [x + 1.4, y + r + 1.6]]), fp('#000', 0.5)),
    path(poly([L, T, A]), fp(tl)), path(poly([T, R, A]), fp(tr)), path(poly([R, B, A]), fp(br)), path(poly([B, L, A]), fp(bl)),
    ellipse(x + sd * r * 0.35, y - r * 0.35, r * 0.18, r * 0.18, fp('#ffffff', 0.9))];
};
/** A round stud (a cone seen end on): a dark rim, a steel disc, a hot spot toward the light. */
const dome = (x, y, r, sd) => [ellipse(x + 1, y + 1.4, r, r, fp('#000', 0.45)), ellipse(x, y, r, r, fp(STEEL_LO)), ellipse(x + sd * r * 0.12, y - r * 0.12, r * 0.8, r * 0.8, fp(STEEL)), ellipse(x + sd * r * 0.35, y - r * 0.35, r * 0.3, r * 0.3, fp('#ffffff', 0.9))];
/** A ring through skin: the front half only (the rest is inside), its lit edge and the two dimples it goes in by. */
const ring = (cx, cy, r, sd, sw = 1.6) => {
  const K = 0.5523, d = `M ${f1(cx - r)} ${f1(cy)} C ${f1(cx - r)} ${f1(cy + K * r)}, ${f1(cx - K * r)} ${f1(cy + r)}, ${f1(cx)} ${f1(cy + r)} C ${f1(cx + K * r)} ${f1(cy + r)}, ${f1(cx + r)} ${f1(cy + K * r)}, ${f1(cx + r)} ${f1(cy)}`;
  return [path(d, stroke('#000', sw + 0.6, 0.35)), path(d, stroke(STEEL, sw)), path(`M ${f1(cx + sd * r * 0.92)} ${f1(cy + r * 0.3)} Q ${f1(cx + sd * r * 0.7)} ${f1(cy + r * 0.85)} ${f1(cx)} ${f1(cy + r)}`, stroke(STEEL_HI, sw * 0.45, 0.9)), ...[-1, 1].map((s) => ellipse(cx + s * r, cy, sw * 0.6, sw * 0.6, fp('#3a2620', 0.45)))];
};

// --- hair ---------------------------------------------------------------------------------------------------------
/** One gelled spike: a cone from a root to a tip, split down its axis into a lit half and a shadow half, the dye fading in over the dark regrowth at its root and a hard line of gel on the lit side. `k` darkens the ones behind. */
const spike = (p, r, t, hw, k = 1, roots = true) => {
  const c = p.hairColor, sd = sideOf(p), dx = t[0] - r[0], dy = t[1] - r[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, lit = nx * sd - ny * 0.6 >= 0 ? 1 : -1;
  const a = [r[0] + nx * hw * lit, r[1] + ny * hw * lit], b = [r[0] - nx * hw * lit, r[1] - ny * hw * lit], root = rootOf(c), g = at(r, a, 0.5);
  return [path(poly([r, a, t]), fp(shade(mix(c, '#ffffff', 0.12), k))), path(poly([r, b, t]), fp(shade(mix(c, root, 0.5), k))), // the shadow side toward the root's own colour, not grey, or bleached spikes read as steel
    ...(roots ? [[0.46, 0.3], [0.32, 0.5], [0.2, 0.9]] : []).map(([u, op]) => path(poly([a, b, at(b, t, u), at(a, t, u)]), fp(root, op))), // the roots grown out under the dye, fading up the spike
    path(`M ${f1(at(g, t, 0.34)[0])} ${f1(at(g, t, 0.34)[1])} L ${f1(at(g, t, 0.8)[0])} ${f1(at(g, t, 0.8)[1])}`, stroke('#ffffff', 1.5, 0.32 * k))];
};
/** Spikes standing out of the skull in three dimensions: each `{ th, e }` is where it roots (degrees round the head from the face, and up from the ear line), `ed` the elevation it points at, `L` its length. The head's turn turns them about the vertical (as far as the features slide), so a crest turns with the face and the ones that go behind the skull are drawn behind it. */
const HEAD = { cx: 200, cy: 160, rx: 70, ry: 58, rz: 70 }; // the skull under the hair, a little proud of the head's outline (its crown is y 112)
const crest = (p, list, roots = true) => {
  const ph = 0.3 * (p.pose?.turn ?? 0), cs = Math.cos(ph), sn = Math.sin(ph), rnd = own(p, 5);
  const dir = (th, e) => [Math.cos(e * D) * Math.sin(th * D), Math.sin(e * D), Math.cos(e * D) * Math.cos(th * D)], rot = ([x, y, z]) => [x * cs + z * sn, y, -x * sn + z * cs];
  return list.map(({ th, e, ed = e, tw = 0, lat = 0, L, hw }) => {
    const j = 1 + (rnd() - 0.5) * 0.2, ja = (rnd() - 0.5) * 10, u = rot(dir(th, e)), d0 = dir(th + tw, ed + ja), v = rot([d0[0] + lat, d0[1], d0[2]]); // lat: a lean to the side, off the plane the spike roots in
    const r = [HEAD.cx + u[0] * HEAD.rx * 0.94, HEAD.cy - u[1] * HEAD.ry * 0.94]; let t = [r[0] + v[0] * L * j, r[1] - v[1] * L * j];
    if (t[1] < 4) t = at(r, t, (r[1] - 4) / (r[1] - t[1])); // the sheet's top edge
    return { z: u[2] * HEAD.rz, r, t, ops: spike(p, r, t, hw * (0.75 + 0.25 * Math.hypot(v[0], v[1])), u[2] < -0.25 ? 0.8 : 1, roots) };
  }).sort((a, b) => a.z - b.z);
};
const BEHIND = -16; // a spike rooted further back than this is behind the skull
const STUBBLE = 'M 126 163 C 124 121, 150 91, 199 90 C 247 91, 275 121, 274 163 C 255 139, 231 128, 200 128 C 169 128, 145 140, 126 163 Z'; // the buzz's cap, as portrait.mjs draws it
const stubble = (p, op = 0.3) => [clip(facePath({ face: { ...p.face, width: 156 } })), path(STUBBLE.replace('M 126 163', 'M 120 175'), fp(rootOf(p.hairColor), op)), ...soft(200, 118, 60, 14, rootOf(p.hairColor), op * 0.6), UNCLIP]; // shaved to the skin: a tone on the skull itself, inside the head's own outline (drawn for the default width, which the hair's fit then scales), never a cap standing off it
const LIBERTY = [
  ...[10, 30, 50, 68].flatMap((e, i) => [-1, 1].map((s) => ({ th: 74 * s, e, ed: e + 12, L: 62 + i * 7, hw: 12.5 }))),
  { th: 0, e: 84, ed: 88, L: 86, hw: 13 }, { th: 30, e: 72, ed: 80, L: 76, hw: 12 }, { th: -30, e: 72, ed: 80, L: 76, hw: 12 },
  ...[20, 46, 70].flatMap((e) => [-1, 1].map((s) => ({ th: 130 * s, e, ed: e + 8, L: 64, hw: 11 }))), { th: 180, e: 52, ed: 58, L: 70, hw: 11 },
];
/** Liberty spikes: the whole head gelled into a crown of long cones, the sides above the ears shaved to stubble. */
HAIR.libertySpikes = {
  back: (p) => crest(p, LIBERTY).filter((s) => s.z < BEHIND).flatMap((s) => s.ops),
  front: (p) => { const root = rootOf(p.hairColor);
    return [...stubble(p), path('M 138 146 C 136 108, 163 91, 200 89 C 237 91, 264 108, 262 146 C 246 132, 226 125, 200 125 C 174 125, 154 132, 138 146 Z', fp(root)), // the gathered roots the spikes stand out of
      ...crest(p, LIBERTY).filter((s) => s.z >= BEHIND).flatMap((s) => s.ops)]; },
};
const FIN = Array.from({ length: 9 }, (_, i) => { const e = 40 + i * 12.5; return { th: 0, e, ed: 90 + (e - 90) * 0.5, lat: [0.16, -0.12, 0.06, -0.18, 0.1, -0.06, 0.18, -0.14, 0.04][i], L: 62 + 34 * Math.sin(e * D), hw: 14 }; }); // the tips splay a little either side of the blade, so it is a row of points and not one needle seen end on // front to back over the crown, leaning forward at the brow and back at the nape
/** A tall mohawk fin: one blade of gelled hair from the brow to the nape, its edge a row of spikes, the sides shaved; seen edge on it is a tall narrow blade, and as the head turns its side swings into view. */
HAIR.mohawkFin = {
  back: (p) => crest(p, FIN, false).filter((s) => s.z < BEHIND).flatMap((s) => s.ops),
  front: (p) => { const c = p.hairColor, sp = crest(p, FIN, false), turn = p.pose?.turn ?? 0, sd = sideOf(p);
    const front = sp.filter((s) => s.z >= BEHIND);
    const sheet = poly([...front.map((s) => s.r), ...[...front].reverse().map((s) => at(s.r, s.t, 0.55))]), face = turn === 0 ? shade(c, 0.85) : Math.sign(-turn) === sd ? shade(c, 1.05) : shade(c, 0.66); // the fin's flat side: the one turned to the light lit
    const base = front.length ? `M ${front.map((s) => `${f1(s.r[0])} ${f1(s.r[1])}`).join(' L ')}` : '';
    return [...stubble(p, 0.34), path(sheet, fp(face)), ...front.flatMap((s) => s.ops), ...(base ? [path(base, stroke(rootOf(c), 20, 0.22)), path(base, stroke(rootOf(c), 10, 0.55))] : [])]; }, // the roots: one fade along the whole blade's base, where spike by spike it stepped like a stack of boxes
};
/** A crop dyed over a shaved head, and spotted: a short bleached pile hugging the skull, rosettes dyed on it in broken dark rings, the roots dark at the hairline. */
HAIR.leopardCrop = (p) => {
  const c = p.hairColor, root = rootOf(c), rnd = own(p, 9), sd = sideOf(p);
  const spots = [[200, 119], [176, 122], [224, 122], [156, 131], [244, 131], [140, 150], [260, 150], [134, 162], [266, 162]].map(([x, y]) => [x + (rnd() - 0.5) * 6, y + (rnd() - 0.5) * 4, 3.6 + rnd() * 1.8]);
  const rosette = ([x, y, r]) => [ellipse(f1(x), f1(y), f1(r * 0.75), f1(r * 0.55), fp(mix(c, '#8a5a24', 0.6), 0.8)), ...[0, 1, 2, 3].map((i) => { const a = i * 1.57 + rnd() * 0.7, bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r * 0.75; return ellipse(f1(bx), f1(by), f1(r * (0.32 + rnd() * 0.2)), f1(r * (0.24 + rnd() * 0.14)), fp('#24160e', 0.88)); })]; // a rosette: a tawny centre in a broken ring of dark blots
  const crop = 'M 127 170 C 127 136, 152 112, 200 108 C 248 112, 273 136, 273 170 C 256 146, 232 131, 200 130 C 168 131, 144 146, 127 170 Z';
  return [path(crop, fp(c)), clip(crop), ...soft(200, 162, 84, 34, root, 0.6), ...spots.flatMap(rosette), ...soft(200 + sd * 30, 114, 30, 9, '#ffffff', 0.22), UNCLIP]; // the pile follows the skull a little proud of it, so its grain stays on the head
};
/** A chelsea: shaved to stubble but for a fringe hacked straight across the brow and two long locks before the ears, bleached over roots grown dark. */
HAIR.chelsea = (p) => {
  const c = p.hairColor, root = rootOf(c), dx = 6 * (p.pose?.turn ?? 0), X = (x) => f1(x + dx), lit = shade(c, 1.12), sd = sideOf(p);
  const fringe = `M ${X(146)} 134 C ${X(160)} 111, ${X(240)} 111, ${X(254)} 134 L ${X(254)} 150 L ${X(246)} 143 L ${X(239)} 160 L ${X(230)} 146 L ${X(222)} 164 L ${X(213)} 148 L ${X(204)} 167 L ${X(195)} 149 L ${X(186)} 163 L ${X(178)} 146 L ${X(169)} 159 L ${X(161)} 142 L ${X(153)} 155 L ${X(146)} 146 Z`;
  const x0 = (s, v) => f1(200 + s * (v - 200));
  const band = (a, b) => `M ${X(146)} ${134 + a} C ${X(160)} ${111 + a}, ${X(240)} ${111 + a}, ${X(254)} ${134 + a} L ${X(254)} ${134 + b} C ${X(240)} ${111 + b}, ${X(160)} ${111 + b}, ${X(146)} ${134 + b} Z`; // a strip under the fringe's top edge
  const lock = (s) => { const x = (v) => f1(200 + s * (v - 200)); return [`M ${x(137)} 150 C ${x(133)} 176, ${x(130)} 204, ${x(131)} 240 L ${x(136)} 226 L ${x(139)} 238 C ${x(142)} 206, ${x(146)} 178, ${x(149)} 152 Z`, `M ${x(143)} 151 C ${x(140)} 180, ${x(137)} 210, ${x(139)} 238 C ${x(142)} 206, ${x(146)} 178, ${x(149)} 152 Z`]; }; // a long lock before the ear, and its inner half in shadow
  return [...stubble(p, 0.32), ...[-1, 1].flatMap((s) => { const [d, inner] = lock(s); return [path(d, fp(c)), path(inner, fp(shade(c, 0.62), 0.7)), path(`M ${x0(s, 137)} 150 L ${x0(s, 149)} 152 L ${x0(s, 147)} 166 L ${x0(s, 136)} 164 Z`, fp(root, 0.7))]; }), path(fringe, fp(c)), // each lock's root dark where it leaves the head
    path(band(-1, 4), fp(root, 0.85)), path(band(4, 9), fp(root, 0.45)), path(band(9, 15), fp(root, 0.18)), // the dark regrowth along the crown, fading into the bleach
    ...[160, 176, 192, 208, 224, 240].map((x, i) => path(`M ${X(x)} 128 Q ${X(x + 2)} 142 ${X(x - 1 + (i % 2) * 3)} ${150 + (i % 3) * 5}`, stroke(shade(c, 0.55), 1.3, 0.55))), // hacked, not combed
    path(`M ${X(200 + sd * 44)} 136 Q ${X(200 + sd * 22)} 128 ${X(200)} 131`, stroke(lit, 3.4, 0.5))];
};

// --- the jacket ---------------------------------------------------------------------------------------------------
const LAPEL = [[164, 350], [126, 366], [142, 380], [116, 402], [196, 452]]; // the viewer's left: collar at the neck, collar tip, notch, lapel point, where the lapel rolls into the front edge
const flip = (pts) => pts.map(([x, y]) => [400 - x, y]);
/** A patch sewn on: abstract (checks, a bolt, a target, tartan), its edge stitched. */
const patch = (kind, x, y, w, h, tilt) => {
  const q = (u, v) => [x + u * w - (v * h) * tilt, y + v * h + (u * w) * tilt], box = poly([q(0, 0), q(1, 0), q(1, 1), q(0, 1)]), out = [path(box, fp('#000', 0.35)), path(box, fp(kind === 'checks' ? '#e8e2d4' : kind === 'tartan' ? '#9a2424' : '#c8302a'))];
  if (kind === 'checks') for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2) out.push(path(poly([q(i / 4, j / 3), q((i + 1) / 4, j / 3), q((i + 1) / 4, (j + 1) / 3), q(i / 4, (j + 1) / 3)]), fp('#1a1a1a')));
  if (kind === 'bolt') out.push(path(poly([q(0.56, 0.08), q(0.3, 0.52), q(0.5, 0.5), q(0.4, 0.92), q(0.72, 0.42), q(0.52, 0.44)]), fp('#141214')));
  if (kind === 'tartan') { for (const u of [0.3, 0.72]) out.push(path(poly([q(u - 0.1, 0), q(u + 0.1, 0), q(u + 0.1, 1), q(u - 0.1, 1)]), fp('#1a1c2a', 0.45)), path(poly([q(0, u - 0.12), q(1, u - 0.12), q(1, u + 0.12), q(0, u + 0.12)]), fp('#1a1c2a', 0.45))); out.push(path(`M ${f1(q(0.5, 0)[0])} ${f1(q(0.5, 0)[1])} L ${f1(q(0.5, 1)[0])} ${f1(q(0.5, 1)[1])}`, stroke('#e0c040', 1, 0.8))); }
  out.push(path(box, stroke('#ffffff', 1, 0.18)), ...along([q(0, 0), q(1, 0), q(1, 1), q(0, 1), q(0, 0)], 4).map(([sx, sy]) => ellipse(f1(sx), f1(sy), 0.6, 0.6, fp('#000', 0.4))));
  return out;
};
const badge = (x, y, r, sd) => [ellipse(x + 1.5, y + 2, r, r, fp('#000', 0.45)), ellipse(x, y, r, r, fp('#eae4d8')), ellipse(x, y, r * 0.72, r * 0.72, fp('#c8302a')), ellipse(x, y, r * 0.44, r * 0.44, fp('#141214')), ellipse(x, y, r * 0.18, r * 0.18, fp('#eae4d8')),
  path(`M ${f1(x + sd * r * 0.75)} ${f1(y - r * 0.2)} Q ${f1(x + sd * r * 0.6)} ${f1(y - r * 0.65)} ${f1(x + sd * r * 0.1)} ${f1(y - r * 0.8)}`, stroke('#ffffff', 1.6, 0.7))]; // a pin badge, its dome catching the light
const safetyPin = (x0, y0, x1, y1, sd) => { const l = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / l * 2, ny = (x1 - x0) / l * 2;
  return [path(`M ${f1(x0 + 1.5)} ${f1(y0 + 2)} L ${f1(x1 + 1.5)} ${f1(y1 + 2)}`, stroke('#000', 4, 0.35)), path(`M ${f1(x0 + nx)} ${f1(y0 + ny)} L ${f1(x1 + nx)} ${f1(y1 + ny)}`, stroke(STEEL, 1.4)), path(`M ${f1(x0 - nx)} ${f1(y0 - ny)} L ${f1(x1 - nx * 0.5)} ${f1(y1 - ny * 0.5)}`, stroke(STEEL_HI, 1.2)),
    ellipse(x1, y1, 2.4, 2.4, { fill: 'none', stroke: STEEL, sw: 1.2 }), path(`M ${f1(x0 - nx * 1.4)} ${f1(y0 - ny * 1.4)} L ${f1(x0 + nx * 1.4)} ${f1(y0 + ny * 1.4)} L ${f1(x0 + (x0 - x1) / l * 4)} ${f1(y0 + (y0 - y1) / l * 4)} Z`, fp(STEEL)), ellipse(x0 + sd, y0 - 1, 0.8, 0.8, fp('#ffffff', 0.9))]; }; // two wires, the coil at one end and the clasp at the other
const PATCHES = ['checks', 'bolt', 'tartan'];
/** A studded perfecto worn open: wide lapels with a notch, epaulettes, pyramid studs down the lapels and along the shoulders, the leather's hard highlights, a patch, a pin badge, a safety pin, the zip pulls. */
JACKETS.studdedLeather = (p) => {
  const c = p.jacket.color, sd = sideOf(p), rnd = own(p, 3), face = mix(c, '#ffffff', 0.07), hi = (s) => (s === sd ? 0.3 : 0.1);
  const lapels = [LAPEL, flip(LAPEL)], panels = ['M 56 480 C 68 388, 118 357, 160 347 L 164 350 C 176 398, 190 436, 204 468 L 230 700 L 56 700 Z', 'M 344 480 C 332 388, 282 357, 240 347 L 236 350 C 224 398, 212 436, 204 468 L 230 700 L 344 700 Z'];
  const kinds = [PATCHES[Math.floor(rnd() * 3)], rnd() < 0.5];
  return [
    path('M 164 350 C 176 398, 190 436, 204 468 C 212 436, 224 398, 236 350', stroke('#000', 14, 0.28, 'butt')), // the front edges' shadow on the shirt
    ...panels.map((d) => path(d, fp(c))),
    ...lapels.map((L) => path(`M ${L[1][0]} ${L[1][1] + 4} L ${L[2][0] + 2} ${L[2][1] + 5} L ${L[3][0] + 1} ${L[3][1] + 5} L ${L[4][0]} ${L[4][1] + 6}`, stroke('#000', 7, 0.5))), // each lapel's shadow on the front
    ...lapels.map((L) => path(`M ${L[0][0]} ${L[0][1]} L ${L[1][0]} ${L[1][1]} L ${L[2][0]} ${L[2][1]} L ${L[3][0]} ${L[3][1]} L ${L[4][0]} ${L[4][1]} Q ${f1((L[0][0] + L[4][0]) / 2 + (L[4][0] - 200) * 0.2)} ${f1((L[0][1] + L[4][1]) / 2)} ${L[0][0]} ${L[0][1]} Z`, fp(face))),
    ...lapels.map((L, i) => path(`M ${L[0][0]} ${L[0][1]} Q ${f1((L[0][0] + L[4][0]) / 2 + (L[4][0] - 200) * 0.2)} ${f1((L[0][1] + L[4][1]) / 2)} ${L[4][0]} ${L[4][1]}`, stroke('#ffffff', 1.8, hi(i ? 1 : -1)))), // the roll of the lapel catches a hard line of light
    ...lapels.map((L) => path(`M ${L[1][0]} ${L[1][1]} L ${L[2][0]} ${L[2][1]}`, stroke('#000', 1.6, 0.5))), // the notch's seam
    ...lapels.map((L, i) => path(taper([at(L[2], L[4], 0.08), at(at(L[2], L[4], 0.45), L[0], 0.12), at(L[2], L[4], 0.86)], 7, 0.25), fp('#ffffff', hi(i ? 1 : -1) * 0.8))), // the leather's sheen down each lapel's face
    ...[-1, 1].flatMap((s) => taperStreaks(s, sd)),
    ...lapels.flatMap((L) => along([[L[0][0] + (L[1][0] - L[0][0]) * 0.25, L[0][1] + (L[1][1] - L[0][1]) * 0.25], L[1], L[2], L[3], L[4]], 11.5).slice(0, -1).map(([x, y]) => [x + (200 - x) * 0.07, y - 4]).flatMap(([x, y]) => stud(f1(x), f1(y), 4, sd))), // the studs: round the collar and down the lapel's edge
    ...patch(kinds[0], 222, 456, 30, 22, -0.1),
    ...(kinds[1] ? badge(252, 404, 7, sd) : safetyPin(242, 396, 260, 410, sd)), ...safetyPin(150, 404, 168, 420, sd),
    path('M 132 476 L 172 459', stroke('#000', 2.4, 0.55)), path('M 132 475 L 172 458', stroke(STEEL, 0.8, 0.6)), path(poly([[170, 457], [176, 454], [180, 463], [174, 466]]), fp(STEEL)), // the chest pocket's zip
    path(poly([[200, 462], [208, 462], [209, 476], [199, 476]]), fp(STEEL)), path('M 201 464 L 202 474', stroke(STEEL_HI, 1, 0.8)), // the main zip's pull
  ];
};
/** The leather's hard highlights where the front shows between the arms and under the lapels: the chest rounding away beside the lapel point, and the creases the zip pulls across the front; bright on the lit side, dull on the other. */
const taperStreaks = (s, sd) => { const k = s === sd ? 1.6 : 0.5, X = (x) => 200 + s * x;
  return [path(taper([[X(82), 404], [X(74), 432], [X(72), 470]], 4.5, 0.2), fp('#ffffff', 0.2 * k)),
    path(taper([[X(64), 478], [X(46), 466], [X(28), 470]], 3, 0.3), fp('#ffffff', 0.18 * k)), path(taper([[X(84), 478], [X(66), 462], [X(52), 458]], 2.4, 0.3), fp('#ffffff', 0.14 * k))]; };

// --- tops ---------------------------------------------------------------------------------------------------------
/** A band tee: the collar cut off (a raw scoop the neck shows through), a print with no words cracked by the wash, and rips the skin shows through, each with a shadowed edge, a curled lip and threads across it. */
TOPS.rippedBandTee = (p) => {
  const c = p.top.color, ink = p.top.accent ?? '#e8e2d6', rnd = own(p, 11), dark = shade(c, 0.5), lip = mix(c, '#ffffff', 0.25);
  const body = torso('M 66 480 C 80 388, 126 358, 162 348 L 176 350 C 182 374, 218 374, 224 350 L 238 348 C 274 358, 320 388, 334 480 Z', c);
  const print = [Array.from({ length: 11 }, (_, i) => { const a = (i / 11) * Math.PI * 2 + 0.2, r = i % 2 ? 7 + rnd() * 12 : 16 + rnd() * 32; return [200 + Math.cos(a) * r * 1.1, 424 + Math.sin(a) * r]; }), // a burst of shards, every point its own length
    [[216, 382], [172, 430], [196, 428], [178, 468], [230, 412], [206, 414], [228, 382]]][Math.floor(rnd() * 2)]; // or a bolt
  const cracks = Array.from({ length: 7 }, () => { const x = 160 + rnd() * 80, y = 386 + rnd() * 70; return path(`M ${f1(x)} ${f1(y)} L ${f1(x + (rnd() - 0.5) * 22)} ${f1(y + 4 + rnd() * 10)} L ${f1(x + (rnd() - 0.5) * 30)} ${f1(y + 10 + rnd() * 14)}`, stroke(c, 1 + rnd(), 0.9)); });
  const spots = [[150, 404], [246, 446], [168, 464], [238, 470]], picks = spots.map((s) => [rnd(), s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s).slice(0, 2 + (rnd() < 0.5 ? 1 : 0)); // two or three of them
  const rip = ([x, y]) => { const w = 12 + rnd() * 9, h = 5 + rnd() * 4, pts = [[x - w, y], [x - w * 0.5, y - h * (0.6 + rnd() * 0.6)], [x, y - h], [x + w * 0.45, y - h * (0.5 + rnd() * 0.7)], [x + w, y + rnd() * 3], [x + w * 0.4, y + h * (0.7 + rnd() * 0.5)], [x - w * 0.2, y + h], [x - w * 0.6, y + h * 0.6]];
    return [path(poly(pts), fp(p.skin)), path(poly([pts[0], pts[1], pts[2], pts[3], pts[4], at(pts[3], pts[5], 0.4), at(pts[1], pts[7], 0.4)]), fp('#000', 0.32)), // skin through it, the cloth's edge shadowing the top of it
      path(`M ${f1(pts[4][0])} ${f1(pts[4][1])} L ${f1(pts[5][0])} ${f1(pts[5][1])} L ${f1(pts[6][0])} ${f1(pts[6][1])} L ${f1(pts[7][0])} ${f1(pts[7][1])} L ${f1(pts[0][0])} ${f1(pts[0][1])}`, stroke(lip, 1.4, 0.7)), // the lower lip curled toward the light
      ...[0.3, 0.62].map((u) => line(f1(x - w + 2 * w * u), f1(y - h + 0.5), f1(x - w + 2 * w * u + 2), f1(y + h - 0.5), stroke(lip, 0.7, 0.7)))]; }; // threads left across
  return [body, path(poly(print), fp(ink, 0.92)), ...cracks, ...picks.flatMap(rip),
    path('M 176 350 C 182 374, 218 374, 224 350', stroke(dark, 3, 0.7)), ...Array.from({ length: 9 }, (_, i) => { const x = 180 + i * 5, y = 352 + Math.sin((i / 8) * Math.PI) * 16; return line(x, f1(y), f1(x + (rnd() - 0.5) * 2), f1(y + 2 + rnd() * 2.5), stroke(lip, 0.8, 0.6)); })]; // the raw edge, frayed
};
/** A tartan shirt, open at the throat: dark bands crossing at the setts, thin lines of the accent between, a collar and a placket. */
TOPS.tartanShirt = (p) => {
  const c = p.top.color, a = p.top.accent ?? '#e0c040', band = mix(c, '#141826', 0.7), dark = shade(c, 0.5);
  const body = torso('M 66 480 C 80 388, 126 358, 162 348 L 172 350 L 200 392 L 228 350 L 238 348 C 274 358, 320 388, 334 480 Z', c);
  const xs = [42, 90, 138, 186, 234, 282, 330], ys = [366, 414, 462];
  return [body,
    ...xs.map((x) => line(x, 340, x, 520, stroke(band, 18, 0.42, 'butt'))), ...ys.map((y) => line(40, y, 360, y, stroke(band, 18, 0.42, 'butt'))), // the setts: where the bands cross, the darkest squares
    ...xs.map((x) => line(x + 24, 340, x + 24, 520, stroke(a, 1.4, 0.6, 'butt'))), ...ys.map((y) => line(40, y + 24, 360, y + 24, stroke(a, 1.4, 0.6, 'butt'))),
    ...xs.map((x) => line(x, 340, x, 520, stroke('#0e0e12', 2, 0.5, 'butt'))), ...ys.map((y) => line(40, y, 360, y, stroke('#0e0e12', 2, 0.5, 'butt'))),
    path('M 200 392 L 200 520', stroke(dark, 3, 0.5, 'butt')), ...[412, 446].map((y) => ellipse(204, y, 2.2, 2.2, fp('#e8e2d6', 0.8))), // the placket and its buttons
    path('M 172 350 L 200 392 L 180 398 L 158 360 Z', fp(c)), path('M 228 350 L 200 392 L 220 398 L 242 360 Z', fp(c)), // the collar's points lie open
    path('M 172 350 L 200 392 L 180 398 L 158 360 Z', fp(band, 0.3)), path('M 228 350 L 200 392 L 220 398 L 242 360 Z', fp(band, 0.3)),
    path('M 180 398 L 158 360', stroke('#000', 3, 0.3)), path('M 220 398 L 242 360', stroke('#000', 3, 0.3))];
};

// --- ears and nose ------------------------------------------------------------------------------------------------
/** Hardware on an ear rides with that ear: its size about the ear's centre, the swing a turned head gives it (the far one tucked behind the head and foreshortened, the near one out a little; portrait.mjs's `ears`, whose constants are copied here), the face's eye line. */
const onEar = (p, side, ops) => { const cx = side < 0 ? 122 : 278, k = p.ears?.size ?? 1, turn = p.pose?.turn ?? 0, a = turn * turn, far = side === Math.sign(turn), piv = cx - 15 * side;
  const squash = turn ? (far ? 1 - 0.55 * a : 1 + 0.2 * a) : 1, dx = turn ? (far ? -side * EAR_TURN * a : side * 3 * a) : 0, dy = (p.eyes?.y ?? 196) - 196;
  return mapXY(ops, (x) => { const s = scaleAbout(cx, k)(x); return piv + (s - piv) * squash + dx; }, (y) => scaleAbout(212, k)(y) + dy); };
/** A safety pin through the left lobe, hanging; a ring at the top of the same ear's rim. */
ACCESSORIES.safetyPinEar = { at: 'ear', ops: (p) => onEar(p, -1, [...safetyPin(117, 236, 119, 258, sideOf(p)), ...ring(112, 200, 3.4, sideOf(p), 1.3)]) };
/** Three rings up the right ear's helix and a stud in the lobe. */
ACCESSORIES.helixRings = { at: 'ear', ops: (p) => onEar(p, 1, [...[[290, 206], [292, 216], [291, 226]].flatMap(([x, y]) => ring(x, y, 3.6, sideOf(p), 1.3)), ...dome(281, 234, 2.2, sideOf(p))]) };
/** Both lobes stretched round black tunnels, a steel rim on each. */
ACCESSORIES.lobeTunnels = { at: 'ear', ops: (p) => [-1, 1].flatMap((s) => onEar(p, s, [ellipse(200 + s * 81, 233, 5, 5.4, fp('#131113')), ellipse(200 + s * 81, 233, 5, 5.4, { fill: 'none', stroke: STEEL, sw: 1.3 }), path(`M ${200 + s * 81 - 3.4} 230 Q ${200 + s * 81} 227.6 ${200 + s * 81 + 3.4} 230`, stroke(STEEL_HI, 0.8, 0.8))])) };
const noseAt = (p) => { const st = NOSES[p.nose?.style] ?? NOSES.straight, y0 = p.eyes.y + 10, ky = (p.nose?.length ?? 38) / 38, kx = (p.nose?.width ?? 20) / 20; return { y: (u) => y0 + u * ky, x: (u) => 200 + u * kx, st }; }; // this face's nose, as portrait.mjs scales it: about the bridge's top
/** A ring through the septum, hanging under the tip. */
MARKS.punkSeptum = { face: (p) => { const n = noseAt(p); return ring(200, n.y(n.st.len + n.st.tip * 1.05), 4.2, sideOf(p), 1.6); } };
/** A ring through the left nostril's wing. */
MARKS.punkNostril = { face: (p) => { const n = noseAt(p); return ring(n.x(-n.st.w * 0.85), n.y(n.st.len + n.st.tip * 0.35), 3.4, sideOf(p), 1.4); } };

// --- on the neck and body -----------------------------------------------------------------------------------------
/** A dog collar: a leather band round the throat under the jaw, its top edge lit, round studs across it foreshortening round the neck, an O-ring at the front. */
MARKS.studCollar = { neck: (p) => {
  const w = Math.min(p.neck?.width ?? 60, (p.face?.width ?? 156) * (p.face?.jaw ?? 0.85) * 0.8), hw = w / 2 + 1.5, y = CHIN_Y + 6, sd = sideOf(p); // portrait.mjs's neckW, without the build's head scale (the punks are built as humans)
  const top = (dy) => `${f1(200 - hw)} ${f1(y - 3 + dy)} Q 200 ${f1(y + 6 + dy)} ${f1(200 + hw)} ${f1(y - 3 + dy)}`;
  return [path(`M ${top(0)} L ${f1(200 + hw)} ${f1(y + 9)} Q 200 ${f1(y + 18)} ${f1(200 - hw)} ${f1(y + 9)} Z`, fp('#151416')), path(`M ${top(0.8)}`, stroke('#ffffff', 1, 0.3)), path(`M ${top(12)}`, stroke('#000', 2.4, 0.4)),
    ...[-0.75, -0.4, 0, 0.4, 0.75].flatMap((u) => { const x = 200 + hw * u, yy = y + 4.5 + 4.5 * (1 - u * u) - 0.5, r = 2.4 * Math.sqrt(1 - u * u * 0.6); return dome(f1(x), f1(yy), f1(r), sd); }),
    ellipse(200, y + 17, 3.6, 4.2, { fill: 'none', stroke: '#000', sw: 2.8, op: 0.35 }), ellipse(200, y + 16, 3.6, 4.2, { fill: 'none', stroke: STEEL, sw: 1.6 })];
} };
/** A padlock on a chain round the neck, lying on the chest: links alternately face on and edge on, the lock's body lit down one side. */
MARKS.padlockChain = { body: (p) => {
  const sd = sideOf(p), links = [...qpts([168, 350], [176, 394], [200, 398], 8), ...qpts([200, 398], [224, 394], [232, 350], 8).slice(1)];
  return [...links.flatMap(([x, y], i) => (i % 2 ? [line(f1(x - 2), f1(y), f1(x + 2), f1(y), stroke(STEEL_LO, 2.2))] : [ellipse(f1(x), f1(y), 2.6, 2.2, { fill: 'none', stroke: '#000', sw: 2.4, op: 0.3 }), ellipse(f1(x), f1(y), 2.6, 2.2, { fill: 'none', stroke: STEEL, sw: 1.3 })])),
    path('M 193 412 C 193 398, 207 398, 207 412', stroke(STEEL_LO, 3.2)), path('M 193 412 C 193 400, 207 400, 207 412', stroke(STEEL, 1.6)), // the shackle
    path('M 189 410 L 211 410 L 212 428 Q 200 432 188 428 Z', fp('#000', 0.35)), path('M 188 408 L 212 408 L 211 426 Q 200 430 189 426 Z', fp(STEEL)),
    path(`M ${200 + sd * 9} 410 L ${200 + sd * 9} 425`, stroke(STEEL_HI, 2.2, 0.9)), path(`M ${200 - sd * 9} 410 L ${200 - sd * 9} 425`, stroke(STEEL_LO, 2.4, 0.8)), ellipse(200, 416, 1.6, 1.6, fp('#111')), line(200, 417, 200, 421, stroke('#111', 1.2))];
} };
/** A bullet belt slung from one shoulder across the chest: brass cartridges in a leather loop band, each lit down one side, their tips standing proud of the belt. */
MARKS.bandolier = { body: (p) => {
  const sd = sideOf(p), a = [104, 376], b = [318, 540], l = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l, nx = uy, ny = -ux; // n: across the belt, toward its top edge
  const P = (s, t) => [a[0] + ux * s + nx * t, a[1] + uy * s + ny * t];
  const belt = poly([P(0, -11), P(l, -11), P(l, 11), P(0, 11)]), shells = [];
  for (let s = 8; s < l; s += 10.5) { const lit = sd * nx > 0 ? 1 : -1;
    shells.push(path(poly([P(s - 3.2, -9), P(s + 3.2, -9), P(s + 3.2, 13), P(s - 3.2, 13)]), fp(BRASS)), path(poly([P(s + lit * 1.2 - 0.8, -9), P(s + lit * 1.2 + 0.8, -9), P(s + lit * 1.2 + 0.8, 13), P(s + lit * 1.2 - 0.8, 13)]), fp(BRASS_HI, 0.8)), path(poly([P(s - lit * 3.2, -9), P(s - lit * 2, -9), P(s - lit * 2, 13), P(s - lit * 3.2, 13)]), fp(BRASS_LO, 0.7)),
      path(`M ${f1(P(s - 3, 13)[0])} ${f1(P(s - 3, 13)[1])} Q ${f1(P(s, 23)[0])} ${f1(P(s, 23)[1])} ${f1(P(s + 3, 13)[0])} ${f1(P(s + 3, 13)[1])} Z`, fp('#8a6a52')), ellipse(f1(P(s + lit, 16)[0]), f1(P(s + lit, 16)[1]), 0.9, 0.9, fp('#f0d0b0', 0.8))); } // the casing, its lit and dark sides, the bullet's ogive
  return [path(poly([P(0, -9), P(l, -9), P(l, 13), P(0, 13)].map(([x, y]) => [x + 2, y + 4])), fp('#000', 0.3)), path(belt, fp('#2a1d16')), ...shells, path(poly([P(0, -3), P(l, -3), P(l, 6), P(0, 6)]), fp('#241812')), path(`M ${f1(P(0, -3)[0])} ${f1(P(0, -3)[1])} L ${f1(P(l, -3)[0])} ${f1(P(l, -3)[1])}`, stroke('#ffffff', 1, 0.18)), // the loops across them
    ...Array.from({ length: Math.floor(l / 10.5) }, (_, i) => { const [x, y] = P(8 + i * 10.5 + 5.25, 1.5); return line(f1(x - nx * 4.5), f1(y - ny * 4.5), f1(x + nx * 4.5), f1(y + ny * 4.5), stroke('#000', 1, 0.4)); })]; // the stitching between loops
} };

// --- paint --------------------------------------------------------------------------------------------------------
/** Heavy liner all round the eyes, a flick out of the outer corner, smudged down into the socket: on each eye's own
 *  outline (eyeShape), so it rings the eye this face has, whatever its shape, size, tilt or openness. */
MAKEUP.punkLiner = {
  skin: (p) => [-1, 1].flatMap((s) => { const E = eyeShape(p, s); return [...soft(E.cx + s * 2, E.y + E.bh + 4, E.w * 1.5, 8, '#141214', 0.42), ...soft(E.cx, E.y - 2, E.w * 1.8, E.th + 8, '#2a1a26', 0.25)]; }),
  face: (p) => [-1, 1].flatMap((s) => { const E = eyeShape(p, s), k = E.k; return [path(E.lid, stroke('#141214', 3.6, 0.85)),
    path(`M ${E.xo} ${E.yo} L ${E.xo + s * 12 * k} ${E.yo - 7 * k}`, stroke('#141214', 2.8, 0.85)), // the flick
    path(`M ${E.xi + s * 3} ${E.yi + 4} Q ${E.cx - s} ${E.y + E.bh + 9} ${E.xo - s * 2} ${E.yo + 4}`, stroke('#141214', 4, 0.32))]; }) }; // the smudge under it

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const PUNK = { hair: ['libertySpikes', 'mohawkFin', 'chelsea', 'leopardCrop'], jackets: ['studdedLeather'], tops: ['rippedBandTee', 'tartanShirt'], accessories: ['safetyPinEar', 'helixRings', 'lobeTunnels'], makeup: ['punkLiner'], marks: ['punkSeptum', 'punkNostril', 'studCollar', 'padlockChain', 'bandolier'] };
for (const n of PUNK.hair) tag('hair', n, 'only:punk');
for (const n of PUNK.jackets) tag('jacket', n, 'only:punk');
for (const n of PUNK.tops) tag('top', n, 'only:punk');
for (const n of PUNK.accessories) tag('accessories', n, 'only:punk');
for (const n of PUNK.makeup) tag('makeup', n, 'only:punk');
for (const n of PUNK.marks) tag('marks', n, 'only:punk');
