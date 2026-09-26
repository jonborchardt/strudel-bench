// A parameterized portrait: everything comes from one plain object (DEFAULTS merged with the character), drawn on a
// 400 x 480 sheet with the face centred on x = 200, its top at y = 112 + HEAD_DY, eyes near 196, mouth near 260.
// `portraitOps(p)` gives the drawing as a list of primitives (path, ellipse, rect, line, clip/unclip, push/pop
// transform groups), `toSvg(ops)` / `renderPortrait(p)` print it as SVG, `drawOn(ctx, ops)` paints it on a canvas in
// sheet units (the caller sets the transform). Paths are absolute M/L/C/Q/Z only, so one small parser covers them.
// Every part library (eyes, brows, noses, mouths, hair, facial hair, glasses, hats, tops, jackets, accessories,
// details) is drawn for the default head and fitted to the character's face width, eye spacing or nose size.
export const SKIN_COLORS = { porcelain: '#f0cbb3', fair: '#e7b99a', lightWarm: '#dca481', lightOlive: '#cf9b72', mediumWarm: '#bf825e', mediumOlive: '#aa7454', tan: '#9d6548', brown: '#805039', deepBrown: '#633d2f', deep: '#452d27' };
export const HAIR_COLORS = { jetBlack: '#151414', softBlack: '#211e1c', espresso: '#30231f', darkBrown: '#443128', brown: '#654836', chestnut: '#79533d', lightBrown: '#907057', auburn: '#854b37', copper: '#a15c3d', darkBlond: '#9f845d', blond: '#c3a775', lightBlond: '#dac89f', platinum: '#ded8ca', saltPepper: '#77736f', gray: '#979490', silver: '#b9b8b3', white: '#deddd6' };
export const EYE_COLORS = { veryDarkBrown: '#211917', darkBrown: '#372820', brown: '#604839', amber: '#8b6438', hazel: '#6e6746', green: '#536657', grayGreen: '#68736b', gray: '#697276', blueGray: '#617783', blue: '#52748e', lightBlue: '#738fa1' };
export const CLOTHING_COLORS = { black: '#222426', charcoal: '#373b3e', darkGray: '#54595d', gray: '#74797c', lightGray: '#a9aaab', offWhite: '#e7e4dc', cream: '#dad0bd', navy: '#263849', darkBlue: '#304c61', blue: '#41677f', fadedBlue: '#698492', forest: '#405547', olive: '#59604b', sage: '#778271', burgundy: '#673f45', rust: '#8b543c', mustard: '#9c7e3e', brown: '#665047', camel: '#9a7857', tan: '#aa9276', mutedPurple: '#665c70', dustyRose: '#956a70' };
export const COLORS = { skin: SKIN_COLORS, hair: HAIR_COLORS, eyes: EYE_COLORS, clothing: CLOTHING_COLORS };
/** A hex colour scaled toward black (k < 1) or white (k > 1). */
export const shade = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('');

// corner: how far above the chin the jaw angle sits (32 unless set); the square and broad heads carry it higher, so they taper under the beard
export const FACE_SHAPES = {
  oval: { width: 156, height: 204, jaw: 0.75, chin: 0.2 }, round: { width: 168, height: 190, jaw: 0.9, chin: 0.06 }, square: { width: 171, height: 201, jaw: 0.73, chin: 0.03, corner: 40 },
  heart: { width: 166, height: 204, jaw: 0.63, chin: 0.33 }, diamond: { width: 165, height: 210, jaw: 0.66, chin: 0.26 },
  narrow: { width: 146, height: 216, jaw: 0.68, chin: 0.22 }, broad: { width: 180, height: 204, jaw: 0.67, chin: 0.1, corner: 40 }, softSquare: { width: 170, height: 204, jaw: 0.76, chin: 0.08 }, longOval: { width: 151, height: 220, jaw: 0.72, chin: 0.22 },
};
export const NECK_TYPES = { narrow: { width: 48, height: 71 }, average: { width: 63, height: 72 }, thick: { width: 79, height: 67 }, long: { width: 58, height: 88 }, short: { width: 68, height: 55 } };

export const HEAD_DY = 8; // the head sits this far down the neck
const NECK_TOP = 240, NECK_BASE = [200, 300 + HEAD_DY], HIPS = [200, 600];
const headDrop = (p) => (204 - p.face.height) * 0.8; // the chin, not the crown, is what sits on the neck: a short face rides lower, a long one higher, so every face shows the same neck
export const DEFAULTS = {
  background: '#d7d0c5', skin: '#c98e68', hairColor: '#30231e',
  face: { ...FACE_SHAPES.oval, skew: 0 }, // skew: the seed's asymmetry, one side a little lower, the chin off centre, in -1..1
  ears: { size: 1 },
  eyes: { y: 196, spacing: 52, openness: 1, asym: 1, style: 'almond', iris: '#604839', pupil: '#171716', browStyle: 'softArch', browLift: 0, browSkew: 0, look: { x: 0, y: 0 } }, // asym: the left eye's openness against the right's
  nose: { style: 'straight', length: 38, width: 20 },
  mouth: { style: 'plain', y: 260, width: 48, smile: 0.05, fullness: 0.45, color: null, open: 0 }, // color: the lips; null is a lip tone under the skin
  hair: { style: 'sidePart' },
  facialHair: { style: 'none' },
  hat: { style: 'none', color: '#353b43', accent: '#24292f', metal: 0 }, // metal: the garment shaded as metallic cloth (sheen)
  top: { style: 'crewTshirt', color: '#42576c', accent: null, graphic: null, metal: 0 }, // accent: piping, a tie; graphic: a GRAPHICS name printed on the torso
  jacket: { style: 'none', color: '#373b3e', metal: 0 },
  body: { width: 1 }, // the shoulders' width against the default torso
  glasses: null, // { style, color }
  accessories: [], details: [], makeup: [], marks: [], props: [], blush: 0, // names in ACCESSORIES, DETAILS, MAKEUP, MARKS, PROPS
  seed: 1, // places the sheen's folds
  light: { side: -1, amount: 0.5 }, // the modelling: a light on one cheek and a shadow on the other, from none (0) to full (1)
  neck: { ...NECK_TYPES.average },
  pose: { headX: 0, headY: 0, headTilt: 0, bodyX: 0, bodyTilt: 0 }, // the head moves on the neck (sheet units, radians, about the neck base), the body sways about the hips
};

export function merge(base, override) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(override || {})) out[k] = v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' ? merge(out[k], v) : v;
  return out;
}

// the primitives: `a` is the shared style (fill, stroke, sw, op, cap)
const path = (d, a = {}) => ({ k: 'path', d: d.replace(/\s+/g, ' ').trim(), ...a });
const ellipse = (cx, cy, rx, ry, a = {}) => ({ k: 'ellipse', cx, cy, rx, ry, ...a });
const rect = (x, y, w, h, a = {}) => ({ k: 'rect', x, y, w, h, ...a });
const line = (x1, y1, x2, y2, a = {}) => ({ k: 'line', x1, y1, x2, y2, ...a });
const clip = (d, rule) => ({ k: 'clip', d: d.replace(/\s+/g, ' ').trim(), ...(rule ? { rule } : {}) }), UNCLIP = { k: 'unclip' }; // rule: 'evenodd' for a path with a hole
const push = (tx, ty, rot, [cx, cy]) => ({ k: 'push', tx, ty, rot, cx, cy }), POP = { k: 'pop' }; // a transform group: shifted by (tx, ty), turned by rot about (cx, cy)
const stroke = (color, sw, op = 1, cap = 'round') => ({ fill: 'none', stroke: color, sw, op, cap });
const ARGS = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };
const tokens = (d) => d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
/** The ops with every x through `fx` and every y through `fy`: how a part drawn for the default head follows this one. */
export function mapXY(ops, fx, fy = (y) => y) {
  const r = (v) => Math.round(v * 100) / 100;
  const px = (d) => { let cmd = 'M', i = 0; return tokens(d).map((t) => { if (/[a-z]/i.test(t)) { cmd = t.toUpperCase(); i = 0; return t; } const n = ARGS[cmd] || 2, v = i % n % 2 === 0 ? fx(+t) : fy(+t); i++; return String(r(v)); }).join(' '); };
  return ops.map((o) => o.k === 'path' || o.k === 'clip' ? { ...o, d: px(o.d) } : o.k === 'ellipse' ? { ...o, cx: r(fx(o.cx)), cy: r(fy(o.cy)), rx: r(fx(o.cx + o.rx) - fx(o.cx)), ry: r(fy(o.cy + o.ry) - fy(o.cy)) } : o.k === 'rect' ? { ...o, x: r(fx(o.x)), y: r(fy(o.y)), w: r(fx(o.x + o.w) - fx(o.x)), h: r(fy(o.y + o.h) - fy(o.y)) } : o.k === 'line' ? { ...o, x1: r(fx(o.x1)), x2: r(fx(o.x2)), y1: r(fy(o.y1)), y2: r(fy(o.y2)) } : o);
}
export const mapX = (ops, fx) => mapXY(ops, fx);
const scaleAbout = (c, k) => (v) => c + (v - c) * k;

// the head is not an egg: from the temple the side runs out to a cheekbone, then in along the jaw to its angle (an
// on-curve corner, rounded off the more `jaw` is), then under to the chin; `skew` (from the seed) drops one cheekbone
// and jaw a little and moves the chin off centre, since no face is symmetric
function facePath(p) {
  const cx = 200, top = 112, w = p.face.width, h = p.face.height, hw = w / 2, bottom = top + h, sk = p.face.skew ?? 0;
  const jawX = hw * p.face.jaw * 0.94, chinDrop = 16 * p.face.chin, chinX = cx + sk * 5, soft = 12 + 26 * p.face.jaw; // how far the jaw corner's handles reach: a round face has no corner
  const seg = (s) => { // one side descending, temple to chin, as three cubics [c1, c2, end]
    const x = (d) => cx + s * d, cheekY = top + 104 + s * sk * 5, jawY = bottom - (p.face.corner ?? 32) - s * sk * 4;
    return [[[x(hw - 18), top - 2], [x(hw + 5), top + 58], [x(hw - 6), cheekY]], [[x(hw - 8), cheekY + 34], [x(jawX + soft * 0.45), jawY - soft], [x(jawX), jawY]], [[x(jawX - soft * 0.36), jawY + soft * 0.8], [chinX + s * 16, bottom + chinDrop + 1], [chinX, bottom + chinDrop]]];
  };
  const P = ([a, b]) => `${Math.round(a * 10) / 10} ${Math.round(b * 10) / 10}`, L = seg(-1), R = seg(1);
  const down = L.map(([c1, c2, e]) => `C ${P(c1)}, ${P(c2)}, ${P(e)}`).join(' ');
  const up = [`C ${P(R[2][1])}, ${P(R[2][0])}, ${P(R[1][2])}`, `C ${P(R[1][1])}, ${P(R[1][0])}, ${P(R[0][2])}`, `C ${P(R[0][1])}, ${P(R[0][0])}, ${cx} ${top}`].join(' ');
  return `M ${cx} ${top} ${down} ${up} Z`;
}

// the neck starts high behind the head (the head is drawn over it), no wider than the jaw, its shadow under the chin
function neck(p) {
  const w = Math.min(p.neck.width, p.face.width * p.face.jaw * 0.8), x1 = 200 - w / 2, x2 = 200 + w / 2, top = NECK_TOP, bottom = 302 + p.neck.height;
  const chin = 112 + HEAD_DY + headDrop(p) + p.face.height + 16 * p.face.chin - 6;
  return [
    path(`M ${x1} ${top} L ${x1 + 4} ${bottom} Q 200 ${bottom + 22} ${x2 - 4} ${bottom} L ${x2} ${top} Z`, { fill: p.skin }),
    ...[30, 22, 14, 7].map((d) => path(`M ${x1} ${chin} L ${x2} ${chin} L ${x2} ${chin + d} C ${x2 - 10} ${chin + d + 14}, ${x1 + 10} ${chin + d + 14}, ${x1} ${chin + d} Z`, { fill: '#000', op: 0.06 })), // the chin's shadow, fading down the neck
  ];
}

function ears(p) {
  const rx = 15 * p.ears.size, ry = 27 * p.ears.size, s = stroke(underSkin(p.skin, '#7f5140', 0.5), 2.2, 0.48);
  const k = p.ears.size, bowl = (cx, sd) => [...soft(cx + 2 * sd, 215, 6 * k, 11 * k, TONE, 0.3), ellipse(cx - 4 * sd, 226, 5 * k, 4 * k, { fill: '#fff', op: 0.08 }), path(`M ${cx - 3 * sd} ${187} C ${cx - 14 * sd} 190, ${cx - 17 * sd} 206, ${cx - 12 * sd} 222`, stroke('#fff', 2, 0.14))]; // the ear's bowl in shadow, the lobe and the rim of the helix in light
  return [ellipse(122, 212, rx, ry, { fill: p.skin }), ellipse(278, 212, rx, ry, { fill: p.skin }), ...bowl(122, 1), ...bowl(278, -1), path('M 119 199 C 109 205, 111 224, 121 227 C 129 222, 127 211, 120 211', s), path('M 281 199 C 291 205, 289 224, 279 227 C 271 222, 273 211, 280 211', s)];
}

