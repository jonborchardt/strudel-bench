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
/** `a` blended toward `b` by `t`. */
export const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

// corner: how far above the chin the jaw angle sits (32 unless set); the square and broad heads carry it higher, so they taper under the beard
export const FACE_SHAPES = {
  oval: { width: 156, height: 204, jaw: 0.75, chin: 0.2 }, round: { width: 168, height: 190, jaw: 0.9, chin: 0.06 }, square: { width: 171, height: 201, jaw: 0.73, chin: 0.03, corner: 40 },
  heart: { width: 166, height: 204, jaw: 0.63, chin: 0.33 }, diamond: { width: 165, height: 210, jaw: 0.66, chin: 0.26 },
  narrow: { width: 146, height: 216, jaw: 0.68, chin: 0.22 }, broad: { width: 180, height: 204, jaw: 0.67, chin: 0.1, corner: 40 }, softSquare: { width: 170, height: 204, jaw: 0.76, chin: 0.08 }, longOval: { width: 151, height: 220, jaw: 0.72, chin: 0.22 },
};
export const NECK_TYPES = { narrow: { width: 48, height: 71 }, average: { width: 63, height: 72 }, thick: { width: 79, height: 67 }, long: { width: 58, height: 88 }, short: { width: 68, height: 55 } };

export const HEAD_DY = 8; // the head sits this far down the neck
export const NECK_FOLLOW = 0.15; // how much of the head's tilt the neck takes (a third read as a rubber neck bending, none as a peg)
export const HAT_PUFF_MAX = 1.22; // a hat sits on the hair, not on the skull: it is as wide as the hair it goes over, up to this much wider than it would sit bare (past which it is a costume, and an afro or a big bun is meant to show around it)
export const HAT_TURN = 10; // how far a hat slides on a fully turned head: it rides the skull, so further than the outline and less than the features
export const HAT_TUCK = 14; // how far the hat's skirt hangs below the hat, filling the crescent under a crown's arched edge
export const HAIR_LIFT = 40, HAT_SEAT_MAX = 18; // every hat is drawn over a head of hair (the styles rise ~44 above the skull): a hat missing that much hair sits this much further down the head, so a cap on a bald or buzzed head rests on the skull instead of floating over where the hair would have been
const NECK_BOTTOM = 430; // every neck runs to here, below the lowest neckline: the neck sits behind the garments, so its base and its flare into the shoulders are covered whatever the collar, and only the straight column between chin and neckline shows. A neck that stopped at its own height left two tabs of skin sitting on a low collar.
const NECK_TOP = 240, NECK_BASE = [200, 300 + HEAD_DY], HIPS = [200, 600];
export const CHIN_Y = 327.2, NECK_SHOW = 0.2; // where every chin lands on the sheet (the default head's), and how much of a neck type's height shows above the collar (a long neck is a little longer, never a stalk)
const headDrop = (p) => CHIN_Y + ((p.neck?.height ?? 72) - 72) * NECK_SHOW - (112 + HEAD_DY + (p.face?.height ?? 204) + 16 * (p.face?.chin ?? 0.2)); // the chin, not the crown, is what sits on the neck: the head moves up or down the neck so a short face and a long one show the same neck
/** The body's build with every dial a finite number in 0.3..3 (a cast's object may leave keys out or write nonsense); 1 everywhere is the figure as drawn. */
const bld = (p) => { const b = { ...DEFAULTS.build, ...(p.build ?? {}) }; for (const k of Object.keys(b)) { const v = +b[k]; b[k] = Number.isFinite(v) ? Math.max(0.3, Math.min(3, v)) : 1; } return b; };
const SHOULDER_LINE = 356; // the trunk's height is measured from here: the shoulder line every garment's neckline sits under
export const DEFAULTS = {
  background: '#d7d0c5', skin: '#c98e68', hairColor: '#30231e',
  face: { ...FACE_SHAPES.oval, skew: 0, fullness: 0, asym: { cheek: 0, jaw: 0, temple: 0, chin: 0 } }, // skew: one side a little lower, the chin off centre, in -1..1; fullness: soft tissue on the cheeks in -1..1, the weight a face carries independently of the skull its jaw width describes; asym: the face's own irregularities, each signed by side (+x is the character's right): one cheek fuller, one jaw corner sharper, one temple wider, the chin toward one side
  ears: { size: 1, pointed: 0, mode: 'human' }, // mode: a machine's ear (EAR_MODES, see machineEar);  pointed: the helix drawn on past the top into a point (0 a round ear, 1 an elf's); a cast's, like build
  eyes: { y: 196, spacing: 52, openness: 1, asym: 1, dy: 0, depth: 0.5, sclera: null, lidWeight: null, corner: null, bags: 0, squint: 0, style: 'almond', iris: '#604839', pupil: '#171716', browStyle: 'softArch', browLift: 0, browSkew: 0, browInner: 0, size: 1, white: null, slit: 0, tilt: 0, mode: 'human', browColor: null, look: { x: 0, y: 0 } }, // mode: a machine's eye (EYE_MODES, see machineEye); browColor: the brows' own colour (null: the hair's; a dyed head keeps the brows it grew);  asym: the left eye's openness against the right's; dy: the left eye lower by this much; depth: how far under the brow the eyes sit; sclera: how much white shows (null: the style's); lidWeight: the upper lid's weight (null: the style's); corner: the inner corner drawn out to a point (null: the style's); bags: the lower socket; squint: the lower lid pushed up, what a real smile does to the eye; browInner: the brows' inner ends raised (worry, grief) or, below 0, pulled down and together (anger); size: the whole eye scaled, white: the eye's white as a colour (null: a white that takes the skin; an alien's eye is black from corner to corner), slit: the pupil drawn up into a vertical slit; tilt: the outer corner raised (+) or dropped (-) against the inner, the eye's slant
  nose: { style: 'straight', length: 38, width: 20, muzzle: 0, mode: 'human' }, // mode: a machine's (NOSE_MODES);  muzzle: the nose drawn as one, the bridge carried down into a wide nostril pad instead of a tip with wings (0 a face's nose, 1 a dragonborn's), and the mouth widened and thinned under it; a cast's, like ears.pointed and build
  mouth: { style: 'plain', y: 260, width: 48, smile: 0.05, fullness: 0.45, color: null, open: 0, teeth: 'even', skew: 0, press: 0, mode: 'human' }, // mode: a machine's mouth (MOUTH_MODES, see machineMouth);  color: the lips; null is a lip tone under the skin. teeth: what shows between them when the mouth is parted or smiling broadly. skew: the +x corner pulled up (a smirk), the other left; press: the lips pressed thin
  hair: { style: 'sidePart', hairline: 0, recession: 0 }, // hairline: the front hair's edge higher (+1) or lower (-1) on the forehead, the style's own cut at 0; recession: the temples retreating, the centre staying, in 0..1
  facialHair: { style: 'none', color: null, density: null, mustache: null, mustacheStyle: null, cheekLine: null }, // color: null is the hair's; density: how much hair, 0..1, null the style's (the gap between a stubble and a beard is a number, not a style); it is always drawn opaque, a thin beard being the skin showing between the hair rather than a transparent one; mustache: null the style's, true or false to add or drop one; cheekLine: how high up the cheek the beard climbs, 0..1, null the style's
  hat: { style: 'none', color: '#353b43', accent: '#24292f', metal: 0 }, // metal: the garment shaded as metallic cloth (sheen)
  top: { style: 'crewTshirt', color: '#42576c', accent: null, graphic: null, graphicColor: null, graphicScale: 1, graphicY: 0, metal: 0 }, // accent: piping, a tie; graphic: a GRAPHICS name printed on the torso, the print a slot rather than a fixed mark: graphicColor recolours it (null keeps its own inks), graphicScale sizes it about the print's centre and graphicY moves it up or down the chest
  jacket: { style: 'none', color: '#373b3e', metal: 0 },
  body: { width: 1 }, // the shoulders' width against the default torso
  build: { trunk: 1, legs: 1, shoulders: 1, arms: 1, hands: 1, feet: 1, head: 1 }, // the body's proportions: the trunk's height between the shoulder line and the hem, the legs' length to the floor, the shoulder width (over body.width), the arms' length about the joint, the head's size about the neck base; a cast's build, 1 the figure as drawn
  pants: { style: 'trousers', color: '#2e3136' }, shoes: { color: '#1f1d1b' }, // the legs: LEGS style and its cloth, and the shoes
  glasses: null, // { style, color }
  figure: { opacity: 1, saturation: 1 }, // the figure as a whole: opacity under 1 fades it as one group (a hologram), saturation under 1 grades every colour toward grey (noir); 1 and 1 draw nothing extra
  accessories: [], details: [], makeup: [], marks: [], props: [], blush: 0, // names in ACCESSORIES, DETAILS, MAKEUP, MARKS, PROPS
  seed: 1, // places the sheen's folds
  light: { side: -1, amount: 0.5, contrast: 1 }, // the light: a soft frontal wash, its strength from none (0) to full (1), the side the planes' shadows fall away from, and contrast: how deep the tonal planes go (the sockets, the cheek, under the chin, the neck, the torso's far side); 1 is the soft default, more is harder (the tableau's dial, never the generic one)
  neck: { ...NECK_TYPES.average },
  pose: { headX: 0, headY: 0, headTilt: 0, bodyX: 0, bodyTilt: 0, turn: 0, shoulder: 0, gaze: null }, // the head moves on the neck (sheet units, radians, about the neck base), the body sways about the hips; turn: the head turned off the torso (-1..1, the features slide toward one side and the far ear goes); shoulder: one shoulder dropped (-1..1, the +x one down when positive); gaze: 'camera' keeps the eyes on the viewer through the turn, so a turned head does not stare off the sheet
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
const push = (tx, ty, rot, [cx, cy], sc = 1) => ({ k: 'push', tx, ty, rot, cx, cy, ...(sc !== 1 ? { sc } : {}) }), POP = { k: 'pop' }; // a transform group: shifted by (tx, ty), turned by rot and scaled by sc about (cx, cy); sc is written only when it does something
const stroke = (color, sw, op = 1, cap = 'round') => ({ fill: 'none', stroke: color, sw, op, cap });
export { path, ellipse, rect, line, clip, UNCLIP, stroke }; // for a theme module (thriller.mjs) that registers parts of its own into the registries below
const ARGS = { M: 2, L: 2, C: 6, Q: 4, Z: 0 };
const tokens = (d) => d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
/** The ops with every x through `fx` and every y through `fy`: how a part drawn for the default head follows this one.
 *  An ellipse's radius is remapped as the mapped half-width, `fx(cx + rx) - fx(cx)`, and a strong turn can map the far
 *  edge to the left of the centre -- so the radius is clamped at zero. A negative one is invalid SVG (the browser
 *  refuses the attribute and the feature silently does not draw) and throws IndexSizeError on a canvas; zero is what
 *  the geometry means there anyway, which is the far eye gone at a near profile. */
export function mapXY(ops, fx, fy = (y) => y) {
  const r = (v) => Math.round(v * 100) / 100;
  const px = (d) => { let cmd = 'M', i = 0; return tokens(d).map((t) => { if (/[a-z]/i.test(t)) { cmd = t.toUpperCase(); i = 0; return t; } const n = ARGS[cmd] || 2, v = i % n % 2 === 0 ? fx(+t) : fy(+t); i++; return String(r(v)); }).join(' '); };
  return ops.map((o) => o.k === 'path' || o.k === 'clip' ? { ...o, d: px(o.d) } : o.k === 'ellipse' ? { ...o, cx: r(fx(o.cx)), cy: r(fy(o.cy)), rx: Math.max(0, r(fx(o.cx + o.rx) - fx(o.cx))), ry: Math.max(0, r(fy(o.cy + o.ry) - fy(o.cy))) } : o.k === 'rect' ? { ...o, x: r(fx(o.x)), y: r(fy(o.y)), w: r(fx(o.x + o.w) - fx(o.x)), h: r(fy(o.y + o.h) - fy(o.y)) } : o.k === 'line' ? { ...o, x1: r(fx(o.x1)), x2: r(fx(o.x2)), y1: r(fy(o.y1)), y2: r(fy(o.y2)) } : o);
}
export const mapX = (ops, fx) => mapXY(ops, fx);
export const scaleAbout = (c, k) => (v) => c + (v - c) * k;
/** The ops with every point through `f(x, y) → [x, y]` (a shear, a turn); an ellipse or rect moves by its centre and keeps its size. */
export function mapPts(ops, f) {
  const r = (v) => Math.round(v * 100) / 100;
  const px = (d) => { let cmd = 'M', i = 0, x = 0; const out = []; for (const t of tokens(d)) { if (/[a-z]/i.test(t)) { cmd = t.toUpperCase(); i = 0; out.push(t); continue; } if (i % 2 === 0) x = +t; else { const [a, b] = f(x, +t); out.push(r(a), r(b)); } i++; } return out.join(' '); };
  return ops.map((o) => { if (o.k === 'path' || o.k === 'clip') return { ...o, d: px(o.d) }; if (o.k === 'ellipse') { const [cx, cy] = f(o.cx, o.cy); return { ...o, cx: r(cx), cy: r(cy) }; } if (o.k === 'rect') { const [cx, cy] = f(o.x + o.w / 2, o.y + o.h / 2); return { ...o, x: r(cx - o.w / 2), y: r(cy - o.h / 2) }; } if (o.k === 'line') { const [x1, y1] = f(o.x1, o.y1), [x2, y2] = f(o.x2, o.y2); return { ...o, x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2) }; } return o; });
}
export const lcg = (seed) => { let x = (Math.abs(Math.floor(seed * 7919)) % 233280) || 7; return () => (x = (x * 9301 + 49297) % 233280) / 233280; };
// an irregular plane: a closed smooth curve through n points around (cx, cy), their radii jittered by `rnd`, so no
// two planes share a silhouette and none is an ellipse
const blob = (cx, cy, rx, ry, rnd, n = 7, wob = 0.22) => {
  const pts = Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + rnd() * 0.3, k = 1 + (rnd() - 0.5) * 2 * wob; return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; }), f = (v) => Math.round(v * 10) / 10;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]; d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)}, ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)}, ${f(p2[0])} ${f(p2[1])}`; }
  return d + ' Z';
};
const solid = (o) => o.fill && o.fill !== 'none' && (o.op ?? 1) >= 0.5, region = (ops) => ops.filter((o) => solid(o) && (o.k === 'path' || o.k === 'ellipse')).map((o) => (o.k === 'ellipse' ? ellipsePath(o) : o.d)).join(' '); // the filled shapes as one clip region

// the head is not an egg: from the temple the side runs out to a cheekbone, then in along the jaw to its angle (an
// on-curve corner, rounded off the more `jaw` is), then under to the chin; `skew` (from the seed) drops one cheekbone
// and jaw a little and moves the chin off centre, and `asym` gives the face its own irregularities, coherent rather
// than wobbled: one cheek fuller (its bone out and its jaw curve rounder), one jaw corner sharper, one temple wider,
// the chin toward one side
export function facePath(p) { // exported: a pack that clips to the head (a cyborg's plates, an alien's skull tones) takes the outline itself rather than a copy that drifts
  const cx = 200, top = 112, w = p.face.width, h = p.face.height, hw = w / 2, bottom = top + h, sk = p.face.skew ?? 0, A = p.face.asym ?? {};
  const jawX = hw * p.face.jaw * 0.94, chinDrop = 16 * p.face.chin, chinX = cx + sk * 5 + (A.chin ?? 0) * 6, soft0 = 12 + 26 * p.face.jaw; // how far the jaw corner's handles reach: a round face has no corner
  const fn = p.face.fullness ?? 0, fat = 1 + 0.09 * fn, jfat = 1 + 0.045 * fn; // the weight a face carries sits on the cheek and only half of it reaches the jaw: the temples, which are bone, never move
  const seg = (s) => { // one side descending, temple to chin, as three cubics [c1, c2, end]
    const x = (d) => cx + s * d, cheekY = top + 104 + s * sk * 5, jawY = bottom - (p.face.corner ?? 32) - s * sk * 4;
    const full = 1 + Math.max(0, s * (A.cheek ?? 0)) * 0.08 - Math.max(0, -s * (A.cheek ?? 0)) * 0.025, temple = Math.max(0, s * (A.temple ?? 0)) * 6, soft = soft0 * (1 - Math.max(0, s * (A.jaw ?? 0)) * 0.6 + Math.max(0, -s * (A.jaw ?? 0)) * 0.25);
    return [[[x(hw - 18 + temple), top - 2], [x(hw + 5 + temple), top + 58], [x((hw - 6) * full * fat), cheekY]], [[x((hw - 8) * full * fat), cheekY + 34 + s * (A.cheek ?? 0) * 4], [x(jawX * full * jfat + soft * 0.45), jawY - soft], [x(jawX * full * jfat), jawY]], [[x(jawX * full * jfat - soft * 0.36), jawY + soft * 0.8], [chinX + s * 16, bottom + chinDrop + 1], [chinX, bottom + chinDrop]]];
  };
  const P = ([a, b]) => `${Math.round(a * 10) / 10} ${Math.round(b * 10) / 10}`, L = seg(-1), R = seg(1);
  const down = L.map(([c1, c2, e]) => `C ${P(c1)}, ${P(c2)}, ${P(e)}`).join(' ');
  const up = [`C ${P(R[2][1])}, ${P(R[2][0])}, ${P(R[1][2])}`, `C ${P(R[1][1])}, ${P(R[1][0])}, ${P(R[0][2])}`, `C ${P(R[0][1])}, ${P(R[0][0])}, ${cx} ${top}`].join(' ');
  return `M ${cx} ${top} ${down} ${up} Z`;
}

// the neck starts high behind the head (the head is drawn over it), no wider than the jaw at the top and flaring into the
// shoulders at its base (a column that narrows downward reads as a pipe stuck into a shirt), its shadow under the chin
// fading in steps too fine to see, and its far side rounded off into shadow like the face's
const chinY = (p) => headBox(p).chin - 6; // where the jaw meets the neck on the sheet: measured from the chin as drawn, so the head's build moves the collar and the neck's flare with it (identical to the figure as drawn at a build of 1)
// How thick the neck is: its own type's width, never wider than this jaw, and then the head's build over both. The
// neck does not ride in the head's group, so without this a short people's smaller head stands on a full-size column.
const neckW = (p) => Math.min(p.neck.width, p.face.width * p.face.jaw * 0.8) * bld(p).head;
// the sides of the neck are not two verticals: straight under the jaw, then curving out into the trapezius from a
// hand's width below the chin, so the base is 16 wider each side than the throat and the flare shows above the collar
const neckPath = (p) => { const w = neckW(p), x1 = 200 - w / 2, x2 = 200 + w / 2, bottom = NECK_BOTTOM, c = chinY(p); return `M ${x1} ${NECK_TOP} L ${x1} ${c} C ${x1} ${c + 30}, ${x1 - 4} ${c + 34}, ${x1 - 16} ${bottom} Q 200 ${bottom + 22} ${x2 + 16} ${bottom} C ${x2 + 4} ${c + 34}, ${x2} ${c + 30}, ${x2} ${c} L ${x2} ${NECK_TOP} Z`; };
function neck(p) {
  const w = neckW(p), x1 = 200 - w / 2, x2 = 200 + w / 2, sd = p.light.side || -1, c = p.light.contrast ?? 1;
  const chin = chinY(p);
  return [
    path(neckPath(p), { fill: p.skin }), clip(neckPath(p)),
    ...[36, 30, 24, 18, 12, 6].map((d) => path(`M ${x1 - 12} ${chin} L ${x2 + 12} ${chin} L ${x2 + 12} ${chin + d} C ${x2 - 10} ${chin + d + 14}, ${x1 + 10} ${chin + d + 14}, ${x1 - 12} ${chin + d} Z`, { fill: TONE, op: 0.045 * c })), // the chin's shadow, fading down the neck
    ...soft(200 - sd * w * 0.44, chin + 46, w * 0.3, 64, TONE, 0.18 * c), // the far side of the column, in shadow
    ...soft(200 + sd * w * 0.08, chin + 34, w * 0.14, 34, '#fff', 0.07), // the throat's front catches the light: with the far side dark, the column is round
    ...[-1, 1].map((s) => path(`M ${200 + s * (w / 2 - 4)} ${chin + 6} Q ${200 + s * w * 0.3} ${chin + 36} ${200 + s * w * 0.14} ${chin + 62}`, stroke(TONE, 3, 0.08 * c))), // the two muscles from behind the jaw to the pit of the neck: what makes it a neck and not a tube
    ...[-1, 1].map((s) => path(`M ${200 + s * (w / 2 + 2)} ${chin + 22} Q ${200 + s * (w / 2 + 12)} ${chin + 44} ${200 + s * (w / 2 + 22)} ${chin + 70}`, stroke('#fff', 3, 0.07))), // the flare's lit edge, where the neck widens into the shoulder
    UNCLIP,
  ];
}

export const EAR_POINT = 32; // how far a fully pointed ear's tip rises above the round shell's top, before ears.size
export const EAR_TURN = 14, EAR_TURN_POINT = 12, EAR_TURN_OUT = 3; // how far a fully turned head takes the far ear behind it, how much further a fully pointed one must go, and how far the near one stands out
/** The ear's shell. `t` (ears.pointed) draws the same ear as one blade instead: the lobe and the bowl where they were,
 *  the helix carrying on past the top into a point that leans out and back. One shape from lobe to tip, never a tip
 *  laid over a round ear, which reads as a shard taped to the temple; the head is drawn after the ears, so the blade's
 *  front edge may run inside the outline and the face covers it, and the point stands free above the temple. */
const earShell = (cx, sd, t, fill) => {
  if (!t) return ellipse(cx, 212, 15, 27, { fill });
  const X = (d) => cx - d * sd; // d away from the face
  return path(`M ${X(-15)} 212 C ${X(-15)} 227, ${X(-8)} 239, ${X(0)} 239 C ${X(8)} 239, ${X(15)} 227, ${X(15)} 212`
    + ` C ${X(15 + t)} ${196 - 4 * t}, ${X(8 + 5 * t)} ${185 - 23 * t}, ${X(9 * t)} ${185 - EAR_POINT * t}` // up the helix, bowing out and then drawing in to the tip
    + ` C ${X(-8 + 10 * t)} ${185 - 17 * t}, ${X(-15)} ${196 - 4 * t}, ${X(-15)} 212 Z`, { fill, ear: true }); // and down the front edge, into the head: both edges converge, so the point is a point and not a corner
};
// the ears: both, always; a turned head slides the far one behind the outline until only a sliver shows
function ears(p, turn = 0) {
  const s = stroke(underSkin(p.skin, '#7f5140', 0.5), 2.2, 0.48), k = p.ears.size, t = Math.max(0, Math.min(1, p.ears.pointed ?? 0));
  // the ear is one thing: the shell, its bowl in shadow, the lobe's light and the rim of the helix are drawn at size
  // 1 and scaled about the ear's own centre, so a small ear is a small ear and not a shell with a full-size rim beside it
  const mode = p.ears.mode ?? 'human'; if (mode === 'none') return [];
  const one = (cx, sd, rim) => mode !== 'human' ? mapXY(machineEar(cx, sd, mode, p), scaleAbout(cx, k), scaleAbout(212, k)) : mapXY([earShell(cx, sd, t, p.skin), ...soft(cx + 2 * sd, 215, 6, 11, TONE, 0.3), ellipse(cx - 4 * sd, 226, 5, 4, { fill: '#fff', op: 0.08 }),
    ...(t ? [path(`M ${cx - 9 * sd} 207 C ${cx - 12 * sd} ${194 - 10 * t}, ${cx - 12 * sd} ${182 - 14 * t}, ${cx - (9 + t) * sd} ${182 - 20 * t}`, { ...s, sw: 1.7, op: 0.3 })] : []), // the fold carried up into the point, so the blade is a cupped surface and not a flat shard
    path(`M ${cx - (3 + 5 * t) * sd} ${187 - 32 * t} C ${cx - 14 * sd} ${190 - 10 * t}, ${cx - 17 * sd} 206, ${cx - 12 * sd} 222`, stroke('#fff', 2, 0.14)), path(rim, s)], scaleAbout(cx, k), scaleAbout(212, k));
  // The turn, about the ear's own attachment to the head: the ear on the side the nose goes to swings behind the head
  // (it is drawn under it) and foreshortens on the way, the other comes forward, stands a little clear of the outline
  // and reads a touch fuller. A pointed ear tucks further than a round one: its tip is up where the head is narrow, so
  // the slide that hides a round ear leaves a crescent of blade past the temple, which reads as a mark, not an ear.
  const swing = (ops, cx) => {
    if (!turn) return ops;
    const o = cx < 200 ? -1 : 1, a = turn * turn, far = o === Math.sign(turn), piv = cx - 15 * o; // a: how far round, as the projection goes (cos falls away as the square), so a half turn still shows the far ear and a hard one has tucked it away
    const squash = far ? 1 - 0.55 * a : 1 + 0.2 * a, dx = far ? -o * (EAR_TURN + EAR_TURN_POINT * t) * a : o * EAR_TURN_OUT * a;
    return mapX(ops, (x) => piv + (x - piv) * squash + dx);
  };
  const left = one(122, 1, 'M 119 199 C 109 205, 111 224, 121 227 C 129 222, 127 211, 120 211'), right = one(278, -1, 'M 281 199 C 291 205, 289 224, 279 227 C 271 222, 273 211, 280 211');
  return mapXY([...swing(left, 122), ...swing(right, 278)], (x) => x, (y) => y + p.eyes.y - 196); // drawn for the eye line at 196, they ride with this face's
}

// the head: the face and its planes, then a faint blush on the cheeks when `blush` is up; the soft light comes over the features (faceLight)
// Tone, not line, is what keeps a face from reading as a cartoon, and one kind of tone everywhere is what makes it
// airbrushed: the sockets and the shadow under the nose are tight and soft, the cheek and the forehead are large
// irregular planes with a hard edge at low opacity, and the temples get nothing.
const TONE = '#4a2418';
export const soft = (cx, cy, rx, ry, fill, op) => [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.5, 0.4].map((k) => ellipse(cx, cy, rx * k, ry * k, { fill, op: op / 8 })); // a plane with no edge: eight fading ellipses stand in for a gradient
const planes = (p) => { const y = p.eyes.y, sp = p.eyes.spacing / 2, h = p.face.height, w = p.face.width / 2, sd = p.light.side || -1, rnd = lcg(p.seed + 3), depth = p.eyes.depth ?? 0.5, c = p.light.contrast ?? 1, k = featureScale(p), ky = h / 204; return [
  ...soft(200 - sp, y - 3, 21 * k, 12 * k, TONE, (0.05 + 0.1 * depth) * c), ...soft(200 + sp, y - 3, 21 * k, 12 * k, TONE, (0.05 + 0.1 * depth) * c), // the sockets: tight, deeper for deep-set eyes, as big as the eyes
  path(blob(200 - sd * w * 0.6, y + 66 * ky, w * 0.3, h * 0.24, rnd, 9, 0.3), { fill: TONE, op: 0.035 * c }), path(blob(200 - sd * w * 0.62, y + 70 * ky, w * 0.22, h * 0.18, rnd, 9, 0.3), { fill: TONE, op: 0.035 * c }), // the shadow cheek: one large irregular plane under the bone (as far under the eye as this face is tall), down to the jaw, in two steps so its edge is not a cut
  ...soft(200 + sd * w * 0.52, y + 30 * ky, w * 0.2, 14 * ky, '#fff', 0.05), // the lit cheekbone: the one high plane that ties the eye to the jaw below it
  path(blob(200 + sd * 8, 112 + h * 0.2, w * 0.66, h * 0.11, rnd, 9, 0.3), { fill: '#fff', op: 0.035 }), // the forehead's front plane
  ellipse(200, 112 + h * 0.95 + 16 * p.face.chin, w * 0.5, 7, { fill: TONE, op: 0.08 * c }), // under the chin
]; };
const head = (p) => [path(facePath(p), { fill: p.skin }),
  ...(p.blush > 0.02 ? [ellipse(200 - p.eyes.spacing / 2 - 6, p.eyes.y + 32, 16, 8, { fill: '#c9564c', op: 0.15 * p.blush }), ellipse(200 + p.eyes.spacing / 2 + 6, p.eyes.y + 32, 16, 8, { fill: '#c9564c', op: 0.15 * p.blush })] : [])];
const modelling = (p) => [clip(facePath(p)), ...planes(p), UNCLIP]; // the planes stay inside the face: a cheek plane past the jaw is a shadow beside the head; drawn over any paint on the skin, so a painted face is modelled in the same language as a bare one

// the light: one soft frontal wash on the face (a pale plane over the forehead, nose and chin, a little dark under the jaw), as strong as `amount` says; `side` says which cheek the planes' and shadows' light falls on
function faceLight(p, d) {
  const a = p.light.amount; if (a <= 0.02) return [];
  const h = p.face.height, w = p.face.width / 2, bot = 112 + h + 16 * p.face.chin;
  return [clip(d), path(blob(200, 112 + h * 0.55, w * 0.7, h * 0.4, lcg(p.seed + 5), 8, 0.12), { fill: '#fff', op: 0.035 * a }), rect(0, bot - 26, 400, 60, { fill: TONE, op: 0.045 * a * (p.light.contrast ?? 1) }), UNCLIP];
}

// eyes: the right eye's shape (its outer corner at +x), mirrored for the left; `top`/`bot` are the lid heights at
// openness 1, `inn`/`out` the corners' drop, `lid` the upper lid's weight, `sclera` how much white shows around the
// iris, `corner` the inner corner drawn out to a point, a crease the fold above a hooded or monolid eye
export const EYES = {
  almond: { w: 14, top: 9, bot: 6, iris: 5.8, lid: 0.55, sclera: 0.45, corner: 0.6 },
  round: { w: 13, top: 11, bot: 10, iris: 6.2, lid: 0.4, sclera: 0.8, corner: 0.3 },
  narrow: { w: 15, top: 5, bot: 4, iris: 5.2, lid: 0.7, sclera: 0.15, corner: 0.5 },
  hooded: { w: 14, top: 6, bot: 5, iris: 5.6, lid: 0.8, sclera: 0.25, corner: 0.4, crease: { dy: -7, ctl: -12, sw: 1.3, op: 0.32, color: '#684b3d' } },
  monolid: { w: 14, top: 4, bot: 5, iris: 5.3, lid: 0.9, sclera: 0.2, corner: 0.2, crease: { dy: -5, ctl: -8, sw: 1.5, op: 0.35, color: '#5f4238' } },
  upturned: { w: 14.5, top: 8, bot: 6, inn: 1, out: -3, iris: 5.6, lid: 0.5, sclera: 0.5, corner: 0.8 },
  downturned: { w: 14, top: 8, bot: 7, inn: -2, out: 2, iris: 5.6, lid: 0.45, sclera: 0.55, corner: 0.5 },
};
export const EYE_STYLES = Object.keys(EYES);
// A stroke that changes weight along a quadratic, as one filled outline: two constant-width strokes butted end to end
// show the joint as a step and leave the thin one sticking out past the fat one like a whisker, which is what a brow
// and an upper lid are made of. `wf(t)` is the width at t along the curve.
const N = 16; // steps per side of the outline
function taper(a, c, b, wf, color, op) {
  const at = (t, f) => [f(a[0], c[0], b[0], t), f(a[1], c[1], b[1], t)];
  const q = (t) => at(t, (p0, p1, p2) => (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2), d = (t) => at(t, (p0, p1, p2) => 2 * (1 - t) * (p1 - p0) + 2 * t * (p2 - p1));
  const side = (s) => Array.from({ length: N + 1 }, (_, i) => { const t = i / N, [x, y] = q(t), [dx, dy] = d(t), L = Math.hypot(dx, dy) || 1, h = (s * wf(t)) / 2; return [x - (dy / L) * h, y + (dx / L) * h]; });
  const cap = (t, s) => { const [x, y] = q(t), [dx, dy] = d(t), L = Math.hypot(dx, dy) || 1, r = wf(t) / 2; return [0.25, 0.5, 0.75].map((k) => { const c = (Math.cos(k * Math.PI) * s * r) / L, g = (Math.sin(k * Math.PI) * s * r) / L; return [x - c * dy + g * dx, y + c * dx + g * dy]; }); }; // the round end walked as part of the one outline: a separate circle at the same opacity would show as a darker blob
  const pts = [...side(1), ...cap(1, 1), ...side(-1).reverse(), ...cap(0, -1)], f = (v) => Math.round(v * 10) / 10;
  return path(`M ${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} Z`, { fill: color, op });
}
// An eye is tone before it is line: the socket under the brow (deeper for deep-set eyes), a white that takes the
// skin's tone, the iris up under the upper lid (which cuts its top and drops its shadow across it), the upper lid a
// stroke that is thin at the inner end and heavy at the outer third, the lower lid a rim of light with a faint dark
// at its outer end, a tear duct at the inner corner, a bag under the eye when the character has one.
export const featureScale = (p) => Math.min(1.12, Math.max(0.92, 0.5 + 0.5 * ((p.face?.width ?? 156) / 156))); // the eyes and brows grow a little with the head: one fixed eye on a broad face is a bead, on a narrow one a saucer, and either reads as a part placed on a head

// Machine faces. A robot is not a mask over a face: each feature has a `mode`, and a mode other than 'human' draws that
// feature as a made thing, driven by the same dials a face is, so a robot still opens, squints, frowns and smiles.
// What carries the feeling is the lids: every machine eye has a shutter above and below its light (mLids), the upper
// one tilted by the brows (browInner down: the inner end drops, anger; up: the outer end droops, grief), lowered as
// the eye shuts and lifted clear in surprise, the lower one rising in an arch with a smile's squint, the happy eye.
//   eyes.mode   'lens' a camera lens in a bezel, its aperture the light, two shutter plates for lids; 'led' a lit
//               bar sunk in a housing, cut by the lids; 'visor' one band across both, the lids a V or a roof across
//               it, its two bright spots the look. eyes.iris is the light's colour.
//   mouth.mode  'grille' slats in a framed housing that opens with the jaw; 'slot' a lit line along the parting;
//               'speaker' a plate of holes that light up as it talks; 'matrix' a panel of pixels, the lit ones
//               drawing the lips' line (and the opening's outline when it opens). Each bends with the smile
//               through lipMove, harder than a lip does, so it reads at a thumbnail. mouth.color is the light.
//   ears.mode   'none', 'disc' a receiver plate, 'antenna' the plate with a stalk, 'bolt' a hex nut on a boss (a jaw
//               hinge), 'fin' a stack of cooling fins; they turn with the head as ears do.
//   nose.mode   'none', 'vent' (slats in a sunk grille where the nostrils would be), 'ridge' a raised nasal plate.
// The metal is the skin: a robot's skin colour is its plating. Everything made is modelled as a made thing: a plate
// stands proud (a dropped shadow, a lit top edge, a dark bottom one), a well is sunk (the reverse).
export const EYE_MODES = ['human', 'lens', 'led', 'visor'], MOUTH_MODES = ['human', 'grille', 'slot', 'speaker', 'matrix'], EAR_MODES = ['human', 'none', 'disc', 'antenna', 'bolt', 'fin'], NOSE_MODES = ['human', 'none', 'vent', 'ridge', 'slits'];
const R1 = (v) => Math.round(v * 10) / 10;
const lightOf = (c) => c ?? '#6fe0ff';
const mCl = (v, a, b) => Math.max(a, Math.min(b, v));
/** A lit shape's glow: the light spread soft around it. */
const halo = (cx, cy, rx, ry, c, op = 0.35) => (op > 0.01 ? soft(cx, cy, rx, ry, c, op) : []);
/** An ellipse as a path (four cubics), for what has to be clipped to or bevelled. */
const mOval = (cx, cy, rx, ry) => { const a = 0.5523 * rx, b = 0.5523 * ry, f = R1; return `M ${f(cx - rx)} ${f(cy)} C ${f(cx - rx)} ${f(cy - b)}, ${f(cx - a)} ${f(cy - ry)}, ${f(cx)} ${f(cy - ry)} C ${f(cx + a)} ${f(cy - ry)}, ${f(cx + rx)} ${f(cy - b)}, ${f(cx + rx)} ${f(cy)} C ${f(cx + rx)} ${f(cy + b)}, ${f(cx + a)} ${f(cy + ry)}, ${f(cx)} ${f(cy + ry)} C ${f(cx - a)} ${f(cy + ry)}, ${f(cx - rx)} ${f(cy + b)}, ${f(cx - rx)} ${f(cy)} Z`; };
/** A rounded box, half sizes w and h, corners of radius r. */
const mBox = (cx, cy, w, h, r = Math.min(w, h)) => { const f = R1, x1 = cx - w, x2 = cx + w, y1 = cy - h, y2 = cy + h; r = Math.min(r, w, h); return `M ${f(x1 + r)} ${f(y1)} L ${f(x2 - r)} ${f(y1)} Q ${f(x2)} ${f(y1)} ${f(x2)} ${f(y1 + r)} L ${f(x2)} ${f(y2 - r)} Q ${f(x2)} ${f(y2)} ${f(x2 - r)} ${f(y2)} L ${f(x1 + r)} ${f(y2)} Q ${f(x1)} ${f(y2)} ${f(x1)} ${f(y2 - r)} L ${f(x1)} ${f(y1 + r)} Q ${f(x1)} ${f(y1)} ${f(x1 + r)} ${f(y1)} Z`; };
const mDown = (ops, dy) => mapXY(ops, (x) => x, (y) => y + dy);
/** A plate standing proud of the plating: the shadow it drops, its fill, a lit top edge and a dark bottom one, its rim. */
const mPlate = (d, fill, sh = 1) => [...mDown([path(d, { fill: '#000000', op: 0.28 })], 2.2 * sh), path(d, { fill }), clip(d), ...mDown([path(d, stroke(shade(fill, 1.75), 2.2, 0.65))], 1.5 * sh), ...mDown([path(d, stroke(shade(fill, 0.42), 2.2, 0.6))], -1.5 * sh), UNCLIP, path(d, stroke(shade(fill, 0.38), 0.9, 0.8))];
/** A well sunk into it: the rim's shadow inside its top edge, light caught on its bottom one. */
const mWell = (d, fill) => [path(d, { fill }), clip(d), ...mDown([path(d, stroke('#000000', 3.4, 0.55))], 1.8), ...mDown([path(d, stroke('#ffffff', 1.4, 0.2))], -1.3), UNCLIP];
/** Where a machine eye's lids stand, as offsets from its centre for an eye `r` tall each way: the upper lid's inner and
 *  outer ends, the lower lid's ends and how far it arches up in the middle. The tilt eases off as the eye goes wide,
 *  so surprise is a round eye and not a worried one; the lids never cross. */
const mLids = (e, side, r) => {
  const o = mCl(e.openness * (side < 0 ? e.asym ?? 1 : 1), 0, 1.5), bi = e.browInner ?? 0, sq = unit(e.squint ?? 0), tilt = 1 - mCl((o - 1) * 1.4, 0, 0.6);
  const top = r * (1 - 1.9 * Math.min(o, 1)) - r * 0.9 * Math.max(0, o - 1) - (e.browLift ?? 0) * 0.12 + (e.browSkew ?? 0) * 4 * side - 0.5 * r * sq; // a smile lifts the upper lid as the lower one rises: the happy eye is an arch of light, not a slit
  const low = r * (1.05 - 1.0 * sq), yi = Math.min(low, top + tilt * (bi < 0 ? -bi * 0.3 : -bi * 0.14) * r), yo = Math.min(low, top + tilt * (bi > 0 ? bi * 0.2 : bi * 0.08) * r);
  const arch = Math.min(r * 0.9 * sq, Math.max(0, low - Math.max(yi, yo)) * 0.85);
  return { yi, yo, low, arch, shown: mCl((low - arch / 2 - (yi + yo) / 2) / (2 * r), 0, 1) };
};
/** The lids as two filled shapes about an eye at (cx, y) spanning `half` each way: what covers the light from above and below. */
const mShutters = (cx, y, half, side, L, reach) => { const xi = R1(cx - half * side), xo = R1(cx + half * side);
  return { upper: `M ${xi} ${R1(y + L.yi)} Q ${R1(cx)} ${R1(y + (L.yi + L.yo) / 2 + 1.5)} ${xo} ${R1(y + L.yo)} L ${xo} ${R1(y - reach)} L ${xi} ${R1(y - reach)} Z`, lower: `M ${xi} ${R1(y + L.low)} Q ${R1(cx)} ${R1(y + L.low - 2 * L.arch)} ${xo} ${R1(y + L.low)} L ${xo} ${R1(y + reach)} L ${xi} ${R1(y + reach)} Z`,
    upEdge: `M ${xi} ${R1(y + L.yi)} Q ${R1(cx)} ${R1(y + (L.yi + L.yo) / 2 + 1.5)} ${xo} ${R1(y + L.yo)}`, lowEdge: `M ${xi} ${R1(y + L.low)} Q ${R1(cx)} ${R1(y + L.low - 2 * L.arch)} ${xo} ${R1(y + L.low)}` }; };
function machineEye(cx, p, side) {
  const e = p.eyes, k = featureScale(p) * (e.size ?? 1), y = e.y + (side < 0 ? e.dy ?? 0 : 0), c = lightOf(e.iris), metal = p.skin;
  const lx = cx + e.look.x * 3.5 * k, ly = y + e.look.y * 2.5 * k;
  if (e.mode === 'lens') { const r = 11.5 * k, R = r + 4.5 * k, L = mLids(e, side, r), ap = r * 0.5 * (0.85 + 0.25 * mCl(e.openness, 0, 1.5)), glass = mOval(cx, y, r, r), S = mShutters(cx, y, r + 1, side, L, r + 2), lid = shade(metal, 0.85);
    return [
      ...soft(cx, y - 2, R + 6, R + 3, '#000000', 0.14 * (0.5 + (e.depth ?? 0.5))), // the socket the lens sits in
      ...mPlate(mOval(cx, y, R, R), shade(metal, 0.7)), ...halo(cx, y, R * 1.5, R * 1.5, c, 0.22 * L.shown), // the bezel, the light spilling onto it
      ...mWell(glass, '#0b0e12'), clip(glass),
      ...halo(lx, ly, ap * 2.3, ap * 2.3, c, 0.5), ellipse(lx, ly, ap, ap, { fill: c }), ellipse(lx, ly, ap * 1.35, ap * 1.35, stroke(c, 0.9, 0.55)), ellipse(lx, ly, ap * 0.45, ap * 0.45, { fill: mix(c, '#ffffff', 0.7) }), // the aperture's light, its ring, its hot centre
      ellipse(cx - r * 0.4, y - r * 0.45, r * 0.24, r * 0.15, { fill: '#ffffff', op: 0.6 }), // the glass's glint
      ...mDown([path(S.upper, { fill: '#000000', op: 0.45 })], 2.4 * k), path(S.upper, { fill: lid }), path(S.lower, { fill: lid }), // the shutters, the upper dropping its shadow on the light
      path(S.upEdge, stroke(shade(metal, 0.4), 1.6, 0.9)), ...mDown([path(S.upEdge, stroke(shade(metal, 1.7), 1.1, 0.55))], -1.6), path(S.lowEdge, stroke(shade(metal, 0.45), 1.3, 0.8)), ...mDown([path(S.lowEdge, stroke(shade(metal, 1.7), 1, 0.45))], 1.4),
      UNCLIP];
  }
  // led: a lit bar sunk in a housing, cut by the lids
  const w = 15 * k, H = 6.5 * k * (1 + 0.35 * Math.max(0, mCl(e.openness, 0, 1.5) - 1)), L = mLids(e, side, H), S = mShutters(cx, y, w + 3, side, L, H + 4);
  const bar = mBox(cx, y, w, H, H * 0.75);
  const lit = `M ${R1(cx - (w + 3) * side)} ${R1(y + L.yi)} Q ${R1(cx)} ${R1(y + (L.yi + L.yo) / 2 + 1.5)} ${R1(cx + (w + 3) * side)} ${R1(y + L.yo)} L ${R1(cx + (w + 3) * side)} ${R1(y + L.low)} Q ${R1(cx)} ${R1(y + L.low - 2 * L.arch)} ${R1(cx - (w + 3) * side)} ${R1(y + L.low)} Z`;
  const core = mCl(lx, cx - w * 0.6, cx + w * 0.6);
  return [...mPlate(mBox(cx, y, w + 4.5 * k, H + 4.5 * k, H + 2), shade(metal, 0.72), 0.8), ...mWell(mBox(cx, y, w + 2 * k, H + 2 * k, H + 1), '#0b0e12'), ...halo(cx, y, w * 1.35, H + 9, c, 0.38 * L.shown),
    clip(lit), path(bar, { fill: c }), ellipse(core, y + e.look.y * 2 * k, w * 0.5, H * 0.6, { fill: mix(c, '#ffffff', 0.45), op: 0.85 }), ellipse(core - w * 0.2, y - H * 0.35, w * 0.18, H * 0.2, { fill: '#ffffff', op: 0.7 }), UNCLIP,
    clip(mBox(cx, y, w + 2 * k, H + 2 * k, H + 1)), path(S.upEdge, stroke(shade(metal, 0.5), 1.4, 0.8)), UNCLIP];
}
function machineVisor(p) {
  const e = p.eyes, k = featureScale(p) * (e.size ?? 1), c = lightOf(e.iris), sp = e.spacing / 2, half = sp + 20 * k, y = e.y, H = 7.5 * k * (1 + 0.3 * Math.max(0, mCl(e.openness, 0, 1.5) - 1));
  const Ll = mLids(e, -1, H), Lr = mLids(e, 1, H), xl = R1(200 - half - 2), xr = R1(200 + half + 2);
  const lit = `M ${xl} ${R1(y + Ll.yo)} L 200 ${R1(y + (Ll.yi + Lr.yi) / 2)} L ${xr} ${R1(y + Lr.yo)} L ${xr} ${R1(y + Lr.low)} Q ${R1(200 + sp)} ${R1(y + Lr.low - 2 * Lr.arch)} 200 ${R1(y + (Ll.low + Lr.low) / 2)} Q ${R1(200 - sp)} ${R1(y + Ll.low - 2 * Ll.arch)} ${xl} ${R1(y + Ll.low)} Z`;
  const band = mBox(200, y, half, H, H * 0.8), shown = (Ll.shown + Lr.shown) / 2;
  return [...mPlate(mBox(200, y, half + 5 * k, H + 5 * k, H + 4), shade(p.skin, 0.55), 0.8), ...mWell(mBox(200, y, half + 1.5, H + 1.5, H + 1), '#0b0e12'), ...halo(200, y, half * 1.1, H + 10, c, 0.34 * shown),
    clip(lit), path(band, { fill: c, op: 0.95 }), ...Array.from({ length: Math.ceil((2 * H) / 2.6) }, (_, i) => line(200 - half, R1(y - H + 1.3 + i * 2.6), 200 + half, R1(y - H + 1.3 + i * 2.6), stroke('#000000', 0.8, 0.18))), // scan lines
    ...[-1, 1].map((sd) => ellipse(R1(200 + sd * sp + e.look.x * 4 * k), R1(y + e.look.y * 2), 8 * k, H * 0.6, { fill: mix(c, '#ffffff', 0.5), op: 0.9 })), ...[-1, 1].map((sd) => ellipse(R1(200 + sd * sp + e.look.x * 4 * k), R1(y + e.look.y * 2), 3 * k, H * 0.3, { fill: '#ffffff', op: 0.9 })), UNCLIP,
    clip(band), path(`M ${R1(200 - half * 0.7)} ${R1(y + H)} L ${R1(200 - half * 0.45)} ${R1(y - H)} L ${R1(200 - half * 0.32)} ${R1(y - H)} L ${R1(200 - half * 0.57)} ${R1(y + H)} Z`, { fill: '#ffffff', op: 0.12 }), UNCLIP]; // a streak of light across the glass
}
function machineMouth(p) {
  const m = p.mouth, w = m.width * (MOUTHS[m.style]?.wide ?? 1) * 1.3, x1 = 200 - w / 2, x2 = 200 + w / 2, open = m.open ?? 0, kw = m.skew ?? 0, pr = unit(m.press ?? 0), s = m.smile ?? 0;
  const lift = 15 * s, yl = m.y - lift + 2 * kw, yr = m.y - lift - 9 * kw, mid = m.y + 15 * s - 10 * open, c = lightOf(m.color), metal = p.skin; // a lip's move, pushed: a machine has no lip to read, so the line itself carries the smile
  const yAt = (t) => (1 - t) ** 2 * yl + 2 * t * (1 - t) * mid + t * t * yr; // the parting
  const shape = (dw, h) => { const a = x1 - dw, b = x2 + dw; return `M ${R1(a)} ${R1(yl - h / 2)} Q 200 ${R1(mid - h / 2 - 2 * open)} ${R1(b)} ${R1(yr - h / 2)} L ${R1(b)} ${R1(yr + h / 2)} Q 200 ${R1(mid + h / 2)} ${R1(a)} ${R1(yl + h / 2)} Z`; };
  if (m.mode === 'slot') { const t = (3.4 + 15 * open) * (1 - 0.3 * pr), d = `M ${R1(x1)} ${R1(yl)} Q 200 ${R1(mid)} ${R1(x2)} ${R1(yr)}`;
    return [...mDown([path(d, stroke(shade(metal, 1.6), t + 8, 0.35))], 1.6), path(d, stroke(shade(metal, 0.4), t + 8, 1)), path(d, stroke('#0b0e12', t + 3, 1)), ...halo(200, yAt(0.5), w * 0.6, t + 8, c, 0.36), path(d, stroke(c, t, 0.95)), path(d, stroke(mix(c, '#ffffff', 0.7), Math.max(0.8, t * 0.3), 0.8))]; }
  const h = (10 + 30 * open) * (1 - 0.35 * pr), box = shape(0, h), frame = shape(4.5, h + 9);
  if (m.mode === 'speaker') { const rows = 2 + Math.round(3 * open), cols = Math.max(7, Math.round(w / 6)), hole = mix('#0b0e12', c, 0.25 + 0.75 * Math.min(1, open * 2.5)), out = [...mPlate(frame, shade(metal, 0.72)), ...mWell(box, shade(metal, 0.5)), clip(box)];
    if (open > 0.05) out.push(...halo(200, yAt(0.5), w * 0.5, h * 0.6, c, 0.45 * Math.min(1, open * 2)));
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) { const t = (i + 0.5) / cols, x = x1 + w * t, yy = yAt(t) - h / 2 + (r + 0.5) * (h / rows); out.push(ellipse(R1(x), R1(yy), 2, 2, { fill: hole }), ellipse(R1(x), R1(yy + 1), 1.6, 1, { fill: '#ffffff', op: 0.12 })); }
    return [...out, UNCLIP]; }
  if (m.mode === 'matrix') { const cols = 11, pitch = w / cols, rows = 6, top = m.y - (rows / 2) * pitch, half = h / 2 * Math.min(1, open * 3), panel = mBox(200, m.y, w / 2 + 3, (rows / 2) * pitch + 3, 4), out = [...mPlate(mBox(200, m.y, w / 2 + 7, (rows / 2) * pitch + 7, 7), shade(metal, 0.72)), ...mWell(panel, '#0b0e12'), ...halo(200, yAt(0.5), w * 0.55, h * 0.5 + 6, c, 0.3), clip(panel)];
    for (let i = 0; i < cols; i++) { const t = (i + 0.5) / cols, x = x1 + w * t, yc = yAt(t), up = yc - half - (open > 0.08 ? 2 * open * 4 * t * (1 - t) : 0), dn = yc + half;
      for (let r = 0; r < rows; r++) { const yy = top + (r + 0.5) * pitch, on = Math.abs(yy - up) < pitch * 0.8 || Math.abs(yy - dn) < pitch * 0.8 || (open > 0.08 && (i === 0 || i === cols - 1) && yy > up && yy < dn);
        out.push(rect(R1(x - pitch * 0.4), R1(yy - pitch * 0.4), R1(pitch * 0.8), R1(pitch * 0.8), on ? { fill: c, rx: 1.2 } : { fill: mix('#0b0e12', c, 0.14), rx: 1.2 })); if (on) out.push(rect(R1(x - pitch * 0.4), R1(yy - pitch * 0.4), R1(pitch * 0.8), R1(pitch * 0.3), { fill: '#ffffff', op: 0.35, rx: 1 })); } }
    return [...out, UNCLIP]; }
  // grille: slats across a sunk housing in a raised frame, light from inside when it opens
  const n = Math.max(7, Math.round(w / 7)), slat = shade(metal, 0.62);
  return [...mPlate(frame, shade(metal, 0.72)), ...mWell(box, '#0e1115'), clip(box), ...halo(200, yAt(0.5), w * 0.45, h * 0.5, c, 0.5 * Math.min(1, open * 2)),
    ...Array.from({ length: n }, (_, i) => { const x = R1(x1 + (i + 0.5) * (w / n)); return [line(x, m.y - 60, x, m.y + 60, stroke(slat, 3, 1)), line(x - 1, m.y - 60, x - 1, m.y + 60, stroke(shade(slat, 1.6), 0.8, 0.6))]; }).flat(), UNCLIP];
}
function machineEar(cx, sd, mode, p) {
  const metal = p.skin, X = (d) => cx - d * sd; // d away from the face
  const disc = [...mPlate(mOval(X(2), 212, 13, 15), shade(metal, 0.8)), ...mWell(mOval(X(2), 212, 8, 9.5), shade(metal, 0.45)), ellipse(X(2), 212, 3, 3, { fill: shade(metal, 0.3) })];
  if (mode === 'disc') return disc;
  if (mode === 'bolt') { const hex = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; return [X(2) + 9 * Math.cos(a), 212 + 9 * Math.sin(a)]; }), d = `M ${hex.map(([x, y]) => `${R1(x)} ${R1(y)}`).join(' L ')} Z`;
    return [...mPlate(mOval(X(1), 212, 14, 17), shade(metal, 0.75)), ...mPlate(d, shade(metal, 1.05), 1.2), ...hex.map(([x, y]) => line(R1(X(2) + (x - X(2)) * 0.45), R1(212 + (y - 212) * 0.45), R1(x), R1(y), stroke(shade(metal, 0.6), 0.8, 0.5))), ...mWell(mOval(X(2), 212, 3.6, 3.6), shade(metal, 0.3))]; }
  if (mode === 'fin') { const fins = [-2, -1, 0, 1, 2].flatMap((i) => mPlate(mBox(X(5), 212 + i * 7, 9, 2.2, 1.5), shade(metal, 0.95 - 0.04 * Math.abs(i)), 0.6));
    return [...mPlate(mBox(X(-1), 212, 9, 22, 7), shade(metal, 0.7)), ...fins]; }
  const c = lightOf(p.eyes.iris);
  return [path(`M ${X(-4)} 198 L ${X(-10)} 152`, stroke(shade(metal, 0.4), 3)), path(`M ${X(-4.8)} 198 L ${X(-10.8)} 152`, stroke(shade(metal, 1.6), 1, 0.5)), ...disc, ...halo(X(-10), 150, 8, 8, c, 0.45), ellipse(X(-10), 150, 3.6, 3.6, { fill: c }), ellipse(X(-9), 149, 1.2, 1.2, { fill: '#ffffff', op: 0.8 })];
}
const slitNose = (p) => { const y = p.eyes.y + 10 + (p.nose.length ?? 30) * 0.9, w = Math.max(3, (p.nose.width ?? 12) * 0.32), dark = shade(p.skin, 0.35), lit = shade(p.skin, 1.25); // a grey's nose: no bridge and no tip, two slits where the nostrils would be, each with the light catching its upper rim
  return [-1, 1].flatMap((s) => [path(`M ${R1(200 + s * w * 0.4)} ${R1(y - 3)} Q ${R1(200 + s * w * 1.1)} ${R1(y)} ${R1(200 + s * w * 0.7)} ${R1(y + 4)}`, stroke(dark, 1.8, 0.75)), path(`M ${R1(200 + s * w * 0.3)} ${R1(y - 4.2)} Q ${R1(200 + s * w)} ${R1(y - 1.4)} ${R1(200 + s * w * 0.9)} ${R1(y + 1)}`, stroke(lit, 0.9, 0.4))]); };
const machineNose = (p) => { if (p.nose.mode === 'slits') return slitNose(p); if (p.nose.mode === 'none') return []; const y = p.eyes.y + 10 + (p.nose.length ?? 38) * 0.85, w = (p.nose.width ?? 20) * 0.5, metal = p.skin;
  if (p.nose.mode === 'ridge') { const y0 = p.eyes.y + 4, d = `M ${R1(200 - 4)} ${R1(y0)} L ${R1(200 + 4)} ${R1(y0)} L ${R1(200 + w * 0.8)} ${R1(y)} Q 200 ${R1(y + 5)} ${R1(200 - w * 0.8)} ${R1(y)} Z`;
    return [...mPlate(d, shade(metal, 1.08), 1.3), path(`M ${R1(200 + 1.5)} ${R1(y0 + 2)} L ${R1(200 + w * 0.45)} ${R1(y - 2)}`, stroke(shade(metal, 1.8), 1.2, 0.5))]; }
  const box = mBox(200, y + 3, w, 6, 3);
  return [...mWell(box, shade(metal, 0.32)), clip(box), ...[0, 1, 2].map((i) => line(R1(200 - w), R1(y - 1 + i * 4), R1(200 + w), R1(y - 1 + i * 4), stroke(shade(metal, 0.7), 1.6, 0.9))), UNCLIP, path(box, stroke(shade(metal, 0.4), 0.9, 0.7))]; };
/** The whole drawing graded toward grey: every fill and stroke mixed toward its own luminance by 1 - saturation, so a
 *  noir figure keeps its values (what reads) and loses its colour. */
const greyed = (hex, s) => { if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return hex; const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)), l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return '#' + c.map((v) => Math.round(l + (v - l) * s).toString(16).padStart(2, '0')).join(''); };
const grade = (ops, s) => (s >= 1 ? ops : ops.map((o) => (o.fill || o.stroke ? { ...o, ...(o.fill ? { fill: greyed(o.fill, s) } : {}), ...(o.stroke ? { stroke: greyed(o.stroke, s) } : {}) } : o)));
/** One eye's outline as this face draws it (side +1 the right eye, -1 the left): its centre and line, the inner and
 *  outer corners (xi,yi / xo,yo), the upper lid's peak (px, y - th) and the lower lid's depth (y + bh), and the lid
 *  path itself. Exported so makeup on the eye (a liner, a lid colour, a gloss) is built on the eye that is drawn and
 *  never on a default eye slid into place, which misses the corners on any other face. */
export function eyeShape(p, side, cx = 200 + side * p.eyes.spacing / 2) {
  const e = p.eyes, k = featureScale(p) * (e.size ?? 1), st0 = EYES[e.style] ?? EYES.almond, st = { ...st0, w: st0.w * k, top: st0.top * k, bot: st0.bot * k, iris: st0.iris * k, inn: (st0.inn ?? 0) * k, out: (st0.out ?? 0) * k, crease: st0.crease && { ...st0.crease, dy: st0.crease.dy * k, ctl: st0.crease.ctl * k } }, o = e.openness * (side < 0 ? e.asym : 1), y = e.y + (side < 0 ? e.dy ?? 0 : 0);
  const sq = unit(e.squint ?? 0); // a smile does not shut the eye from above: the cheek pushes the lower lid up and the upper lid comes down a little after it
  const tl = (e.tilt ?? 0) * st.w * 0.6; // the slant: the outer corner up by most of it, the inner down by the rest
  const irTop = st.top * 0.22 + st.iris * (1.5 - 0.55 * (e.sclera ?? st.sclera)); // the iris's top at rest, as eye() places it
  const wide = o > 1 ? Math.max(st.top * o, irTop + 14 * k * (o - 1)) : st.top * o; // eyes opened past rest show white over the iris: a narrow or lidded eye's small top scaled by openness never clears its own iris (T015)
  const xi = cx - st.w * side, xo = cx + st.w * side, yi = y + (st.inn ?? 0) + 0.3 * tl, yo = y + (st.out ?? 0) - tl, th = wide * (1 - 0.25 * sq), bh = st.bot * o * (1 - 0.6 * sq), px = cx + 2 * side; // the upper lid peaks past the centre toward the outer corner
  return { cx, y, k, st, o, sq, xi, xo, yi, yo, th, bh, px, w: st.w, lid: `M ${xi} ${yi} Q ${px} ${y - th} ${xo} ${yo} Q ${cx - side} ${y + bh} ${xi} ${yi} Z` };
}
function eye(cx, p, side) { // side: +1 the right eye, -1 the left (its outer corner at -x)
  if (p.eyes.mode === 'lens' || p.eyes.mode === 'led') return machineEye(cx, p, side);
  const e = p.eyes, { k, st, o, y, sq, xi, xo, yi, yo, th, bh, px, lid } = eyeShape(p, side, cx);
  const depth = e.depth ?? 0.5, scl = e.sclera ?? st.sclera, lw = e.lidWeight ?? st.lid, corner = e.corner ?? st.corner, bags = e.bags ?? 0, dark = '#2b1d19';
  const ir = st.iris * (1.5 - 0.55 * scl), lx = cx + e.look.x * 3, ly = y - st.top * 0.22 + e.look.y * 2; // the iris sits up under the upper lid; the more sclera, the smaller it is against the aperture. Placed from the resting lid, not this one, so a lid raised in surprise shows white over the iris and a lowered one cuts across it
  const white = e.white ?? mix('#ece0d3', p.skin, 0.18), sl = unit(e.slit ?? 0); // the white is never white: it takes a little of the skin, unless the eye is not a human one
  return [
    ...(depth > 0.02 ? soft(cx, y - 9, st.w + 4, 8, '#1d0f0c', 0.2 * depth) : []),
    ...(bags > 0.02 ? [path(`M ${xi} ${yi + 3} Q ${cx} ${y + bh + 9} ${xo} ${yo + 3} Q ${cx} ${y + bh + 16 + 4 * bags} ${xi} ${yi + 5} Z`, { fill: TONE, op: 0.18 * bags }), path(`M ${xi + 3 * side} ${y + bh + 5} Q ${cx} ${y + bh + 11 + 3 * bags} ${xo - 2 * side} ${y + bh + 4}`, stroke('#6b473b', 1.1, 0.3 * bags))] : []),
    path(lid, { fill: white }),
    clip(lid), ellipse(lx, ly, ir, ir, { fill: e.iris }), ellipse(lx, ly, ir, ir, stroke(shade(e.iris, 0.55), 1, 0.45)), ellipse(lx, ly, ir * 0.42 * (1 - 0.78 * sl), ir * 0.42 * (1 + 1.1 * sl), { fill: e.pupil }), ellipse(lx - 1.6 * side, ly - 1.8, 1.2, 1.2, { fill: '#fff', op: 0.75 }),
    ellipse(lx + 0.5, ly + ir * 0.35, ir * 0.7, ir * 0.35, { fill: '#fff', op: 0.08 }), // the iris lit from below, where the light gets under the lid
    path(`M ${xi - 2 * side} ${yi - 2} Q ${px} ${y - th + 3.5} ${xo + 2 * side} ${yo - 2} L ${xo + 2 * side} ${yo - 12} L ${xi - 2 * side} ${yi - 12} Z`, { fill: TONE, op: 0.24 + 0.1 * depth }), UNCLIP, // the upper lid's shadow across the white and the iris
    taper([xi, yi], [px, y - th - 0.4], [xo + 2 * side, yo - 1.5], (t) => (0.7 + 1.1 * lw) + (0.7 + 0.9 * lw) * Math.sin(Math.PI * t ** 2.4), dark, 0.85), // the upper lid: one line, thin at the inner end, heaviest at the outer third where the lashes gather, to a point at the corner (t ** 2.4 puts the hump at three quarters)
    path(`M ${xi + 4 * side} ${yi + 1} Q ${cx} ${y + bh + 1.2} ${xo - 2 * side} ${yo + 0.4}`, stroke('#fff', 1.4, 0.16)), path(`M ${cx + 2 * side} ${y + bh + 0.6} Q ${xo - 3 * side} ${y + bh - 0.5} ${xo - side} ${yo}`, stroke(dark, 0.9, 0.3)), // the lower lid: a light rim, its outer third a faint dark
    ...(corner > 0.05 ? [path(`M ${xi} ${yi - 1.5} Q ${xi - 3.5 * corner * side} ${yi} ${xi} ${yi + 1.8}`, { fill: '#b8635a', op: 0.5 })] : []), // the tear duct
    ...(st.crease ? [path(`M ${cx - 16} ${y + st.crease.dy} Q ${cx} ${y + st.crease.ctl} ${cx + 16} ${y + st.crease.dy}`, stroke(st.crease.color, st.crease.sw, st.crease.op * (0.6 + 0.8 * depth)))] : []),
  ];
}

// brows: the right brow as [x0, y0, cx, cy, x1, y1, width] relative to the eye's centre and line, inner end first; mirrored for the left
export const BROWS = {
  straight: [-16, -27, 0, -30, 16, -27, 4.6], softArch: [-16, -25, 0, -35, 17, -27, 4.5], highArch: [-16, -24, 0, -39, 16, -28, 4], thickStraight: [-17, -27, 0, -30, 17, -27, 6.8],
  angled: [-17, -25, -2, -33, 17, -30, 4.7], thin: [-16, -26, 0, -32, 16, -27, 2.5], tapered: [-18, -26, -4, -34, 18, -28, 5.4], none: null, // none: brow() draws nothing
};
export const BROW_STYLES = Object.keys(BROWS);
function brow(cx, p, side) {
  if (p.eyes.browStyle === 'none') return []; // a face with no brow ridge hair at all: the greys, a hologram's smooth mask
  const e = p.eyes, k = featureScale(p), [x0, y0, mx, my, x1, y1, sw] = (BROWS[e.browStyle] ?? BROWS.softArch).map((v, i) => (i < 6 ? v * k : v)), y = e.y - e.browLift + side * e.browSkew * 5; // skew: one brow up, the other down; the brow grows with the eye
  const bi = 1.4 * (e.browInner ?? 0), knit = Math.max(0, -bi); // the inner end carries the feeling: up and the brow slopes like a roof (grief, worry), down and in it slopes like a scowl
  const a = [cx + (x0 + 0.5 * knit) * side, y + y0 - bi], c = [cx + mx * side, y + my - 0.2 * bi], b = [cx + x1 * side, y + y1 + 0.35 * bi]; // a drawn brow is heavy at the inner end and tapers to a tail: one stroke whose weight falls along it, not a fat one with a thin one sticking out past its end
  const out = [{ ...taper(a, c, b, (t) => sw * (0.98 - 0.76 * t ** 1.25), e.browColor ?? p.hairColor, 0.88), brow: true }]; // marked, since a brow is now a hair-coloured fill like the beard and the hair
  if (e.browStyle === 'tapered') out.push(path(`M ${cx + 7 * side} ${y - 29} Q ${cx + 14 * side} ${y - 28} ${cx + 19 * side} ${y - 27}`, stroke(p.skin, 2.4)));
  return out;
}
// what the brows do to the skin around them: two short furrows between them when they knit, and lines across the
// forehead when they go up (the whole brow, or the inner ends in grief). Nothing at rest.
function browCreases(p) {
  const e = p.eyes, bi = e.browInner ?? 0, by = e.y - e.browLift - 27 * featureScale(p), ink = underSkin(p.skin, '#7a4f42', 0.6), out = [];
  const knit = unit((-bi - 1.5) / 5); if (knit > 0) out.push(...[-1, 1].map((s) => path(`M ${200 + s * 5} ${by - 6} Q ${200 + s * 3} ${by + 2} ${200 + s * 4.5} ${by + 10}`, stroke(ink, 1.4, 0.5 * knit))));
  const up = unit((e.browLift + 1.5 * Math.max(0, bi) - 4) / 8); if (up > 0) out.push(...[0, 1].map((i) => path(`M ${200 - 26 + i * 4} ${by - 13 - i * 8} Q 200 ${by - 18 - i * 8 - 1.5 * Math.max(0, bi)} ${200 + 26 - i * 4} ${by - 13 - i * 8}`, stroke(ink, 1.2, (0.34 - 0.1 * i) * up))));
  return out;
}
const eyes = (p, brows = true) => p.eyes.mode === 'visor' ? [...machineVisor(p), ...(brows ? [...brow(200 - p.eyes.spacing / 2, p, -1), ...brow(200 + p.eyes.spacing / 2, p, 1)] : [])] : [...eye(200 - p.eyes.spacing / 2, p, -1), ...eye(200 + p.eyes.spacing / 2, p, 1), ...(brows ? [...browCreases(p), ...brow(200 - p.eyes.spacing / 2, p, -1), ...brow(200 + p.eyes.spacing / 2, p, 1)] : [])]; // brows false: a masked face, whose brows are behind the shell

// a feature line under this skin: the reference colour (drawn for the default skin), or the skin darkened by `k` where that is darker, channel by channel, so a line never comes out lighter than the face it sits on
const luma = (hex) => [0.299, 0.587, 0.114].reduce((a, w, i) => a + (w * parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)) / 255, 0);
const underSkin = (skin, ref, k) => { const d = shade(skin, k); return '#' + [1, 3, 5].map((i) => Math.min(parseInt(d.slice(i, i + 2), 16), parseInt(ref.slice(i, i + 2), 16)).toString(16).padStart(2, '0')).join(''); };
// noses as geometry, not outlines: `len` the bridge from the eye line to the tip, `w` the wings' half width, `tip`
// the ball's radius, `bridge` the profile (a hook > 0, a dip < 0), `up` the tip lifted (the nostrils show more)
export const NOSES = {
  straight: { len: 38, w: 10, tip: 6, bridge: 0, up: 0 },
  short: { len: 32, w: 10, tip: 6, bridge: 0, up: 0.3 },
  long: { len: 46, w: 10, tip: 6, bridge: 0.1, up: -0.2 },
  broad: { len: 38, w: 15, tip: 8, bridge: 0, up: 0.1 },
  narrow: { len: 40, w: 8, tip: 5, bridge: 0.1, up: 0 },
  upturned: { len: 36, w: 10, tip: 6.5, bridge: -0.3, up: 0.8 },
  aquiline: { len: 44, w: 10, tip: 6, bridge: 1, up: -0.3 },
  roundedTip: { len: 38, w: 11, tip: 8.5, bridge: 0, up: 0.2 },
};
export const NOSE_STYLES = Object.keys(NOSES);
// Most of a nose is shadow: the far side of the bridge, the wings, the underside of the tip on the lip, the nostrils;
// then a highlight down the ridge and a spot on the tip. The only lines are the crease at the far wing and a hint of
// the tip's underside, both short. A hook catches light on its bump, a dip holds shadow.
const nose = (p) => { if (p.nose.mode && p.nose.mode !== 'human') return machineNose(p); const st = NOSES[p.nose.style] ?? NOSES.straight, sd = p.light.side || -1, dk = underSkin(p.skin, '#6e4236', 0.42), lift = 1 + Math.max(0, 0.5 - luma(p.skin)) * 1.4, y0 = p.eyes.y + 10, yt = y0 + st.len, w = st.w, t = st.tip, up = st.up, hook = st.bridge; // the bridge starts just under the eye line, wherever this face has it
  const nostril = (s) => path(`M ${200 + s * w * 0.55} ${yt + t * 0.65} Q ${200 + s * w * 0.3} ${yt + t * 0.4 + 4 * up} ${200 + s * w * 0.1} ${yt + t * 0.75} Q ${200 + s * w * 0.35} ${yt + t * 1.05} ${200 + s * w * 0.55} ${yt + t * 0.65} Z`, { fill: dk, op: Math.min(1, (0.3 + 0.35 * up) * lift) });
  // a muzzle is the same nose at the same place, built the other way: no tip with wings but a bridge running down into
  // a broad pad, modelled in light and shadow with the two nostrils cut into it as the only marks, so it reads as the
  // face's own structure rather than something laid over it. `muzzle` fades the whole thing in, and the scaling below
  // is the nose's own, so this face's nose length and width size the muzzle.
  const mz = Math.max(0, Math.min(1, p.nose.muzzle ?? 0));
  if (mz > 0) { const pw = w * (1 + 1.5 * mz), py = yt + t * 0.5, plane = shade(p.skin, 1 - 0.1 * mz); return mapXY([ // the pad is wide: a muzzle ends in a snout, and a narrow one reads as a big nose
    path(`M ${200 - w * 0.8} ${y0} C ${200 - w * 1.1} ${y0 + st.len * 0.5}, ${200 - pw * 1.04} ${py - t * 1.5}, ${200 - pw} ${py}` // the muzzle's own plane: the bridge widening into the pad, the skin a shade down, no line anywhere
      + ` C ${200 - pw} ${py + t * 1.5}, ${200 + pw} ${py + t * 1.5}, ${200 + pw} ${py}`
      + ` C ${200 + pw * 1.04} ${py - t * 1.5}, ${200 + w * 1.1} ${y0 + st.len * 0.5}, ${200 + w * 0.8} ${y0} Z`, { fill: plane }),
    ...soft(200 + sd * w * 1.15, y0 + st.len * 0.55, 5, st.len * 0.45, TONE, 0.3 * mz), ...soft(200 - sd * w * 1.15, y0 + st.len * 0.55, 4.5, st.len * 0.42, TONE, 0.16 * mz), // the bridge's two sides, the far one darker
    ...soft(200 - sd * 2, y0 + st.len * 0.45, w * 0.5, st.len * 0.4, '#fff', 0.12 * mz), // the light down it
    ...[-1, 1].flatMap((s) => soft(200 + s * pw * 0.92, py + t * 0.3, 5, t * 1.2, TONE, s === -sd ? 0.3 * mz : 0.16 * mz)), // the pad's sides
    ...soft(200, py - t * 0.6, pw * 0.72, t * 0.85, '#fff', 0.16 * mz), ...soft(200, py + t * 2.1, pw * 0.72, t * 0.7, TONE, 0.24 * mz), // lit on top, and its shadow well under it: a shadow tight under two nostrils reads as a moustache
    ...[-1, 1].map((s) => path(`M ${200 + s * pw * 0.26} ${py - t * 1.1} C ${200 + s * pw * 0.44} ${py - t * 0.6}, ${200 + s * pw * 0.46} ${py + t * 0.1}, ${200 + s * pw * 0.3} ${py + t * 0.5}`, stroke(dk, t * 0.62, Math.min(1, 0.9 * lift) * mz))), // the two nostrils: slits, standing up the pad. Drawn as commas lying flat they read with the mouth under them as a moustache
  ], scaleAbout(200, p.nose.width / 20), scaleAbout(y0, p.nose.length / 38)); }
  return mapXY([
    ...soft(200 - 5.5 * sd, y0 + st.len * 0.45, 4.5 + 2 * Math.max(0, hook), st.len * 0.42, TONE, 0.22),
    ...(hook > 0.3 ? [ellipse(200 - 3 * sd, y0 + st.len * 0.4, 6, 8, { fill: '#fff', op: 0.08 * hook })] : hook < -0.2 ? [ellipse(200 - 4 * sd, y0 + st.len * 0.55, 5, 9, { fill: TONE, op: 0.1 * -hook })] : []),
    ...soft(200 + 2 * sd + 2 * hook * sd, y0 + st.len * 0.5, 3.5, st.len * 0.3, '#fff', 0.07), // the ridge's light
    ...soft(200, yt + t * 0.3, t * 1.15, t * 0.95, '#fff', 0.1), ellipse(200 + 1.2 * sd, yt - t * 0.25, t * 0.4, t * 0.3, { fill: '#fff', op: 0.22 }), // the ball of the tip and its highlight
    ...[-1, 1].flatMap((s) => soft(200 + s * w * 0.95, yt + 2, 5.5, 5, TONE, s === -sd ? 0.22 : 0.12)), // the wings, the far one darker
    path(`M ${200 - w * 0.7} ${yt + t * 0.75} Q ${200 - w * 0.2 * sd} ${yt + t * 1.9} ${200 + w * 0.7} ${yt + t * 0.75} Q 200 ${yt + t * 1.15} ${200 - w * 0.7} ${yt + t * 0.75} Z`, { fill: TONE, op: 0.2 }), // the shadow under the tip, on the lip
    nostril(-1), nostril(1),
    path(`M ${200 - (w + 2) * sd} ${yt - 6} Q ${200 - (w + 4) * sd} ${yt + 1} ${200 - (w - 2) * sd} ${yt + 6}`, stroke(dk, 1.3, Math.min(1, 0.35 * lift))), // the crease at the far wing
    path(`M ${200 - t * 0.9 * sd} ${yt + t * 0.5} Q ${200 - t * 0.2 * sd} ${yt + t * 1.05} ${200 + t * 0.5 * sd} ${yt + t * 0.75}`, stroke(dk, 1.2, Math.min(1, 0.28 * lift))), // a hint of the tip's underside
  ], scaleAbout(200, p.nose.width / 20), scaleAbout(y0, p.nose.length / 38)); };

// mouths: the lips' style; the smile is a parameter (a broad one shows teeth), as is `open`
// `wide` scales the width, `thin`/`full` how much lip there is, `asym` tilts it, `bow` deepens the upper lip's dip and
// `pout` pushes the lower lip out.
export const MOUTHS = { plain: {}, thin: { thin: true }, full: { full: true }, wide: { wide: 1.3 }, asym: { asym: 1 }, small: { wide: 0.78 }, cupidBow: { bow: 1.9, full: true }, pout: { full: true, pout: 5, wide: 0.9 } };
export const MOUTH_STYLES = Object.keys(MOUTHS);
// teeth: the band between the lips when a mouth is parted or smiling broadly. `d` is that band, shaped to the two lips
// and tucked in from the corners, and the caller clips every entry to it, so a mark is meant to run past the band's
// edge and be cut there. `cx`/`w` are the mouth's centre and width, `ty`/`th` the band's middle and its full height.
export const TEETH = {
  even: (d) => [path(d, { fill: '#f2e7dc' })],
  gapped: (d, cx, w, ty, th) => [path(d, { fill: '#f2e7dc' }), line(cx, ty - th, cx, ty + th, stroke('#3a1f1c', 2.4, 0.7))],
  crooked: (d, cx, w, ty, th) => [path(d, { fill: '#eee0cd' }), ...[-0.17, -0.06, 0.06, 0.17].map((f, i) => line(cx + w * f, ty - th, cx + w * f + (i % 2 ? 1.8 : -1.8), ty + th, stroke('#3a1f1c', 1.5, 0.45)))],
  grill: (d, cx, w, ty, th) => [path(d, { fill: '#c49a34' }), path(d, stroke('#f7e3a4', 1.6, 0.55)), ...[-0.18, -0.06, 0.06, 0.18].map((f) => line(cx + w * f, ty - th, cx + w * f, ty + th, stroke('#6e5010', 1.4, 0.5)))],
  none: () => [],
};
export const TEETH_STYLES = Object.keys(TEETH);
// where the mouth's parting sits on a laid-out face: its own line, or with a muzzle the end of the pad (the nose's own
// scaling, so the parting runs under the nostrils and never through them: a mouth line across the nostrils reads as a ring)
const mouthLine = (p) => { const mz = Math.max(0, Math.min(1, p.nose?.muzzle ?? 0)); if (!mz) return p.mouth.y; const st = NOSES[p.nose.style] ?? NOSES.straight; return p.mouth.y + mz * (p.eyes.y + 10 + (st.len + st.tip * 1.625) * (p.nose.length / 38) + 6 - p.mouth.y); };
/** How the lips move: a smile lifts the corners (a frown drops them) by `lift` and the parting bows by the rest, so a grin is corners pulled up and out, not a lip bent down at the middle; `ctl` is where the parting's control point sits under the resting line. Exported because the moustache rides the same lip. */
export const lipMove = (m) => { const s = m.smile ?? 0, o = m.open ?? 0; return { lift: 9 * s, ctl: 9 * s - 14 * o }; }; // an open jaw lifts the upper lip's middle as it drops the lower, so the opening is an oval and not a crescent hung off the parting
/** How far past a muzzle's nostril pad, each side, its mouth may run (T066: the pad is the nose's own width, a straight nose's half as broad as a broad one's, while the mouth was sized from the face, so a straight-nosed dragonborn's mouth ran 30 past the pad at every style and expression, a slash cheek to cheek). The mouth follows the snout it ends. */
const MOUTH_PAD_MARGIN = 12;
function mouth(p) {
  if (p.mouth.mode && p.mouth.mode !== 'human') return machineMouth(p);
  const mz = Math.max(0, Math.min(1, p.nose?.muzzle ?? 0)); // a muzzle's mouth is the same mouth, wider and with less lip: it still smiles, opens and shows its teeth, because it is this code and not a line drawn over it
  const m = { ...p.mouth, y: mouthLine(p), color: p.mouth.color ?? underSkin(p.skin, '#8b5149', 0.72) }, st = MOUTHS[m.style] ?? MOUTHS.plain, open = m.open ?? 0, sm = m.smile, kw = m.skew ?? 0, pr = unit(m.press ?? 0), a = st.asym ?? 0; // a muzzle's mouth is up at the end of it, not a lip gap below: there is no lip to leave room for
  const sw = st.wide ?? 1, pad = mz ? (NOSES[p.nose.style] ?? NOSES.straight).w * (1 + 1.5 * mz) * (p.nose.width / 20) : 0, w = Math.min(m.width * Math.min(sw * (1 + 0.7 * mz), Math.max(sw, 1 + 0.7 * mz)) * (1 + 0.14 * Math.max(0, sm) - 0.16 * open - 0.08 * pr), mz ? (2 * (pad + MOUTH_PAD_MARGIN)) / mz : Infinity), x1 = 200 - w / 2, x2 = 200 + w / 2; // a smile pulls the corners out, a dropped jaw draws them in, pressed lips go a little narrower; under a muzzle a wide style is no wider than a plain mouth there (T058: wide on top of the muzzle's own widening ran the line past the pad to the cheeks, and off the jaw on a turned head), a small one stays small
  const { lift, ctl } = lipMove(m), yl = m.y + a * 2 - lift + 1.5 * kw, yr = m.y - a * 4 - lift - 7 * kw, qx = 200 - a * 7 + 3 * kw, mid = m.y + ctl, dark = shade(m.color, 0.45); // skew: the +x corner hitched up, the other barely moving
  const yAt = (t) => (1 - t) ** 2 * yl + 2 * t * (1 - t) * mid + t * t * yr; // the parting itself, so the upper lip is built on it however far the corners have gone
  const parted = open > 0.08 || sm > 0.6, inside = open > 0.08 ? mid + 6 + 50 * open : mid + 16 * unit((sm - 0.6) / 0.4), drop = parted ? inside - mid : 0; // a broad smile parts the lips over the teeth; the lower lip's top edge is `inside`
  const upper = `M ${x1} ${yl} Q ${qx} ${mid} ${x2} ${yr}`, out = [ellipse(200, m.y + 11 + 6 * m.fullness + drop * 0.5, w * 0.36, 4.5, { fill: TONE, op: 0.12 }), ellipse(200, m.y + 5 + 5 * m.fullness + drop * 0.5, w * 0.28, 3, { fill: '#fff', op: 0.1 }), ellipse(200, m.y - 9 - lift * 0.5, w * 0.2, 4, { fill: TONE, op: 0.05 })]; // the shadow under the lower lip and the light on it, and the philtrum's shade above, so the mouth sits in a face rather than on it
  // the cheeks a smile pushes up: the apple lit, and the fold from the nose's wing down past the corner; a hitched corner (skew) folds its own side
  // a hitched corner with no smile behind it is the lip lifted off the teeth on that side, a sneer, not the cheek's pull a smirk is: the upper lip's +x half rises off the parting and the teeth show under it (T042: at skew .5, smile -.3 the mouth was a short tilted line, a stare)
  const cu = unit(kw / 0.6) * unit((-sm - 0.1) / 0.2), L = 7 * cu, c1 = `${x1 + (2 / 3) * (qx - x1)} ${yl + (2 / 3) * (mid - yl)}`, c2x = x2 + (2 / 3) * (qx - x2), c2y = yr + (2 / 3) * (mid - yr);
  const lip = cu > 0.02 ? `M ${x1} ${yl} C ${c1} ${c2x} ${c2y - 1.6 * L} ${x2} ${yr}` : upper; // the parting as a cubic, its +x control raised
  const ink = underSkin(p.skin, '#6e4236', 0.55);
  for (const s of [-1, 1]) { const f = (1 - mz) * Math.min(1, unit((sm - 0.15) / 0.6) + 0.8 * unit((s * kw) / 0.7) + (s > 0 ? cu : 0)), cxr = s > 0 ? x2 : x1, cyr = s > 0 ? yr : yl; if (f < 0.03) continue;
    out.push(...soft(200 + s * (w * 0.62 + 10), m.y - 30 - 0.4 * lift, 15, 10, '#fff', 0.05 * f), path(`M ${200 + s * (w * 0.36 + 6)} ${m.y - 32} Q ${200 + s * (w * 0.5 + 14)} ${m.y - 14 - lift * 0.4} ${cxr + s * 7} ${cyr + 9}`, stroke(ink, 1.6, 0.5 * f))); }
  // every mouth is two lips, not a line: the upper a bowed lens in shadow, the lower a fuller lens in the light, the parting drawn between them; the style sets how much lip there is, pressed lips have less of it
  const k = (st.thin ? 0.45 : st.full ? 1.5 : 1) * (1 - 0.55 * mz) * (1 - 0.65 * pr), top = (4 + 4 * m.fullness) * k, bot = (6 + 8 * m.fullness) * k, low = parted ? inside : mid;
  out.push(path(`${lip} Q ${qx + w * 0.26} ${yAt(0.75) - top * 1.15 - L} ${qx} ${yAt(0.5) - (top * 0.55) / (st.bow ?? 1)} Q ${qx - w * 0.26} ${yAt(0.25) - top * 1.15} ${x1} ${yl} Z`, { fill: shade(m.color, 0.82), op: 0.88 }), path(`M ${x1} ${yl} Q ${qx} ${low} ${x2} ${yr} Q ${qx} ${low + bot + (st.pout ?? 0)} ${x1} ${yl} Z`, { fill: shade(m.color, 1.08), op: 0.82 }));
  if (cu > 0.02) out.push(path(`${lip} C ${c2x} ${c2y} ${c1} ${x1} ${yl} Z`, { fill: '#ece4d6', op: 0.92 }), path(lip, stroke(dark, 1.4, 0.8))); // the teeth under the lifted half, between it and the parting
  // the teeth: the band between the two lips, from the parting down (a parted mouth) or the row a broad smile shows
  const rows = TEETH[m.teeth ?? 'even'] ?? TEETH.even, bx1 = x1 + 5, bx2 = x2 - 5, bl = yl + (mid - yl) * 0.15, br = yr + (mid - yr) * 0.15;
  // the band is also the clip: a gap, a crooked edge or a grill's dividers are straight marks across a lens that is
  // thinner at its ends than at its middle, so left loose they are drawn over the lower lip. They run past it instead and are cut to it.
  const band = (bot2) => `M ${bx1} ${bl} Q ${qx} ${mid} ${bx2} ${br} Q ${qx} ${bot2} ${bx1} ${bl} Z`;
  const teeth = (bot2) => { const d = band(bot2); return [clip(d), ...rows(d, qx, w, (mid + bot2) / 2, Math.abs(bot2 - mid)), UNCLIP]; };
  if (parted) out.push(path(`${upper} Q ${qx} ${inside} ${x1} ${yl} Z`, { fill: open > 0.08 ? '#3a1f1c' : dark }), ...teeth(open > 0.08 ? mid + Math.min(8, (inside - mid) * 0.3) : inside - 1)); // the inside is the region between the two lips, so it never shows past them
  out.push(path(upper, stroke(shade(m.color, 0.55), st.thin ? 1.4 : 2, 0.9)), ellipse(x1, yl, 2.2, 1.6, { fill: dark, op: 0.45 }), ellipse(x2, yr, 2.2, 1.6, { fill: dark, op: 0.45 })); // the parting, and the corners tucked into the cheeks
  if (parted) out.push(path(`M ${x1} ${yl} Q ${qx} ${inside} ${x2} ${yr}`, stroke(shade(m.color, 0.7), 2)));
  return out;
}

// hair: `front` sits over the face, `back` behind the head and neck (long styles, buns, an afro's mass). Each entry is
// front(p), or { back, front }. Drawn for the default head, fitted to the face width.
const CAP = (p) => [path('M 126 163 C 124 121, 150 91, 199 90 C 247 91, 275 121, 274 163 C 255 139, 231 128, 200 128 C 169 128, 145 140, 126 163 Z', { fill: p.hairColor })]; // the buzz: a hairline for styles whose mass sits behind
const longBack = (bottom, p) => [path(`M 110 150 C 110 78, 150 60, 200 60 C 250 60, 290 78, 290 150 L 294 ${bottom} Q 294 ${bottom + 20} 274 ${bottom + 20} L 126 ${bottom + 20} Q 106 ${bottom + 20} 106 ${bottom} Z`, { fill: shade(p.hairColor, 0.8) })]; // the sheet of long hair behind the neck and shoulders
const gloss = (d, sw = 2.1) => path(d, stroke('#fff', sw, 0.09));
// strands: a fan of fine lines combed from the crown, darker and lighter than the hair by turns, jittered by the seed; clipped to the hair's mass by the caller, so they read as its grain on any style
// `from` is the crown they fan from, `a0..a1` the fan in radians, `len` how far; a beard combs down from the chin with the same.
// Head hair (`fall`) starts each strand on a ring 40..68 out from the crown in its own direction: started at the one point, the fan met there and read as wireframe spokes on pale hair (T011)
const strands =(p, { from = [200, 64], a0 = -0.15, a1 = Math.PI + 0.15, len = 150, n = 22, fall = false } = {}) => { const rnd = lcg(p.seed), out = [];
  const dark = 0.16 * (1 - 0.7 * luma(p.hairColor)); // a dark strand on white hair is a crack, so it fades with the hair's lightness
  for (let i = 0; i < n; i++) { const a = a0 + (i / (n - 1)) * (a1 - a0) + (rnd() - 0.5) * 0.12, l = len + rnd() * len * 0.6, rs = fall ? 40 + (i % 3) * 14 : 0, x0 = from[0] + (rnd() - 0.5) * 30 + Math.cos(a) * rs, y0 = from[1] + (rnd() - 0.5) * 16 + Math.max(Math.sin(a), 0) * rs * 0.6, x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; // out from the crown, then it falls
    const j = (rnd() - 0.5) * 12, r = l * 0.4, sx = x0 + Math.cos(a) * r, sy = y0 + Math.max(Math.sin(a), 0.2) * r, hang = `M ${x0} ${y0} Q ${sx} ${sy - r * 0.35} ${sx + Math.cos(a) * r * 0.2} ${sy + r * 0.3} L ${sx + Math.cos(a) * r * 0.2 + j} ${sy + l * 1.2}`; // head hair: over the skull from the crown, then down under its own weight, not a straight spoke
    out.push(path(fall ? hang : `M ${x0} ${y0} Q ${x1} ${y1} ${x1 + Math.cos(a) * l * 0.15 + j} ${y1 + l * 0.8}`, stroke(i % 2 ? '#fff' : '#000', 1 + rnd() * 1.2, i % 2 ? 0.08 : dark))); }
  return out; };
// curls: small arcs scattered over the mass, for hair that has no comb direction
const curls = (p) => { const rnd = lcg(p.seed + 7), out = [];
  for (let i = 0; i < 70; i++) { const x = 90 + rnd() * 220, y = 30 + rnd() * 200, r = 4 + rnd() * 6, a = rnd() * Math.PI * 2, s = i % 3 ? 1 : -1;
    out.push(path(`M ${x + Math.cos(a) * r} ${y + Math.sin(a) * r} Q ${x + Math.cos(a + s * 1.2) * r * 1.5} ${y + Math.sin(a + s * 1.2) * r * 1.5} ${x + Math.cos(a + s * 2.6) * r} ${y + Math.sin(a + s * 2.6) * r}`, stroke(i % 2 ? '#fff' : '#000', 1 + rnd(), i % 2 ? 0.08 : 0.15 * (1 - 0.7 * luma(p.hairColor))))); }
  return out; };
const K = 0.5523, ellipsePath = (o) => `M ${o.cx + o.rx} ${o.cy} C ${o.cx + o.rx} ${o.cy + K * o.ry}, ${o.cx + K * o.rx} ${o.cy + o.ry}, ${o.cx} ${o.cy + o.ry} C ${o.cx - K * o.rx} ${o.cy + o.ry}, ${o.cx - o.rx} ${o.cy + K * o.ry}, ${o.cx - o.rx} ${o.cy} C ${o.cx - o.rx} ${o.cy - K * o.ry}, ${o.cx - K * o.rx} ${o.cy - o.ry}, ${o.cx} ${o.cy - o.ry} C ${o.cx + K * o.rx} ${o.cy - o.ry}, ${o.cx + o.rx} ${o.cy - K * o.ry}, ${o.cx + o.rx} ${o.cy} Z`; // an ellipse as a path, so a clip can take it
// the wreath a head that has lost the top is left with: WREATH is the mass behind the skull, a shade darker as
// `longBack` is, showing past its sides as the volume hair has; WINGS is the same band's near side, on the head.
const WREATH = (p) => [path('M 114 174 C 109 204, 117 232, 136 254 L 164 244 C 143 220, 134 196, 135 170 Z', { fill: shade(p.hairColor, 0.88) }), path('M 286 174 C 291 204, 283 232, 264 254 L 236 244 C 257 220, 266 196, 265 170 Z', { fill: shade(p.hairColor, 0.88) })];
const WINGS = (p) => [path('M 121 146 C 114 160, 112 180, 115 206 L 127 204 C 126 186, 127 166, 133 150 C 129 146, 125 145, 121 146 Z', { fill: p.hairColor }), path('M 279 146 C 286 160, 288 180, 285 206 L 273 204 C 274 186, 273 166, 267 150 C 271 146, 275 145, 279 146 Z', { fill: p.hairColor })]; // a narrow band on the skull's own edge, let out past the outline so it runs on into the wreath behind: drawn inside the outline as a rounded block, with skin showing beside it, it read as an ear muff (T084)
// A panel that hangs beside the face is drawn for the default head and follows this one. Below HANG_TOP each point
// keeps the distance from the face's outline it was drawn at: it moves by how much wider this face's own outline is
// where the point lands than the default's where it was drawn (fullness, a fuller cheek, the jaw, the skew), and
// `cut`, the default cut's bottom, is carried down to this face's jaw corner, so the jaw does not come out under a
// flat cut at the mouth. Then the inner edge, read along its curve, keeps HANG_EYE clear of each eye's outer corner
// near the eye line (T012), the eyes sitting at their own spacing (not the face's width) and sliding HANG_TURN past
// the hair per unit of turn (the features 12 x turn, the head and hair 4). In the default frame: `fit` scales it after.
// Width alone moved the panels, so a full cheek or a broad jaw stood out past and under them, and the hair read as a
// see-through sheet laid on the face (T113).
const HANG_TOP = 170, HANG_BLEND = 30, HANG_TURN = 8, HANG_EYE = 12, HANG_OUT = 2;
const flatten = (d, n = 24) => { const t = tokens(d), out = []; let c = [0, 0], start = c, cmd = 'M';
  for (let i = 0; i < t.length;) {
    if (/[MLCQZ]/i.test(t[i])) { cmd = t[i++].toUpperCase(); if (cmd === 'Z') { for (let k = 1; k <= n; k++) out.push([0, 1].map((j) => c[j] + (k / n) * (start[j] - c[j]))); c = start; } continue; }
    const m = ARGS[cmd], v = t.slice(i, i + m).map(Number); i += m;
    if (cmd === 'C') for (let k = 1; k <= n; k++) { const u = k / n, w = 1 - u; out.push([0, 1].map((j) => w * w * w * c[j] + 3 * w * w * u * v[j] + 3 * w * u * u * v[2 + j] + u * u * u * v[4 + j])); }
    else if (cmd === 'Q') for (let k = 1; k <= n; k++) { const u = k / n, w = 1 - u; out.push([0, 1].map((j) => w * w * c[j] + 2 * w * u * v[j] + u * u * v[2 + j])); }
    else if (cmd === 'L') for (let k = 1; k <= n; k++) out.push([0, 1].map((j) => c[j] + (k / n) * (v[j] - c[j])));
    else out.push([v[0], v[1]]);
    c = [v[m - 2], v[m - 1]]; if (cmd === 'M') start = c;
  }
  return out; };
const halfAt = (pts, s, y) => { let w = 0; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; if (y0 !== y1 && (y0 - y) * (y1 - y) <= 0 && Math.sign(x0 + x1 - 400) === s) w = Math.max(w, Math.abs(x0 + ((x1 - x0) * (y - y0)) / (y1 - y0) - 200)); } return w; };
const jawYOf = (face) => 112 + face.height - (face.corner ?? 32);
const hang = (p, ops, cut, edges = true) => { // edges: a front panel, whose edges are measured against the face; a back sheet only follows the outline
  const ref = DEFAULTS.face, k = p.face.width / 156, turn = p.pose?.turn ?? 0, ey = 112 + ((p.eyes.y - 112) * p.face.height) / 204;
  const me = flatten(facePath(p)), base = flatten(facePath({ face: ref })), jy = jawYOf(p.face), jr = jawYOf(ref), stretch = cut ? (jy - HANG_TOP) / (cut - HANG_TOP) : 1;
  const ramp = (y) => unit((y - HANG_TOP + HANG_BLEND) / HANG_BLEND), inside = (x, y, s, need = 0) => y > HANG_TOP - HANG_BLEND && s * (x - 200) > 0 && Math.abs(x - 200) < Math.max(halfAt(me, s, Math.min(y, jy)) / k, need + 1); // the inner edge: inside the face, or short of where it has to be
  let out = mapPts(ops, (x, y) => { if (y <= HANG_TOP - HANG_BLEND) return [x, y];
    const y1 = y > HANG_TOP ? HANG_TOP + (y - HANG_TOP) * stretch : y, s = x < 200 ? -1 : 1;
    return [x + s * ramp(y) * (halfAt(me, s, Math.min(y1, jy)) / k - halfAt(base, s, Math.min(y, jr))), y1]; });
  if (edges) for (const s of [-1, 1]) {
    // the outer edge is straight between its points while the cheek bulges between them, and a fuller cheek or one lowered by the skew bulges where no point is: it moves out by what still shows
    const from = out, lines = from.filter((o) => o.k === 'path').map((o) => flatten(o.d)), bottom = Math.max(...lines.flat().filter(([x]) => s * (x - 200) > 0).map(([, y]) => y)), reach = (y) => Math.max(0, ...lines.map((l) => halfAt(l, s, y)));
    let show = 0; for (let y = HANG_TOP + 40; y <= Math.min(bottom, jy); y += 4) show = Math.max(show, halfAt(me, s, y) / k + HANG_OUT - reach(y));
    if (show > 0) out = mapPts(from, (x, y) => (y > HANG_TOP - HANG_BLEND && s * (x - 200) > halfAt(me, s, Math.min(y, jy)) / k ? [x + s * show * ramp(y), y] : [x, y]));
  }
  if (edges) for (const s of [-1, 1]) {
    const need = (Math.abs(eyeShape(p, s).xo - 200) + HANG_EYE + HANG_TURN * Math.max(0, s * turn)) / k, from = out, push = (g) => mapPts(from, (x, y) => (inside(x, y, s, need) ? [x + s * g * ramp(y), y] : [x, y]));
    let g = 0; for (let pass = 0; pass < 4; pass++) { // the edge's curve follows its moved points only part of the way, so the shift is found in a few passes, always from the same points
      const near = out.filter((o) => o.k === 'path').flatMap((o) => flatten(o.d)).filter(([x, y]) => Math.abs(y - ey) <= 25 && s * (x - 200) > 0 && s * (x - 200) < need + 1 + g), gap = near.length ? need - Math.min(...near.map(([x]) => s * (x - 200))) : 0;
      if (gap <= 0.05) break; g += gap; out = push(g); }
  }
  return out; };
const HAIR_TEXTURE = { curlyMedium: 'curls', afroShort: 'curls', afroMedium: 'curls', locsShort: 'none', boxBraids: 'none', cornrows: 'none', shortMohawk: 'none' }; // the grain each style takes; unlisted styles are combed strands
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
  bob: { back: (p) => hang(p, [path('M 118 160 C 114 100, 152 66, 200 66 C 248 66, 286 100, 282 160 L 285 244 L 115 244 Z', { fill: shade(p.hairColor, 0.8) })], 248, false), front: (p) => hang(p, [path('M 118 171 C 108 126, 121 90, 151 76 C 177 64, 223 64, 249 76 C 279 90, 292 126, 282 171 L 288 248 C 281 252, 274 251, 267 246 C 268 222, 268 204, 268 183 C 266 148, 236 117, 200 112 C 164 117, 134 148, 132 183 C 132 204, 132 222, 133 246 C 126 251, 119 252, 112 248 Z', { fill: p.hairColor })], 248) }, // a hanging panel's inner edge stays outside the eyes' outer corners (x 132 at the eye line) and its outer edge outside the face's widest (x 112 at the jaw): cut nearer the middle and narrowing to a point it lay across the cheek with the face's edge showing past it, which read as a see-through sheet over the face (T022). The back is its own, inside the front's outline, as bluntBob's is (T068): the shared longBack stood out round a pale bob as a grey rim, blinkers off the head (T120)
  bluntBob: { back: (p) => hang(p, [path('M 118 160 C 114 100, 152 66, 200 66 C 248 66, 286 100, 282 160 L 281 244 L 119 244 Z', { fill: shade(p.hairColor, 0.8) })], 248, false), front: (p) => hang(p, [path('M 112 170 C 104 121, 122 84, 154 72 C 178 62, 222 62, 246 72 C 278 84, 296 121, 288 170 L 284 248 L 254 248 C 262 214, 262 172, 250 144 C 234 114, 166 114, 150 144 C 138 172, 138 214, 146 248 L 116 248 Z', { fill: p.hairColor })], 248) }, // the panels hang beside the face, their inner edge outside the eyes' outer corners: cut nearer the middle they laid a slab of hair across the cheeks and eyes (T012). The back is the blunt cut's own, inside the front's outline: the shared longBack is wider and longer than these panels, so it stood out round every edge as a darker rim and the panels read as see-through sheets laid on the face (T068)
  longStraight: { back: (p) => hang(p, longBack(350, p), null, false), front: (p) => hang(p, [path('M 114 178 C 103 125, 120 84, 151 70 C 177 58, 223 58, 249 70 C 280 84, 297 125, 286 178 L 299 355 L 259 355 C 266 285, 268 222, 268 183 C 266 146, 234 120, 200 118 C 166 120, 134 146, 132 183 C 132 222, 134 285, 141 355 L 101 355 Z', { fill: p.hairColor })]) }, // the same panel rule as bob's (T022)
  ponytailLow: { back: (p) => [path('M 254 139 C 292 150, 303 195, 284 229 C 273 248, 260 257, 249 264 C 263 221, 261 176, 254 139 Z', { fill: p.hairColor })], front: (p) => [path('M 122 168 C 116 124, 128 93, 154 78 C 179 64, 221 64, 246 78 C 272 93, 284 124, 278 168 C 258 140, 234 122, 200 120 C 166 122, 142 140, 122 168 Z', { fill: p.hairColor })] },
  highBun: { back: (p) => [ellipse(200, 54, 36, 31, { fill: p.hairColor })], front: (p) => [path('M 121 168 C 117 124, 129 92, 155 78 C 179 66, 221 66, 245 78 C 271 92, 283 124, 279 168 C 259 139, 235 122, 200 120 C 165 122, 141 139, 121 168 Z', { fill: p.hairColor })] },
  lowBun: { back: (p) => [ellipse(268, 171, 29, 31, { fill: p.hairColor })], front: (p) => [path('M 122 169 C 118 125, 130 93, 155 78 C 179 64, 221 64, 245 78 C 270 93, 282 125, 278 169 C 258 140, 234 122, 200 120 C 166 122, 142 140, 122 169 Z', { fill: p.hairColor })] },
  locsShort: { back: (p) => [[135, 96, 126, 167], [151, 82, 145, 176], [169, 74, 165, 179], [187, 70, 184, 175], [205, 69, 205, 179], [223, 72, 225, 177], [241, 80, 247, 176], [257, 94, 270, 168]].map(([x1, y1, x2, y2]) => path(`M ${x1} ${y1} Q ${(x1 + x2) / 2 + 6} ${(y1 + y2) / 2} ${x2} ${y2}`, stroke(p.hairColor, 11))), front: CAP },
  boxBraids: { back: (p) => { const hw = p.face.width / 2; return [-1, 1].flatMap((s) => [-2, 6, 14, 22].flatMap((o) => { const x0 = 200 + s * (hw - 20), y0 = 118, xm = 200 + s * (hw + o), ym = 210, x1 = xm + s * 4, y1 = 340, at = (t, a, b, c) => (1 - t) ** 2 * a + 2 * t * (1 - t) * b + t * t * c; return [path(`M ${x0} ${y0} Q ${xm} ${ym} ${x1} ${y1}`, stroke(p.hairColor, 7)), ...Array.from({ length: 10 }, (_, i) => { const t = 0.2 + i * 0.08, bx = at(t, x0, xm, x1), by = at(t, y0, ym, y1); return line(bx - 3, by - 2 * s, bx + 3, by + 2 * s, stroke('#fff', 2, 0.12)); })]; })); }, front: (p) => [...CAP(p), ...[-40, -14, 14, 40].map((d) => path(`M ${200 + d} 92 Q ${200 + d * 1.3} 120 ${200 + d * 1.6} 150`, stroke(p.skin, 1.6, 0.5)))] }, // a braided cap parted into sections, the braids starting behind the skull and falling beside the face from the temples, so each is seen joined to the head (T021: started inside the face's outline they showed only past the jaw, sticks attached to nothing), each knotted along its length
  // rows braided flat to the scalp, parted to the skin between them, each knotted along its length: a cap with the head's own partings showing, nothing hanging
  cornrows: (p) => [...CAP(p), ...[-60, -47, -34, -21, -8, 5, 18, 31, 44, 56].flatMap((d) => { const x0 = 200 + d * 0.58, x1 = 200 + d * 1.2; return [path(`M ${x0} 94 Q ${(x0 + x1) / 2} 124 ${x1} 158`, stroke(p.skin, 1.3, 0.4)), ...[0.25, 0.55, 0.8].map((t) => line(x0 + (x1 - x0) * t - 2, 94 + 64 * t, x0 + (x1 - x0) * t + 2, 94 + 64 * t + 1.5, stroke('#fff', 1.4, 0.1)))]; })],
  // shaved to the skin either side of a crest standing off the crown: the crest is the whole style, so a hat sits on the skull
  shortMohawk: (p) => [path('M 183 138 C 177 114, 181 86, 200 76 C 219 86, 223 114, 217 138 Z', { fill: p.hairColor }), gloss('M 192 132 C 190 112, 192 94, 199 82', 2.2), gloss('M 208 134 C 210 114, 208 96, 202 84', 1.8)],
  receding: (p) => [path('M 127 163 C 126 125, 140 104, 166 98 C 172 112, 184 118, 200 114 C 216 118, 228 112, 234 98 C 260 104, 274 125, 273 163 C 251 139, 228 129, 200 129 C 172 129, 149 139, 127 163 Z', { fill: p.hairColor })], // the crown bare between two low tufts that follow the skull (tall narrow tufts read as horns on a narrow head)
  // the rest of the way bald, in the order it goes: the temples first (widowsPeak), then the top (horseshoe, with
  // combOver over it), and the whole head shaved down to the shadow hair leaves (shavedHead). A head that has lost
  // the top is the one case that needs the mass drawn behind the skull as well: the wreath is hair with a head in
  // front of it, and it shows past the sides as the volume it has. The front wings are its near side, on the head.
  widowsPeak: (p) => [path('M 126 163 C 124 121, 150 91, 199 90 C 247 91, 275 121, 274 163 C 268 148, 250 136, 232 131 C 223 136, 210 139, 200 146 C 190 139, 177 136, 168 131 C 150 136, 132 148, 126 163 Z', { fill: p.hairColor })], // the hairline gone at the temples with the centre holding: two gulfs and a point between them, the whole edge kept inside the head's own outline
  horseshoe: { back: (p) => WREATH(p), front: (p) => WINGS(p) },
  combOver: { back: (p) => WREATH(p), front: (p) => [...WINGS(p), path('M 131 146 C 158 116, 222 105, 273 130 C 279 154, 244 158, 206 159 C 176 164, 148 160, 131 146 Z', { fill: p.hairColor }), gloss('M 150 140 C 186 122, 232 122, 264 134', 2.6)] }, // the same wreath with the long side combed across the bare top
  shavedHead: (p) => CAP(p).map((o) => ({ ...o, op: 0.34 })), // shaved to the skin: the hair is only the shadow it leaves where it grows
};
export const HAIR_STYLES = Object.keys(HAIR);
const ON_SKIN = ['shavedHead']; // styles that are only a shadow on the scalp: clipped to the head's outline, or the cap's fitted crown stands clear above a flat-topped skull as a halo (T008)
export const LONG_HAIR = ['bob', 'bluntBob', 'longStraight']; // the styles that hang past the jaw: never on a long oval head, which they stretch further
const hairOf = (p) => { const r = HAIR[p.hair.style] ?? HAIR.sidePart; return typeof r === 'function' ? { back: [], front: r(p) } : { back: r.back(p), front: r.front(p) }; };

// Beards wrap the face they are on: the mass is a band whose top edge is the beard line (from the sideburn under the
// ear, down the cheek, under the mouth's corners and the lower lip) cut to this face's own outline let out a little
// (`hull`: wider at the jaw, longer under the chin), so a beard on a square jaw is square and one on a narrow chin is
// narrow. Drawn in the face's real coordinates (the eye line, the mouth), not fitted from a default beard.
// The beard's own silhouette, not the face's: the head's sides down to the cheekbone, then one curve each side out
// over the jaw's corner and round under the chin, `chin` below it. A copy of the face outline let out kept the face's
// straight cheek-to-jaw side, its corner and its flat chin, so every beard was a straight-sided box (T062).
const hull = (p, chin) => { const hw = (p.face.width / 2) * 1.03, ey = p.eyes.y, jawY = 112 + p.face.height - (p.face.corner ?? 32), jx = (p.face.width / 2) * p.face.jaw * 0.94 * 1.1, B = 112 + p.face.height + 16 * p.face.chin + chin;
  return `M ${200 - hw} ${ey - 20} L ${200 + hw} ${ey - 20} L ${200 + hw} 216 C ${200 + jx} ${jawY + 20}, ${200 + hw * 0.35} ${B}, 200 ${B} C ${200 - hw * 0.35} ${B}, ${200 - jx} ${jawY + 20}, ${200 - hw} 216 Z`; };
// top: the sideburn's y under the eye line; cheek: how far in from the outline the beard line runs (0..1 of the half width); lip: how far under the lower lip the beard starts; chin: how far the mass hangs past the chin; sharp: a straight, barbered line; width: how far out the band reaches (1 past the face, less for a beard that leaves the jaw's sides bare and sits round the mouth)
function beardBand(p, { top = 26, cheek = 0.1, lip = 9, chin = 6, sharp = false, op = 1, width = 1 } = {}) {
  const w = p.face.width / 2, ey = p.eyes.y, my = p.mouth.y, mw = p.mouth.width / 2, x0 = 200 - (w + 30) * width, x1 = 200 + (w + 30) * width, ya = ey + top, cx = Math.min(w * (1 - cheek), (w + 30) * width), c2 = w * 0.44; // c2: how tightly the beard line closes on the mouth. Swung wide it leaves the mouth sitting on a bare island in the middle of the beard, which is what a beard never looks like
  const band = sharp
    ? `M ${x0} ${ya} L ${200 - cx} ${ya} L ${200 - mw} ${my + lip * 0.25} Q 200 ${my + lip} ${200 + mw} ${my + lip * 0.25} L ${200 + cx} ${ya} L ${x1} ${ya} L ${x1} 700 L ${x0} 700 Z`
    : `M ${x0} ${ya} C ${200 - cx} ${ya}, ${200 - c2} ${my - 6}, ${200 - mw} ${my + lip * 0.25} Q 200 ${my + lip} ${200 + mw} ${my + lip * 0.25} C ${200 + c2} ${my - 6}, ${200 + cx} ${ya}, ${x1} ${ya} L ${x1} 700 L ${x0} 700 Z`;
  return [clip(hull(p, chin)), path(band, { fill: p.hairColor, op }), ...(op >= 0.5 ? [clip(band), ...strands(p, { from: [200, my + 10], a0: 0.4, a1: Math.PI - 0.4, len: 55, n: 16 }), UNCLIP] : []), UNCLIP]; // a stubble is a wash with no grain
}
const onMouth = (p, ops) => mapXY(ops, scaleAbout(200, p.mouth.width / 48), (y) => y + p.mouth.y - 260); // ops drawn for the default mouth (48 wide on the line 260) follow this one
/** Where the nose ends on this face: the underside of the tip, what a moustache hangs from. */
const noseBottom = (p) => { const st = NOSES[p.nose.style] ?? NOSES.straight; return p.eyes.y + 10 + (st.len + st.tip * 1.1) * (p.nose.length / 38); };
// A moustache is not a beard: it belongs to the features, so it lives in the gap between the nose's underside and
// the top of the upper lip, and it is laid out from those two, not from the mouth line alone (a long nose or a full
// lip would otherwise have it sitting on the lip or up the nostrils). Inside that band its lower edge still rides
// the lip's own curve (the same quadratic `mouth` draws, `2t(1-t)` of the centre's move, nothing at the tips), so a
// smile bows the hair down with the lip and an open mouth draws it up. `LIP_PULL` is how much of that move the hair
// takes: all of it on its own, less inside a beard, where the mass around it holds it.
export const LIP_PULL = 1, BEARD_PULL = 0.55;
// Each shape is one path drawn for the default mouth (48 wide): its top at 243, its lower edge on the lip line at
// 260, so `mustache` below can squeeze all of them into whatever gap this face's nose and lip leave.
export const MUSTACHES = {
  chevron: { d: 'M 175 252 C 184 243, 194 245, 200 251 C 206 245, 216 243, 225 252 C 216 254, 207 260, 200 258 C 193 260, 184 254, 175 252 Z' },
  walrus: { d: 'M 166 246 C 179 240, 192 244, 200 249 C 208 244, 221 240, 234 246 C 236 253, 231 259, 222 260 C 212 260, 206 257, 200 256 C 194 257, 188 260, 178 260 C 169 259, 164 253, 166 246 Z', w: 1.3 },
  handlebar: { d: 'M 172 245 C 168.5 238, 175 236, 177.5 242 C 181 247, 187.5 246, 193 245 C 196.5 244, 199 246, 200 248 C 201 246, 203.5 244, 207 245 C 212.5 246, 219 247, 222.5 242 C 225 236, 231.5 238, 228 245 C 223.5 255, 211 260, 203 259 L 197 259 C 189 260, 176.5 255, 172 245 Z' }, // a body as full as the chevron's on the lip, only its ends past the corners and turned up; drawn 56 wide, so no `w` over it (T001: a thin 64-wide bar scaled again by 1.35 was a stripe twice the mouth, clear of the lip)
  pencil: { d: 'M 180 253 C 188 250, 194 251, 200 253 C 206 251, 212 250, 220 253 C 212 258, 206 256, 200 255 C 194 256, 188 258, 180 253 Z', w: 0.86 },
  horseshoe: { d: 'M 172 246 C 182 242, 193 245, 200 250 C 207 245, 218 242, 228 246 C 231 252, 230 258, 227 260 C 224 254, 220 251, 214 250 C 208 250, 205 253, 200 254 C 195 253, 192 250, 186 250 C 180 251, 176 254, 173 260 C 170 258, 169 252, 172 246 Z', w: 1.2 },
};
export const MUSTACHE_STYLES = Object.keys(MUSTACHES);
const unit = (v) => Math.min(1, Math.max(0, v));
/** Where a moustache sits on this face: the gap it hangs in (top..bot, between the nostrils and the upper lip's own
 *  top edge, never squeezed to nothing), the mouth's half width and its own, which is wider on the fuller shapes. */
function stacheBox(p, style = 'chevron') {
  const m = p.mouth, st = MOUTHS[m.style] ?? MOUTHS.plain, sh = MUSTACHES[style] ?? MUSTACHES.chevron;
  const lipK = st.thin ? 0.45 : st.full ? 1.5 : 1, bot = m.y - (4 + 4 * m.fullness) * lipK - 1;
  return { mw: (m.width * (st.wide ?? 1)) / 2, hw: 25 * ((m.width * (st.wide ?? 1)) / 48) * (sh.w ?? 1), bot, top: Math.min(bot - 8, noseBottom(p) + 1) };
}
// The strip of hair down the corner of the mouth that joins a moustache to the beard under it. Without it the two are
// two marks with a wedge of bare skin between them, which is what a shaved gap looks like and not what a beard does;
// hair grows through that corner, so anything with both a moustache and a mass gets it. Tagged `stache`, since the
// corner of the mouth is a feature and travels with the features on a turned head.
const stacheJoin = (p, style, lip, op) => { const { mw, hw, bot } = stacheBox(p, style), y = p.mouth.y + lip * 0.4 + 3, x0 = Math.min(mw - 1, hw - 3);
  return [-1, 1].map((sd) => ({ ...path(`M ${200 + sd * x0} ${bot - 2} C ${200 + sd * (x0 + 7)} ${bot - 1} ${200 + sd * (x0 + 11)} ${y - 5} ${200 + sd * (x0 + 12)} ${y} L ${200 + sd * (x0 - 2)} ${y} C ${200 + sd * (x0 + 2)} ${y - 6} ${200 + sd * x0} ${bot + 2} ${200 + sd * x0} ${bot - 2} Z`, { fill: p.hairColor, op }), stache: true })); };
const mustache = (p, pull = LIP_PULL, op = 1, style = 'chevron') => {
  const m = p.mouth, st = MOUTHS[m.style] ?? MOUTHS.plain, hw = (m.width * (st.wide ?? 1)) / 2;
  const { top, bot } = stacheBox(p, style);
  const sh = MUSTACHES[style] ?? MUSTACHES.chevron; // the gap under the nose is only ever a few units tall, so what tells one moustache from another is mostly its width: each shape carries its own
  const ops = mapXY([path(sh.d, { fill: p.hairColor, op })], scaleAbout(200, ((m.width * (st.wide ?? 1)) / 48) * (sh.w ?? 1)), (y) => top + ((y - 243) * (bot - top)) / 17).map((o) => ({ ...o, stache: true })); // marked: on a turned head the moustache rides with the features, not with the jaw the beard sits on
  const { lift, ctl } = lipMove(m), drop = (ctl + lift) * pull, rise = lift * pull; // the parting: its ends up by the corners' lift, its middle bowed by the rest
  if (Math.abs(drop) < 0.2 && Math.abs(rise) < 0.2) return ops; // a resting mouth moves nothing
  return mapPts(ops, (x, y) => { const t = unit((x - 200 + hw) / (2 * hw)), d = unit((y - top) / (bot - top)); return [x, y + d * (2 * t * (1 - t) * drop - rise)]; });
};
// Each style is the band's shape and whether it carries a moustache; `facialHair`'s own dials (color, density,
// mustache, cheekLine) go over it, so the gap between a stubble and a beard is a number and not a missing style.
// The chin patch (goatee, vanDyke), drawn for the default mouth (48 wide on the line 260) and clipped to the chin: a tuft under the lip that fills out over the chin and tapers to it, curved sides, not a straight-sided box (T052)
const CHIN_PATCH = 'M 194 272 Q 200 276 206 272 Q 213 284 216 300 Q 219 314 213 324 L 208 327 L 205 333 L 200 330 L 195 335 L 192 327 L 187 324 Q 181 314 184 300 Q 187 284 194 272 Z';
const chinPatch = (q) => { const [patch] = onMouth(q, [path(CHIN_PATCH, { fill: q.hairColor })]); return [clip(hull(q, 8)), patch, clip(patch.d), ...strands(q, { from: [200, q.mouth.y + 8], a0: 1.25, a1: Math.PI - 1.25, len: 34, n: 7 }), UNCLIP, UNCLIP]; }; // the grain the full beard has, so the patch reads as hair
const BEARDS = {
  none: null,
  lightStubble: { op: 0.09, chin: 0, stubble: true, stache: true, stacheStyle: 'walrus' }, // a shadow of hair grows on the upper lip as well: a stubble with a shaved moustache is a choice, not the default (facialHair.mustache 0 makes it one) // a stubble is a shadow of hair, so it is never lighter than the skin: pale hair is pulled toward dark for it
  heavyStubble: { op: 0.2, chin: 0, stubble: true, stache: true, stacheStyle: 'walrus' },
  mustache: { band: false, stache: true, pull: LIP_PULL },
  shortBeard: { chin: 8, op: 0.92, stache: true },
  fullBeard: { top: 20, cheek: 0.02, lip: 7, chin: 40, stache: true },
  goatee: { band: false, stache: true, pull: (LIP_PULL + BEARD_PULL) / 2, chinPatch: true },
  boxedBeard: { top: 36, cheek: 0.26, lip: 13, chin: 10, sharp: true, stache: false },
  // the styles the moustache is half of: the hair round the mouth is the shape, and each names the moustache it is drawn with
  circleBeard: { top: 34, cheek: 0.5, lip: 9, chin: 8, width: 0.52, stache: true, stacheStyle: 'chevron' }, // the jaw's sides bare: a ring of hair round the mouth and chin
  vanDyke: { band: false, chinPatch: true, stache: true, pull: (LIP_PULL + BEARD_PULL) / 2, stacheStyle: 'handlebar' }, // the chin patch and the moustache, apart, with the ends turned up
  garibaldi: { top: 22, cheek: 0.02, lip: 6, chin: 64, stache: true, stacheStyle: 'walrus' }, // a long full beard under a moustache to match
  ducktail: { top: 28, cheek: 0.14, lip: 9, chin: 30, width: 0.86, stache: true, stacheStyle: 'chevron' }, // full at the jaw and drawn to a point below the chin
  stubbleStache: { op: 0.22, chin: 0, stubble: true, stache: true, pull: LIP_PULL, stacheStyle: 'horseshoe', stacheOp: 1 }, // the one the other way round: the beard is a shadow and the moustache is grown out, at its own full weight // a shadow of a beard with a real moustache standing in it
  pencilStache: { band: false, stache: true, pull: LIP_PULL, stacheStyle: 'pencil' },
};
/** One style's ops with the character's own dials applied: a density anywhere between a wash and a mass, a beard colour of its own, a moustache added or dropped, and how high the mass climbs the cheek. */
export function beardOps(p, spec) { // exported for a pack that registers a beard of its own (parts/dwarf.mjs): a spec shaped like a BEARDS entry
  if (!spec) return [];
  const f = p.facialHair ?? {}, color = f.color ?? p.hairColor, d = f.density == null ? null : unit(f.density);
  // Density is how much hair there is, not how solid the paint is: it is drawn opaque at every setting, thin hair
  // being the skin's own colour showing between it rather than the beard let down to a wash. A transparent beard
  // shows the mouth and the cheek's planes through itself, which reads as a stain and not as a thin beard, and on a
  // pale-haired face it is a dark smudge whichever way the hair goes. The two stubble styles keep their wash when no
  // density is asked for, since a stubble with no dial on it is a shadow of hair and drawn as one.
  const fill = d == null ? (spec.stubble ? mix(color, '#3a2a24', 0.45) : color) : mix(p.skin, color, 0.35 + 0.65 * d);
  const q = { ...p, hairColor: fill };
  const op = d == null ? spec.op ?? 1 : 1;
  const top = f.cheekLine == null ? spec.top : 46 - 32 * unit(f.cheekLine); // 0: a beard line low on the jaw; 1: up to the cheekbone
  const stache = f.mustache == null ? !!spec.stache : !!f.mustache, stacheStyle = f.mustacheStyle ?? spec.stacheStyle ?? 'chevron'; // the style's own moustache, or the one this face asks for over it
  return [
    ...(spec.band === false ? [] : beardBand(q, { top, cheek: spec.cheek, lip: spec.lip, chin: spec.chin, sharp: spec.sharp, width: spec.width, op })),
    ...(spec.chinPatch ? chinPatch(q) : []),
    ...(stache && spec.band !== false ? stacheJoin(q, stacheStyle, spec.lip ?? 14, op) : []), // the corners of the mouth, so the moustache and the mass under it are one beard
    ...(stache ? mustache(q, spec.pull ?? (spec.band === false ? LIP_PULL : BEARD_PULL), spec.stacheOp ?? op, stacheStyle) : []), // the moustache is the same hair: the beard's colour and the beard's weight
  ];
}
export const FACIAL_HAIR = Object.fromEntries(Object.entries(BEARDS).map(([name, spec]) => [name, (p) => beardOps(p, spec)]));
export const FACIAL_HAIR_STYLES = Object.keys(FACIAL_HAIR);

// glasses: drawn for eyes 68 apart on the line y = 196, fitted to the character's spacing and eye line
export const GLASSES = {
  rectangularThin: (c) => [rect(145, 183, 43, 27, { rx: 7, fill: 'none', stroke: c, sw: 2.4 }), rect(212, 183, 43, 27, { rx: 7, fill: 'none', stroke: c, sw: 2.4 }), line(188, 194, 212, 194, { stroke: c, sw: 2.4 })],
  rectangularBold: (c) => [rect(143, 181, 47, 30, { rx: 8, fill: 'none', stroke: c, sw: 4.6 }), rect(210, 181, 47, 30, { rx: 8, fill: 'none', stroke: c, sw: 4.6 }), line(190, 193, 210, 193, { stroke: c, sw: 4.2 })],
  round: (c) => [ellipse(166, 196, 22, 21, { fill: 'none', stroke: c, sw: 2.8 }), ellipse(234, 196, 22, 21, { fill: 'none', stroke: c, sw: 2.8 }), path('M 188 194 Q 200 189 212 194', stroke(c, 2.4))],
  browline: (c) => [path('M 143 184 L 190 184 L 188 208 L 147 208 Z', stroke(c, 2.2)), path('M 210 184 L 257 184 L 253 208 L 212 208 Z', stroke(c, 2.2)), line(144, 184, 190, 184, { stroke: c, sw: 5 }), line(210, 184, 256, 184, { stroke: c, sw: 5 }), line(190, 194, 210, 194, { stroke: c, sw: 2.2 })],
  aviator: (c) => [path('M 144 185 Q 166 179 188 185 L 184 209 Q 166 217 148 207 Z', stroke(c, 2.5)), path('M 212 185 Q 234 179 256 185 L 252 207 Q 234 217 216 209 Z', stroke(c, 2.5)), path('M 188 190 Q 200 182 212 190', stroke(c, 2.2))],
  rimless: () => [rect(145, 184, 43, 27, { rx: 8, fill: 'none', stroke: '#888', sw: 1, op: 0.55 }), rect(212, 184, 43, 27, { rx: 8, fill: 'none', stroke: '#888', sw: 1, op: 0.55 }), line(188, 195, 212, 195, { stroke: '#777', sw: 1.4 })],
  oversized: (c) => [rect(135, 174, 57, 42, { rx: 14, fill: 'none', stroke: c, sw: 3.4 }), rect(208, 174, 57, 42, { rx: 14, fill: 'none', stroke: c, sw: 3.4 }), line(192, 187, 208, 187, { stroke: c, sw: 3 })],
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
  bucketHat: (p) => [path('M 138 108 Q 200 77 262 108 L 272 141 Q 200 125 128 141 Z', { fill: p.hat.color }), path('M 88 139 Q 200 121 312 139 Q 200 170 88 139 Z', { fill: p.hat.accent }), path('M 104 146 Q 200 168 296 146', stroke('#000', 4, 0.12))],
  flatCap: (p) => [path('M 122 127 C 138 86, 171 73, 215 78 C 245 81, 267 95, 277 118 L 268 134 Q 200 123 122 134 Z', { fill: p.hat.color }), path('M 184 126 Q 248 119 289 132 Q 242 139 185 137 Z', { fill: p.hat.accent })],
  wideBrimFelt: (p) => [path('M 142 112 L 151 68 Q 200 50 249 68 L 258 112 Z', { fill: p.hat.color }), rect(146, 98, 108, 14, { rx: 3, fill: p.hat.accent }), path('M 74 118 Q 200 100 326 118 Q 200 150 74 118 Z', { fill: p.hat.color }), path('M 90 124 Q 200 148 310 124', stroke('#000', 4, 0.14))], // the brim seen from a little above: its front edge dips, and its underside is in shade
  cowboy: (p) => [path('M 145 115 L 155 62 Q 200 42 245 62 L 255 115 Z', { fill: p.hat.color }), path('M 90 119 C 119 128, 148 117, 170 113 L 230 113 C 252 117, 281 128, 310 119 C 292 145, 251 142, 200 136 C 149 142, 108 145, 90 119 Z', { fill: p.hat.color }), rect(148, 98, 104, 16, { fill: p.hat.accent })],
  sunHat: (p) => [path('M 128 126 C 132 74, 162 55, 200 55 C 238 55, 268 74, 272 126 Z', { fill: p.hat.color }), path('M 52 128 C 80 112, 120 104, 200 104 C 280 104, 320 112, 348 128 C 330 150, 300 138, 270 148 C 240 156, 220 140, 200 150 C 180 140, 160 156, 130 148 C 100 138, 70 150, 52 128 Z', { fill: p.hat.color }), path('M 52 128 C 80 112, 120 104, 200 104 C 280 104, 320 112, 348 128', stroke('#000', 2, 0.15)), rect(132, 104, 136, 16, { rx: 4, fill: p.hat.accent })],
  // a soft disc pulled down over one side, its far edge lifted off the head, with the nub on top: no crown seam, no brim
  beret: (p) => [path('M 116 132 C 110 96, 146 71, 202 71 C 254 71, 281 90, 279 120 C 262 133, 226 139, 188 138 C 158 137, 130 136, 116 132 Z', { fill: p.hat.color }), ellipse(207, 69, 6, 4.5, { fill: p.hat.accent }), path('M 134 133 Q 196 142 272 122', stroke(p.hat.accent, 4, 0.8, 'butt')), path('M 150 84 Q 198 76 246 88', stroke('#fff', 3, 0.07))],
  // a hood up: one path with the face opening wound the other way (a nonzero hole), from the crown down over the shoulders; its shadow rims the face
  hood: (p) => { // the outer shape with the face cut out (even-odd), the hole this head's own face a little larger, and the dark lining between the hole and the face, so the hood hugs any head; the hat fit scales its width
    const face = facePath({ face: { ...p.face, width: 156 } }), hole = mapXY([path(face)], scaleAbout(200, 1.07), scaleAbout(112 + p.face.height / 2, 1.04))[0].d;
    return [path(`M 200 40 C 282 40, 320 120, 312 236 C 310 296, 318 336, 338 386 L 62 386 C 82 336, 90 296, 88 236 C 80 120, 118 40, 200 40 Z ${hole}`, { fill: p.hat.color, rule: 'evenodd' }), path(`${hole} ${face}`, { fill: shade(p.hat.color, 0.32), rule: 'evenodd' }), path(hole, stroke('#000', 8, 0.22)), path('M 128 300 C 118 340, 104 360, 76 386', stroke('#000', 3, 0.14)), path('M 272 300 C 282 340, 296 360, 324 386', stroke('#000', 3, 0.14))];
  },
};
export const HAT_STYLES = Object.keys(HATS);
// where each hat's crown meets the head: hair above this line is inside the hat, so it is painted over in the hat's colour and the crown fits the hair
export const HAT_CROWN = { baseballCap: 137, dadCap: 137, snapback: 137, truckerCap: 137, beanie: 140, cuffedBeanie: 140, fishermanBeanie: 130, bucketHat: 141, flatCap: 134, wideBrimFelt: 120, cowboy: 122, sunHat: 128, beret: 133, hood: 400 };
export const HAT_HAIR = HAIR_STYLES.filter((s) => s !== 'highBun'); // the styles a hat can sit on
/** How far from the centre a hat reaches at its crown line: the widest x of any point of its ops within ten units of the line (80 when it has none there). Pass the crown alone to measure where the hat meets the head: a brim reaches far past it. */
export function hatWidth(ops, crown) {
  let hw = 0;
  for (const o of ops) {
    if (o.k === 'path') { let cmd = 'M', i = 0, x = 0; for (const t of tokens(o.d)) { if (/[a-z]/i.test(t)) { cmd = t.toUpperCase(); i = 0; continue; } if (i % 2 === 0) x = +t; else if (Math.abs(+t - crown) <= 10) hw = Math.max(hw, Math.abs(x - 200)); i++; } }
    else if (o.k === 'rect' && o.y <= crown + 10 && o.y + o.h >= crown - 10) hw = Math.max(hw, Math.abs(o.x - 200), Math.abs(o.x + o.w - 200));
    else if (o.k === 'ellipse' && Math.abs(o.cy - crown) <= o.ry + 10) hw = Math.max(hw, Math.abs(o.cx - 200) + o.rx);
  }
  return hw || 80;
}
/** How far the hair rises above the skull's top (y 112): the least y of its filled shapes, 0 for a bald head. What a hat has to go over, so what it sits on. */
export function hairLift(ops) {
  let top = 112;
  for (const o of ops) {
    if (o.k === 'path') { let i = 0; for (const t of tokens(o.d)) { if (/[a-z]/i.test(t)) { i = 0; continue; } if (i % 2 === 1) top = Math.min(top, +t); i++; } }
    else if (o.k === 'rect') top = Math.min(top, o.y);
    else if (o.k === 'ellipse') top = Math.min(top, o.cy - o.ry);
  }
  return 112 - top;
}

// tops: each draws its own torso, run past the sheet's bottom (480) so a tilted or lifted sheet shows no edge
const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill });
const dk = (op) => ({ fill: '#000', op }), dkl = (sw, op) => stroke('#000', sw, op, 'butt');
export const TOPS = {
  crewTshirt: (p) => [torso('M 78 480 C 91 397, 136 370, 166 359 L 234 359 C 264 370, 309 397, 322 480 Z', p.top.color), path('M 161 361 Q 200 389 239 361 Q 230 350 200 349 Q 170 350 161 361 Z', dk(0.13))],
  vneckTshirt: (p) => [torso('M 78 480 C 91 397, 136 370, 167 358 L 233 358 C 264 370, 309 397, 322 480 Z', p.top.color), path('M 165 359 L 200 398 L 235 359 Q 220 350 200 350 Q 180 350 165 359 Z', dk(0.17))],
  heavyweightTshirt: (p) => [torso('M 68 480 C 84 395, 132 366, 165 356 L 235 356 C 268 366, 316 395, 332 480 Z', p.top.color), path('M 158 359 Q 200 389 242 359', dkl(7, 0.14))],
  // an op marked `collar` is drawn a second time over the neck's accessories, so a chain goes under the collar
  // the placket carries the `collar` flag with the wings, so that under a jacket the shirt still shows between them instead of a wedge of the jacket
  polo: (p) => [torso('M 76 480 C 89 400, 132 369, 166 356 L 234 356 C 268 369, 311 400, 324 480 Z', p.top.color), path('M 192 377 L 208 377 L 220 407 L 180 407 Z', { fill: p.top.color, collar: true }), path('M 165 355 L 192 377 L 181 403 L 151 366 Z', { fill: p.top.color, collar: true }), path('M 235 355 L 208 377 L 219 403 L 249 366 Z', { fill: p.top.color, collar: true }), path('M 165 355 L 192 377 L 181 403 L 151 366 Z', { ...dk(0.12), collar: true }), path('M 235 355 L 208 377 L 219 403 L 249 366 Z', { ...dk(0.12), collar: true }), line(200, 375, 200, 419, dkl(2, 0.15))],
  henley: (p) => [torso('M 76 480 C 90 398, 134 370, 166 357 L 234 357 C 266 370, 310 398, 324 480 Z', p.top.color), path('M 163 360 Q 200 386 237 360', dkl(4, 0.14)), line(200, 368, 200, 414, dkl(2, 0.22)), ...[381, 393, 405].map((y) => ellipse(200, y, 2.3, 2.3, { fill: '#222', op: 0.55 }))],
  crewSweater: (p) => [torso('M 72 480 C 86 394, 130 365, 163 354 L 237 354 C 270 365, 314 394, 328 480 Z', p.top.color), path('M 159 356 Q 200 387 241 356', dkl(8, 0.1)), path('M 84 430 Q 200 416 316 430', stroke('#fff', 1.5, 0.04))],
  // a turtleneck is a tube around this neck, not a fixed one: it takes the neck's own width (plus a little slack, so a
  // tilted head does not push skin out past it) and its top sits just under the chin wherever the neck put it
  turtleneck: (p) => { const w = neckW(p) + 6, x1 = 200 - w / 2, x2 = 200 + w / 2, top = chinY(p) - 8; return [torso('M 73 480 C 87 395, 131 365, 165 353 L 235 353 C 269 365, 313 395, 327 480 Z', p.top.color), path(`M ${x1} ${top} L ${x2} ${top} L ${x2 + 7} 371 Q 200 388 ${x1 - 7} 371 Z`, { fill: p.top.color, collar: true, onNeck: true }), line(x1, top + 24, x2, top + 24, { ...dkl(2, 0.08), collar: true, onNeck: true })]; },
  hoodie: (p) => [torso('M 67 480 C 81 393, 127 365, 164 352 L 236 352 C 273 365, 319 393, 333 480 Z', p.top.color), path('M 144 372 C 138 334, 168 314, 200 312 C 232 314, 262 334, 256 372 Z', { fill: shade(p.top.color, 0.78), hood: true }), path('M 150 356 C 138 366, 134 388, 138 410 L 170 390 Q 200 406 230 390 L 262 410 C 266 388, 262 366, 250 356 Q 226 368, 200 370 Q 174 368, 150 356 Z', dk(0.11)), line(176, 380, 170, 432, stroke('#ddd', 2, 0.8)), line(224, 380, 230, 432, stroke('#ddd', 2, 0.8))], // the hood bunched behind the neck, the cowl's edge low on the chest: nothing of it in front of the neck
  buttonDown: (p) => [torso('M 74 480 C 88 397, 131 369, 164 356 L 236 356 C 269 369, 312 397, 326 480 Z', p.top.color), path('M 195 377 L 205 377 L 220 413 L 180 413 Z', { fill: p.top.color, collar: true }), path('M 164 356 L 195 377 L 181 409 L 150 365 Z', { fill: p.top.color, collar: true }), path('M 236 356 L 205 377 L 219 409 L 250 365 Z', { fill: p.top.color, collar: true }), path('M 164 356 L 195 377 L 181 409 L 150 365 Z', { fill: '#fff', op: 0.09, collar: true }), path('M 236 356 L 205 377 L 219 409 L 250 365 Z', { fill: '#fff', op: 0.09, collar: true }), line(200, 377, 200, 600, dkl(1.5, 0.14)), ...[399, 420, 441].map((y) => ellipse(200, y, 2, 2, { fill: '#222', op: 0.55 }))],
  // the editorial wardrobe: a bare torso, oversized shapes, sportswear piping, an open shirt
  bare: (p) => [torso('M 72 480 C 86 396, 132 368, 166 357 L 234 357 C 268 368, 314 396, 328 480 Z', p.skin), path('M 150 388 Q 176 378 198 392', dkl(2, 0.1)), path('M 250 388 Q 224 378 202 392', dkl(2, 0.1)), path('M 140 430 Q 170 470 200 452 Q 230 470 260 430', dkl(2.5, 0.07)), line(200, 405, 200, 500, dkl(2, 0.06))],
  tunic: (p) => [torso('M 48 480 C 56 390, 108 356, 160 345 L 240 345 C 292 356, 344 390, 352 480 Z', p.top.color), path('M 162 347 Q 200 372 238 347', dkl(6, 0.1)), line(146, 420, 138, 600, dkl(1.5, 0.06)), line(254, 420, 262, 600, dkl(1.5, 0.06))],
  hoodieBig: (p) => [torso('M 50 480 C 60 388, 110 356, 158 344 L 242 344 C 290 356, 340 388, 350 480 Z', p.top.color), path('M 138 376 C 132 332, 164 312, 200 310 C 236 312, 268 332, 262 376 Z', { fill: shade(p.top.color, 0.78), hood: true }), path('M 150 350 C 136 362, 130 386, 134 412 L 168 388 Q 200 406 232 388 L 266 412 C 270 386, 264 362, 250 350 Q 224 340 200 342 Q 176 340 150 350 Z', dk(0.11)), line(176, 380, 170, 440, stroke('#ddd', 2.4, 0.7)), line(224, 380, 230, 440, stroke('#ddd', 2.4, 0.7)), path('M 120 500 L 280 500 L 274 560 L 126 560 Z', dkl(1.5, 0.08))],
  trackTop: (p) => [torso('M 74 480 C 88 397, 131 369, 164 356 L 236 356 C 269 369, 312 397, 326 480 Z', p.top.color), path('M 96 440 C 106 400, 130 378, 160 362', stroke(p.top.accent ?? '#b3202a', 5, 1, 'butt')), path('M 304 440 C 294 400, 270 378, 240 362', stroke(p.top.accent ?? '#b3202a', 5, 1, 'butt')), path('M 168 358 L 200 386 L 232 358 L 226 350 L 200 372 L 174 350 Z', { fill: p.top.accent ?? '#b3202a' }), line(200, 386, 200, 470, stroke(p.top.accent ?? '#b3202a', 2, 0.6, 'butt'))],
  openShirt: (p) => [torso('M 72 480 C 86 396, 132 368, 164 356 L 236 356 C 268 368, 314 396, 328 480 Z', p.top.color), path('M 166 357 L 200 478 L 234 357 Z', { fill: p.skin }), path('M 170 366 L 200 470 L 200 400 Q 190 380 170 366 Z', dk(0.12)), path('M 164 356 L 200 478 L 178 478 L 150 372 Z', { fill: shade(p.top.color, 0.7) }), path('M 236 356 L 200 478 L 222 478 L 250 372 Z', { fill: shade(p.top.color, 0.7) }), path('M 155 392 Q 178 384 198 398', dkl(2, 0.1)), path('M 245 392 Q 222 384 202 398', dkl(2, 0.1))],
};
export const TOP_STYLES = Object.keys(TOPS);

export const JACKETS = {
  none: () => [],
  blazer: (p) => [path('M 71 480 C 81 403, 111 374, 161 354 L 193 480 L 200 700 L 60 700 Z', { fill: p.jacket.color }), path('M 329 480 C 319 403, 289 374, 239 354 L 207 480 L 200 700 L 340 700 Z', { fill: p.jacket.color }), path('M 160 354 L 198 387 L 176 424 L 149 369 Z', { fill: '#fff', op: 0.08 }), path('M 240 354 L 202 387 L 224 424 L 251 369 Z', { fill: '#fff', op: 0.08 })],
  denimJacket: (p) => [torso('M 68 480 C 80 395, 122 366, 161 351 L 239 351 C 278 366, 320 395, 332 480 Z', p.jacket.color), path('M 163 352 L 198 380 L 180 410 L 146 365 Z', { fill: '#fff', op: 0.07 }), path('M 237 352 L 202 380 L 220 410 L 254 365 Z', { fill: '#fff', op: 0.07 }), line(200, 381, 200, 600, stroke('#222', 2, 0.25, 'butt')), rect(109, 414, 57, 42, { rx: 3, fill: 'none', stroke: '#222', sw: 1.5, op: 0.2 }), rect(234, 414, 57, 42, { rx: 3, fill: 'none', stroke: '#222', sw: 1.5, op: 0.2 })],
  bomber: (p) => [torso('M 62 480 C 71 398, 120 361, 163 351 L 237 351 C 280 361, 329 398, 338 480 Z', p.jacket.color), line(200, 358, 200, 600, stroke('#1e2021', 4, 0.55, 'butt')), path('M 162 352 Q 200 385 238 352', stroke('#1d1e20', 9, 0.35, 'butt'))],
  leatherJacket: (p) => [torso('M 63 480 C 74 392, 119 361, 160 348 L 240 348 C 281 361, 326 392, 337 480 Z', p.jacket.color), path('M 160 349 L 202 385 L 178 424 L 146 367 Z', { fill: '#fff', op: 0.06 }), path('M 240 349 L 198 385 L 222 424 L 254 367 Z', { fill: '#fff', op: 0.06 }), line(199, 383, 182, 480, stroke('#111', 3, 0.42, 'butt'))],
  puffer: (p) => [torso('M 56 480 C 62 390, 111 358, 160 348 L 240 348 C 289 358, 338 390, 344 480 Z', p.jacket.color), ...[385, 408, 431, 454, 477].map((y) => line(80, y, 320, y, dkl(2, 0.12))), line(200, 352, 200, 600, stroke('#111', 3, 0.25, 'butt'))],
  fieldJacket: (p) => [torso('M 67 480 C 79 395, 121 363, 161 351 L 239 351 C 279 363, 321 395, 333 480 Z', p.jacket.color), line(200, 358, 200, 600, stroke('#111', 2, 0.18, 'butt')), rect(102, 412, 61, 47, { rx: 3, fill: 'none', stroke: '#111', sw: 1.7, op: 0.19 }), rect(237, 412, 61, 47, { rx: 3, fill: 'none', stroke: '#111', sw: 1.7, op: 0.19 })],
  openJacket: (p) => [path('M 66 480 C 76 400, 108 372, 158 352 L 172 480 L 168 700 L 56 700 Z', { fill: p.jacket.color }), path('M 334 480 C 324 400, 292 372, 242 352 L 228 480 L 232 700 L 344 700 Z', { fill: p.jacket.color }), path('M 158 352 L 176 392 L 172 480 L 150 372 Z', { fill: '#000', op: 0.18 }), path('M 242 352 L 224 392 L 228 480 L 250 372 Z', { fill: '#000', op: 0.18 })], // hanging open: the chest shows between the panels
  // a closed overcoat: heavy enough to carry wide notched lapels, a double-breasted front and a belt at the waist
  trenchCoat: (p) => [torso('M 56 480 C 66 386, 114 356, 158 346 L 242 346 C 286 356, 334 386, 344 480 Z', p.jacket.color), path('M 158 347 L 202 396 L 172 452 L 134 364 Z', { fill: shade(p.jacket.color, 1.2) }), path('M 242 347 L 198 396 L 228 452 L 266 364 Z', { fill: shade(p.jacket.color, 1.2) }), path('M 158 347 L 202 396 L 172 452', stroke(shade(p.jacket.color, 0.6), 2.5, 0.9, 'butt')), path('M 242 347 L 198 396 L 228 452', stroke(shade(p.jacket.color, 0.6), 2.5, 0.9, 'butt')), path('M 134 364 L 158 347', stroke(shade(p.jacket.color, 0.6), 2, 0.7)), path('M 266 364 L 242 347', stroke(shade(p.jacket.color, 0.6), 2, 0.7)), rect(62, 456, 276, 24, { fill: shade(p.jacket.color, 0.62) }), rect(184, 450, 32, 34, { rx: 3, fill: shade(p.jacket.color, 0.42) }), ...[[176, 412], [224, 412], [176, 438], [224, 438]].map(([x, y]) => ellipse(x, y, 3.2, 3.2, { fill: '#1d1c1a', op: 0.55 }))], // wide notched lapels rolling open off the shoulder, a double-breasted front and a belt at the waist
  // a waistcoat has no sleeves, so it is narrower than the shirt it goes over: two panels meeting under a deep V, the shirt showing at the shoulders and in the opening
  waistcoat: (p) => [path('M 116 480 C 122 412, 146 380, 165 359 L 196 442 L 196 700 L 116 700 Z', { fill: p.jacket.color }), path('M 284 480 C 278 412, 254 380, 235 359 L 204 442 L 204 700 L 284 700 Z', { fill: p.jacket.color }), path('M 165 360 L 190 400 L 180 434 L 152 372 Z', { fill: '#fff', op: 0.07 }), path('M 235 360 L 210 400 L 220 434 L 248 372 Z', { fill: '#fff', op: 0.07 }), ...[458, 480, 502].map((y) => ellipse(200, y, 2.6, 2.6, { fill: '#1d1c1a', op: 0.55 }))],
};
export const JACKET_STYLES = Object.keys(JACKETS);

// accessories: `at` says where in the stack each is drawn (neck: over the collar; ear: on the ears; over: over the hat and hair)
export const ACCESSORIES = {
  studEarringLeft: { at: 'ear', ops: () => [ellipse(119, 222, 3.2, 3.2, { fill: '#b8b5ad', stroke: '#666', sw: 0.7 })] },
  studEarringRight: { at: 'ear', ops: () => [ellipse(281, 222, 3.2, 3.2, { fill: '#b8b5ad', stroke: '#666', sw: 0.7 })] },
  hoopLeft: { at: 'ear', ops: () => [ellipse(118, 230, 8, 12, { fill: 'none', stroke: '#a59b83', sw: 2.2 })] },
  hoopRight: { at: 'ear', ops: () => [ellipse(282, 230, 8, 12, { fill: 'none', stroke: '#a59b83', sw: 2.2 })] },
  earbuds: { at: 'ear', ops: () => [ellipse(120, 213, 4, 7, { fill: '#e3e3df' }), ellipse(280, 213, 4, 7, { fill: '#e3e3df' }), line(120, 218, 119, 230, stroke('#ddd', 2)), line(280, 218, 281, 230, stroke('#ddd', 2))] },
  studRowLeft: { at: 'ear', ops: () => [[121, 207], [119, 216], [119, 225]].map(([x, y]) => ellipse(x, y, 2.2, 2.2, { fill: '#c9c4ba', stroke: '#6f6a62', sw: 0.6 })) }, // three studs up the lobe and the helix
  studRowRight: { at: 'ear', ops: () => [[279, 207], [281, 216], [281, 225]].map(([x, y]) => ellipse(x, y, 2.2, 2.2, { fill: '#c9c4ba', stroke: '#6f6a62', sw: 0.6 })) },
  earCuffLeft: { at: 'ear', ops: () => [path('M 124 200 Q 114 206 117 214', stroke('#b2a98f', 3.2)), path('M 124 201 Q 116 206 118 213', stroke('#e6dcbd', 1.1, 0.6))] }, // a band clamped on the upper helix, with a lit edge
  earCuffRight: { at: 'ear', ops: () => [path('M 276 200 Q 286 206 283 214', stroke('#b2a98f', 3.2)), path('M 276 201 Q 284 206 282 213', stroke('#e6dcbd', 1.1, 0.6))] },
  overEarHeadphones: { at: 'over', ops: () => [path('M 121 206 C 108 153, 131 111, 200 105 C 269 111, 292 153, 279 206', stroke('#303438', 10)), rect(106, 188, 24, 48, { rx: 10, fill: '#26292c' }), rect(270, 188, 24, 48, { rx: 10, fill: '#26292c' })] },
  tie: { at: 'tie', ops: (p) => [path('M 192 370 L 208 370 L 213 384 L 205 462 L 195 462 L 187 384 Z', { fill: p.top.accent ?? '#b3202a' }), path('M 192 370 L 208 370 L 205 380 L 195 380 Z', { fill: '#000', op: 0.25 })] },
};
export const ACCESSORY_STYLES = Object.keys(ACCESSORIES);
const accessories = (p, at) => p.accessories.flatMap((n) => (ACCESSORIES[n]?.at === at ? ACCESSORIES[n].ops(p) : []));

// The editorial layers, each a registry of { [slot]: (p) => ops, fit? }: `slot` says where in the stack the ops go
// (back: behind the figure; body: over the garments, under the head; neck: on the neck; skin: on the face under the features; face: over the
// features, under the beard and hair; mouth: what comes out of the mouth (a tusk, a fang), over the lips and over the
// beard and moustache too; over: over the hat; front: over everything, inside the body's sway), `fit`
// what a slot's ops follow ('eyes': the eye spacing and line, 'face': the face width; a string for every slot or a
// map by slot; unset: drawn as written, for ops that already read the head). MAKEUP: paint on the face. MARKS:
// tattoos and body markings. PROPS: what the hands hold and do (simple sleeves and hands, editorial geometry, no
// skeleton). GRAPHICS: a print on the torso, clipped to the top. All abstract and original: no words, no logos.
const facePaint = (fill, op = 1) => ({ fill, op });
const INKL = (sw, op = 0.7, color = '#1c1a1e') => stroke(color, sw, op);
const PALE = '#ece6e0', BLACKP = '#141216', REDP = '#b3202a', GOLDP = '#d9b34a';
// a physical mask, not paint: a hard shell a little inside the face outline (skin shows at its rim), a dark edge, its
// own shading (a shadow down the far side, a sheen on the lit cheek) and dark holes the wearer's eyes look out of;
// on the skin slot, so the eyes and nose come over it; the wearer's mouth does not (portraitOps drops it under a
// mask), so a mask with no graphic of its own gets a painted mouth that never moves (`mouth`)
const maskOf = (p, fill, op = 0.94, mouth = false) => {
  const cy = 112 + p.face.height / 2, ex = p.eyes.spacing / 2, ey = p.eyes.y, side = p.light.side, my = p.mouth.y;
  const shell = mapXY([path(facePath({ face: { ...p.face, skew: 0, asym: {} } }))], scaleAbout(200, 0.955), scaleAbout(cy, 0.965))[0].d; // a mask is a made thing: a perfect symmetric curve, none of the face's own irregularity
  return [path(shell, facePaint(fill, op)), path(shell, stroke('#000', 2.4, 0.22)),
    ellipse(200 - 34 * side, cy + 10, 30, 62, facePaint('#000', 0.09)), path(`M ${200 + 22 * side} ${ey + 20} Q ${200 + 46 * side} ${ey + 46} ${200 + 40 * side} ${ey + 76}`, stroke('#fff', 9, 0.12)),
    ellipse(200 - ex, ey, 21, 13, facePaint('#1a1418', 0.5)), ellipse(200 + ex, ey, 21, 13, facePaint('#1a1418', 0.5)),
    ...(mouth ? [path(`M 182 ${my} Q 200 ${my + 3} 218 ${my}`, stroke('#2a1a1c', 1.6, 0.4))] : [])];
};
const maskHoles = (p) => [ellipse(200 - p.eyes.spacing / 2, p.eyes.y, 21, 13), ellipse(200 + p.eyes.spacing / 2, p.eyes.y, 21, 13)].map(ellipsePath).join(' '); // the two holes of `maskOf`, as one clip: all the wearer shows through a mask
const faceY = (p) => { const k = (p.face?.height ?? 204) / 204; return (y) => 112 + (y - 112) * k; }; // a y authored for the 204-tall head, on this face
const hollows = (p, op) => mapXY([path('M 126 232 Q 158 262 178 298 Q 148 270 126 232 Z', facePaint('#4a2a24', op)), path('M 274 232 Q 242 262 222 298 Q 252 270 274 232 Z', facePaint('#4a2a24', op))], scaleAbout(200, p.face.width / 156), faceY(p)); // the cheeks sucked in under the bone
const onEyes = (p, ops) => mapXY(ops, scaleAbout(200, p.eyes.spacing / 68), (y) => y + p.eyes.y - 196); // ops drawn for the default eyes follow this pair
export const MAKEUP = {
  none: {},
  // makeup, kept on the model: paint is thin enough for the face to read through it, and the modelling goes back on over it
  whiteMaskBase: { mask: true, skin: (p) => maskOf(p, '#f3f0ea', 0.94, true) },
  darkEyeSockets: { fit: 'eyes', skin: () => [ellipse(166, 198, 25, 17, facePaint('#2b1c26', 0.6)), ellipse(234, 198, 25, 17, facePaint('#2b1c26', 0.6))] },
  heavyUnderEye: { fit: 'eyes', skin: () => [path('M 144 204 Q 166 230 188 204 Q 166 216 144 204 Z', facePaint('#3b2331', 0.55)), path('M 212 204 Q 234 230 256 204 Q 234 216 212 204 Z', facePaint('#3b2331', 0.55))] },
  sharpEditorialEyes: { fit: 'eyes', face: () => [path('M 188 194 Q 174 184 160 191 L 148 183', stroke(BLACKP, 3.2)), path('M 212 194 Q 226 184 240 191 L 252 183', stroke(BLACKP, 3.2))] },
  blackLipLine: { face: (p) => [path(`M ${200 - p.mouth.width / 2} ${p.mouth.y} Q 200 ${p.mouth.y + 4} ${200 + p.mouth.width / 2} ${p.mouth.y}`, stroke(BLACKP, 3.6)), line(200, p.mouth.y + 6, 200, p.mouth.y + 42, stroke(BLACKP, 3))] },
  geometricEyePaint: { fit: 'eyes', face: () => [path('M 212 168 L 258 168 L 236 226 Z', facePaint(BLACKP, 0.86)), rect(144, 191, 44, 9, facePaint(BLACKP, 0.86))] },
  // a half mask: a hard shell over one side of the face with an eye hole cut in it, taking the face's own outline
  // (clipped to it, and its division drawn from the real crown to the real chin), so it covers exactly half of any
  // head instead of a fixed polygon that misses a long chin and overruns a short one
  asymmetricGraphicPaint: { face: (p) => { const top = 112, bot = 112 + p.face.height + 16 * p.face.chin, x = 200 + 10, hole = ellipsePath({ cx: 200 - p.eyes.spacing / 2, cy: p.eyes.y, rx: 20, ry: 13 });
    const half = `M 20 ${top - 20} L ${x} ${top - 20} L ${x - 24} ${bot + 20} L 20 ${bot + 20} Z`;
    return [clip(facePath(p)), path(`${half} ${hole}`, { ...facePaint(BLACKP, 0.88), rule: 'evenodd' }), path(`M ${x} ${top - 20} L ${x - 24} ${bot + 20}`, stroke('#000', 3, 0.45)), path(hole, stroke('#000', 2.5, 0.35)), UNCLIP]; } },
  // the clown faces are masks with their graphics on the shell, under the eyes, so the wearer looks out through them
  clownGraphic: { mask: true, skin: (p) => [...maskOf(p, '#f3f0ea'), ...onEyes(p, [path('M 166 170 L 188 197 L 166 224 L 144 197 Z', facePaint(BLACKP, 0.9)), path('M 234 170 L 256 197 L 234 224 L 212 197 Z', facePaint(BLACKP, 0.9))]), rect(191, p.mouth.y - 8, 18, 16, facePaint(REDP, 0.9))] },
  smearedClown: { mask: true, skin: (p) => [...maskOf(p, '#efe9e2', 0.9), ...onEyes(p, [path('M 150 240 C 170 232, 186 250, 176 268 C 166 276, 150 262, 150 240 Z', facePaint(REDP, 0.4)), path('M 250 240 C 230 232, 214 250, 224 268 C 234 276, 250 262, 250 240 Z', facePaint(REDP, 0.4)), path('M 146 180 C 160 176, 178 186, 186 208 C 172 214, 154 206, 146 180 Z', facePaint(BLACKP, 0.75)), path('M 254 180 C 240 176, 222 186, 214 208 C 228 214, 246 206, 254 180 Z', facePaint(BLACKP, 0.75))])], face: (p) => [path(`M 184 ${p.mouth.y - 6} Q 200 ${p.mouth.y + 14} 216 ${p.mouth.y - 6}`, stroke(REDP, 6, 0.6))] },
  severeContour: { skin: (p) => hollows(p, 0.32) },
  metallicEyeAccent: { fit: 'eyes', face: () => [path('M 148 186 Q 166 175 184 186', stroke(GOLDP, 4.5, 0.85)), path('M 216 186 Q 234 175 252 186', stroke(GOLDP, 4.5, 0.85))] },
  foreheadMark: { face: (p) => { const by = p.eyes.y - p.eyes.browLift; return [ellipse(200, by - 46, 6, 6, { fill: 'none', stroke: BLACKP, sw: 2.2 }), line(200, by - 38, 200, by - 24, stroke(BLACKP, 2.2))]; } }, // between and above the brows, wherever this face carries them, so it never lands on one
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
const sleeveColor = (p) => { if (p.jacket.style !== 'none') return p.jacket.color; if (p.top.style === 'bare') return p.skin; const own = TOPS[p.top.style]?.sleeve; return own ? (typeof own === 'function' ? own(p) : own) : p.top.color; }; // a top may carry `sleeve` (a colour, or a function of the person): a sleeveless garment worn over a shirt shows the shirt's sleeves
// an arm: the shoulder cap (a deltoid in the sleeve's colour over the torso's shoulder, lifted when the arm is raised), the upper arm to an
// elbow and the forearm to a wrist, both at arm thickness, and a mitten hand carrying on past the wrist; `side` +1 is the character's right (+x)
const ARM_W = 58, FORE_W = 52, SHOULDER = (side) => [200 + 86 * side, 398];
const mitten = (p, x, y, a, k0 = 1) => { const k = k0 * bld(p).hands; const c = Math.cos(a), sn = Math.sin(a), at = (dx, dy) => [x + (dx * c - dy * sn) * k, y + (dx * sn + dy * c) * k], col = handColor(p), f = at(11, 0), t = at(2, -14); return [ellipse(x, y, 15 * k, 17 * k, { fill: col }), ellipse(f[0], f[1], 12 * k, 12 * k, { fill: col }), ellipse(t[0], t[1], 6.5 * k, 8 * k, { fill: col })]; };
/** An arm from the shoulder on `side` through `elbow` to `wrist` (sheet points), with a hand unless `hand` is false. The upper arm and the forearm are round tubes from the joint; over the joint sits the deltoid, a soft bulge that continues the trunk's own shoulder curve out over the top of the arm and fades into it, so the arm grows out of a shoulder rather than hanging off a corner. No outline: a highlight along the top of the shoulder, a soft shadow where the upper arm meets the chest, and a soft edge under the forearm so a sleeve the colour of the shirt still reads against the body. `lift` moves the joint up and out as the arm rises. */
export function arm(p, side, { lift = 0, elbow, wrist, hand = true, clear }) {
  if (clear != null) { elbow = [handsOut(p, side, elbow[0], clear + 4), elbow[1]]; wrist = [handsOut(p, side, wrist[0], clear), wrist[1]]; } // a raised hand kept `clear` outside the face edge, as handsUp's are (T073: a claw on the eye, a hand on the brim)
  const [sx0, sy0] = SHOULDER(side), sx = sx0 - (16 - 24 * lift) * side, sy = sy0 - 8 * lift, col = sleeveColor(p), ak = bld(p).arms, dark = shade(col, 0.5);
  const [ex, ey] = ak === 1 ? elbow : [sx + (elbow[0] - sx) * ak, sy + (elbow[1] - sy) * ak], [wx, wy] = ak === 1 ? wrist : [sx + (wrist[0] - sx) * ak, sy + (wrist[1] - sy) * ak]; // the arm's length is the build's, about the joint
  const dx = wx - ex, dy = wy - ey, L = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx), hx = wx + (dx / L) * 16, hy = wy + (dy / L) * 16;
  const ux0 = ex - sx, uy0 = ey - sy, UL = Math.hypot(ux0, uy0) || 1, ux = ux0 / UL, uy = uy0 / UL; let nx = -uy, ny = ux; if (nx * side < 0) { nx = -nx; ny = -ny; } // along the upper arm, and its outward normal
  const P = (x, y) => `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
  const t0 = [200 + 60 * side, 356], t1 = [sx + nx * 31 - ux * 4, sy + ny * 31 - uy * 4], jo = [sx + ux * 46 + nx * 29, sy + uy * 46 + ny * 29], jc = [sx + ux * 46, sy + uy * 46], ap = [200 + 84 * side, 436]; // the deltoid: from the trunk's shoulder top, over the joint to the arm's outer edge a little down it, back under the tube to the armpit
  const delt = `M ${P(...t0)} C ${P(200 + 88 * side, 344)}, ${P(t1[0] - ux * 16 + nx * 6, t1[1] - uy * 16 + ny * 6)}, ${P(...t1)} Q ${P(sx + nx * 34 + ux * 22, sy + ny * 34 + uy * 22)} ${P(...jo)} L ${P(...jc)} L ${P(...ap)} Z`;
  return [
    line(ex, ey, wx, wy, stroke(dark, FORE_W + 4, 0.25)), // a soft edge under the forearm
    path(delt, { fill: col }), line(sx, sy, ex, ey, stroke(col, ARM_W)), // the shoulder, and the upper arm's tube from the joint
    path(`M ${P(...t0)} C ${P(200 + 88 * side, 346)}, ${P(t1[0] - ux * 16 + nx * 4, t1[1] - uy * 16 + ny * 4)}, ${P(...t1)}`, stroke('#fff', 5, 0.1)), // the light on the top of the shoulder
    path(`M ${P(...ap)} L ${P(ex - nx * 24, ey - ny * 24)}`, stroke('#000', 10, 0.06)), path(`M ${P(...ap)} L ${P(ex - nx * 24, ey - ny * 24)}`, stroke('#000', 4, 0.07)), // a soft shadow where the arm meets the chest, no line
    ...(lift > 0.5 ? [path(`M ${P(sx - 18 * side, sy + 18)} Q ${P(sx, sy + 30)} ${P(sx + 14 * side, sy + 20)}`, stroke('#000', 2.5, 0.09))] : []), // the crease under a lifted arm
    line(ex, ey, wx, wy, stroke(col, FORE_W)),
    ellipse(ex, ey, 9, 7, { fill: '#000', op: 0.07 }), // the elbow
    ...(typeof hand === 'function' ? hand(wx, wy) : hand ? mitten(p, hx + (dx / L) * 4, hy + (dy / L) * 4, a, 1.25) : []), // a function draws its own hand at the wrist as drawn (a claw)
  ];
}
/** A raised arm's x (arm space, as `arm` takes it) that lands at least `gap` outside the face edge on the sheet. `arm` scales the point about the shoulder by the build's arms and the body maps it about 200 by the shoulders' width, while the head scales by its own: a short-armed people with a big head (a halfling) would otherwise put its hands on its cheeks. A broad, long-armed people (a dragonborn, an orc: shoulders 1.44 times a body up to 1.28) would carry the point as far out again as its shoulders, past the figure's frame, so the reach is capped at a human's of the same body width: up is beside the head, not a span. A human's point is already clear and inside its own reach and comes back unchanged. */
const handsOut = (p, side, x, gap) => {
  const b = bld(p), bw = p.body.width * b.shoulders, sx = 200 + 94 * side; // the lifted shoulder joint (SHOULDER less the lift's inset)
  const sheet = 200 + (sx + (x - sx) * b.arms - 200) * bw, clear = (p.face.width / 2) * b.head + gap;
  const off = Math.max(clear, Math.min(Math.abs(sheet - 200), Math.abs(x - 200) * p.body.width)); // clear of the face, within a human's reach
  if (off === Math.abs(sheet - 200)) return x;
  return sx + (200 + (Math.sign(x - 200) * off) / bw - sx) / b.arms; // the point's own side: a far arm reaching across keeps to the side it reached
};
const sleeve = (p, x0, y0, x1, y1, sw = 34) => line(x0, y0, x1, y1, stroke(sleeveColor(p), sw));
const hand = (p, x, y, a = 0, k = 1) => mitten(p, x, y, a - Math.PI / 2, k);
const GOLD_OBJ = (cx, cy, r) => [ellipse(cx, cy, r, r, { fill: '#b8892b' }), ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.35, r * 0.25, { fill: '#fff3c8', op: 0.7 }), ellipse(cx + r * 0.25, cy + r * 0.3, r * 0.5, r * 0.4, { fill: '#6e4d12', op: 0.35 })];
const stem = (x0, y0, x1, y1) => [line(x0, y0, x1, y1, stroke('#3e5a2e', 4)), path(`M ${(x0 + x1) / 2} ${(y0 + y1) / 2} Q ${(x0 + x1) / 2 - 18} ${(y0 + y1) / 2 - 12} ${(x0 + x1) / 2 - 22} ${(y0 + y1) / 2 + 4} Z`, { fill: '#4d6e38' })];
const petals = (cx, cy, color, n = 6, r = 12) => [...Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return ellipse(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75, r * 0.55, r * 0.35, { fill: color }); }), ellipse(cx, cy, r * 0.35, r * 0.35, { fill: '#3a2410' })];
export const PROPS = {
  none: {},
  handsAtSides: {},
  gloves: {}, // hands at the sides are below the sheet; gloves show on whatever the hands do hold (handColor)
  chain: { neck: () => [path('M 150 368 Q 200 424 250 368', stroke('#c9a03c', 7)), path('M 150 368 Q 200 424 250 368', stroke('#fff0c0', 2, 0.5)), ellipse(200, 396, 9, 11, { fill: '#c9a03c' })] },
  flamingFlower: { arms: [1], front: (p) => [...arm(p, 1, { lift: 0.35, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), ...stem(262, 458, 272, 386), ...petals(274, 380, '#b3202a'), path('M 274 362 C 260 344, 268 322, 276 306 C 280 324, 294 336, 286 352 C 298 340, 298 328, 294 316 C 304 336, 298 358, 274 362 Z', { fill: '#e8862a' }), path('M 274 358 C 266 344, 272 330, 276 322 C 280 334, 286 342, 282 352 Z', { fill: '#ffd94a' })] },
  flower: { arms: [1], front: (p) => [...arm(p, 1, { lift: 0.35, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), ...stem(262, 458, 272, 386), ...petals(274, 380, '#efe6d6', 7, 14)] },
  sunglassesInHand: { arms: [1], front: (p) => [...arm(p, 1, { lift: 0.35, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), rect(230, 444, 22, 15, { rx: 6, fill: '#141216' }), rect(256, 444, 22, 15, { rx: 6, fill: '#141216' }), line(252, 449, 256, 449, stroke('#141216', 2.5))] },
  ceremonialObject: { arms: [-1, 1], front: (p) => [...arm(p, -1, { lift: 0.35, elbow: [98, 486], wrist: [172, 474], hand: false }), ...arm(p, 1, { lift: 0.35, elbow: [302, 486], wrist: [228, 474], hand: false }), ...hand(p, 178, 472, 0.6), ...hand(p, 222, 472, -0.6), path('M 178 436 L 222 436 L 214 466 L 186 466 Z', { fill: '#b8892b' }), rect(190, 466, 20, 8, { fill: '#8a6519' }), line(184, 442, 216, 442, stroke('#fff3c8', 1.5, 0.6))] },
  abstractGoldObject: { arms: [1], front: (p) => [...arm(p, 1, { lift: 0.35, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), ...GOLD_OBJ(250, 432, 24)] },
  abstractToyLikeProp: { arms: [1], front: (p) => [...arm(p, 1, { lift: 0.35, elbow: [302, 486], wrist: [262, 470], hand: false }), ...hand(p, 258, 466, -0.9), rect(240, 420, 28, 32, { rx: 5, fill: '#b3202a' }), ellipse(248, 432, 3.5, 3.5, { fill: '#fff' }), ellipse(260, 432, 3.5, 3.5, { fill: '#fff' }), rect(246, 442, 16, 4, { fill: '#fff' })] },
  handHeartGesture: { arms: [-1, 1], front: (p) => [...arm(p, -1, { lift: 0.35, elbow: [96, 490], wrist: [176, 476], hand: false }), ...arm(p, 1, { lift: 0.35, elbow: [304, 490], wrist: [224, 476], hand: false }), path('M 200 498 C 172 480, 160 452, 178 442 C 188 437, 197 443, 200 452 C 203 443, 212 437, 222 442 C 240 452, 228 480, 200 498 Z', stroke(handColor(p), 19)), path('M 200 494 C 176 478, 166 456, 180 448 C 190 444, 198 449, 200 458 C 202 449, 210 444, 220 448 C 234 456, 224 478, 200 494 Z', { fill: '#000', op: 0.16 })] },
  handsUp: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [handsOut(p, -1, 34, 32), 326], wrist: [handsOut(p, -1, 42, 24), 196] }), ...arm(p, 1, { lift: 1, elbow: [handsOut(p, 1, 366, 32), 326], wrist: [handsOut(p, 1, 358, 24), 196] })] }, // both shoulders lifted, elbows wide and forearms upright, palms beside the head clear of the face and the hat: this figure's arms (about 4.6 heads tall) cannot reach over the crown, so up is beside it, not on it
  armRaised: { lift: [1], front: (p) => [...arm(p, 1, { lift: 1, elbow: [332, 296], wrist: [312, 184], clear: 40 })] },
};
export const PROP_STYLES = Object.keys(PROPS);
// The body is a figure: a trunk the body's own width (shoulders rounded at the joint, the sides straight to the hip),
// arms from the shoulder joints, legs from the hips. Every garment is clipped to the trunk (a top to the hem at 640,
// a jacket to 690) instead of drawing its own wide torso, so the shirt is the body's width and the sleeves make the
// figure's width; the legs are drawn under the hem in the trousers' cloth, the shoes under them.
export const TRUNK = (bottom, k = 1) => { const t = (y) => SHOULDER_LINE + (y - SHOULDER_LINE) * k; return `M 200 330 L 136 352 C 112 362, 100 380, 100 ${t(404)} L 102 ${t(520)} C 102 ${t(580)}, 108 ${t(620)}, 112 ${t(bottom)} L 288 ${t(bottom)} C 292 ${t(620)}, 298 ${t(580)}, 298 ${t(520)} L 300 ${t(404)} C 300 380, 288 362, 264 352 Z`; }; // k: the trunk's height below the shoulder line (build.trunk)
export const FEET_Y = 1078; // where the shoes meet the floor, on the figure as drawn
const LEG_TOP = 596; // the legs start under the hem (the trousers' waist)
/** Where this figure's shoes meet the floor: the hem by the trunk's build, then the legs' length by theirs (FEET_Y on a build of all 1). */
export const feetY = (p) => { const b = bld(p); const hem = SHOULDER_LINE + (640 - SHOULDER_LINE) * b.trunk; return hem + (FEET_Y - 640) * b.legs; };
/** The head on the sheet: the top of the skull and the chin, which the head's build scales about the neck base and
 *  `headDrop` slides down the neck. With `feetY`, what a figure's height and its head-to-body ratio are measured
 *  from (`ANATOMY` in people.mjs is the table the fantasy builds are solved from; the hair and a hat rise above `top`). */
