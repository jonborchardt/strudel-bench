// The undead pack: what makes a face dead, as parts of the portrait tagged `only:undead`, so no pool that does not
// name that tag ever gets one. The skins of the dead and the milky eyes (numbers a cast pins), rotten teeth, the rot as
// makeup on the skin and face slots (bruised sockets, gaunt cheeks, grey cracked lips, veins, gashes, the jaw torn
// open to the teeth, stitches, peeling skin, drool, blood), the grave as marks on the clothes, and the clawed hands
// on portrait.mjs's `arm`. The undead cast (casts/undead.mjs) wears them; parts.html?pack=undead is the sheet.
import { MOUTHS, MAKEUP, MARKS, PROPS, TEETH, arm, soft, path, ellipse, rect, line, stroke, tag } from 'limner';

const fp = (fill, op = 1) => ({ fill, op });

/** The skins of the dead: ashen, grey-green, a greyed warm, one deep; no live tone among them. */
export const ZOMBIE_SKINS = ['#8e9a86', '#9aa08f', '#a7a899', '#8b9483', '#b2ac9c', '#9c9d90', '#a39a8e', '#7f8b7a', '#5f6a5e', '#b5b2a6'];
/** Milky eyes: a pale iris, a grey pupil, the sockets deep and bagged. */
export const DEAD_EYES = { iris: '#bdb9ab', pupil: '#55524c', sclera: 0.85, bags: 1, depth: 0.95 };
TEETH.rotten = (d, cx, w, ty, th) => [path(d, { fill: '#c9b27a' }), ...[-0.2, -0.08, 0.05, 0.18].map((f) => line(cx + w * f, ty - th, cx + w * f + 1.5, ty + th, stroke('#3a2a18', 1.8, 0.7))), rect(cx + w * 0.1, ty - th, w * 0.07, th * 2, fp('#2a1a14', 0.9))]; // yellowed, a gap where one is gone
tag('teeth', 'rotten', 'only:undead');