// the head: the face, its modelling (a light on one side, a shadow on the other, as strong as the character's `light` says) and a faint blush on the cheeks when `blush` is up
// Tone, not line, is what keeps a face from reading as a cartoon: every head gets its planes (the eye sockets under
// the brow, the hollow under each cheekbone, the temples) as soft low-opacity shapes, and `light` adds a side.
const TONE = '#4a2418';
const soft = (cx, cy, rx, ry, fill, op) => [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.5, 0.4].map((k) => ellipse(cx, cy, rx * k, ry * k, { fill, op: op / 8 })); // a plane with no edge: eight fading ellipses stand in for a gradient
const planes = (p) => { const y = p.eyes.y, sp = p.eyes.spacing / 2, h = p.face.height, w = p.face.width / 2; return [
  ...soft(200 - sp, y - 2, 26, 16, TONE, 0.09), ...soft(200 + sp, y - 2, 26, 16, TONE, 0.09), // the sockets
  ...soft(200 - w * 0.66, y + 60, 22, h * 0.18, TONE, 0.08), ...soft(200 + w * 0.66, y + 60, 22, h * 0.18, TONE, 0.08), // the hollows under the cheekbones
  ...soft(200 - w * 0.82, y - 8, 14, 30, TONE, 0.06), ...soft(200 + w * 0.82, y - 8, 14, 30, TONE, 0.06), // the temples
  ...soft(200, 112 + h * 0.62, w * 0.55, h * 0.32, '#fff', 0.07), // the light on the front plane: the forehead, the nose and the chin
]; };
const head = (p) => [path(facePath(p), { fill: p.skin }), ...planes(p),
  ...(p.light.amount > 0.02 ? [ellipse(200 + 30 * p.light.side, 245, 34, 48, { fill: '#fff', op: 0.03 * p.light.amount }), ...soft(200 - 36 * p.light.side, 240, 44, 60, '#592e23', 0.12 * p.light.amount)] : []),
  ...(p.blush > 0.02 ? [ellipse(200 - p.eyes.spacing / 2 - 6, p.eyes.y + 32, 16, 8, { fill: '#c9564c', op: 0.15 * p.blush }), ellipse(200 + p.eyes.spacing / 2 + 6, p.eyes.y + 32, 16, 8, { fill: '#c9564c', op: 0.15 * p.blush })] : [])];

// eyes: the right eye's shape (its outer corner at +x), mirrored for the left; `top`/`bot` are the lid heights at
// openness 1, `inn`/`out` the corners' drop, a crease the fold above a hooded or monolid eye
export const EYES = {
  almond: { w: 14, top: 9, bot: 6, iris: 5.8, white: '#f1e7dc' },
  round: { w: 13, top: 11, bot: 10, iris: 6.2, white: '#f1e7dc' },
  narrow: { w: 15, top: 5, bot: 4, iris: 5.2, irisY: 4.8, white: '#eee3d9' },
  hooded: { w: 14, top: 6, bot: 5, iris: 5.6, irisY: 5.3, white: '#eee4da', crease: { dy: -7, ctl: -12, sw: 1.3, op: 0.32, color: '#684b3d' } },
  monolid: { w: 14, top: 4, bot: 5, iris: 5.3, irisY: 4.8, white: '#ede3da', crease: { dy: -5, ctl: -8, sw: 1.5, op: 0.35, color: '#5f4238' } },
  upturned: { w: 14.5, top: 8, bot: 6, inn: 1, out: -3, iris: 5.6, irisY: 5.4, irisDy: -1 },
  downturned: { w: 14, top: 8, bot: 7, inn: -2, out: 2, iris: 5.6, irisY: 5.4 },
};
export const EYE_STYLES = Object.keys(EYES);
function eye(cx, p, side) { // side: +1 the right eye, -1 the left (its outer corner at -x)
  const e = p.eyes, st = EYES[e.style] ?? EYES.almond, o = e.openness * (side < 0 ? e.asym : 1), y = e.y;
  const xi = cx - st.w * side, xo = cx + st.w * side, yi = y + (st.inn ?? 0), yo = y + (st.out ?? 0), lx = cx + e.look.x * 3, ly = y + (st.irisDy ?? 0) + e.look.y * 2;
  const lid = `M ${xi} ${yi} Q ${cx} ${y - st.top * o} ${xo} ${yo} Q ${cx} ${y + st.bot * o} ${xi} ${yi} Z`;
  const ir = st.iris * 1.25, iry = (st.irisY ?? st.iris) * 1.25; // an eye at rest shows little white: the iris nearly fills the lids' height
  return [
    path(lid, { fill: st.white ?? '#f0e6dc' }),
    clip(lid), ellipse(lx, ly, ir, iry, { fill: e.iris }), ellipse(lx, ly, ir, iry, stroke(shade(e.iris, 0.5), 1.2, 0.7)), ellipse(lx, ly, ir * 0.4, ir * 0.4, { fill: e.pupil }), ellipse(lx - 1.8, ly - 2, 1.3, 1.3, { fill: '#fff', op: 0.8 }), // the iris (a dark limbal ring) and pupil stay behind the lids
    ellipse(cx, y - st.top * o - 2, st.w + 2, 5, { fill: TONE, op: 0.28 }), UNCLIP, // the upper lid's shadow across the white and the iris
    path(`M ${xi - side} ${yi} Q ${cx} ${y - st.top * o - 0.6} ${xo + side} ${yo} Q ${xo + 2.5 * side} ${yo - 1} ${xo + 4 * side} ${yo - 2.5}`, stroke('#32241f', 2)), // the upper lid, flicking out into a lash
    path(`M ${xi + 3 * side} ${yi + 1} Q ${cx} ${y + st.bot * o + 1.5} ${xo - side} ${yo + 0.5}`, stroke('#32241f', 1, 0.35)), // the lower lid, half tone
    ...(st.crease ? [path(`M ${cx - 16} ${y + st.crease.dy} Q ${cx} ${y + st.crease.ctl} ${cx + 16} ${y + st.crease.dy}`, stroke(st.crease.color, st.crease.sw, st.crease.op))] : []),
  ];
}

// brows: the right brow as [x0, y0, cx, cy, x1, y1, width] relative to the eye's centre and line, inner end first; mirrored for the left
export const BROWS = {
  straight: [-16, -27, 0, -30, 16, -27, 4.6], softArch: [-16, -25, 0, -35, 17, -27, 4.5], highArch: [-16, -24, 0, -39, 16, -28, 4], thickStraight: [-17, -27, 0, -30, 17, -27, 6.8],
  angled: [-17, -25, -2, -33, 17, -30, 4.7], thin: [-16, -26, 0, -32, 16, -27, 2.5], tapered: [-18, -26, -4, -34, 18, -28, 5.4],
};
export const BROW_STYLES = Object.keys(BROWS);
function brow(cx, p, side) {
  const e = p.eyes, [x0, y0, mx, my, x1, y1, sw] = BROWS[e.browStyle] ?? BROWS.softArch, y = e.y - e.browLift + side * e.browSkew * 5; // skew: one brow up, the other down
  const a = [cx + x0 * side, y + y0], c = [cx + mx * side, y + my], b = [cx + x1 * side, y + y1], m = [(a[0] + 2 * c[0] + b[0]) / 4, (a[1] + 2 * c[1] + b[1]) / 4]; // the curve split at its middle: a drawn brow is heavy at the inner end and tapers out
  const out = [path(`M ${a[0]} ${a[1]} Q ${(a[0] + c[0]) / 2} ${(a[1] + c[1]) / 2} ${m[0]} ${m[1]}`, stroke(p.hairColor, sw, 0.92)), path(`M ${m[0]} ${m[1]} Q ${(c[0] + b[0]) / 2} ${(c[1] + b[1]) / 2} ${b[0]} ${b[1]}`, stroke(p.hairColor, sw * 0.6, 0.85))];
  if (e.browStyle === 'tapered') out.push(path(`M ${cx + 7 * side} ${y - 29} Q ${cx + 14 * side} ${y - 28} ${cx + 19 * side} ${y - 27}`, stroke(p.skin, 2.4)));
  return out;
}
const eyes = (p) => [...eye(200 - p.eyes.spacing / 2, p, -1), ...eye(200 + p.eyes.spacing / 2, p, 1), ...brow(200 - p.eyes.spacing / 2, p, -1), ...brow(200 + p.eyes.spacing / 2, p, 1)];