export const headBox = (p) => { const k = bld(p).head, dy = HEAD_DY + headDrop(p), at = (y) => NECK_BASE[1] + (y - NECK_BASE[1]) * k + dy; return { top: at(112), chin: at(112 + (p.face?.height ?? DEFAULTS.face.height) + 16 * (p.face?.chin ?? DEFAULTS.face.chin)) }; };
const legY = (p) => { const b = bld(p), hem = SHOULDER_LINE + (LEG_TOP - SHOULDER_LINE) * b.trunk; return (y) => hem + (y - LEG_TOP) * b.legs; }; // a leg's y on this build: authored for the figure as drawn, hung from this trunk's hem, stretched by the legs' length
const shoes = (p, ly) => { const k = bld(p).feet; return [-1, 1].flatMap((s) => [ellipse(200 + s * 44, ly(1066), 36 * k, 14, { fill: p.shoes.color }), ellipse(200 + s * (44 + 8 * k), ly(1064), 14 * k, 6, { fill: '#fff', op: 0.08 })]); }; // the shoe is as long as the build's feet say; its width is the leg standing in it
export const LEGS = {
  trousers: (p) => { const ly = legY(p); return [...shoes(p, ly), path(`M 110 ${ly(596)} L 290 ${ly(596)} L 292 ${ly(700)} L 266 ${ly(1062)} L 216 ${ly(1062)} L 200 ${ly(770)} L 184 ${ly(1062)} L 134 ${ly(1062)} L 108 ${ly(700)} Z`, { fill: p.pants.color }), path(`M 200 ${ly(700)} L 200 ${ly(772)}`, stroke('#000', 7, 0.18)), ...[-1, 1].map((s) => path(`M ${200 + s * 50} ${ly(724)} Q ${200 + s * 54} ${ly(900)} ${200 + s * 58} ${ly(1050)}`, stroke('#000', 3, 0.1))), ...[-1, 1].map((s) => path(`M ${200 + s * 24} ${ly(724)} Q ${200 + s * 22} ${ly(900)} ${200 + s * 28} ${ly(1050)}`, stroke('#fff', 3, 0.06)))]; }, // two legs from the hips, a crease down each
  skirt: (p) => { const ly = legY(p); return [...shoes(p, ly), path(`M 110 ${ly(596)} L 290 ${ly(596)} L 338 ${ly(1052)} Q 200 ${ly(1072)} 62 ${ly(1052)} Z`, { fill: p.pants.color }), ...[-60, -20, 20, 60].map((d) => path(`M ${200 + d * 0.6} ${ly(640)} Q ${200 + d * 0.9} ${ly(850)} ${200 + d * 1.3} ${ly(1050)}`, stroke('#000', 3, 0.1)))]; }, // a long skirt to the floor, folds falling from the waist
};
export const LEG_STYLES = Object.keys(LEGS);
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
export const PRINT_CENTER = 440; // where a print sits on the chest: what `graphicScale` grows about and `graphicY` moves from
/** The print on the torso: the named mark, sized and moved about the chest's centre, in its own inks or one colour. */
const printed = (p) => {
  const { graphicScale: k = 1, graphicY: dy = 0, graphicColor: c = null } = p.top;
  const ops = k === 1 && !dy ? GRAPHICS[p.top.graphic](p) : mapXY(GRAPHICS[p.top.graphic](p), scaleAbout(200, k), (y) => PRINT_CENTER + (y - PRINT_CENTER) * k + dy);
  return c ? ops.map((o) => ({ ...o, ...(o.fill && o.fill !== 'none' ? { fill: c } : {}), ...(o.stroke ? { stroke: c } : {}) })) : ops;
};
const LAYERS = [['makeup', MAKEUP], ['marks', MARKS], ['props', PROPS]];
const overlays = (p, at, fits, fitIs = () => true) => LAYERS.flatMap(([key, reg]) => (p[key] ?? []).flatMap((n) => { const d = reg[n], f = d?.[at]; if (!f) return []; const fit = typeof d.fit === 'string' ? d.fit : d.fit?.[at]; if (!fitIs(fit)) return []; return fit ? fits[fit](f(p)) : f(p); })); // fitIs: which fits to take, so one slot can be drawn in two groups that slide differently on a turned head