// --- the rot: makeup on the skin (under the features) and the face (over them), laid out by the eyes or the face ---
const GASH = (d, rim) => [path(d, stroke('#5a1216', 7, 0.92)), path(d, stroke('#1e0608', 2.6, 0.9)), path(rim, stroke('#b2584f', 1.4, 0.5))]; // a slash: the raw flesh, the dark of it, a lighter edge where the skin has pulled
const branch = (x, y, s, c, op) => [path(`M ${x} ${y} C ${x + 6 * s} ${y + 10}, ${x + 2 * s} ${y + 22}, ${x + 10 * s} ${y + 34}`, stroke(c, 2, op)), path(`M ${x + 4 * s} ${y + 14} Q ${x + 14 * s} ${y + 16} ${x + 18 * s} ${y + 26}`, stroke(c, 1.6, op)), path(`M ${x + 2 * s} ${y + 22} Q ${x - 6 * s} ${y + 30} ${x - 4 * s} ${y + 40}`, stroke(c, 1.4, op * 0.8))]; // a vein forking down from (x, y)
export const ZOMBIE_MAKEUP = {
  ashenSockets: { fit: 'eyes', skin: () => [...soft(166, 198, 32, 22, '#3b2d40', 0.8), ...soft(234, 198, 32, 22, '#3b2d40', 0.8), ...soft(166, 200, 20, 13, '#241a2a', 0.5), ...soft(234, 200, 20, 13, '#241a2a', 0.5)] }, // the sockets bruised purple-grey, deeper than any living hollow
  gauntCheeks: { fit: 'face', skin: () => [path('M 118 224 Q 160 266 186 306 Q 142 284 118 224 Z', fp('#3f4a3c', 0.6)), path('M 282 224 Q 240 266 214 306 Q 258 284 282 224 Z', fp('#3f4a3c', 0.6)), ...soft(146, 262, 20, 28, '#2e3a2c', 0.6), ...soft(254, 262, 20, 28, '#2e3a2c', 0.6)] }, // the cheeks sucked in grey-green under the bone
  blackEye: { fit: 'eyes', skin: () => [...soft(234, 200, 28, 19, '#2b1a3a', 0.95), ...soft(238, 206, 16, 10, '#160b20', 0.5)] }, // one eye blackened
  rotLips: { face: (p) => { const w = p.mouth.width / 2, y = p.mouth.y; return [path(`M ${200 - w} ${y} Q 200 ${y + 3} ${200 + w} ${y}`, stroke('#2e1f28', 5, 0.85)), path(`M ${200 - w + 2} ${y - 4} Q 200 ${y - 8} ${200 + w - 2} ${y - 4} Q 200 ${y + 10} ${200 - w + 2} ${y - 4} Z`, fp('#3a2a34', 0.55)), ...[-0.5, -0.15, 0.25, 0.6].map((f) => line(200 + w * f, y - 5, 200 + w * f + 1, y + 7, stroke('#120a10', 1.2, 0.7)))]; } }, // the lips gone grey and cracked across
  veinedTemples: { fit: 'eyes', face: () => [...branch(140, 168, -1, '#243d3d', 0.8), ...branch(260, 168, 1, '#243d3d', 0.8), ...branch(176, 214, -1, '#243d3d', 0.6), ...branch(224, 214, 1, '#243d3d', 0.6)] }, // dark veins forking down the temples and under the eyes
  cheekGash: { fit: 'face', face: () => GASH('M 138 236 L 178 278', 'M 136 233 L 180 281') },
  foreheadGash: { fit: 'face', face: () => GASH('M 164 142 Q 200 154 238 138', 'M 162 139 Q 200 151 240 135') },
  // the cheek torn open from the mouth: the opening is a wedge that starts inside the lips and widens back along the cheek to a ragged edge, this side's lips gone. It moves with the mouth: its top is the upper lip's own edge (a smile bows it, as the mouth draws it), its depth near the mouth is the mouth's own ( drops it), the corner holds as the corners do, and the teeth hang from that edge as the mouth's band does, in the mouth's own tooth colour, small where the lips were and full at the tear; the lower tips sit along the tear's bottom. No further back than the jaw
  exposedJaw: { face: (p) => { const st = MOUTHS[p.mouth.style] ?? {}, hw = (p.mouth.width * (st.wide ?? 1)) / 2, cx = 200 + hw, y = p.mouth.y - (st.asym ? 4 : 0), sm = p.mouth.smile ?? 0, op = p.mouth.open ?? 0, jawX = 200 + (p.face.width / 2) * p.face.jaw * 0.9, x1 = Math.max(cx + 24, Math.min(cx + 42, jawX - 2)), x0 = 200 + hw * 0.25; const yt0 = y + 0.47 * (18 * sm - 2 * op), yb0 = op > 0.08 ? y + 0.47 * (8 + 26 * op) : y + 1.5; const row = TEETH[p.mouth.teeth ?? 'even'] ?? TEETH.even, ivory = row('M 0 0 Z', 200, 40, 0, 2).find((o) => o.fill)?.fill ?? '#e3d9c3'; const hole = `M ${x0} ${yt0} Q ${(x0 + cx) / 2} ${(yt0 + y) / 2 - 2} ${cx - 2} ${y - 5} L ${cx + 4} ${y - 12} L ${cx + 12} ${y - 9} L ${cx + 22} ${y - 14} L ${x1 - 6} ${y - 10} L ${x1} ${y - 1} L ${x1 - 3} ${y + 9} L ${x1 - 12} ${y + 16} L ${cx + 16} ${y + 13} L ${cx + 6} ${y + 17} L ${cx - 2} ${Math.max(y + 9, yb0 + 4)} Q ${(x0 + cx) / 2} ${(yb0 + y + 9) / 2 + 2} ${x0} ${yb0} Z`; const n = Math.max(4, Math.floor((x1 - x0 - 8) / 6.5)), tw = (x1 - x0 - 8) / n, t = (x) => (x - x0) / (x1 - x0), topAt = (x) => (x < cx ? yt0 + (y - yt0) * ((x - x0) / (cx - x0)) : y - 6 + 4 * ((x - cx) / (x1 - cx))), botAt = (x) => y + 16 - 7 * ((x - cx) / (x1 - cx)); return [path(hole, fp('#2a0b0d', 0.97)), path(`M ${x0 + 2} ${topAt(x0 + 2) - 2} L ${x1 - 3} ${topAt(x1 - 3) - 4} L ${x1 - 3} ${topAt(x1 - 3) + 1} L ${x0 + 2} ${topAt(x0 + 2) + 0.5} Z`, fp('#7a3a3e', 0.85)), ...Array.from({ length: n }, (_, k) => { const x = x0 + 4 + k * tw, h = 2.5 + 6 * t(x + tw / 2); return rect(x, topAt(x + tw / 2) + 0.3, tw - 1.1, h, { rx: 1.2, fill: ivory }); }), ...Array.from({ length: n }, (_, k) => { const x = x0 + 4 + (k + 0.5) * tw; if (x < cx + 4) return null; const h = 3 + 2 * t(x); return rect(x, botAt(x + tw / 2) - h - 1, tw - 1.4, h, { rx: 1.2, fill: ivory, op: 0.85 }); }).filter(Boolean), path(`M ${x0} ${yt0} Q ${(x0 + cx) / 2} ${(yt0 + y) / 2 - 2} ${cx - 2} ${y - 5}`, stroke('#120406', 1.6, 0.9)), path(hole, stroke('#8c3a3a', 3, 0.55)), path(hole, stroke('#1a0608', 1.3, 0.85))]; } },
  stitchedBrow: { fit: 'eyes', face: () => [line(140, 177, 198, 165, stroke('#5a1216', 5, 0.8)), line(140, 177, 198, 165, stroke('#2a0c10', 2.4, 0.9)), ...[150, 162, 174, 186].map((x) => line(x - 3, 165 + (x - 142) * -0.2 + 6, x + 3, 165 + (x - 142) * -0.2 + 18, stroke('#1a1012', 2.4, 0.9)))] }, // sewn shut across the left brow
  peelingSkin: { fit: 'face', face: () => [['M 144 246 C 158 240, 172 246, 174 258 C 166 266, 150 262, 144 246 Z', 'M 144 246 C 158 240, 172 246, 174 258'], ['M 232 226 C 246 220, 256 230, 252 242 C 244 246, 234 240, 232 226 Z', 'M 232 226 C 246 220, 256 230, 252 242'], ['M 174 290 C 186 284, 198 290, 198 302 C 190 308, 178 304, 174 290 Z', 'M 174 290 C 186 284, 198 290, 198 302']].flatMap(([d, e]) => [path(d, fp('#5a2a28', 0.7)), path(d, fp('#c9a99a', 0.75)), path(e, stroke('#6a2f2a', 2, 0.9))]) }, // three flaps lifting off the cheeks and chin
  drool: { face: (p) => { const x = 200 + p.mouth.width * 0.42, y = p.mouth.y + 3; return [path(`M ${x} ${y} Q ${x + 3} ${y + 18} ${x + 1} ${y + 36}`, stroke('#e4ebe6', 4, 0.8)), ellipse(x + 1, y + 38, 3, 4, fp('#e4ebe6', 0.85))]; } },
  bloodMouth: { face: (p) => { const w = p.mouth.width / 2, y = p.mouth.y; return [path(`M ${200 - w} ${y} Q ${200 - w - 6} ${y + 12} ${200 - w - 2} ${y + 30}`, stroke('#4a0c10', 4, 0.85)), path(`M ${200 + w - 4} ${y + 2} Q ${200 + w + 2} ${y + 16} ${200 + w - 1} ${y + 40}`, stroke('#4a0c10', 3.2, 0.85)), ...soft(200, y + 2, w * 0.9, 7, '#4a0c10', 0.6), ellipse(200 + w - 1, y + 42, 2.6, 3.2, fp('#4a0c10', 0.9))]; } }, // dark blood smeared on the mouth and running from its corners
};
Object.assign(MAKEUP, ZOMBIE_MAKEUP);
/** The grave on the clothes: drawn on the body slot, over the garments. */
export const ZOMBIE_MARKS = {
  graveDirt: { body: () => [...soft(166, 442, 62, 40, '#3a2f22', 0.75), ...soft(252, 500, 52, 36, '#3a2f22', 0.6), ...soft(200, 392, 40, 22, '#3a2f22', 0.5), path('M 140 470 C 160 484, 150 510, 172 528', stroke('#2a2118', 3, 0.35)), path('M 236 414 C 254 430, 242 452, 262 470', stroke('#2a2118', 2.4, 0.35))] },
  bloodSplatter: { body: () => [...[[176, 412, 9], [192, 436, 5], [226, 402, 6], [238, 448, 11], [164, 470, 4], [214, 480, 7]].map(([x, y, r]) => ellipse(x, y, r, r * 0.8, fp('#4a0c10', 0.85))), path('M 238 456 Q 240 490 236 520', stroke('#4a0c10', 3.4, 0.8)), path('M 176 420 Q 174 450 178 468', stroke('#4a0c10', 2.4, 0.8))] },
  tornShirt: { body: (p) => [['M 146 418 L 164 408 L 178 424 L 172 444 L 152 448 L 142 432 Z', 'M 146 418 L 164 408 L 178 424 L 172 444 L 152 448 L 142 432 Z'], ['M 244 466 L 266 460 L 276 480 L 262 498 L 242 490 Z', 'M 244 466 L 266 460 L 276 480 L 262 498 L 242 490 Z']].flatMap(([d, e]) => [path(d, { fill: p.skin }), path(d, fp('#000', 0.14)), path(e, stroke('#1a1412', 1.6, 0.55))]) }, // ragged holes with the skin in them
  mossStreaks: { body: () => [path('M 130 400 C 150 430, 140 470, 160 500', stroke('#5a6e3a', 6, 0.45)), path('M 262 396 C 248 430, 268 462, 250 496', stroke('#5a6e3a', 5, 0.45)), ...soft(206, 456, 30, 18, '#5a6e3a', 0.5)] },
  dustShoulders: { body: () => [...soft(118, 390, 48, 18, '#bdb7a8', 0.55), ...soft(282, 390, 48, 18, '#bdb7a8', 0.55)] },
};
Object.assign(MARKS, ZOMBIE_MARKS);
export const EXTRA_MARKS = ['bloodSplatter', 'tornShirt', 'graveDirt', 'mossStreaks', 'dustShoulders']; // what a phase adds and a snare cuts through