const NL = (sw, op) => stroke('#805243', sw, op); // a nose line, recoloured under the skin by `nose`, and lifted in opacity on a dark skin, where a half-tone line would vanish
// a feature line under this skin: the reference colour (drawn for the default skin), or the skin darkened by `k` where that is darker, channel by channel, so a line never comes out lighter than the face it sits on
const luma = (hex) => [0.299, 0.587, 0.114].reduce((a, w, i) => a + (w * parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)) / 255, 0);
const underSkin = (skin, ref, k) => { const d = shade(skin, k); return '#' + [1, 3, 5].map((i) => Math.min(parseInt(d.slice(i, i + 2), 16), parseInt(ref.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join(''); };
export const NOSES = {
  straight: () => [path('M 199 205 C 198 219, 195 233, 195 243 C 197 249, 204 250, 209 246', NL(2.2, 0.55)), path('M 190 248 Q 200 255 211 248', NL(1.7, 0.45))],
  short: () => [path('M 199 210 C 198 222, 196 233, 196 239 Q 200 245 205 240', NL(2.1, 0.5)), path('M 191 242 Q 200 248 209 242', NL(1.8, 0.45))],
  long: () => [path('M 199 202 C 197 222, 193 242, 194 252 Q 200 260 208 254', NL(2.2, 0.55)), path('M 188 255 Q 200 262 212 255', NL(1.7, 0.45))],
  broad: () => [path('M 199 207 C 198 222, 196 238, 197 246', NL(2.1, 0.5)), path('M 184 249 C 190 256, 211 256, 217 249', NL(2, 0.52))],
  narrow: () => [path('M 200 205 C 198 221, 197 238, 198 246 Q 200 250 204 247', NL(1.9, 0.52)), path('M 192 249 Q 200 253 208 249', NL(1.4, 0.45))],
  upturned: () => [path('M 199 208 C 197 223, 195 237, 197 243', NL(2, 0.5)), path('M 189 247 Q 200 242 211 247', NL(2, 0.52))],
  aquiline: () => [path('M 199 203 C 198 218, 205 225, 202 236 C 200 243, 198 249, 205 253', NL(2.4, 0.56)), path('M 191 254 Q 200 259 211 254', NL(1.7, 0.46))],
  roundedTip: () => [path('M 199 205 C 198 221, 195 236, 196 245', NL(2.1, 0.5)), ellipse(200, 250, 9, 5, { fill: '#754334', op: 0.08 }), path('M 189 249 Q 200 257 212 249', NL(1.8, 0.48))],
};
export const NOSE_STYLES = Object.keys(NOSES);
const nose = (p) => { const c = underSkin(p.skin, '#805243', 0.5), lift = 1 + Math.max(0, 0.5 - luma(p.skin)) * 2, sd = p.light.side || -1; return mapXY([
  ellipse(200 - 7 * sd, 232, 7, 17, { fill: TONE, op: 0.07 }), ellipse(200, 254, 12, 4, { fill: TONE, op: 0.09 }), // the bridge's shadow side and the shadow under the tip: a nose has planes before it has a line
  ...(NOSES[p.nose.style] ?? NOSES.straight)().map((o) => (o.stroke === '#805243' ? { ...o, stroke: c, op: Math.min(1, o.op * lift) } : o.fill === '#754334' ? { ...o, fill: c } : o))], scaleAbout(200, p.nose.width / 20), scaleAbout(206, p.nose.length / 38)); };

// mouths: the lips' style; the smile is a parameter (a broad one shows teeth), as is `open`
export const MOUTHS = { plain: {}, thin: { thin: true }, full: { full: true }, wide: { wide: 1.3 }, asym: { asym: 1 } };
export const MOUTH_STYLES = Object.keys(MOUTHS);
function mouth(p) {
  const m = { ...p.mouth, color: p.mouth.color ?? underSkin(p.skin, '#8b5149', 0.72) }, st = MOUTHS[m.style] ?? MOUTHS.plain, w = m.width * (st.wide ?? 1), x1 = 200 - w / 2, x2 = 200 + w / 2, open = m.open ?? 0, a = st.asym ?? 0;
  const yl = m.y + a * 2, yr = m.y - a * 4, qx = 200 - a * 7, mid = m.y + m.smile * 18 - 2 * open, dark = shade(m.color, 0.45);
  const upper = `M ${x1} ${yl} Q ${qx} ${mid} ${x2} ${yr}`, out = [ellipse(200, m.y + 11 + 6 * m.fullness, w * 0.36, 4.5, { fill: TONE, op: 0.09 }), ellipse(200, m.y + 5 + 5 * m.fullness, w * 0.28, 3, { fill: '#fff', op: 0.07 })]; // the shadow under the lower lip and the light on it, so the mouth sits in a face rather than on it
  // every mouth is two lips, not a line: the upper a bowed lens in shadow, the lower a fuller lens in the light, the parting drawn between them; the style sets how much lip there is
  const k = st.thin ? 0.45 : st.full ? 1.5 : 1, top = (4 + 4 * m.fullness) * k, bot = (6 + 8 * m.fullness) * k;
  out.push(path(`${upper} Q ${qx + w * 0.26} ${mid - top * 1.15} ${qx} ${mid - top * 0.55} Q ${qx - w * 0.26} ${mid - top * 1.15} ${x1} ${yl} Z`, { fill: shade(m.color, 0.82), op: 0.8 }), path(`${upper} Q ${qx} ${mid + bot} ${x1} ${yl} Z`, { fill: shade(m.color, 1.08), op: 0.72 }));
  if (open > 0.08) out.push(path(`${upper} Q ${qx} ${m.y + 8 + 26 * open} ${x1} ${yl} Z`, { fill: '#3a1f1c' })); // the inside is the region between the two lips, so it never shows past them
  else if (m.smile > 0.75) out.push(path(`${upper} Q ${qx} ${m.y + m.smile * 6} ${x1} ${yl} Z`, { fill: dark }), path(`M ${x1 + 6} ${m.y + 2} Q ${qx} ${m.y + m.smile * 8} ${x2 - 6} ${m.y + 2}`, stroke('#f2e7dc', 4))); // a broad smile shows teeth
  out.push(path(upper, stroke(shade(m.color, 0.55), st.thin ? 1.3 : 1.7, 0.85))); // the parting
  if (open > 0.08) out.push(path(`M ${x1} ${yl} Q ${qx} ${m.y + 8 + 26 * open} ${x2} ${yr}`, stroke(shade(m.color, 0.7), 2)));
  return out;
}

// hair: `front` sits over the face, `back` behind the head and neck (long styles, buns, an afro's mass). Each entry is
// front(p), or { back, front }. Drawn for the default head, fitted to the face width.
const CAP = (p) => [path('M 126 163 C 124 121, 150 91, 199 90 C 247 91, 275 121, 274 163 C 255 139, 231 128, 200 128 C 169 128, 145 140, 126 163 Z', { fill: p.hairColor })]; // the buzz: a hairline for styles whose mass sits behind
const longBack = (bottom, p) => [path(`M 110 150 C 110 78, 150 60, 200 60 C 250 60, 290 78, 290 150 L 294 ${bottom} Q 294 ${bottom + 20} 274 ${bottom + 20} L 126 ${bottom + 20} Q 106 ${bottom + 20} 106 ${bottom} Z`, { fill: shade(p.hairColor, 0.8) })]; // the sheet of long hair behind the neck and shoulders
const gloss = (d, sw = 2.1) => path(d, stroke('#fff', sw, 0.09));
// strands: a fan of fine lines combed from the crown, darker and lighter than the hair by turns, jittered by the seed; clipped to the hair's mass by the caller, so they read as its grain on any style
// `from` is the crown they fan from, `a0..a1` the fan in radians, `len` how far; a beard combs down from the chin with the same
const strands =(p, { from = [200, 64], a0 = -0.15, a1 = Math.PI + 0.15, len = 150, n = 22 } = {}) => { const rnd = lcg(p.seed), out = [];
  const dark = 0.16 * (1 - 0.7 * luma(p.hairColor)); // a dark strand on white hair is a crack, so it fades with the hair's lightness
  for (let i = 0; i < n; i++) { const a = a0 + (i / (n - 1)) * (a1 - a0) + (rnd() - 0.5) * 0.12, l = len + rnd() * len * 0.6, x0 = from[0] + (rnd() - 0.5) * 30, y0 = from[1] + (rnd() - 0.5) * 16, x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; // out from the crown, then it falls
    out.push(path(`M ${x0} ${y0} Q ${x1} ${y1} ${x1 + Math.cos(a) * l * 0.15 + (rnd() - 0.5) * 12} ${y1 + l * 0.8}`, stroke(i % 2 ? '#fff' : '#000', 1 + rnd() * 1.2, i % 2 ? 0.08 : dark))); }
  return out; };
// curls: small arcs scattered over the mass, for hair that has no comb direction
const curls = (p) => { const rnd = lcg(p.seed + 7), out = [];
  for (let i = 0; i < 70; i++) { const x = 90 + rnd() * 220, y = 30 + rnd() * 200, r = 4 + rnd() * 6, a = rnd() * Math.PI * 2, s = i % 3 ? 1 : -1;
    out.push(path(`M ${x + Math.cos(a) * r} ${y + Math.sin(a) * r} Q ${x + Math.cos(a + s * 1.2) * r * 1.5} ${y + Math.sin(a + s * 1.2) * r * 1.5} ${x + Math.cos(a + s * 2.6) * r} ${y + Math.sin(a + s * 2.6) * r}`, stroke(i % 2 ? '#fff' : '#000', 1 + rnd(), i % 2 ? 0.08 : 0.15 * (1 - 0.7 * luma(p.hairColor))))); }
  return out; };
const K = 0.5523, ellipsePath = (o) => `M ${o.cx + o.rx} ${o.cy} C ${o.cx + o.rx} ${o.cy + K * o.ry}, ${o.cx + K * o.rx} ${o.cy + o.ry}, ${o.cx} ${o.cy + o.ry} C ${o.cx - K * o.rx} ${o.cy + o.ry}, ${o.cx - o.rx} ${o.cy + K * o.ry}, ${o.cx - o.rx} ${o.cy} C ${o.cx - o.rx} ${o.cy - K * o.ry}, ${o.cx - K * o.rx} ${o.cy - o.ry}, ${o.cx} ${o.cy - o.ry} C ${o.cx + K * o.rx} ${o.cy - o.ry}, ${o.cx + o.rx} ${o.cy - K * o.ry}, ${o.cx + o.rx} ${o.cy} Z`; // an ellipse as a path, so a clip can take it
const HAIR_TEXTURE = { curlyMedium: 'curls', afroShort: 'curls', afroMedium: 'curls', locsShort: 'none', boxBraids: 'none' }; // the grain each style takes; unlisted styles are combed strands
export const HAIR = {
  bald: () => [],
  buzz: CAP,
  crewCut: (p) => [path('M 124 163 C 122 122, 145 90, 185 83 C 220 77, 255 90, 273 119 L 273 157 C 253 135, 229 125, 200 124 C 170 124, 145 137, 124 163 Z', { fill: p.hairColor })],
  shortTextured: (p) => [path('M 121 167 C 116 130, 121 102, 144 86 C 153 78, 160 82, 167 76 C 176 67, 187 74, 194 68 C 205 61, 215 71, 224 68 C 235 66, 242 76, 252 80 C 275 91, 285 127, 277 167 C 262 144, 240 129, 200 126 C 160 129, 138 144, 121 167 Z', { fill: p.hairColor }), gloss('M 150 96 Q 165 78 177 95'), gloss('M 179 88 Q 194 70 207 91'), gloss('M 207 86 Q 223 71 236 95')],
  // the hairline of every style that shows one sits ~5 units inside the face outline (its top is y 112, its temples
  // run 168,118 · 152,128 · 139,143 · 129,167), or the background shows between the hair and the head
  sidePart: (p) => [path('M 129 165 C 120 130, 124 99, 153 83 C 179 68, 223 69, 250 86 C 273 101, 284 127, 271 165 C 259 149, 250 136, 242 128 C 226 120, 206 117, 186 120 C 158 126, 145 138, 129 165 Z', { fill: p.hairColor }), gloss('M 166 87 C 192 80, 220 80, 245 94', 2.8)],
  middlePart: (p) => [path('M 129 168 C 116 127, 123 92, 153 76 C 176 64, 224 64, 247 76 C 277 92, 284 127, 271 168 C 259 150, 248 136, 224 126 L 200 119 L 176 126 C 152 136, 141 150, 129 168 Z', { fill: p.hairColor }), path('M 200 76 C 198 88, 199 100, 200 119', stroke(p.skin, 3, 0.65))],
  sweptBack: (p) => [path('M 129 165 C 118 122, 128 91, 154 78 C 180 65, 224 64, 252 80 C 279 97, 284 130, 271 165 C 259 149, 252 137, 238 127 C 218 117, 196 116, 176 122 C 160 127, 145 138, 129 165 Z', { fill: p.hairColor })],
  wavyMedium: (p) => [path('M 114 183 C 104 147, 109 107, 136 84 C 151 71, 164 78, 176 70 C 191 60, 207 73, 220 68 C 235 63, 245 76, 259 82 C 286 95, 295 136, 282 183 L 265 202 C 268 166, 258 140, 240 126 C 220 117, 180 117, 160 126 C 142 143, 130 169, 134 202 Z', { fill: p.hairColor })],
  curlyMedium: { back: (p) => [[132, 118, 28, 31], [154, 90, 30, 27], [184, 78, 30, 27], [214, 77, 30, 28], [245, 90, 30, 29], [268, 118, 28, 32], [124, 151, 22, 34], [276, 151, 22, 34]].map(([x, y, rx, ry]) => ellipse(x, y, rx, ry, { fill: p.hairColor })), front: CAP },
  afroShort: { back: (p) => [ellipse(200, 110, 84, 63, { fill: p.hairColor }), ellipse(135, 125, 28, 39, { fill: p.hairColor }), ellipse(265, 125, 28, 39, { fill: p.hairColor })], front: CAP },
  afroMedium: { back: (p) => [ellipse(200, 103, 96, 72, { fill: p.hairColor }), ellipse(120, 134, 33, 45, { fill: p.hairColor }), ellipse(280, 134, 33, 45, { fill: p.hairColor })], front: CAP },
  pixie: (p) => [path('M 129 165 C 118 125, 131 96, 154 82 C 172 71, 198 71, 216 75 C 246 81, 270 104, 271 158 C 257 147, 249 134, 240 126 C 220 117, 198 115, 180 120 C 160 124, 144 136, 129 165 Z', { fill: p.hairColor }), gloss('M 172 83 Q 187 70 198 86', 2), gloss('M 199 79 Q 215 69 226 87', 2)],
  bob: { back: (p) => longBack(240, p), front: (p) => [path('M 118 171 C 108 126, 121 90, 151 76 C 177 64, 223 64, 249 76 C 279 90, 292 126, 282 171 L 272 246 C 256 236, 250 211, 248 183 C 245 145, 228 117, 200 112 C 172 117, 155 145, 152 183 C 150 211, 144 236, 128 246 Z', { fill: p.hairColor })] },
  bluntBob: { back: (p) => longBack(240, p), front: (p) => [path('M 116 170 C 108 121, 124 86, 154 73 C 178 62, 222 62, 246 73 C 276 86, 292 121, 284 170 L 272 245 L 243 245 C 248 210, 247 166, 236 140 C 221 112, 179 112, 164 140 C 153 166, 152 210, 157 245 L 128 245 Z', { fill: p.hairColor })] },
  longStraight: { back: (p) => longBack(350, p), front: (p) => [path('M 114 178 C 103 125, 120 84, 151 70 C 177 58, 223 58, 249 70 C 280 84, 297 125, 286 178 L 299 355 L 259 355 C 264 285, 259 220, 247 171 C 239 140, 223 120, 200 118 C 177 120, 161 140, 153 171 C 141 220, 136 285, 141 355 L 101 355 Z', { fill: p.hairColor })] },
  longWavy: { back: (p) => longBack(350, p), front: (p) => [path('M 114 178 C 102 126, 119 86, 149 70 C 179 54, 222 58, 251 71 C 281 87, 298 126, 286 178 C 300 214, 287 239, 297 270 C 307 302, 292 330, 300 357 L 260 357 C 252 320, 270 292, 256 256 C 245 226, 262 196, 248 165 C 236 140, 221 120, 200 118 C 179 120, 164 140, 152 165 C 138 196, 155 226, 144 256 C 130 292, 148 320, 140 357 L 100 357 C 108 330, 93 302, 103 270 C 113 239, 100 214, 114 178 Z', { fill: p.hairColor })] },
  ponytailLow: { back: (p) => [path('M 254 139 C 292 150, 303 195, 284 229 C 273 248, 260 257, 249 264 C 263 221, 261 176, 254 139 Z', { fill: p.hairColor })], front: (p) => [path('M 122 168 C 116 124, 128 93, 154 78 C 179 64, 221 64, 246 78 C 272 93, 284 124, 278 168 C 258 140, 234 122, 200 120 C 166 122, 142 140, 122 168 Z', { fill: p.hairColor })] },
  highBun: { back: (p) => [ellipse(200, 54, 36, 31, { fill: p.hairColor })], front: (p) => [path('M 121 168 C 117 124, 129 92, 155 78 C 179 66, 221 66, 245 78 C 271 92, 283 124, 279 168 C 259 139, 235 122, 200 120 C 165 122, 141 139, 121 168 Z', { fill: p.hairColor })] },
  lowBun: { back: (p) => [ellipse(268, 171, 29, 31, { fill: p.hairColor })], front: (p) => [path('M 122 169 C 118 125, 130 93, 155 78 C 179 64, 221 64, 245 78 C 270 93, 282 125, 278 169 C 258 140, 234 122, 200 120 C 166 122, 142 140, 122 169 Z', { fill: p.hairColor })] },
  locsShort: { back: (p) => [[135, 96, 126, 167], [151, 82, 145, 176], [169, 74, 165, 179], [187, 70, 184, 175], [205, 69, 205, 179], [223, 72, 225, 177], [241, 80, 247, 176], [257, 94, 270, 168]].map(([x1, y1, x2, y2]) => path(`M ${x1} ${y1} Q ${(x1 + x2) / 2 + 6} ${(y1 + y2) / 2} ${x2} ${y2}`, stroke(p.hairColor, 11))), front: CAP },
  boxBraids: { back: (p) => [118, 132, 148, 165, 182, 218, 235, 252, 268, 282].flatMap((x) => { const s = x < 200 ? -1 : 1, x1 = x + 14 * s, y0 = 150, y1 = 322; return [line(x, y0, x1, y1, stroke(p.hairColor, 7)), ...Array.from({ length: 10 }, (_, i) => { const t = 0.2 + i * 0.08, bx = x + (x1 - x) * t, by = y0 + (y1 - y0) * t; return line(bx - 3, by - 2 * s, bx + 3, by + 2 * s, stroke('#fff', 2, 0.12)); })]; }), front: (p) => [...CAP(p), ...[-40, -14, 14, 40].map((d) => path(`M ${200 + d} 92 Q ${200 + d * 1.3} 120 ${200 + d * 1.6} 150`, stroke(p.skin, 1.6, 0.5)))] }, // a braided cap parted into sections, the braids hanging from under its edge, each knotted along its length
  receding: (p) => [path('M 127 163 C 126 123, 144 95, 168 88 C 171 111, 182 117, 200 112 C 218 117, 229 111, 232 88 C 256 95, 274 123, 273 163 C 251 139, 228 129, 200 129 C 172 129, 149 139, 127 163 Z', { fill: p.hairColor })],
};
export const HAIR_STYLES = Object.keys(HAIR);
export const LONG_HAIR = ['bob', 'bluntBob', 'longStraight', 'longWavy']; // the styles that hang past the jaw: never on a long oval head, which they stretch further
const hairOf = (p) => { const r = HAIR[p.hair.style] ?? HAIR.sidePart; return typeof r === 'function' ? { back: [], front: r(p) } : { back: r.back(p), front: r.front(p) }; };

export const FACIAL_HAIR = {
  none: () => [],
  lightStubble: (p) => [path('M 151 248 C 155 296, 176 319, 200 323 C 224 319, 245 296, 249 248 C 239 278, 223 294, 200 297 C 177 294, 161 278, 151 248 Z', { fill: p.hairColor, op: 0.09 })],
  heavyStubble: (p) => [path('M 149 246 C 153 300, 175 326, 200 331 C 225 326, 247 300, 251 246 C 242 281, 224 302, 200 305 C 176 302, 158 281, 149 246 Z', { fill: p.hairColor, op: 0.2 })],
  mustache: (p) => [path('M 175 252 C 184 243, 194 245, 200 251 C 206 245, 216 243, 225 252 C 216 254, 207 260, 200 258 C 193 260, 184 254, 175 252 Z', { fill: p.hairColor })],
  shortBeard: (p) => [path('M 149 245 C 151 298, 174 329, 200 335 C 226 329, 249 298, 251 245 C 243 281, 224 302, 200 305 C 176 302, 157 281, 149 245 Z', { fill: p.hairColor, op: 0.91 }), path('M 173 260 Q 200 275 227 260 Q 218 290 200 295 Q 182 290 173 260 Z', { fill: p.skin })],
  fullBeard: (p) => [path('M 145 240 C 145 294, 165 342, 200 356 C 235 342, 255 294, 255 240 C 247 277, 226 303, 200 307 C 174 303, 153 277, 145 240 Z', { fill: p.hairColor }), path('M 170 258 Q 200 274 230 258 Q 221 291 200 296 Q 179 291 170 258 Z', { fill: p.skin })],
  goatee: (p) => [path('M 179 252 C 189 246, 195 247, 200 252 C 205 247, 211 246, 221 252 C 211 255, 206 258, 200 258 C 194 258, 189 255, 179 252 Z', { fill: p.hairColor }), path('M 184 271 Q 200 282 216 271 L 211 313 Q 200 321 189 313 Z', { fill: p.hairColor })],
  boxedBeard: (p) => [path('M 150 246 L 158 296 Q 174 326 200 331 Q 226 326 242 296 L 250 246 L 240 251 L 232 286 Q 219 306 200 310 Q 181 306 168 286 L 160 251 Z', { fill: p.hairColor })],
};
export const FACIAL_HAIR_STYLES = Object.keys(FACIAL_HAIR);

// glasses: drawn for eyes 68 apart on the line y = 196, fitted to the character's spacing and eye line
export const GLASSES = {
  rectangularThin: (c) => [rect(145, 183, 43, 27, { rx: 7, fill: 'none', stroke: c, sw: 2.4 }), rect(212, 183, 43, 27, { rx: 7, fill: 'none', stroke: c, sw: 2.4 }), line(188, 194, 212, 194, { stroke: c, sw: 2.4 })],
  rectangularBold: (c) => [rect(143, 181, 47, 30, { rx: 8, fill: 'none', stroke: c, sw: 4.6 }), rect(210, 181, 47, 30, { rx: 8, fill: 'none', stroke: c, sw: 4.6 }), line(190, 193, 210, 193, { stroke: c, sw: 4.2 })],
  round: (c) => [ellipse(166, 196, 22, 21, { fill: 'none', stroke: c, sw: 2.8 }), ellipse(234, 196, 22, 21, { fill: 'none', stroke: c, sw: 2.8 }), path('M 188 194 Q 200 189 212 194', stroke(c, 2.4))],
  browline: (c) => [path('M 143 184 L 190 184 L 188 208 L 147 208 Z', stroke(c, 2.2)), path('M 210 184 L 257 184 L 253 208 L 212 208 Z', stroke(c, 2.2)), line(144, 184, 190, 184, { stroke: c, sw: 5 }), line(210, 184, 256, 184, { stroke: c, sw: 5 }), line(190, 194, 210, 194, { stroke: c, sw: 2.2 })],
  aviator: (c) => [path('M 144 185 Q 166 179 188 185 L 184 209 Q 166 217 148 207 Z', stroke(c, 2.5)), path('M 212 185 Q 234 179 256 185 L 252 207 Q 234 217 216 209 Z', stroke(c, 2.5)), path('M 188 190 Q 200 182 212 190', stroke(c, 2.2))],
  rimless: () => [rect(145, 184, 43, 27, { rx: 8, fill: 'none', stroke: '#888', sw: 1, op: 0.55 }), rect(212, 184, 43, 27, { rx: 8, fill: 'none', stroke: '#888', sw: 1, op: 0.55 }), line(188, 195, 212, 195, { stroke: '#777', sw: 1.4 })],
};
export const GLASSES_STYLES = Object.keys(GLASSES);
const glasses = (p) => (p.glasses ? mapXY((GLASSES[p.glasses.style] ?? GLASSES.rectangularThin)(p.glasses.color ?? '#2b2927'), scaleAbout(200, p.eyes.spacing / 68), (y) => y + p.eyes.y - 196) : []);

export const HATS = {
  none: () => [],
  baseballCap: (p) => [path('M 127 137 C 128 92, 157 70, 197 70 C 237 70, 264 94, 269 137 Z', { fill: p.hat.color }), path('M 190 126 C 239 122, 275 127, 309 142 C 276 146, 238 144, 198 139 Z', { fill: p.hat.accent }), line(196, 72, 196, 126, stroke('#fff', 2, 0.08))],
  dadCap: (p) => [path('M 128 137 C 130 96, 158 76, 198 76 C 238 76, 263 97, 268 137 C 240 130, 175 130, 128 137 Z', { fill: p.hat.color }), path('M 193 127 C 229 124, 258 129, 283 139 C 250 142, 220 141, 192 137 Z', { fill: p.hat.accent })],
  snapback: (p) => [path('M 125 137 L 132 91 Q 198 66 266 91 L 272 137 Z', { fill: p.hat.color }), path('M 193 125 C 243 122, 279 128, 313 141 C 274 144, 236 143, 196 139 Z', { fill: p.hat.accent })],
  truckerCap: (p) => [path('M 126 137 L 134 89 Q 172 72 198 74 L 198 133 Z', { fill: p.hat.color }), path('M 198 74 Q 246 72 267 93 L 272 137 L 198 133 Z', { fill: p.hat.accent, op: 0.7 }), path('M 192 126 C 241 122, 280 127, 313 142 C 276 145, 236 144, 194 138 Z', { fill: p.hat.color })],
  beanie: (p) => [path('M 123 137 C 127 79, 158 52, 200 52 C 242 52, 273 79, 277 137 Z', { fill: p.hat.color }), path('M 119 129 Q 200 113 281 129 L 278 154 Q 200 138 122 154 Z', { fill: p.hat.accent })],
  cuffedBeanie: (p) => [path('M 128 132 C 130 80, 158 56, 200 56 C 242 56, 270 80, 272 132 Z', { fill: p.hat.color }), rect(120, 124, 160, 32, { rx: 9, fill: p.hat.accent })],
  fishermanBeanie: (p) => [path('M 133 125 C 137 89, 159 69, 200 69 C 241 69, 263 89, 267 125 Z', { fill: p.hat.color }), rect(129, 118, 142, 24, { rx: 7, fill: p.hat.accent })],
  bucketHat: (p) => [path('M 138 108 Q 200 77 262 108 L 272 141 Q 200 125 128 141 Z', { fill: p.hat.color }), path('M 88 141 Q 200 119 312 141 Q 200 164 88 141 Z', { fill: p.hat.accent })],
  flatCap: (p) => [path('M 122 127 C 138 86, 171 73, 215 78 C 245 81, 267 95, 277 118 L 268 134 Q 200 123 122 134 Z', { fill: p.hat.color }), path('M 184 126 Q 248 119 289 132 Q 242 139 185 137 Z', { fill: p.hat.accent })],
  wideBrimFelt: (p) => [path('M 142 112 L 151 68 Q 200 50 249 68 L 258 112 Z', { fill: p.hat.color }), rect(146, 98, 108, 14, { rx: 3, fill: p.hat.accent }), path('M 74 120 Q 200 97 326 120 Q 200 143 74 120 Z', { fill: p.hat.color })],
  cowboy: (p) => [path('M 145 115 L 155 62 Q 200 42 245 62 L 255 115 Z', { fill: p.hat.color }), path('M 90 119 C 119 128, 148 117, 170 113 L 230 113 C 252 117, 281 128, 310 119 C 292 145, 251 142, 200 136 C 149 142, 108 145, 90 119 Z', { fill: p.hat.color }), rect(148, 98, 104, 16, { fill: p.hat.accent })],
  sunHat: (p) => [path('M 128 126 C 132 74, 162 55, 200 55 C 238 55, 268 74, 272 126 Z', { fill: p.hat.color }), path('M 52 128 C 80 112, 120 104, 200 104 C 280 104, 320 112, 348 128 C 330 150, 300 138, 270 148 C 240 156, 220 140, 200 150 C 180 140, 160 156, 130 148 C 100 138, 70 150, 52 128 Z', { fill: p.hat.color }), path('M 52 128 C 80 112, 120 104, 200 104 C 280 104, 320 112, 348 128', stroke('#000', 2, 0.15)), rect(132, 104, 136, 16, { rx: 4, fill: p.hat.accent })],
  // a hood up: one path with the face opening wound the other way (a nonzero hole), from the crown down over the shoulders; its shadow rims the face
  hood: (p) => { // the outer shape with the face cut out (even-odd), the hole this head's own face a little larger, and the dark lining between the hole and the face, so the hood hugs any head; the hat fit scales its width
    const face = facePath({ face: { ...p.face, width: 156 } }), hole = mapXY([path(face)], scaleAbout(200, 1.07), scaleAbout(112 + p.face.height / 2, 1.04))[0].d;
    return [path(`M 200 40 C 282 40, 320 120, 312 236 C 310 296, 318 336, 338 386 L 62 386 C 82 336, 90 296, 88 236 C 80 120, 118 40, 200 40 Z ${hole}`, { fill: p.hat.color, rule: 'evenodd' }), path(`${hole} ${face}`, { fill: shade(p.hat.color, 0.32), rule: 'evenodd' }), path(hole, stroke('#000', 8, 0.22)), path('M 128 300 C 118 340, 104 360, 76 386', stroke('#000', 3, 0.14)), path('M 272 300 C 282 340, 296 360, 324 386', stroke('#000', 3, 0.14))];
  },
};
export const HAT_STYLES = Object.keys(HATS);
// where each hat's crown meets the head: hair above this line is inside the hat, so it is painted over in the hat's colour and the crown fits the hair
export const HAT_CROWN = { baseballCap: 137, dadCap: 137, snapback: 137, truckerCap: 137, beanie: 140, cuffedBeanie: 140, fishermanBeanie: 130, bucketHat: 141, flatCap: 134, wideBrimFelt: 120, cowboy: 122, sunHat: 128, hood: 400 };
export const HAT_HAIR = HAIR_STYLES.filter((s) => s !== 'highBun'); // the styles a hat can sit on

// tops: each draws its own torso, run past the sheet's bottom (480) so a tilted or lifted sheet shows no edge
const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 600 L 60 600 Z'), { fill });
const dk = (op) => ({ fill: '#000', op }), dkl = (sw, op) => stroke('#000', sw, op, 'butt');
export const TOPS = {
  crewTshirt: (p) => [torso('M 78 480 C 91 397, 136 370, 166 359 L 234 359 C 264 370, 309 397, 322 480 Z', p.top.color), path('M 161 361 Q 200 389 239 361 Q 230 350 200 349 Q 170 350 161 361 Z', dk(0.13))],
  vneckTshirt: (p) => [torso('M 78 480 C 91 397, 136 370, 167 358 L 233 358 C 264 370, 309 397, 322 480 Z', p.top.color), path('M 165 359 L 200 398 L 235 359 Q 220 350 200 350 Q 180 350 165 359 Z', dk(0.17))],
  heavyweightTshirt: (p) => [torso('M 68 480 C 84 395, 132 366, 165 356 L 235 356 C 268 366, 316 395, 332 480 Z', p.top.color), path('M 158 359 Q 200 389 242 359', dkl(7, 0.14))],
  polo: (p) => [torso('M 76 480 C 89 400, 132 369, 166 356 L 234 356 C 268 369, 311 400, 324 480 Z', p.top.color), path('M 165 355 L 192 377 L 181 403 L 151 366 Z', dk(0.12)), path('M 235 355 L 208 377 L 219 403 L 249 366 Z', dk(0.12)), line(200, 375, 200, 419, dkl(2, 0.15))],
  henley: (p) => [torso('M 76 480 C 90 398, 134 370, 166 357 L 234 357 C 266 370, 310 398, 324 480 Z', p.top.color), path('M 163 360 Q 200 386 237 360', dkl(4, 0.14)), line(200, 368, 200, 414, dkl(2, 0.22)), ...[381, 393, 405].map((y) => ellipse(200, y, 2.3, 2.3, { fill: '#222', op: 0.55 }))],
  crewSweater: (p) => [torso('M 72 480 C 86 394, 130 365, 163 354 L 237 354 C 270 365, 314 394, 328 480 Z', p.top.color), path('M 159 356 Q 200 387 241 356', dkl(8, 0.1)), path('M 84 430 Q 200 416 316 430', stroke('#fff', 1.5, 0.04))],
  turtleneck: (p) => [torso('M 73 480 C 87 395, 131 365, 165 353 L 235 353 C 269 365, 313 395, 327 480 Z', p.top.color), path('M 169 319 L 231 319 L 238 371 Q 200 388 162 371 Z', { fill: p.top.color }), line(169, 343, 231, 343, dkl(2, 0.08))],
  hoodie: (p) => [torso('M 67 480 C 81 393, 127 365, 164 352 L 236 352 C 273 365, 319 393, 333 480 Z', p.top.color), path('M 156 355 C 140 363, 132 384, 135 409 L 168 385 Q 200 403 232 385 L 265 409 C 268 384, 260 363, 244 355 Q 221 345 200 347 Q 179 345 156 355 Z', dk(0.11)), line(175, 377, 168, 432, stroke('#ddd', 2, 0.8)), line(225, 377, 232, 432, stroke('#ddd', 2, 0.8))],
  buttonDown: (p) => [torso('M 74 480 C 88 397, 131 369, 164 356 L 236 356 C 269 369, 312 397, 326 480 Z', p.top.color), path('M 164 356 L 195 377 L 181 409 L 150 365 Z', { fill: '#fff', op: 0.09 }), path('M 236 356 L 205 377 L 219 409 L 250 365 Z', { fill: '#fff', op: 0.09 }), line(200, 377, 200, 600, dkl(1.5, 0.14)), ...[399, 420, 441].map((y) => ellipse(200, y, 2, 2, { fill: '#222', op: 0.55 }))],
  // the editorial wardrobe: a bare torso, oversized shapes, sportswear piping, an open shirt
  bare: (p) => [torso('M 72 480 C 86 396, 132 368, 166 357 L 234 357 C 268 368, 314 396, 328 480 Z', p.skin), path('M 150 388 Q 176 378 198 392', dkl(2, 0.1)), path('M 250 388 Q 224 378 202 392', dkl(2, 0.1)), path('M 140 430 Q 170 470 200 452 Q 230 470 260 430', dkl(2.5, 0.07)), line(200, 405, 200, 500, dkl(2, 0.06))],
  tunic: (p) => [torso('M 48 480 C 56 390, 108 356, 160 345 L 240 345 C 292 356, 344 390, 352 480 Z', p.top.color), path('M 162 347 Q 200 372 238 347', dkl(6, 0.1)), line(146, 420, 138, 600, dkl(1.5, 0.06)), line(254, 420, 262, 600, dkl(1.5, 0.06))],
  hoodieBig: (p) => [torso('M 50 480 C 60 388, 110 356, 158 344 L 242 344 C 290 356, 340 388, 350 480 Z', p.top.color), path('M 138 376 C 132 332, 164 312, 200 310 C 236 312, 268 332, 262 376 Z', { fill: shade(p.top.color, 0.78) }), path('M 150 350 C 136 362, 130 386, 134 412 L 168 388 Q 200 406 232 388 L 266 412 C 270 386, 264 362, 250 350 Q 224 340 200 342 Q 176 340 150 350 Z', dk(0.11)), line(176, 380, 170, 440, stroke('#ddd', 2.4, 0.7)), line(224, 380, 230, 440, stroke('#ddd', 2.4, 0.7)), path('M 120 500 L 280 500 L 274 560 L 126 560 Z', dkl(1.5, 0.08))],
  trackTop: (p) => [torso('M 74 480 C 88 397, 131 369, 164 356 L 236 356 C 269 369, 312 397, 326 480 Z', p.top.color), path('M 96 440 C 106 400, 130 378, 160 362', stroke(p.top.accent ?? '#b3202a', 5, 1, 'butt')), path('M 304 440 C 294 400, 270 378, 240 362', stroke(p.top.accent ?? '#b3202a', 5, 1, 'butt')), path('M 168 358 L 200 386 L 232 358 L 226 350 L 200 372 L 174 350 Z', { fill: p.top.accent ?? '#b3202a' }), line(200, 386, 200, 470, stroke(p.top.accent ?? '#b3202a', 2, 0.6, 'butt'))],
  openShirt: (p) => [torso('M 72 480 C 86 396, 132 368, 164 356 L 236 356 C 268 368, 314 396, 328 480 Z', p.top.color), path('M 166 357 L 200 478 L 234 357 Z', { fill: p.skin }), path('M 170 366 L 200 470 L 200 400 Q 190 380 170 366 Z', dk(0.12)), path('M 164 356 L 200 478 L 178 478 L 150 372 Z', { fill: shade(p.top.color, 0.7) }), path('M 236 356 L 200 478 L 222 478 L 250 372 Z', { fill: shade(p.top.color, 0.7) }), path('M 155 392 Q 178 384 198 398', dkl(2, 0.1)), path('M 245 392 Q 222 384 202 398', dkl(2, 0.1))],
};
export const TOP_STYLES = Object.keys(TOPS);

export const JACKETS = {
  none: () => [],
  blazer: (p) => [path('M 71 480 C 81 403, 111 374, 161 354 L 193 480 L 200 600 L 60 600 Z', { fill: p.jacket.color }), path('M 329 480 C 319 403, 289 374, 239 354 L 207 480 L 200 600 L 340 600 Z', { fill: p.jacket.color }), path('M 160 354 L 198 387 L 176 424 L 149 369 Z', { fill: '#fff', op: 0.08 }), path('M 240 354 L 202 387 L 224 424 L 251 369 Z', { fill: '#fff', op: 0.08 })],
  denimJacket: (p) => [torso('M 68 480 C 80 395, 122 366, 161 351 L 239 351 C 278 366, 320 395, 332 480 Z', p.jacket.color), path('M 163 352 L 198 380 L 180 410 L 146 365 Z', { fill: '#fff', op: 0.07 }), path('M 237 352 L 202 380 L 220 410 L 254 365 Z', { fill: '#fff', op: 0.07 }), line(200, 381, 200, 600, stroke('#222', 2, 0.25, 'butt')), rect(109, 414, 57, 42, { rx: 3, fill: 'none', stroke: '#222', sw: 1.5, op: 0.2 }), rect(234, 414, 57, 42, { rx: 3, fill: 'none', stroke: '#222', sw: 1.5, op: 0.2 })],
  bomber: (p) => [torso('M 62 480 C 71 398, 120 361, 163 351 L 237 351 C 280 361, 329 398, 338 480 Z', p.jacket.color), line(200, 358, 200, 600, stroke('#1e2021', 4, 0.55, 'butt')), path('M 162 352 Q 200 385 238 352', stroke('#1d1e20', 9, 0.35, 'butt'))],
  leatherJacket: (p) => [torso('M 63 480 C 74 392, 119 361, 160 348 L 240 348 C 281 361, 326 392, 337 480 Z', p.jacket.color), path('M 160 349 L 202 385 L 178 424 L 146 367 Z', { fill: '#fff', op: 0.06 }), path('M 240 349 L 198 385 L 222 424 L 254 367 Z', { fill: '#fff', op: 0.06 }), line(199, 383, 182, 480, stroke('#111', 3, 0.42, 'butt'))],
  puffer: (p) => [torso('M 56 480 C 62 390, 111 358, 160 348 L 240 348 C 289 358, 338 390, 344 480 Z', p.jacket.color), ...[385, 408, 431, 454, 477].map((y) => line(80, y, 320, y, dkl(2, 0.12))), line(200, 352, 200, 600, stroke('#111', 3, 0.25, 'butt'))],
  fieldJacket: (p) => [torso('M 67 480 C 79 395, 121 363, 161 351 L 239 351 C 279 363, 321 395, 333 480 Z', p.jacket.color), line(200, 358, 200, 600, stroke('#111', 2, 0.18, 'butt')), rect(102, 412, 61, 47, { rx: 3, fill: 'none', stroke: '#111', sw: 1.7, op: 0.19 }), rect(237, 412, 61, 47, { rx: 3, fill: 'none', stroke: '#111', sw: 1.7, op: 0.19 })],
  openJacket: (p) => [path('M 66 480 C 76 400, 108 372, 158 352 L 172 480 L 168 600 L 56 600 Z', { fill: p.jacket.color }), path('M 334 480 C 324 400, 292 372, 242 352 L 228 480 L 232 600 L 344 600 Z', { fill: p.jacket.color }), path('M 158 352 L 176 392 L 172 480 L 150 372 Z', { fill: '#000', op: 0.18 }), path('M 242 352 L 224 392 L 228 480 L 250 372 Z', { fill: '#000', op: 0.18 })], // hanging open: the chest shows between the panels
};
export const JACKET_STYLES = Object.keys(JACKETS);

// accessories: `at` says where in the stack each is drawn (neck: over the collar; ear: on the ears; over: over the hat and hair)
export const ACCESSORIES = {
  studEarringLeft: { at: 'ear', ops: () => [ellipse(119, 222, 3.2, 3.2, { fill: '#b8b5ad', stroke: '#666', sw: 0.7 })] },
  studEarringRight: { at: 'ear', ops: () => [ellipse(281, 222, 3.2, 3.2, { fill: '#b8b5ad', stroke: '#666', sw: 0.7 })] },
  hoopLeft: { at: 'ear', ops: () => [ellipse(118, 230, 8, 12, { fill: 'none', stroke: '#a59b83', sw: 2.2 })] },
  hoopRight: { at: 'ear', ops: () => [ellipse(282, 230, 8, 12, { fill: 'none', stroke: '#a59b83', sw: 2.2 })] },
  chainNecklace: { at: 'neck', ops: () => [path('M 162 369 Q 200 395 238 369', stroke('#a49b81', 2.5))] },
  pendantNecklace: { at: 'neck', ops: () => [path('M 163 369 Q 200 398 237 369', stroke('#a49b81', 2.3)), ellipse(200, 397, 5, 7, { fill: '#8f8267' })] },
  earbuds: { at: 'ear', ops: () => [ellipse(120, 213, 4, 7, { fill: '#e3e3df' }), ellipse(280, 213, 4, 7, { fill: '#e3e3df' }), line(120, 218, 119, 230, stroke('#ddd', 2)), line(280, 218, 281, 230, stroke('#ddd', 2))] },
  overEarHeadphones: { at: 'over', ops: () => [path('M 121 206 C 108 153, 131 111, 200 105 C 269 111, 292 153, 279 206', stroke('#303438', 10)), rect(106, 188, 24, 48, { rx: 10, fill: '#26292c' }), rect(270, 188, 24, 48, { rx: 10, fill: '#26292c' })] },
  tie: { at: 'neck', ops: (p) => [path('M 192 370 L 208 370 L 213 384 L 205 462 L 195 462 L 187 384 Z', { fill: p.top.accent ?? '#b3202a' }), path('M 192 370 L 208 370 L 205 380 L 195 380 Z', { fill: '#000', op: 0.25 })] },
};
export const ACCESSORY_STYLES = Object.keys(ACCESSORIES);
const accessories = (p, at) => p.accessories.flatMap((n) => (ACCESSORIES[n]?.at === at ? ACCESSORIES[n].ops(p) : []));

// The editorial layers, each a registry of { [slot]: (p) => ops, fit? }: `slot` says where in the stack the ops go
// (back: behind the figure; body: over the garments, under the head; neck: on the neck; skin: on the face under the features; face: over the
// features, under the beard and hair; over: over the hat; front: over everything, inside the body's sway), `fit`
// what a slot's ops follow ('eyes': the eye spacing and line, 'face': the face width; a string for every slot or a
// map by slot; unset: drawn as written, for ops that already read the head). MAKEUP: paint on the face. MARKS:
// tattoos and body markings. PROPS: what the hands hold and do (simple sleeves and hands, editorial geometry, no
// skeleton). GRAPHICS: a print on the torso, clipped to the top. All abstract and original: no words, no logos.
const facePaint = (fill, op = 1) => ({ fill, op });
const INKL = (sw, op = 0.7, color = '#1c1a1e') => stroke(color, sw, op);
const PALE = '#ece6e0', BLACKP = '#141216', REDP = '#b3202a', GOLDP = '#d9b34a';
// a physical mask, not paint: a hard shell a little inside the face outline (skin shows at its rim), a dark edge, its
// own shading (a shadow down the far side, a sheen on the lit cheek) and dark holes the wearer's eyes look out of;
// on the skin slot, so the eyes, nose and mouth come over it
const maskOf = (p, fill, op = 0.94) => {
  const cy = 112 + p.face.height / 2, ex = p.eyes.spacing / 2, ey = p.eyes.y, side = p.light.side;
  const shell = mapXY([path(facePath(p))], scaleAbout(200, 0.955), scaleAbout(cy, 0.965))[0].d;
  return [path(shell, facePaint(fill, op)), path(shell, stroke('#000', 2.4, 0.22)),
    ellipse(200 - 34 * side, cy + 10, 30, 62, facePaint('#000', 0.09)), path(`M ${200 + 22 * side} ${ey + 20} Q ${200 + 46 * side} ${ey + 46} ${200 + 40 * side} ${ey + 76}`, stroke('#fff', 9, 0.12)),
    ellipse(200 - ex, ey, 21, 13, facePaint('#1a1418', 0.5)), ellipse(200 + ex, ey, 21, 13, facePaint('#1a1418', 0.5))];
};
const hollows = (p, op) => mapX([path('M 126 232 Q 158 262 178 298 Q 148 270 126 232 Z', facePaint('#4a2a24', op)), path('M 274 232 Q 242 262 222 298 Q 252 270 274 232 Z', facePaint('#4a2a24', op))], scaleAbout(200, p.face.width / 156)); // the cheeks sucked in under the bone
const onEyes = (p, ops) => mapXY(ops, scaleAbout(200, p.eyes.spacing / 68), (y) => y + p.eyes.y - 196); // ops drawn for the default eyes follow this pair
export const MAKEUP = {
  none: {},
  // makeup, kept on the model: the pale base is thin enough for the face to read through, and the modelling is put back over it with the sockets and cheeks sunk
  paleCorpseBase: { skin: (p) => [path(facePath(p), facePaint('#e6dfd8', 0.6)), ellipse(200 - 36 * p.light.side, 240, 40, 56, facePaint('#4a2a34', 0.1)), ...hollows(p, 0.14), ...onEyes(p, [ellipse(166, 202, 24, 16, facePaint('#3b2331', 0.22)), ellipse(234, 202, 24, 16, facePaint('#3b2331', 0.22))])] },
  whiteMaskBase: { mask: true, skin: (p) => maskOf(p, '#f3f0ea') },
  darkEyeSockets: { fit: 'eyes', skin: () => [ellipse(166, 198, 25, 17, facePaint('#2b1c26', 0.6)), ellipse(234, 198, 25, 17, facePaint('#2b1c26', 0.6))] },
  heavyUnderEye: { fit: 'eyes', skin: () => [path('M 144 204 Q 166 230 188 204 Q 166 216 144 204 Z', facePaint('#3b2331', 0.55)), path('M 212 204 Q 234 230 256 204 Q 234 216 212 204 Z', facePaint('#3b2331', 0.55))] },
  sharpEditorialEyes: { fit: 'eyes', face: () => [path('M 188 194 Q 174 184 160 191 L 148 183', stroke(BLACKP, 3.2)), path('M 212 194 Q 226 184 240 191 L 252 183', stroke(BLACKP, 3.2))] },
  blackLipLine: { face: (p) => [path(`M ${200 - p.mouth.width / 2} ${p.mouth.y} Q 200 ${p.mouth.y + 4} ${200 + p.mouth.width / 2} ${p.mouth.y}`, stroke(BLACKP, 3.6)), line(200, p.mouth.y + 6, 200, p.mouth.y + 42, stroke(BLACKP, 3))] },
  geometricEyePaint: { fit: 'eyes', face: () => [path('M 212 168 L 258 168 L 236 226 Z', facePaint(BLACKP, 0.86)), rect(144, 191, 44, 9, facePaint(BLACKP, 0.86))] },
  asymmetricGraphicPaint: { face: (p) => [clip(facePath(p)), ...mapX([path('M 200 112 L 122 150 L 128 300 L 200 334 Z', facePaint(BLACKP, 0.82))], scaleAbout(200, p.face.width / 156)), UNCLIP] }, // paint on one half of the face: clipped to it, or it hangs beside the head
  // the clown faces are masks with their graphics on the shell, under the eyes, so the wearer looks out through them
  clownGraphic: { mask: true, skin: (p) => [...maskOf(p, '#f3f0ea'), ...onEyes(p, [path('M 166 170 L 188 197 L 166 224 L 144 197 Z', facePaint(BLACKP, 0.9)), path('M 234 170 L 256 197 L 234 224 L 212 197 Z', facePaint(BLACKP, 0.9))]), rect(191, p.mouth.y - 8, 18, 16, facePaint(REDP, 0.9))] },
  smearedClown: { mask: true, skin: (p) => [...maskOf(p, '#efe9e2', 0.9), ...onEyes(p, [path('M 150 240 C 170 232, 186 250, 176 268 C 166 276, 150 262, 150 240 Z', facePaint(REDP, 0.4)), path('M 250 240 C 230 232, 214 250, 224 268 C 234 276, 250 262, 250 240 Z', facePaint(REDP, 0.4)), path('M 146 180 C 160 176, 178 186, 186 208 C 172 214, 154 206, 146 180 Z', facePaint(BLACKP, 0.75)), path('M 254 180 C 240 176, 222 186, 214 208 C 228 214, 246 206, 254 180 Z', facePaint(BLACKP, 0.75))])], face: (p) => [path(`M 184 ${p.mouth.y - 6} Q 200 ${p.mouth.y + 14} 216 ${p.mouth.y - 6}`, stroke(REDP, 6, 0.6))] },
  severeContour: { skin: (p) => hollows(p, 0.32) },
  metallicEyeAccent: { fit: 'eyes', face: () => [path('M 148 186 Q 166 175 184 186', stroke(GOLDP, 4.5, 0.85)), path('M 216 186 Q 234 175 252 186', stroke(GOLDP, 4.5, 0.85))] },
  foreheadMark: { fit: 'face', face: () => [ellipse(200, 150, 6, 6, { fill: 'none', stroke: BLACKP, sw: 2.2 }), line(200, 158, 200, 172, stroke(BLACKP, 2.2))] },
  cheekMark: { fit: 'face', face: () => [line(234, 246, 244, 256, stroke(BLACKP, 2)), line(244, 246, 234, 256, stroke(BLACKP, 2))] },
};
export const MAKEUP_STYLES = Object.keys(MAKEUP);
export const MARKS = {
  none: {},
  chestSparse: { body: () => [ellipse(166, 412, 7, 7, { fill: 'none', stroke: '#1c1a1e', sw: 2, op: 0.65 }), path('M 236 396 L 248 420 L 224 420 Z', INKL(2)), line(200, 444, 200, 476, INKL(2))] },
  chestDense: { body: () => [ellipse(166, 412, 7, 7, { fill: 'none', stroke: '#1c1a1e', sw: 2, op: 0.65 }), path('M 236 396 L 248 420 L 224 420 Z', INKL(2)), line(200, 440, 200, 476, INKL(2)), path('M 140 440 Q 160 430 176 446', INKL(1.8)), path('M 260 440 Q 240 430 224 446', INKL(1.8)), path('M 150 470 L 166 462 L 158 484 Z', INKL(1.6)), path('M 250 470 L 234 462 L 242 484 Z', INKL(1.6)), ellipse(200, 500, 12, 12, { fill: 'none', stroke: '#1c1a1e', sw: 1.8, op: 0.6 }), line(186, 500, 214, 500, INKL(1.6)), path('M 176 396 Q 200 388 224 396', INKL(1.6))] },
  neckMarks: { neck: () => [line(186, 322, 214, 322, INKL(2)), path('M 190 340 Q 200 348 210 340', INKL(2)), ellipse(200, 358, 3, 3, facePaint('#1c1a1e', 0.7))] },
  faceMarkSmall: { fit: 'eyes', face: () => [line(150, 214, 156, 220, INKL(1.6)), line(156, 214, 150, 220, INKL(1.6))] },
  abstractLineWork: { body: () => [path('M 130 400 C 170 440, 230 380, 270 430', INKL(2)), path('M 140 460 C 180 420, 220 500, 262 458', INKL(1.8)), path('M 160 500 Q 200 470 240 500', INKL(1.6))] },
  redGraphicLines: { body: () => [line(150, 400, 250, 400, INKL(3, 0.8, REDP)), line(200, 408, 200, 480, INKL(3, 0.8, REDP)), path('M 160 470 L 240 470', INKL(2.4, 0.8, REDP)), path('M 168 430 L 232 430', INKL(2.4, 0.8, REDP))] },
  scriptLikeMarks: { body: () => [path('M 140 420 C 150 406, 156 434, 166 418 C 176 402, 182 436, 192 420 C 202 404, 208 434, 218 418 C 228 402, 236 436, 246 420 C 252 410, 258 428, 264 418', INKL(1.6)), path('M 150 456 C 160 442, 166 470, 176 454 C 186 438, 192 472, 202 456 C 212 440, 218 470, 228 454 C 238 438, 244 466, 252 456', INKL(1.6))] },
  ceremonialSymbols: { body: () => [ellipse(200, 420, 16, 16, { fill: 'none', stroke: '#1c1a1e', sw: 2, op: 0.7 }), ellipse(200, 420, 4, 4, facePaint('#1c1a1e', 0.7)), path('M 152 470 L 170 440 L 188 470 Z', INKL(2)), path('M 212 470 L 230 440 L 248 470 Z', INKL(2)), ...[150, 200, 250].map((x) => ellipse(x, 496, 2.5, 2.5, facePaint('#1c1a1e', 0.7)))] },
  geometricBodyMarks: { body: () => [rect(150, 396, 34, 34, facePaint('#1c1a1e', 0.8)), path('M 216 396 L 250 396 L 233 430 Z', facePaint('#1c1a1e', 0.8)), rect(176, 452, 48, 10, facePaint('#1c1a1e', 0.8)), ellipse(200, 494, 14, 14, { fill: 'none', stroke: '#1c1a1e', sw: 3, op: 0.8 })] },
};
export const MARK_STYLES = Object.keys(MARKS);
// hands and sleeves: a hand is the skin (a glove when the character wears them), a sleeve the outer garment's colour
const gloved = (p) => p.props.includes('gloves');
const handColor = (p) => (gloved(p) ? '#161517' : p.skin);
const sleeveColor = (p) => (p.jacket.style !== 'none' ? p.jacket.color : p.top.style === 'bare' ? p.skin : p.top.color);
// an arm: the shoulder cap (a deltoid in the sleeve's colour over the torso's shoulder, lifted when the arm is raised), the upper arm to an
// elbow and the forearm to a wrist, both at arm thickness, and a mitten hand carrying on past the wrist; `side` +1 is the character's right (+x)
const ARM_W = 58, FORE_W = 52, SHOULDER = (side) => [200 + 86 * side, 398];
const mitten = (p, x, y, a, k = 1) => { const c = Math.cos(a), sn = Math.sin(a), at = (dx, dy) => [x + (dx * c - dy * sn) * k, y + (dx * sn + dy * c) * k], col = handColor(p), f = at(11, 0), t = at(2, -14); return [ellipse(x, y, 15 * k, 17 * k, { fill: col }), ellipse(f[0], f[1], 12 * k, 12 * k, { fill: col }), ellipse(t[0], t[1], 6.5 * k, 8 * k, { fill: col })]; };
/** An arm from the shoulder on `side` through `elbow` to `wrist` (sheet points), the shoulder lifted by `lift` (0..1), with a hand unless `hand` is false. */
export function arm(p, side, { lift = 0, elbow, wrist, hand = true }) {
  const [sx0, sy0] = SHOULDER(side), sx = sx0 - (16 - 24 * lift) * side, sy = sy0 - 8 * lift, col = sleeveColor(p), [ex, ey] = elbow, [wx, wy] = wrist; // the cap sits inside the torso's shoulder and rises out of it as the arm lifts
  const dx = wx - ex, dy = wy - ey, L = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx), hx = wx + (dx / L) * 16, hy = wy + (dy / L) * 16;
  return [
    ...(lift > 0.5 ? [ellipse(200 + 72 * side, 404, 34, 30, { fill: col })] : []), // a lifted arm's shoulder: a rounded mass joining the torso across the armpit notch
    ellipse(sx, sy, 20 + 12 * lift, 17 + 13 * lift, { fill: col }), ...(lift > 0.5 ? [path(`M ${sx - 22 * side} ${sy + 18} Q ${sx} ${sy + 30} ${sx + 18 * side} ${sy + 20}`, stroke('#000', 2.5, 0.12))] : []), // the cap, and the crease under a lifted one
    line(sx, sy, ex, ey, stroke(col, ARM_W)), line(ex, ey, wx, wy, stroke(col, FORE_W)),
    ellipse(ex, ey, 9, 7, { fill: '#000', op: 0.08 }), // the elbow
    ...(hand ? mitten(p, hx + (dx / L) * 4, hy + (dy / L) * 4, a, 1.25) : []),
  ];
}
const sleeve = (p, x0, y0, x1, y1, sw = 34) => line(x0, y0, x1, y1, stroke(sleeveColor(p), sw));
const hand = (p, x, y, a = 0, k = 1) => mitten(p, x, y, a - Math.PI / 2, k);
const GOLD_OBJ = (cx, cy, r) => [ellipse(cx, cy, r, r, { fill: '#b8892b' }), ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.35, r * 0.25, { fill: '#fff3c8', op: 0.7 }), ellipse(cx + r * 0.25, cy + r * 0.3, r * 0.5, r * 0.4, { fill: '#6e4d12', op: 0.35 })];
const stem = (x0, y0, x1, y1) => [line(x0, y0, x1, y1, stroke('#3e5a2e', 4)), path(`M ${(x0 + x1) / 2} ${(y0 + y1) / 2} Q ${(x0 + x1) / 2 - 18} ${(y0 + y1) / 2 - 12} ${(x0 + x1) / 2 - 22} ${(y0 + y1) / 2 + 4} Z`, { fill: '#4d6e38' })];
const petals = (cx, cy, color, n = 6, r = 12) => [...Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return ellipse(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75, r * 0.55, r * 0.35, { fill: color }); }), ellipse(cx, cy, r * 0.35, r * 0.35, { fill: '#3a2410' })];
export const PROPS = {
  none: {},
  handsAtSides: {},
  gloves: {}, // hands at the sides are below the sheet; gloves show on whatever the hands do hold (handColor)
  goldField: { back: () => [ellipse(200, 200, 172, 172, { fill: GOLDP, op: 0.2 }), ellipse(200, 200, 172, 172, { fill: 'none', stroke: GOLDP, sw: 3, op: 0.4 }), ellipse(200, 200, 118, 118, { fill: GOLDP, op: 0.14 })] }, // a gilded ground far behind the head: two discs and a rim
  chain: { neck: () => [path('M 150 368 Q 200 424 250 368', stroke('#c9a03c', 7)), path('M 150 368 Q 200 424 250 368', stroke('#fff0c0', 2, 0.5)), ellipse(200, 396, 9, 11, { fill: '#c9a03c' })] },
  flamingFlower: { front: (p) => [...arm(p, 1, { lift: 0.15, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), ...stem(262, 458, 272, 386), ...petals(274, 380, '#b3202a'), path('M 274 362 C 260 344, 268 322, 276 306 C 280 324, 294 336, 286 352 C 298 340, 298 328, 294 316 C 304 336, 298 358, 274 362 Z', { fill: '#e8862a' }), path('M 274 358 C 266 344, 272 330, 276 322 C 280 334, 286 342, 282 352 Z', { fill: '#ffd94a' })] },
  flower: { front: (p) => [...arm(p, 1, { lift: 0.15, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), ...stem(262, 458, 272, 386), ...petals(274, 380, '#efe6d6', 7, 14)] },
  sunglassesInHand: { front: (p) => [...arm(p, 1, { lift: 0.15, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), rect(230, 444, 22, 15, { rx: 6, fill: '#141216' }), rect(256, 444, 22, 15, { rx: 6, fill: '#141216' }), line(252, 449, 256, 449, stroke('#141216', 2.5))] },
  ceremonialObject: { front: (p) => [...arm(p, -1, { lift: 0.15, elbow: [98, 486], wrist: [172, 474], hand: false }), ...arm(p, 1, { lift: 0.15, elbow: [302, 486], wrist: [228, 474], hand: false }), ...hand(p, 178, 472, 0.6), ...hand(p, 222, 472, -0.6), path('M 178 436 L 222 436 L 214 466 L 186 466 Z', { fill: '#b8892b' }), rect(190, 466, 20, 8, { fill: '#8a6519' }), line(184, 442, 216, 442, stroke('#fff3c8', 1.5, 0.6))] },
  abstractGoldObject: { front: (p) => [...arm(p, 1, { lift: 0.15, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), ...GOLD_OBJ(250, 432, 24)] },
  abstractToyLikeProp: { front: (p) => [...arm(p, 1, { lift: 0.15, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), rect(240, 420, 28, 32, { rx: 5, fill: '#b3202a' }), ellipse(248, 432, 3.5, 3.5, { fill: '#fff' }), ellipse(260, 432, 3.5, 3.5, { fill: '#fff' }), rect(246, 442, 16, 4, { fill: '#fff' })] },
  handHeartGesture: { front: (p) => [...arm(p, -1, { lift: 0.1, elbow: [96, 490], wrist: [176, 476], hand: false }), ...arm(p, 1, { lift: 0.1, elbow: [304, 490], wrist: [224, 476], hand: false }), path('M 200 498 C 172 480, 160 452, 178 442 C 188 437, 197 443, 200 452 C 203 443, 212 437, 222 442 C 240 452, 228 480, 200 498 Z', stroke(handColor(p), 19)), path('M 200 494 C 176 478, 166 456, 180 448 C 190 444, 198 449, 200 458 C 202 449, 210 444, 220 448 C 234 456, 224 478, 200 494 Z', { fill: '#000', op: 0.16 })] },
  handsUp: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [70, 300], wrist: [92, 190] }), ...arm(p, 1, { lift: 1, elbow: [330, 300], wrist: [308, 190] })] }, // both shoulders lifted, elbows out past the ears, hands above the head
  armRaised: { lift: [1], front: (p) => [...arm(p, 1, { lift: 1, elbow: [332, 296], wrist: [312, 184] })] },
};
export const PROP_STYLES = Object.keys(PROPS);
const ink = (p) => (p.top.color && parseInt(p.top.color.slice(1, 3), 16) > 150 ? '#1a1719' : '#ece8e0'); // a print in the colour that shows on this top
export const GRAPHICS = {
  redLabel: (p) => [rect(172, 404, 56, 20, { fill: REDP }), rect(178, 411, 26, 5, { fill: '#f4ece0' })],
  strokes: (p) => [path('M 150 420 C 168 404, 176 436, 196 416 C 212 402, 220 434, 244 414', stroke(ink(p), 5, 0.85)), path('M 162 456 C 190 440, 206 470, 236 448', stroke(ink(p), 4, 0.85)), line(158, 484, 246, 486, stroke(ink(p), 3, 0.7))],
  concentric: (p) => [ellipse(200, 440, 44, 44, { fill: 'none', stroke: ink(p), sw: 4, op: 0.85 }), ellipse(200, 440, 28, 28, { fill: 'none', stroke: ink(p), sw: 4, op: 0.85 }), ellipse(200, 440, 12, 12, { fill: 'none', stroke: ink(p), sw: 4, op: 0.85 })],
  symbol: (p) => [path('M 200 396 L 236 440 L 200 484 L 164 440 Z', { fill: 'none', stroke: ink(p), sw: 5, op: 0.9 }), line(200, 420, 200, 460, stroke(ink(p), 5, 0.9))],
  geometric: (p) => [rect(156, 404, 36, 36, { fill: ink(p), op: 0.85 }), path('M 208 404 L 244 404 L 226 440 Z', { fill: ink(p), op: 0.85 }), rect(156, 454, 88, 8, { fill: ink(p), op: 0.85 }), ellipse(200, 490, 12, 12, { fill: 'none', stroke: ink(p), sw: 4, op: 0.85 })],
  stripes: (p) => [400, 424, 448, 472, 496].map((y) => rect(60, y, 280, 9, { fill: ink(p), op: 0.8 })),
  blocks: (p) => [rect(120, 420, 80, 80, { fill: REDP, op: 0.9 }), rect(200, 420, 80, 80, { fill: ink(p), op: 0.85 })],
  piping: (p) => [path('M 96 440 C 106 400, 130 378, 160 362', stroke(p.top.accent ?? REDP, 5, 1, 'butt')), path('M 304 440 C 294 400, 270 378, 240 362', stroke(p.top.accent ?? REDP, 5, 1, 'butt'))],
};
export const GRAPHIC_STYLES = Object.keys(GRAPHICS);
const LAYERS = [['makeup', MAKEUP], ['marks', MARKS], ['props', PROPS]];
const overlays = (p, at, fits) => LAYERS.flatMap(([key, reg]) => (p[key] ?? []).flatMap((n) => { const d = reg[n], f = d?.[at]; if (!f) return []; const fit = typeof d.fit === 'string' ? d.fit : d.fit?.[at]; return fit ? fits[fit](f(p)) : f(p); }));

// metallic cloth: SVG has no gold lamé, so the garment gets dark folds falling from the shoulders, sharp pale patches beside them and a few near-white slivers, all clipped to its shape; the seed places them
const lcg = (seed) => { let x = (Math.abs(Math.floor(seed * 7919)) % 233280) || 7; return () => (x = (x * 9301 + 49297) % 233280) / 233280; };
export function sheen(d, color, seed = 1, [y0, y1] = [340, 600], n = 6, rule) {
  const r = lcg(seed), out = [clip(d, rule)], span = y1 - y0;
  for (let i = 0; i < n; i++) { const x = 50 + r() * 300, bend = (r() - 0.5) * 70, w = 6 + r() * 16; out.push(path(`M ${x} ${y0} C ${x + bend} ${y0 + span * 0.3}, ${x - bend} ${y0 + span * 0.65}, ${x + bend * 0.5} ${y1} L ${x + bend * 0.5 + w} ${y1} C ${x - bend + w} ${y0 + span * 0.65}, ${x + bend + w} ${y0 + span * 0.3}, ${x + w} ${y0} Z`, { fill: shade(color, 0.5), op: 0.38 })); }
  for (let i = 0; i < n; i++) { const x = 50 + r() * 300, y = y0 + r() * span * 0.8, hh = span * (0.1 + r() * 0.3), w = 4 + r() * 11, sk = (r() - 0.5) * 24; out.push(path(`M ${x} ${y} L ${x + w} ${y} L ${x + w + sk} ${y + hh} L ${x + sk} ${y + hh} Z`, { fill: shade(color, 1.55), op: 0.55 })); }
  for (let i = 0; i < 3; i++) { const x = 60 + r() * 280, y = y0 + r() * span * 0.7; out.push(line(x, y, x + (r() - 0.5) * 12, y + span * (0.15 + r() * 0.3), stroke('#fff8e0', 1.6, 0.6))); }
  out.push(UNCLIP);
  return out;
}
/** The ops with a sheen after every path filled in the garment's colour. */
export const metalize = (ops, color, seed, box) => ops.flatMap((o) => (o.k === 'path' && o.fill === color ? [o, ...sheen(o.d, color, seed, box, 6, o.rule)] : [o]));

// face details: freckles, moles, lines; `fit` says what they follow (the eye spacing or the face width)
const DL = (color, sw, op) => stroke(color, sw, op);
export const DETAILS = {
  frecklesLight: { fit: 'face', ops: () => [[164, 224], [172, 226], [180, 223], [220, 223], [228, 226], [236, 224]].map(([x, y]) => ellipse(x, y, 1.2, 1.1, { fill: '#7a4f3e', op: 0.38 })) },
  frecklesMedium: { fit: 'face', ops: () => [[158, 223], [165, 228], [171, 223], [179, 227], [185, 224], [215, 224], [221, 227], [229, 223], [236, 228], [243, 223]].map(([x, y]) => ellipse(x, y, 1.4, 1.2, { fill: '#744c3c', op: 0.45 })) },
  cheekMoleLeft: { fit: 'face', ops: () => [ellipse(166, 246, 1.8, 1.8, { fill: '#3f2b25', op: 0.85 })] },
  cheekMoleRight: { fit: 'face', ops: () => [ellipse(235, 246, 1.8, 1.8, { fill: '#3f2b25', op: 0.85 })] },
  underEyeLines: { fit: 'eyes', ops: () => [path('M 147 210 Q 166 217 185 210', DL('#754b3d', 1.3, 0.25)), path('M 215 210 Q 234 217 253 210', DL('#754b3d', 1.3, 0.25))] },
  crowsFeet: { fit: 'eyes', ops: () => [line(144, 192, 137, 188, DL('#6b473b', 1, 0.32)), line(144, 197, 136, 198, DL('#6b473b', 1, 0.32)), line(256, 192, 263, 188, DL('#6b473b', 1, 0.32)), line(256, 197, 264, 198, DL('#6b473b', 1, 0.32))] },
  foreheadLines: { fit: 'face', ops: () => [path('M 168 145 Q 200 139 232 145', DL('#6f493d', 1.2, 0.2)), path('M 174 153 Q 200 148 226 153', DL('#6f493d', 1.1, 0.16))] },
  dimples: { fit: 'face', ops: () => [path('M 166 269 Q 170 274 174 269', DL('#754b3d', 1.4, 0.42)), path('M 226 269 Q 230 274 234 269', DL('#754b3d', 1.4, 0.42))] },
  cleftChin: { fit: 'face', ops: (p) => mapXY([path('M 196 297 Q 200 303 204 297', DL('#744a3d', 1.4, 0.4))], (x) => x, (y) => y + p.face.height - 204) },
  noseRingLeft: { fit: 'face', ops: () => [ellipse(191, 248, 4.5, 4.5, { fill: 'none', stroke: '#aaa397', sw: 1.7 })] },
};
export const DETAIL_STYLES = Object.keys(DETAILS);
const details = (p, fitFace, fitEyes) => p.details.flatMap((n) => { const d = DETAILS[n]; return d ? (d.fit === 'eyes' ? fitEyes : fitFace)(d.ops(p)) : []; });

/** The drawing, back to front, without the background: a plain list of primitives for `toSvg` or `drawOn`. */
export function portraitOps(options = {}) {
  const p = merge(DEFAULTS, options), hair = hairOf(p), q = p.pose;
  const fit = (ops) => (p.face.width === 156 ? ops : mapX(ops, scaleAbout(200, p.face.width / 156))); // hair, ears, beard, hat and cheeks are drawn for the default head and follow this one's width
  const fitEyes = (ops) => mapXY(ops, scaleAbout(200, p.eyes.spacing / 68), (y) => y + p.eyes.y - 196);
  const headG = push(q.headX, HEAD_DY + headDrop(p) + q.headY, q.headTilt, NECK_BASE); // the head sits HEAD_DY down the neck and moves about its base; the back hair rides with it but sits behind the neck, so the group opens twice
  const neckG = push(q.headX * 0.3, 0, q.headTilt * 0.3, [200, 302 + p.neck.height]); // the neck follows a third of the head's move, pivoting at its base
  const crown = HAT_CROWN[p.hat.style], back = fit(hair.back), front = fit(hair.front);
  const solid = (o) => o.fill && o.fill !== 'none' && (o.op ?? 1) >= 0.5, region = (ops) => ops.filter((o) => solid(o) && (o.k === 'path' || o.k === 'ellipse')).map((o) => (o.k === 'ellipse' ? ellipsePath(o) : o.d)).join(' '); // the filled shapes as one clip region
  const grain = HAIR_TEXTURE[p.hair.style] ?? 'strands', mass = region(grain === 'curls' ? [...back, ...front] : front); // the hair's mass: the front, or with the back for curls (an afro's mass is behind the head)
  const textured = (ops, mass, grainOps) => (grain !== 'none' && mass ? [...ops, clip(mass), ...grainOps, ...soft(200, 96, 46, 22, '#fff', 0.14), UNCLIP] : ops); // the hair with its grain (strands combed from the crown, or curls) and a light on it inside its mass, so it is hair and not a cap
  const backHair = grain === 'curls' ? textured(back, region(back), curls(p)) : back, frontHair = textured(front, region(front), grain === 'curls' ? curls(p) : strands(p)); // the back's texture goes on behind the head, since the face sits inside an afro's footprint
  const hairShadow = front.length ? [clip(facePath(p)), ...mapXY(front.filter((o) => o.fill && o.fill !== 'none' && (o.op ?? 1) >= 0.5), (x) => x, (y) => y + 6).map((o) => ({ ...o, fill: '#000', op: 0.14 })), UNCLIP] : []; // the hair's cast shadow on the forehead: the front hair a little lower, dark, inside the face
  const beardOps = fit((FACIAL_HAIR[p.facialHair.style] ?? FACIAL_HAIR.none)(p)), beardMass = region(beardOps.filter((o) => o.fill === p.hairColor)); // the beard's own hair, not the skin it leaves around the mouth or a stubble wash
  const beard = beardMass ? [...beardOps, clip(beardMass), ...strands(p, { from: [200, 258], a0: 0.4, a1: Math.PI - 0.4, len: 55, n: 16 }), UNCLIP] : beardOps, masked = p.makeup.some((n) => MAKEUP[n]?.mask); // a mask goes on over the beard, so the beard goes under the skin overlays
  const asHat = (ops) => ops.filter((o) => (o.op ?? 1) >= 0.5).map((o) => ({ ...o, ...(o.fill && o.fill !== 'none' ? { fill: p.hat.color } : {}), ...(o.stroke ? { stroke: p.hat.color } : {}) })); // the hair in the hat's colour (its glosses dropped)
  const cover = crown ? [clip(`M -100 ${crown} L 500 ${crown} L 500 -200 L -100 -200 Z`), ...asHat(back), ...asHat(front), UNCLIP] : []; // the hat covers everything of the hair above its line: the crown takes the hair's shape
  const fits = { face: fit, eyes: fitEyes }, wide = (ops) => (p.body.width === 1 ? ops : mapX(ops, scaleAbout(200, p.body.width))); // the torso, its print and the arms follow the body's width
  let top = (TOPS[p.top.style] ?? TOPS.crewTshirt)(p); if (p.top.metal) top = metalize(top, p.top.color, p.seed); if (p.top.graphic && GRAPHICS[p.top.graphic]) top = [...top, clip(top[0].d), ...GRAPHICS[p.top.graphic](p), UNCLIP]; // every top's first op is its torso
  const lifted = p.props.flatMap((n) => PROPS[n]?.lift ?? []); // the sides whose arm a prop raises: the garment's shoulder slope is cut away there and the side under the arm is trimmed to an armpit notch, so the shirt still reaches the arm; the arm's cap and sleeve take the shoulder's place
  const armpit = lifted.length ? [clip(`M -100 -200 L 500 -200 L 500 700 L -100 700 Z ${lifted.map((sd) => `M ${200 + 54 * sd} 300 L ${200 + 220 * sd} 300 L ${200 + 220 * sd} 600 L ${200 + 96 * sd} 600 L ${200 + 88 * sd} 424 L ${200 + 58 * sd} 392 Z`).join(' ')}`, 'evenodd')] : [];
  let jacket = (JACKETS[p.jacket.style] ?? JACKETS.none)(p); if (p.jacket.metal) jacket = metalize(jacket, p.jacket.color, p.seed + 1);
  let hat = fit((HATS[p.hat.style] ?? HATS.none)(p)); if (p.hat.metal) hat = metalize(hat, p.hat.color, p.seed + 2, [40, 390]);
  return [
    ...overlays(p, 'back', fits), // the ground behind the figure, outside its sway
    push(q.bodyX, 0, q.bodyTilt, HIPS),
    headG, ...backHair, POP, // the back hair hangs behind the shoulders, so it goes down before the top
    ...wide([...armpit, ...top, ...jacket, ...(armpit.length ? [UNCLIP] : []), ...overlays(p, 'body', fits)]),
    neckG, ...neck(p), POP, ...accessories(p, 'neck'), ...overlays(p, 'neck', fits),
    headG, ...fit(ears(p)), ...fit(accessories(p, 'ear')), ...head(p), ...details(p, fit, fitEyes), ...(masked ? beard : []), ...overlays(p, 'skin', fits), ...eyes(p), ...nose(p), ...mouth(p), ...overlays(p, 'face', fits), ...(masked ? [] : beard), ...hairShadow, ...frontHair, ...glasses(p), ...cover, ...hat, ...fit(accessories(p, 'over')), ...overlays(p, 'over', fits), POP,
    ...wide(overlays(p, 'front', fits)),
    POP,
  ];
}

const attrs = (o) => [o.fill !== undefined ? `fill="${o.fill}"` : '', o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw ?? 1}" stroke-linecap="${o.cap ?? 'round'}"` : '', o.op !== undefined ? `opacity="${o.op}"` : '', o.rx ? `rx="${o.rx}"` : '', o.rule ? `fill-rule="${o.rule}"` : ''].filter(Boolean).join(' ');
let clipN = 0; // clip ids are unique across every svg printed, since a page shows many portraits and ids are document-wide
export function toSvg(ops, background = null) {
  let n = 0;
  const body = ops.map((o) => o.k === 'push' ? `<g transform="translate(${o.tx} ${o.ty}) rotate(${(o.rot * 180) / Math.PI} ${o.cx} ${o.cy})">` : o.k === 'pop' ? '</g>' : o.k === 'clip' ? `<clipPath id="c${(n = ++clipN)}"><path d="${o.d}"${o.rule ? ` clip-rule="${o.rule}"` : ''}/></clipPath><g clip-path="url(#c${n})">` : o.k === 'unclip' ? '</g>' : o.k === 'path' ? `<path d="${o.d}" ${attrs(o)}/>` : o.k === 'ellipse' ? `<ellipse cx="${o.cx}" cy="${o.cy}" rx="${o.rx}" ry="${o.ry}" ${attrs({ ...o, rx: 0 })}/>` : o.k === 'rect' ? `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" ${attrs(o)}/>` : `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" ${attrs(o)}/>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480" role="img">\n${background ? `<rect width="400" height="480" fill="${background}"/><circle cx="200" cy="194" r="150" fill="#fff" opacity=".08"/>` : ''}\n${body}\n</svg>`;
}
/** The whole portrait as SVG, background included. */
export const renderPortrait = (options = {}) => toSvg(portraitOps(options), merge(DEFAULTS, options).background);

/** Walk an absolute M/L/C/Q/Z path onto a canvas context. */
export function tracePath(ctx, d) {
  const tok = tokens(d);
  let cmd = 'M';
  for (let i = 0; i < tok.length;) {
    if (/[a-z]/i.test(tok[i])) { cmd = tok[i++].toUpperCase(); if (cmd === 'Z') { ctx.closePath(); continue; } }
    const n = ARGS[cmd] ?? 2, a = tok.slice(i, i + n).map(Number); i += n;
    if (cmd === 'M') ctx.moveTo(a[0], a[1]); else if (cmd === 'L') ctx.lineTo(a[0], a[1]); else if (cmd === 'C') ctx.bezierCurveTo(...a); else if (cmd === 'Q') ctx.quadraticCurveTo(...a);
    if (cmd === 'M') cmd = 'L';
  }
}
/** Paint the ops on a canvas in sheet units (400 x 480); `alpha` scales every opacity. */
export function drawOn(ctx, ops, alpha = 1) {
  for (const o of ops) {
    if (o.k === 'clip') { ctx.save(); ctx.beginPath(); tracePath(ctx, o.d); ctx.clip(o.rule ?? 'nonzero'); continue; }
    if (o.k === 'unclip' || o.k === 'pop') { ctx.restore(); continue; }
    if (o.k === 'push') { ctx.save(); ctx.translate(o.cx + o.tx, o.cy + o.ty); ctx.rotate(o.rot); ctx.translate(-o.cx, -o.cy); continue; }
    ctx.globalAlpha = (o.op ?? 1) * alpha;
    ctx.beginPath();
    if (o.k === 'path') tracePath(ctx, o.d);
    else if (o.k === 'ellipse') ctx.ellipse(o.cx, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2);
    else if (o.k === 'rect') ctx.roundRect ? ctx.roundRect(o.x, o.y, o.w, o.h, o.rx ?? 0) : ctx.rect(o.x, o.y, o.w, o.h);
    else { ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); }
    if (o.fill && o.fill !== 'none') { ctx.fillStyle = o.fill; ctx.fill(o.rule ?? 'nonzero'); }
    if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.sw ?? 1; ctx.lineCap = o.cap ?? 'round'; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}