// metallic cloth: SVG has no gold lamé, so the garment gets dark folds falling from the shoulders, sharp pale patches beside them and a few near-white slivers, all clipped to its shape; the seed places them
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
// a hoop through skin: the half that runs behind the nostril or the lip is not drawn, so it reads as a ring going in and not a circle lying on the face. The bottom half, from one entry point round to the other.
const hoop = (cx, cy, r, sw = 1.7) => [path(`M ${cx - r} ${cy} C ${cx - r} ${cy + K * r}, ${cx - K * r} ${cy + r}, ${cx} ${cy + r} C ${cx + K * r} ${cy + r}, ${cx + r} ${cy + K * r}, ${cx + r} ${cy}`, stroke('#aaa397', sw)), ...[-1, 1].map((s) => ellipse(cx + s * r, cy, sw * 0.6, sw * 0.6, { fill: '#6b5f4e', op: 0.5 }))]; // the two ends dimple the skin they enter
export const DETAILS = {
  frecklesLight: { fit: 'face', ops: () => [[164, 224], [172, 226], [180, 223], [220, 223], [228, 226], [236, 224]].map(([x, y]) => ellipse(x, y, 1.2, 1.1, { fill: '#7a4f3e', op: 0.38 })) },
  frecklesMedium: { fit: 'face', ops: () => [[158, 223], [165, 228], [171, 223], [179, 227], [185, 224], [215, 224], [221, 227], [229, 223], [236, 228], [243, 223]].map(([x, y]) => ellipse(x, y, 1.4, 1.2, { fill: '#744c3c', op: 0.45 })) },
  cheekMoleLeft: { fit: 'face', ops: () => [ellipse(166, 246, 1.8, 1.8, { fill: '#3f2b25', op: 0.85 })] },
  cheekMoleRight: { fit: 'face', ops: () => [ellipse(235, 246, 1.8, 1.8, { fill: '#3f2b25', op: 0.85 })] },
  underEyeLines: { fit: 'eyes', ops: () => [path('M 147 210 Q 166 217 185 210', DL('#754b3d', 1.3, 0.25)), path('M 215 210 Q 234 217 253 210', DL('#754b3d', 1.3, 0.25))] },
  crowsFeet: { fit: 'eyes', ops: () => [line(144, 192, 137, 188, DL('#6b473b', 1, 0.32)), line(144, 197, 136, 198, DL('#6b473b', 1, 0.32)), line(256, 192, 263, 188, DL('#6b473b', 1, 0.32)), line(256, 197, 264, 198, DL('#6b473b', 1, 0.32))] },
  foreheadLines: { fit: 'face', ops: () => [path('M 168 145 Q 200 139 232 145', DL('#6f493d', 1.2, 0.2)), path('M 174 153 Q 200 148 226 153', DL('#6f493d', 1.1, 0.16))] },
  dimples: { fit: 'face', ops: () => [path('M 166 269 Q 170 274 174 269', DL('#754b3d', 1.4, 0.42)), path('M 226 269 Q 230 274 234 269', DL('#754b3d', 1.4, 0.42))] },
  cleftChin: { fit: 'face', ops: () => [path('M 196 297 Q 200 303 204 297', DL('#744a3d', 1.4, 0.4))] },
  noseRingLeft: { fit: 'face', ops: () => hoop(191, 246, 4.5) },
  // the piercings: a hoop sits in the skin, so each is a ring or a stud with its own small highlight and shadow on the
  // face under it. Drawn on the default head's nose (the tip at 244), brows (the line at 182) and lip (the parting at 260).
  noseRingRight: { fit: 'face', ops: () => hoop(209, 246, 4.5) },
  nostrilStudLeft: { fit: 'face', ops: () => [ellipse(190, 246, 2, 2, { fill: '#d6cfbf', stroke: '#7d7466', sw: 0.6 })] },
  septumRing: { fit: 'face', ops: () => [path('M 194 250 Q 200 262 206 250', stroke('#aaa397', 1.8)), ellipse(200, 259, 1.6, 1.6, { fill: '#8d8578' })] }, // a hoop hanging out of the septum, under the tip
  browBarLeft: { fit: 'eyes', ops: () => [line(152, 173, 157, 189, stroke('#3b3833', 3.4)), line(152, 173, 157, 189, stroke('#cec7b8', 1.8)), ellipse(152, 173, 2.8, 2.8, { fill: '#ded7c6', stroke: '#5f594f', sw: 0.7 }), ellipse(157, 189, 2.8, 2.8, { fill: '#bdb6a8', stroke: '#5f594f', sw: 0.7 })] }, // a barbell through the brow's outer end: the bar reads only against a dark line of its own
  browBarRight: { fit: 'eyes', ops: () => [line(248, 173, 243, 189, stroke('#3b3833', 3.4)), line(248, 173, 243, 189, stroke('#cec7b8', 1.8)), ellipse(248, 173, 2.8, 2.8, { fill: '#ded7c6', stroke: '#5f594f', sw: 0.7 }), ellipse(243, 189, 2.8, 2.8, { fill: '#bdb6a8', stroke: '#5f594f', sw: 0.7 })] },
  lipRingLeft: { fit: 'face', ops: () => hoop(186, 269, 4) }, // hanging off the lower lip's edge, off centre
  labretStud: { fit: 'face', ops: () => [ellipse(200, 285, 2.4, 2.4, { fill: '#d6cfbf', stroke: '#7d7466', sw: 0.6 })] }, // under the lip, on the chin's shelf
};
export const DETAIL_STYLES = Object.keys(DETAILS);