// --- the hands: the Thriller claw, on arms from portrait.mjs's `arm` ---
/** A clawed hand at (x, y): the palm and four fingers hooked over, the thumb aside; `a` turns it (0: fingers up, π: hanging), `k` sizes it. */
export const claw = (p, x, y, a, k = 1.45) => {
  const col = p.props.includes('gloves') ? '#161517' : p.skin, c = Math.cos(a), sn = Math.sin(a), at = (dx, dy) => [x + (dx * c - dy * sn) * k, y + (dx * sn + dy * c) * k], P = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  const out = [ellipse(x, y, 13 * k, 15 * k, { fill: col }), ellipse(x, y + 4 * k, 9 * k, 7 * k, fp('#000', 0.1))];
  [-11, -4, 4, 11].forEach((dx, i) => { const reach = i === 0 || i === 3 ? 0.9 : 1, d = `M ${P(at(dx, -8))} Q ${P(at(dx * 1.5, -27 * reach))} ${P(at(dx * 2.3 + (dx < 0 ? -2 : 2), -15 * reach))}`; out.push(path(d, stroke(col, 6 * k)), path(d, stroke('#2a1a18', 1.1, 0.2))); });
  out.push(path(`M ${P(at(-8, 2))} Q ${P(at(-22, -4))} ${P(at(-25, -14))}`, stroke(col, 5.5 * k)));
  return out;
};
// The hands as the dance has them (a raised hand's fingers point up and curl forward, never hang: claw's angle near 0). The claw: the elbows out at shoulder height, the forearms straight up, the hands at eye level
// hooked forward; the arms leave the body, so the garment's shoulders are cut away under them as for hands up. Reaching at the
// camera: the upper arm foreshortens to a stub behind a large near hand in front of the shoulder. The side swing: the near arm up
// beside the head, the far arm across the chest under the chin with its forearm up beside the near one, both hands hooked together.
export const ZOMBIE_PROPS = {
  clawHands: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [62, 392], wrist: [80, 262], hand: false }), ...claw(p, 84, 244, -0.35, 1.6), ...arm(p, 1, { lift: 1, elbow: [338, 392], wrist: [320, 262], hand: false }), ...claw(p, 316, 244, 0.35, 1.6)] },
  clawRaisedRight: { lift: [1], front: (p) => [...arm(p, 1, { lift: 1, elbow: [318, 300], wrist: [296, 198], hand: false }), ...claw(p, 292, 182, 0.3, 1.6)] }, // one arm over the head, the hand hanging clawed
  clawRaisedLeft: { lift: [-1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [82, 300], wrist: [104, 198], hand: false }), ...claw(p, 108, 182, -0.3, 1.6)] },
  clawsUp: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 1, elbow: [70, 300], wrist: [94, 194], hand: false }), ...claw(p, 98, 178, -0.35, 1.6), ...arm(p, 1, { lift: 1, elbow: [330, 300], wrist: [306, 194], hand: false }), ...claw(p, 302, 178, 0.35, 1.6)] }, // both arms up, the hands hanging over the head
  clawsRight: { lift: [-0.25, 1], front: (p) => [...arm(p, -1, { lift: 0.5, elbow: [262, 338], wrist: [282, 236], hand: false }), ...claw(p, 286, 220, 0.4, 1.6), ...arm(p, 1, { lift: 1, elbow: [340, 326], wrist: [326, 214], hand: false }), ...claw(p, 330, 198, 0.3, 1.6)] },
  clawsLeft: { lift: [-1, 0.25], front: (p) => [...arm(p, 1, { lift: 0.5, elbow: [138, 338], wrist: [118, 236], hand: false }), ...claw(p, 114, 220, -0.4, 1.6), ...arm(p, -1, { lift: 1, elbow: [60, 326], wrist: [74, 214], hand: false }), ...claw(p, 70, 198, -0.3, 1.6)] },
  armsForward: { lift: [-1, 1], front: (p) => [...arm(p, -1, { lift: 0.7, elbow: [96, 436], wrist: [126, 404], hand: false }), ...claw(p, 132, 386, -0.1, 2.1), ...arm(p, 1, { lift: 0.7, elbow: [304, 436], wrist: [274, 404], hand: false }), ...claw(p, 268, 386, 0.1, 2.1)] }, // reaching at the camera: the hands large and near, the arms stubs behind them
  reachRight: { lift: [1], front: (p) => [...arm(p, 1, { lift: 0.7, elbow: [304, 436], wrist: [272, 404], hand: false }), ...claw(p, 264, 386, 0.1, 2)] },
  veilBack: { back: () => [path('M 150 96 C 118 160, 92 260, 74 430 L 326 430 C 308 260, 282 160, 250 96 Z', fp('#f6f2ea', 0.5)), path('M 150 96 C 118 160, 92 260, 74 430', stroke('#fff', 1.5, 0.5)), path('M 250 96 C 282 160, 308 260, 326 430', stroke('#fff', 1.5, 0.5))] }, // the veil's sheet, behind the figure
};
Object.assign(PROPS, ZOMBIE_PROPS);
for (const n of Object.keys(ZOMBIE_MAKEUP)) tag('makeup', n, 'only:undead');
for (const n of Object.keys(ZOMBIE_MARKS)) tag('marks', n, 'only:undead');
for (const n of Object.keys(ZOMBIE_PROPS)) tag('props', n, 'only:undead');
/** The pack's own names, by kind: what its sheet shows. */
export const UNDEAD = { makeup: Object.keys(ZOMBIE_MAKEUP), marks: Object.keys(ZOMBIE_MARKS), props: Object.keys(ZOMBIE_PROPS), teeth: ['rotten'] };