// Tags: what a part is (`everyday`, `formal`, `era:80s`) and who may take it (`only:undead`). Every generator
// picks through `parts()`; nothing iterates a registry or a *_STYLES list to choose. A part tagged `only:<x>` is
// returned only when the query names `only:<x>` (in `any` or `all`), which is the whole of the quarantine: sharing is
// a tag, quarantine is a pool. Untagged parts are general. Tags are per kind: 'top:leotard' knows nothing of hats.
export const PART_TAGS = {}; // 'kind:name' -> Set of tags
export const tag = (kind, name, ...tags) => { const k = `${kind}:${name}`; PART_TAGS[k] ??= new Set(); for (const t of tags) PART_TAGS[k].add(t); };
export const tagsOf = (kind, name) => PART_TAGS[`${kind}:${name}`] ?? new Set();
export const REGISTRIES = { top: TOPS, jacket: JACKETS, hat: HATS, hair: HAIR, facialHair: FACIAL_HAIR, glasses: GLASSES, makeup: MAKEUP, marks: MARKS, props: PROPS, teeth: TEETH, accessories: ACCESSORIES, details: DETAILS, graphics: GRAPHICS, legs: LEGS };
/** The names of `kind` a query may take: every part not tagged only:* (unless asked for by name in any/all), with every `all` tag, at least one `any` tag when any are given, and none of `not`. */
export function parts(kind, { any = [], all = [], not = [] } = {}) {
  const reg = REGISTRIES[kind]; if (!reg) throw new Error(`parts: no registry for kind "${kind}"`);
  const asked = new Set([...any, ...all]);
  return Object.keys(reg).filter((name) => {
    const t = tagsOf(kind, name);
    for (const x of t) if (x.startsWith('only:') && !asked.has(x)) return false;
    if (not.some((x) => t.has(x))) return false;
    if (all.some((x) => !t.has(x))) return false;
    if (any.length && !any.some((x) => t.has(x))) return false;
    return true;
  });
}
// the editorial tags on today's parts: what characterOf and identityOf have always picked from
for (const n of ['crewTshirt', 'vneckTshirt', 'heavyweightTshirt', 'polo', 'henley', 'crewSweater', 'turtleneck', 'hoodie', 'buttonDown']) tag('top', n, 'everyday');
for (const n of Object.keys(JACKETS).filter((x) => x !== 'none' && x !== 'openJacket')) tag('jacket', n, 'everyday');
for (const n of Object.keys(FACIAL_HAIR).filter((x) => x !== 'none')) tag('facialHair', n, 'everyday');
for (const n of Object.keys(HAIR)) tag('hair', n, 'everyday');
for (const n of ['wavyMedium', 'longStraight']) tag('hair', n, 'overEars'); // the two whose mass hangs over the ear itself: a cast whose ears are the point of it (the elves) asks for the rest
for (const n of Object.keys(GLASSES)) tag('glasses', n, 'everyday');
for (const n of Object.keys(DETAILS)) tag('details', n, 'everyday');
for (const n of Object.keys(GRAPHICS)) tag('graphics', n, 'everyday');

const details = (p, fitFace, fitEyes) => p.details.flatMap((n) => { const d = DETAILS[n]; return d ? (d.fit === 'eyes' ? fitEyes : fitFace)(d.ops(p)) : []; });

// Cloth is not flat: every garment gets the head's shadow across its chest, folds falling from the shoulders, the
// pull at the armpits, creases at the sleeve seams and a thickness to its neckline, all clipped to its own shape and
// placed by the seed. A bare torso keeps only the head's shadow. The hems are below the sheet.
export const NECKLINES = { crewTshirt: 'M 161 361 Q 200 389 239 361', heavyweightTshirt: 'M 158 359 Q 200 389 242 359', henley: 'M 163 360 Q 200 386 237 360', crewSweater: 'M 159 356 Q 200 387 241 356', polo: 'M 165 355 L 192 377 L 200 386 L 208 377 L 235 355', vneckTshirt: 'M 165 359 L 200 398 L 235 359', buttonDown: 'M 164 356 L 195 377 L 200 386 L 205 377 L 236 356', tunic: 'M 162 347 Q 200 372 238 347', trackTop: 'M 168 358 L 200 386 L 232 358', denimJacket: 'M 163 352 L 198 380 L 202 380 L 237 352', bomber: 'M 162 352 Q 200 385 238 352', leatherJacket: 'M 160 349 L 202 385 L 240 349', fieldJacket: 'M 161 351 Q 200 384 239 351', puffer: 'M 160 348 Q 200 380 240 348', trenchCoat: 'M 158 346 L 200 396 L 242 346' };
export const JACKET_EDGE = { blazer: ['M 161 354 L 193 480 L 200 700', 'M 239 354 L 207 480 L 200 700'], openJacket: ['M 158 352 L 172 480 L 168 700', 'M 242 352 L 228 480 L 232 700'], waistcoat: ['M 165 359 L 196 442 L 196 700', 'M 235 359 L 204 442 L 204 700'] }; // the inner edges of the jackets that hang open: they drop a shadow on the shirt
function cloth(p, ops, style, color, seed) {
  const d = region(ops); if (!d) return ops;
  const rnd = lcg(seed), dark = shade(color, 0.55), neckline = NECKLINES[style], bare = style === 'bare';
  const fold = (x0, y0, x1, y1, x2, y2, sw, op) => [path(`M ${x0} ${y0} Q ${x1} ${y1} ${x2} ${y2}`, stroke(dark, sw, op, 'butt')), path(`M ${x0 + 3} ${y0 + 2} Q ${x1 + 3} ${y1 + 2} ${x2 + 3} ${y2 + 2}`, stroke('#fff', sw * 0.6, op * 0.4, 'butt'))]; // a fold: a dark valley with a lit ridge beside it
  const out = [clip(d), ...(bare // the head's and the neck's shadow on the chest: on cloth it has an edge, on skin it must not, or its lower edge reads as a neckline and a bare torso looks dressed
    ? soft(200, 368, 78, 36, '#000', 0.18)
    : [path(`M 130 358 Q 200 346 270 358 Q 262 ${392 + (p.neck.height - 72) * 0.4} 200 402 Q 138 392 130 358 Z`, { fill: '#000', op: 0.12 }), path('M 150 358 Q 200 350 250 358 Q 244 384 200 390 Q 156 384 150 358 Z', { fill: '#000', op: 0.07 })])];
  const sd = p.light.side || -1, c = p.light.contrast ?? 1, a = 0.5 + 0.5 * (p.light.amount ?? 0.5);
  out.push(...soft(200 - sd * 150, 520, 125, 260, '#000', 0.15 * c * a), ...soft(200 + sd * 110, 480, 70, 200, '#fff', 0.06 * a)); // the torso is a cylinder under the same light as the face: its far side in shadow, its near side lit, so a garment is a volume and not a block
  for (const s of [-1, 1]) out.push(path(`M ${200 + s * 118} 470 C ${200 + s * 104} 410, ${200 + s * 76} 380, ${200 + s * 40} 366`, stroke('#fff', 14, 0.05 * a))); // the top of each shoulder catches the light
  if (!bare) for (const s of [-1, 1]) {
    const x = 200 + s * (78 + rnd() * 14);
    out.push(...fold(x, 370 + rnd() * 10, x - s * (14 + rnd() * 14), 424, x - s * (30 + rnd() * 24), 500 + rnd() * 40, 4.5 + rnd() * 3, 0.13), ...fold(x + s * 10, 366, x + s * 2, 410, x - s * (8 + rnd() * 10), 470 + rnd() * 30, 2.5 + rnd() * 2, 0.09)); // the shoulder's folds falling to the chest
    out.push(path(`M ${200 + s * 100} ${440 + rnd() * 10} Q ${200 + s * 82} 428 ${200 + s * 56} ${438 + rnd() * 8}`, stroke(dark, 3, 0.14, 'butt')), path(`M ${200 + s * 104} 460 Q ${200 + s * 86} 448 ${200 + s * 64} 460`, stroke(dark, 2, 0.09, 'butt'))); // the pull at the armpit
    out.push(path(`M ${200 + s * (88 + rnd() * 4)} ${386 + rnd() * 4} C ${200 + s * 100} 420, ${200 + s * 104} 452, ${200 + s * 100} 484`, stroke(dark, 3, 0.16 * c, 'butt')), path(`M ${200 + s * 91} 388 C ${200 + s * 103} 422, ${200 + s * 107} 452, ${200 + s * 103} 484`, stroke('#fff', 1.4, 0.1))); // the sleeve seam from the shoulder point to the armpit, a dark line with a lit edge: what makes the arm a separate volume from the chest
  }
  if (neckline && !bare) out.push(path(neckline, stroke(dark, 5, 0.14, 'butt')), path(neckline, stroke('#fff', 1.6, 0.14)), ...mapXY([path(neckline, stroke('#000', 7, 0.14, 'butt'))], (x) => x, (y) => y + 5)); // the neckline: its rib's thickness, a lit edge, the shadow it drops on the chest
  return [...ops, ...out, UNCLIP];
}
// no two edges at the same precision: every fine stroke's weight and opacity vary a little by the seed, so brow ends,
// hair contours, seams, lip edges and frames stop being one pen; the wide strokes (arms, rims, bands) keep their size
const rough = (ops, seed) => { const rnd = lcg(seed + 29); return ops.map((o) => (o.stroke && o.k !== 'clip' && (o.sw ?? 1) <= 6 ? { ...o, sw: Math.round((o.sw ?? 1) * (0.8 + 0.4 * rnd()) * 100) / 100, op: Math.min(1, Math.round((o.op ?? 1) * (0.88 + 0.24 * rnd()) * 100) / 100) } : o)); };

/** Where the eye line sits on this face: `eyes.y` is authored for the 204-tall head and laid out by the face's height (what a world centres its framing on). */
const onHead = (p, y) => { const k = bld(p).head; return (k === 1 ? y : NECK_BASE[1] + (y - NECK_BASE[1]) * k) + headDrop(p); }; // a head-local y as the sheet reads it (less HEAD_DY and the pose, the convention every framing shares): the head group scales about the neck base, so a bigger head lifts its features
export const eyeY = (p) => onHead(p, faceY(p)(p.eyes?.y ?? DEFAULTS.eyes.y)); // on the sheet: the face's layout, the head's scale, plus how far the head moved on the neck to seat its chin
/** Where the mouth sits on the sheet, laid out the same way: the other line a likeness is judged on (the third, the chin, is `CHIN_Y` on every face). */
export const mouthY = (p) => { const q = merge(DEFAULTS, p), fy = faceY(q); return onHead(p, mouthLine({ ...q, eyes: { ...q.eyes, y: fy(q.eyes.y) }, mouth: { ...q.mouth, y: fy(q.mouth.y) }, nose: { ...q.nose, length: q.nose.length * q.face.height / 204 } })); }; // laid out as portraitOps lays it out, so a muzzle's mouth is where it is drawn
/** The drawing, back to front, without the background: a plain list of primitives for `toSvg` or `drawOn`. */
export function portraitOps(options = {}) {
  const p = merge(DEFAULTS, options), hair = hairOf(p), q = p.pose, turn = q.turn ?? 0, sd = p.light.side || -1, fy = faceY(p);
  if (q.gaze === 'camera' && turn) p.eyes.look = { ...p.eyes.look, x: Math.max(-1, Math.min(1, (p.eyes.look.x ?? 0) - turn * 0.35)) }; // the head goes, the eyes stay on the viewer
  p.eyes.y = fy(p.eyes.y); p.mouth.y = fy(p.mouth.y); p.nose.length *= p.face.height / 204; // the features are authored for the 204 head and laid out by this face's height: a long face is long between its features, not a face with a tall chin, and a short one is not a face with the mouth on the jaw
  const fit = (ops) => (p.face.width === 156 ? ops : mapX(ops, scaleAbout(200, p.face.width / 156))); // hair, ears, hat and cheeks are drawn for the default head and follow this one's width (the hair and hat hang from the crown, so the height is theirs to fill)
  const fitFace = (ops) => mapXY(ops, scaleAbout(200, p.face.width / 156), fy); // the beard, the face's details and its paints follow the width and the height
  const fitEyes = (ops) => mapXY(ops, scaleAbout(200, p.eyes.spacing / 68), (y) => y + p.eyes.y - 196);
  const tf = (ops, k) => (turn ? mapX(ops, (x) => x + k * turn) : ops); // the turn: the features slide across the head further than the head's own outline and hair, a cheap quarter turn
  const hatDx = (HAT_TURN - 4) * turn; // the hair's cut rides with the hat, not with the head: where the hat vacates, hair fills it instead of scalp
  const b = bld(p), headG = push(q.headX, HEAD_DY + headDrop(p) + q.headY, q.headTilt, NECK_BASE, b.head); // the head sits HEAD_DY down the neck and moves about its base, at the build's size; the back hair rides with it but sits behind the neck, so the group opens twice
  const neckG = push(q.headX * 0.3, 0, q.headTilt * NECK_FOLLOW, [200, 302 + p.neck.height]); // the neck slides a third of the head's way and turns less: the skull pivots on the neck, the neck does not bend under it
  // the hairline: the style's own cut raised or lowered on the forehead, and the temples retreating while the centre
  // holds (a widow's peak). The crown never moves, so the silhouette above the head is the style's; only its edge goes.
  const hairline = (ops) => { const { hairline: hl = 0, recession: rc = 0 } = p.hair; if (!hl && !rc) return ops; return mapPts(ops, (x, y) => { if (y <= 112) return [x, y]; const t = unit((Math.abs(x - 200) - 30) / 60), ramp = Math.min(1, (y - 112) / 40); return [x, y - ramp * (14 * hl + 30 * rc * t)]; }); };
  const crown0 = HAT_CROWN[p.hat.style], back = fit(hair.back), front = hairline(fit(hair.front));
  const grain = HAIR_TEXTURE[p.hair.style] ?? 'strands', mass = region(grain === 'curls' ? [...back, ...front] : front); // the hair's mass: the front, or with the back for curls (an afro's mass is behind the head)
  const textured = (ops, mass, grainOps) => (grain !== 'none' && mass ? [...ops, clip(mass), ...grainOps, ...soft(200, 96, 46, 22, '#fff', 0.14), UNCLIP] : ops); // the hair with its grain (strands combed from the crown, or curls) and a light on it inside its mass, so it is hair and not a cap
  const backHair = grain === 'curls' ? textured(back, region(back), curls(p)) : back, frontHair = textured(front, region(front), grain === 'curls' ? curls(p) : strands(p, { fall: true })), skinHair = ON_SKIN.includes(p.hair.style) ? [clip(facePath(p)), ...frontHair, UNCLIP] : frontHair; // the back's texture goes on behind the head, since the face sits inside an afro's footprint
  const hairShadow = front.length ? [clip(facePath(p)), ...mapXY(front.filter(solid), (x) => x, (y) => y + 6).map((o) => ({ ...o, fill: '#000', op: 0.14 })), UNCLIP] : []; // the hair's cast shadow on the forehead: the front hair a little lower, dark, inside the face
  const facial = (FACIAL_HAIR[p.facialHair.style] ?? FACIAL_HAIR.none)(p), masked = p.makeup.some((n) => MAKEUP[n]?.mask); // the beard is built on this face's own outline and mouth (beardBand); a mask goes on over the beard, so the beard goes under the skin overlays
  const beard = facial.filter((o) => !o.stache), stache = facial.filter((o) => o.stache); // the mass belongs to the jaw and the moustache to the features, and on a turned head they travel at different rates; a moustache is never inside a clip group, so the two split cleanly
  // How much hair the hat has to go over: how far the hair reaches anywhere over the band the hat covers (the crown
  // line and the four lines above it, since a bob's widest mass sits above the line with no path point on it), against
  // the head's own half width. The hat takes all of that excess up to HAT_PUFF_MAX, so a bob, long hair and an afro
  // all push it out, and it grows about its crown line, so its edge stays where it meets the head and it gets taller
  // as it gets wider. Left at the skull's size, the hair's flat cut shows past it as a shelf at the temple.
  const reach = (hair) => Math.max(...[0, 8, 16, 24, 32].map((d) => hatWidth(hair, crown - d)));
  // and how far down the head it sits: a hat is drawn over HAIR_LIFT of hair, so a bald, buzzed or receding head
  // leaves it hanging in the air over hair that is not there. It takes the missing lift up (to HAT_SEAT_MAX, past
  // which a brim would land on the brows), crown line and all, so the cut, the skirt and the brim's shadow follow it down.
  const seat = crown0 && crown0 < 300 ? Math.max(0, Math.min(HAT_SEAT_MAX, HAIR_LIFT - hairLift([...back, ...front].filter(solid)))) : 0;
  const crown = crown0 === undefined ? crown0 : crown0 + seat;
  const puff = crown && crown < 300 ? Math.min(HAT_PUFF_MAX, Math.max(1, reach([...back, ...front].filter(solid)) / (p.face.width / 2))) : 1;
  const plainHat = mapXY(fit((HATS[p.hat.style] ?? HATS.none)(p)), scaleAbout(200, puff), (y) => (crown0 === undefined ? y : crown0 + seat + (y - crown0) * puff)); // a hat with no crown line (a headband, a veil's comb) sits on the hair as drawn // the hat before any sheen: what the skirt below is built from, since a sheen's patches are clipped to the garment and a copy of them would leave loose bars on the background
  let hat = plainHat; if (p.hat.metal) hat = metalize(hat, p.hat.color, p.seed + 2, [40, 390]);
  const hw = hatWidth(hat.slice(0, 1), crown), under = (ops) => (crown && ops.length ? [clip(`M -100 900 L -100 ${crown + 50} L ${200 + hatDx - hw - 50} ${crown + 50} L ${200 + hatDx - hw} ${crown} L ${200 + hatDx + hw} ${crown} L ${200 + hatDx + hw + 50} ${crown + 50} L 500 ${crown + 50} L 500 900 Z`), ...ops, UNCLIP] : ops); // under a hat the hair stops at the crown line and is pressed in under the hat's edge: the mass above is inside the hat (a cap does not take an afro's shape), and what is below springs out past the brim at a slant, not as a shelf
  // a crown's bottom edge arcs upward, so cutting the hair level with the crown line leaves a crescent of bare
  // forehead under the arc. The hat wears a skirt to fill it: its own filled shapes again, HAT_TUCK lower, in its own
  // colour, clipped to above the line so it can never show below the hat. Drawn under the hat, so only the crescent shows.
  const skirt = crown && crown < 300 && plainHat.length ? [clip(`M -100 -200 L 500 -200 L 500 ${crown} L -100 ${crown} Z`), ...mapXY(plainHat.filter(solid), (x) => x, (y) => y + HAT_TUCK).map((o) => ({ ...o, fill: p.hat.color, op: 1 })), UNCLIP] : []; // only a hat that sits on the skull has a crescent to fill: a hood covers the whole head, and shifting its face opening down would lay a band across the face
  const brim = crown && crown < 300 ? [clip(facePath(p)), ...soft(200, crown, hw + 20, 34, '#000', 0.26), UNCLIP] : []; // the hat's shadow on the forehead: a wash centred on the crown line, half of it under the hat, and on the face alone. A band of two rects stood a hard-edged rectangle on the temples wherever the head was wider than the crown, and taking the hair into the clip as a second subpath punched a hole through the wash where the two wound against each other.
  const specs = glasses(p), specShadow = specs.length ? [clip(facePath(p)), ...mapXY(specs.filter((o) => o.stroke), (x) => x - 2 * sd, (y) => y + 4).map((o) => ({ ...o, stroke: '#000', op: 0.16 })), UNCLIP] : []; // the frames drop a shadow on the face, away from the light
  const fits = { face: fitFace, eyes: fitEyes }, bw = p.body.width * b.shoulders, wide = (ops) => (bw === 1 ? ops : mapX(ops, scaleAbout(200, bw))); // the torso, its print and the arms follow the body's width, and the build's shoulders over it
  const shear = (ops) => (q.shoulder ? mapPts(ops, (x, y) => [x, y + q.shoulder * 0.1 * (x - 200)]) : ops); // one shoulder dropped: the torso sheared about its centre
  let top = (TOPS[p.top.style] ?? TOPS.crewTshirt)(p); if (p.top.metal) top = metalize(top, p.top.color, p.seed);
  if (p.top.graphic && GRAPHICS[p.top.graphic]) top = [...top, clip(top[0].d), ...printed(p), UNCLIP]; // every top's first op is its torso, and the print is a slot on it: sized and moved about the chest's centre, recoloured when asked
  const hoodBack = top.filter((o) => o.hood); if (hoodBack.length) top = top.filter((o) => !o.hood); // a hood bunched behind the head goes behind the neck, or it swallows it: the chin ends up resting on a dome of cloth
  // a turtleneck's collar wraps the neck, so it rides in the neck's own group and slides and leans with it; a shirt's collar lies on the chest and stays with the torso
  const collar = top.filter((o) => o.collar), onNeck = collar.filter((o) => o.onNeck); if (onNeck.length) top = top.filter((o) => !o.onNeck); top = cloth(p, top, p.top.style, p.top.style === 'bare' ? p.skin : p.top.color, p.seed + 11);
  // Every portrait has arms: a prop may place one (`PROPS[n].lift`: the signed sides it raises; `PROPS[n].arms`: the sides it draws low), every other arm hangs from the shoulder joint with its hand at the hip. Nothing is cut per pose: the trunk is always the body's width (TRUNK) and the sleeves make the figure's.
  const armed = (sd) => p.props.some((n) => (PROPS[n]?.lift ?? []).some((v) => Math.sign(v) === sd) || PROPS[n]?.arms?.includes(sd));
  const ty = (y) => SHOULDER_LINE + (y - SHOULDER_LINE) * b.trunk, hangs = [-1, 1].flatMap((sd) => (armed(sd) ? [] : arm(p, sd, { lift: 0.3, elbow: [200 + 104 * sd, ty(540)], wrist: [200 + 110 * sd, ty(690)] }))); // lift 0.3: the cap covers the trunk's shoulder corner without the mass a lifted arm gets; the hands hang to this trunk's hip
  const legs = (LEGS[p.pants.style] ?? LEGS.trousers)(p);
  let jacket = (JACKETS[p.jacket.style] ?? JACKETS.none)(p); if (p.jacket.metal) jacket = metalize(jacket, p.jacket.color, p.seed + 1); if (jacket.length) jacket = cloth(p, jacket, p.jacket.style, p.jacket.color, p.seed + 12);
  const edge = JACKET_EDGE[p.jacket.style] ? [clip(top[0].d), ...JACKET_EDGE[p.jacket.style].map((d) => path(d, stroke('#000', 14, 0.2, 'butt'))), UNCLIP] : []; // an open jacket's shadow on the shirt beside its edge
  // A neckline is an opening: the neck is drawn once behind the clothes, so every collar covers its base, and once
  // more through the hole the outermost garment's neckline makes (each `NECKLINES` curve closed on its own chord),
  // so a crew or a V shows skin inside it instead of a curve drawn on the fabric. A jacket with a neckline of its own
  // is the outer one; a blazer or an open jacket has none, so the shirt's own neckline shows in the gap. A turtleneck,
  // a hood or a bare chest has no entry and needs none.
  const outer = p.jacket.style !== 'none' && NECKLINES[p.jacket.style] ? p.jacket.style : p.top.style;
  const openingOf = (d) => { const t = d.match(/-?[\d.]+/g); return `${d} L ${t[t.length - 2]} ${NECK_TOP} L ${t[0]} ${NECK_TOP} Z`; }; // the curve closed upward, not on its own chord: a garment's top edge sits a little above the neckline, and closing on the chord leaves a band of cloth lying across the throat
  const through = NECKLINES[outer] ? [...wide(shear([clip(openingOf(NECKLINES[outer]))])), neckG, ...neck(p), ...overlays(p, 'neck', fits), ...onNeck, POP, UNCLIP] : [];
  const model = modelling(p), see = (p.figure?.opacity ?? 1) < 1; // `figure.opacity`: the whole figure faded as one thing (a hologram), never shape by shape, so nothing inside it shows through anything else inside it
  return grade(rough([
    ...overlays(p, 'back', fits), // the ground behind the figure, outside its sway: a hologram's beam stays at full strength
    ...(see ? [{ k: 'layer', op: Math.max(0, p.figure.opacity) }] : []),
    push(q.bodyX, 0, q.bodyTilt, HIPS),
    headG, ...tf(under(backHair), 4), POP, // the back hair hangs behind the shoulders, so it goes down before the top
    ...wide(shear(hoodBack)), // a hood hangs behind the neck
    neckG, ...neck(p), ...overlays(p, 'neck', fits), POP, // the neck goes behind every garment, so a collar, a lapel or a neckline covers its base: a collar, a lapel or a neckline covers its base, or the skin reads as a column standing on the shirt
    ...wide(shear(legs)), // the legs under the hem
    ...wide(shear([clip(TRUNK(640, b.trunk)), ...top, ...edge, UNCLIP])), // a top is the trunk's shape to its hem
    ...(onNeck.length ? [neckG, ...onNeck, POP] : []), // a turtleneck's collar wraps the neck, so it rides in the neck's group and leans with it, over the shirt it belongs to and under any jacket (which shows it again through its own neckline)
    ...wide(shear([clip(TRUNK(690, b.trunk)), ...jacket, UNCLIP, ...overlays(p, 'body', fits)])), // a jacket, longer
    ...through, // and shows again through the outermost neckline, because a neckline is a hole, not a curve painted on the cloth
    ...accessories(p, 'neck'), ...wide(shear(collar.filter((o) => !o.onNeck))), ...accessories(p, 'tie'), // a chain lies on the shirt, the collar goes back over it, a tie over that
    headG, ...tf(fit(ears(p, turn)), 4), ...tf(fit(accessories(p, 'ear')), 4), ...tf(head(p), 4), ...tf(masked ? beard : [], 8), ...tf(masked ? stache : [], 12), ...tf(masked ? model : [], 4), ...tf(overlays(p, 'skin', fits, (f) => f !== 'eyes'), 4), ...tf(overlays(p, 'skin', fits, (f) => f === 'eyes'), 12), ...tf(masked ? [] : model, 4), ...tf(masked ? [] : details(p, fitFace, fitEyes), 12), // the planes go over paint on the skin (one modelling for a painted face and a bare one); a mask is a shell with its own shading, so they go under it, with the beard; paint laid out on the eyes (sockets, under-eye) rides with the eyes on a turn (12), the rest with the outline (4)
    ...tf(masked ? [clip(maskHoles(p)), ...eyes(p, false), UNCLIP] : eyes(p), 12), ...tf(masked ? [] : nose(p), 12), ...tf(masked ? [] : mouth(p), 12), ...tf(overlays(p, 'face', fits), 12), ...tf(masked ? [] : beard, 8), ...tf(masked ? [] : stache, 12), ...tf(overlays(p, 'mouth', fits), 12), // the `mouth` slot is what comes out of the mouth, a tusk or a fang: over the lips, the beard and the moustache (paint on the `face` slot stays under them, since hair grows over paint), and riding with the features on a turned head. A mask is a rigid thing: none of the wearer's face is drawn on it, no brows, no nose, no mouth, no lines, and the eyes show only through its holes, where they still look about and blink
    ...tf(faceLight(p, facePath(p)), 4), ...tf(hairShadow, 4), ...tf(under(skinHair), 4), ...tf(specShadow, 12), ...tf(specs, 12), ...tf(brim, HAT_TURN), ...tf(skirt, HAT_TURN), ...tf(hat, HAT_TURN), ...tf(fit(accessories(p, 'over')), 4), ...tf(overlays(p, 'over', fits), 4), POP,
    ...wide([...hangs, ...overlays(p, 'front', fits)]), // the arms: hanging, then what a prop does with them
    POP,
    ...(see ? [{ k: 'unlayer' }] : []),
  ], p.seed), p.figure?.saturation ?? 1);
}

const attrs = (o) => [o.fill !== undefined ? `fill="${o.fill}"` : '', o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw ?? 1}" stroke-linecap="${o.cap ?? 'round'}"` : '', o.op !== undefined ? `opacity="${o.op}"` : '', o.rx ? `rx="${o.rx}"` : '', o.rule ? `fill-rule="${o.rule}"` : ''].filter(Boolean).join(' ');
let clipN = 0; // clip ids are unique across every svg printed, since a page shows many portraits and ids are document-wide
export function toSvg(ops, background = null, view = '0 0 400 480', dy = 0) {
  let n = 0;
  const body = ops.map((o) => o.k === 'layer' ? `<g opacity="${o.op}">` : o.k === 'unlayer' ? '</g>' : o.k === 'push' ? `<g transform="translate(${o.tx} ${o.ty}) rotate(${(o.rot * 180) / Math.PI} ${o.cx} ${o.cy})${o.sc && o.sc !== 1 ? ` translate(${o.cx} ${o.cy}) scale(${o.sc}) translate(${-o.cx} ${-o.cy})` : ''}">` : o.k === 'pop' ? '</g>' : o.k === 'clip' ? `<clipPath id="c${(n = ++clipN)}"><path d="${o.d}"${o.rule ? ` clip-rule="${o.rule}"` : ''}/></clipPath><g clip-path="url(#c${n})">` : o.k === 'unclip' ? '</g>' : o.k === 'path' ? `<path d="${o.d}" ${attrs(o)}/>` : o.k === 'ellipse' ? `<ellipse cx="${o.cx}" cy="${o.cy}" rx="${o.rx}" ry="${o.ry}" ${attrs({ ...o, rx: 0 })}/>` : o.k === 'rect' ? `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" ${attrs(o)}/>` : `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" ${attrs(o)}/>`).join('\n');
  const [vx, vy, vw, vh] = view.split(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" role="img">\n${background ? `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${background}"/>` : ''}\n${dy ? `<g transform="translate(0 ${dy})">` : ''}${body}${dy ? '</g>' : ''}\n</svg>`;
}
/** The whole portrait as SVG, background included. */
export const renderPortrait = (options = {}) => toSvg(portraitOps(options), merge(DEFAULTS, options).background);
/** The standing figure: the same drawing down to the floor, dropped so the shoes land on the view's bottom edge
 *  whatever the build, so a short people (a halfling, a gnome) draws as a short figure beside a tall one rather than
 *  the same figure scaled. */
export const renderFigure = (options = {}) => { const p = merge(DEFAULTS, options); return toSvg(portraitOps(p), p.background, '-90 -200 580 1284', FEET_Y - feetY(p)); }; // the shoes on the bottom edge, 200 units of headroom above the sheet: a dragonborn's build stands its crown 91 above a human's and it wears a horn crest on top of that; and 90 either side of the bust's 0..400, because the broadest builds (a dragonborn's shoulders 1.44, an orc's 1.37) times the widest body.width a person is given draw hands and a skirt's hem out to about -67..478

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
  const under = []; // the contexts a `layer` drew over: its ops go to an offscreen canvas, composited at `unlayer` at the layer's opacity, so the figure fades as one thing
  for (const o of ops) {
    if (o.k === 'layer') { const can = typeof OffscreenCanvas !== 'undefined' && ctx.canvas ? new OffscreenCanvas(ctx.canvas.width, ctx.canvas.height) : null; const off = can?.getContext('2d'); under.push({ ctx, op: o.op, off: !!off, alpha }); if (off) { off.setTransform(ctx.getTransform()); ctx = off; } else alpha *= o.op; continue; } // no offscreen canvas: each shape at the layer's opacity, close and still deterministic
    if (o.k === 'unlayer') { const u = under.pop(); if (!u) continue; if (u.off) { const off = ctx; ctx = u.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = u.op * u.alpha; ctx.drawImage(off.canvas, 0, 0); ctx.restore(); } alpha = u.alpha; continue; }
    if (o.k === 'clip') { ctx.save(); ctx.beginPath(); tracePath(ctx, o.d); ctx.clip(o.rule ?? 'nonzero'); continue; }
    if (o.k === 'unclip' || o.k === 'pop') { ctx.restore(); continue; }
    if (o.k === 'push') { ctx.save(); ctx.translate(o.cx + o.tx, o.cy + o.ty); ctx.rotate(o.rot); if (o.sc && o.sc !== 1) ctx.scale(o.sc, o.sc); ctx.translate(-o.cx, -o.cy); continue; }
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
