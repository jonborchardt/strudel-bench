// crawl's screen-space art: the weapons as the walker holds them, the muzzle flashes, the face in the status bar
// and the bar itself. Painted once, as sprites.mjs paints the creatures, with the same forms and the same light.
// The weapons are frames, not one drawing slid about: the shotgun's fore-end really comes back with the hand on it,
// the pistol's slide really moves, the rotary's barrels really turn.
import { R, ix, T } from './art.mjs';
import { cv, ell, limb, poly, box, dot, set, get, shade, crease, outline } from './sprites.mjs';
import { VH, BAR, rect, text, digits, panel, blit } from './render.mjs';

// ---------- weapons ----------
// Every weapon is painted as the walker sees it: from directly behind and a little above, so it is short and broad,
// its back end large and near and its barrel a stub running away. The hand that holds it is cupped underneath, and
// the wrist goes straight down out of the bottom of the frame, so there is never an arm in view: only as much
// forearm as a shot or the action throws up into the picture. Rows above `top` are empty; the canvas runs on below
// what is seen at rest.
const HIDE = { lo: 1.4, hi: 5.6 }; // the gloves are leather, so a hand never reads as part of the gun
const glove = (c, x, y, rx, ry) => { ell(c, x, y, rx, ry, R.tan, HIDE); for (let k = -1; k <= 1; k++) crease(c, x + k * rx * 0.45, y - ry * 0.7, x + k * rx * 0.5, y + ry * 0.2, 0, -2); }; // a fist: the seams between the knuckles
const wrist = (c, x, y, x1, y1, r) => { limb(c, x1, y1, x, y, r + 2, r, R.olive, { lo: 0.6, hi: 4.2 }); limb(c, x, y + 5, x, y + 1, r + 1, r + 0.5, R.brown, { lo: 0.6, hi: 3 }); }; // a sleeve and the glove's cuff, running down and out

function shotgun(pump = 0) { // pump: how far the fore-end has been hauled back toward the eye, in pixels
  const c = cv(120, 104, 60, 103), cx = 60, fy = 18 + pump;
  // the arm that works the action: a forearm running up under the gun on its left, parallel to it, to the hand on the fore-end
  limb(c, cx - 21, 110, cx - 17, fy + 22, 9.5, 7.5, R.olive, { lo: 0.6, hi: 4.4 }); for (let y = fy + 30; y < 104; y += 9) crease(c, cx - 28, y, cx - 11, y + 2, 1, -1); // the sleeve, creased
  limb(c, cx - 17, fy + 24, cx - 16.5, fy + 19, 8.4, 8, R.brown, { lo: 0.6, hi: 3.2 }); // the glove's cuff
  wrist(c, cx + 15, 86, cx + 17, 112, 9); glove(c, cx + 15, 80, 10, 8); // the trigger hand, low on the right, mostly behind the receiver
  limb(c, cx - 5.5, 42, cx - 4.5, 16, 5, 3.6, R.steel, { lo: 0.4, hi: 3 }); ell(c, cx - 4.5, 16, 3.4, 2, R.steel, { lo: 1, hi: 4 }); // magazine tube and its cap
  limb(c, cx + 1.5, 44, cx + 1, 9, 7, 5, R.steel, { lo: 1, hi: 6.6 }); // the barrel, running away
  box(c, cx, 3, 2, 3, R.bone, (i, j) => 7 - j); // the bead on the far end; the bore faces away and is not seen from here
  for (let y = 12; y < 44; y++) { shade(c, cx - 2, y, 3); shade(c, cx + 6, y, -2); } // a hard light down it
  glove(c, cx - 15, fy + 10, 9, 9); // the hand, cupped under the wood: what shows is its near side
  poly(c, [[cx - 15.5, fy + 19], [cx + 15, fy + 19], [cx + 12, fy], [cx - 12.5, fy]], R.brown, (x, y) => 5.6 - Math.abs(x - cx + 6) * 0.25 - ((y - fy) % 3 === 0 ? 3 : (y - fy) % 3 === 1 ? -0.6 : 0)); // the fore-end, ribbed
  for (let y = fy; y < fy + 19; y++) { shade(c, cx - 12 - (y - fy) * 0.16, y, -3); shade(c, cx + 11 + (y - fy) * 0.16, y, -3); } // its edges turn away
  limb(c, cx + 1.4, fy + 20, cx + 1.2, fy - 1, 6.6, 5.8, R.steel, { lo: 1.4, hi: 6.6 }); // the barrel rides over the wood
  limb(c, cx - 19, fy + 9, cx - 11, fy + 3, 3, 2.4, R.tan, HIDE); // a thumb laid over the top of it
  // the receiver, seen along its top: narrow where it meets the barrel, broad and rounded at the end by the eye
  poly(c, [[cx - 10, 40], [cx + 11, 40], [cx + 15.5, 80], [cx - 14.5, 80]], R.steel, (x, y) => 4.8 - Math.abs(x - cx + 4 + (y - 40) * 0.04) * 0.22 - (y - 40) * 0.012);
  ell(c, cx + 0.5, 80, 15, 6, R.steel, { lo: 1.4, hi: 5.4 });
  for (let y = 41; y < 80; y++) { const w = 3 + (y - 40) * 0.05; for (let i = -w; i <= w; i++) set(c, cx + 0.5 + i, y, ix(R.steel, i < -w + 1.5 ? 6.6 : i > w - 1.5 ? 1 : 3.6)); } // the rib down its middle
  box(c, cx - 1, 39, 3, 3, R.steel, 0); dot(c, cx, 40, R.bone, 6); // the rear sight
  poly(c, [[cx + 6, 54], [cx + 12, 54], [cx + 13, 64], [cx + 7, 64]], R.steel, (x, y) => (y === 54 || x <= cx + 7 ? 0 : 1)); dot(c, cx + 10, 59, R.yellow, 5); dot(c, cx + 11, 59, R.yellow, 3); // the port, a shell in it
  crease(c, cx - 11, 50, cx + 12, 50, 0, -3); crease(c, cx - 13, 70, cx + 14, 70, 0, -3); for (const s of [-1, 1]) for (const y of [45, 60, 75]) { shade(c, cx + s * (7 + (y - 40) * 0.1), y, 3); shade(c, cx + s * (7 + (y - 40) * 0.1) + 1, y + 1, -3); } // seams and pins
  return outline(c);
}
function pistol(back = 0) { // back: the slide's travel toward the eye
  const c = cv(100, 100, 50, 99), cx = 50, sy = 10 + back;
  wrist(c, cx + 5, 70, cx + 8, 110, 13); // the wrist, straight down and out
  ell(c, cx + 3, 54, 19, 17, R.tan, HIDE); // the back of the hand, wrapped round the grip from the right
  for (let k = 0; k < 4; k++) { ell(c, cx + 20 - k * 1.5, 42 + k * 7, 4.6, 4, R.tan, { lo: 1.2, hi: 4.6 }); crease(c, cx + 14 - k, 45 + k * 7, cx + 23 - k * 1.5, 45.5 + k * 7, 0, -2); } // four knuckles down its edge
  crease(c, cx - 8, 60, cx + 14, 66, 2, -2); crease(c, cx - 4, 50, cx + 6, 47, -1, -1); // the hide folds
  limb(c, cx - 15, 52, cx - 12, 30, 5.4, 4.4, R.tan, HIDE); ell(c, cx - 12, 29, 4.2, 3.6, R.tan, { lo: 2, hi: 6 }); crease(c, cx - 16, 40, cx - 9, 39, 0, -2); // the thumb, up the near side of the frame
  // the pistol: the back of its slide square to the eye, its top running away to the front sight
  poly(c, [[cx - 6, sy - 5], [cx + 6, sy - 5], [cx + 10, sy + 3], [cx - 10, sy + 3]], R.steel, (x, y) => 6 - Math.abs(x - cx + 2) * 0.3 - (sy + 3 - y) * 0.25); // the top of the slide
  box(c, cx - 1, sy - 8, 2, 4, R.steel, 1); dot(c, cx, sy - 8, R.accA, 7); // the front sight, far off
  poly(c, [[cx - 10, sy + 3], [cx + 10, sy + 3], [cx + 10, sy + 30], [cx - 10, sy + 30]], R.steel, (x, y) => 4.4 - (x - cx + 10) * 0.16 - (y - sy - 3) * 0.03); // its back face
  for (let y = sy + 3; y < sy + 30; y++) { shade(c, cx - 10, y, 3); shade(c, cx + 9, y, -3); } for (let x = cx - 10; x < cx + 10; x++) shade(c, x, sy + 3, 3); // lit edges
  for (let k = 0; k < 7; k++) { box(c, cx - 9, sy + 8 + k * 3, 4, 1, R.steel, 0.6); box(c, cx + 5, sy + 8 + k * 3, 4, 1, R.steel, 0.4); } // the serrations either side
  box(c, cx - 8, sy - 1, 5, 5, R.steel, (i, j) => (i === 0 || j === 0 ? 5 : 1.4)); box(c, cx + 3, sy - 1, 5, 5, R.steel, (i, j) => (i === 0 || j === 0 ? 5 : 1.4)); dot(c, cx - 6, sy + 1, R.bone, 7); dot(c, cx + 5, sy + 1, R.bone, 7); // the rear sight: two posts, a dot on each
  ell(c, cx, sy + 18, 4, 4, R.steel, { lo: 0.4, hi: 2.4 }); ell(c, cx, sy + 18, 2, 2, R.steel, { flat: 0 }); // the firing pin's plate
  poly(c, [[cx - 3, sy + 24], [cx + 3, sy + 24], [cx + 2, sy + 33], [cx - 2, sy + 33]], R.steel, (x) => 4 - (x - cx + 3) * 0.5); for (let k = 0; k < 3; k++) box(c, cx - 2, sy + 26 + k * 2, 4, 1, R.steel, 0.6); // the hammer, ridged
  poly(c, [[cx - 10, sy + 30], [cx + 10, sy + 30], [cx + 9, sy + 36], [cx - 12, sy + 36]], R.steel, (x) => 2.6 - (x - cx + 10) * 0.08); // the tang, over the web of the hand
  return outline(c);
}
function rotary(turn = 0) { // six barrels in a clamp, turning: the highlight walks across the three that show
  const c = cv(130, 96, 65, 95), cx = 65;
  for (const s of [-1, 1]) { wrist(c, cx + s * 30, 72, cx + s * 31, 104, 9); glove(c, cx + s * 33, 66, 10, 8); } // carried from underneath: the gloves show at its sides
  for (let k = 0; k < 3; k++) { const lit = (k + turn) % 3; limb(c, cx + (k - 1) * 9, 46, cx + (k - 1) * 6, 9, 5, 3.2, R.steel, { lo: lit === 0 ? 2 : 0.6, hi: lit === 0 ? 7 : lit === 1 ? 5 : 4 }); } // their far ends are just ends: the bores face away
  for (const y of [20, 34]) { const w = 11 + (y - 9) * 0.16; box(c, Math.round(cx - w), y, Math.round(w * 2), 4, R.steel, (i, j) => (j === 0 ? 6 : j === 3 ? 0.6 : 3 - i * 0.04)); } // the clamps
  ell(c, cx, 52, 34, 13, R.steel, { lo: 1.6, hi: 6.2 }); // the housing, end on
  poly(c, [[cx - 34, 52], [cx + 34, 52], [cx + 37, 80], [cx - 37, 80]], R.steel, (x, y) => 4 - Math.abs(x - cx + 10) * 0.07 - (y - 52) * 0.04);
  crease(c, cx - 35, 62, cx + 35, 62, 0, -3); for (let i = 0; i < 8; i++) { shade(c, cx - 28 + i * 8, 58, 3); shade(c, cx - 27 + i * 8, 59, -3); }
  box(c, cx - 4, 46, 8, 30, R.accA, (i, j) => (j % 4 === 0 ? 1 : 3 + (((j >> 2) + turn) % 3))); // the counter, lit, ticking with the barrels
  poly(c, [[cx - 54, 80], [cx - 36, 80], [cx - 34, 58], [cx - 48, 58]], R.olive, (x) => 3.6 - (x - cx + 54) * 0.07); for (let k = 0; k < 4; k++) box(c, cx - 47 + k * 3, 60, 2, 5, R.yellow, (i) => 6 - i * 2); // the belt box, rounds showing
  return outline(c);
}
function cannon(charge = 0) { // a slab of emitter, end on: lit coils across its back, brighter as it charges
  const c = cv(140, 96, 70, 95), cx = 70;
  for (const s of [-1, 1]) { wrist(c, cx + s * 38, 74, cx + s * 39, 104, 9); glove(c, cx + s * 41, 68, 10, 8); }
  ell(c, cx, 13, 17, 7, R.steel, { lo: 0.4, hi: 3 }); ell(c, cx, 12, 13, 4.6, R.accB, { lo: 1 + charge * 3, hi: 4 + charge * 3 }); if (charge > 0.5) ell(c, cx, 12, 7, 2.4, R.accB, { flat: 7 }); // the emitter's mouth, away from the eye
  poly(c, [[cx - 17, 14], [cx + 17, 14], [cx + 26, 36], [cx - 26, 36]], R.steel, (x, y) => 2.8 - Math.abs(x - cx + 7) * 0.07); // its neck
  ell(c, cx, 38, 42, 9, R.steel, { lo: 2, hi: 6.2 });
  poly(c, [[cx - 42, 38], [cx + 42, 38], [cx + 46, 82], [cx - 46, 82]], R.steel, (x, y) => 4.2 - Math.abs(x - cx + 12) * 0.06 - (y - 38) * 0.03);
  for (let k = 0; k < 4; k++) { const y = 42 + k * 9, w = 30 + k * 2.4; box(c, Math.round(cx - w), y, Math.round(w * 2), 5, R.accB, (i, j) => clamp(1 + charge * 4 + (j === 1 || j === 2 ? 2 : 0) - Math.abs(i - w) * 0.04, 0, 7)); box(c, Math.round(cx - w), y + 5, Math.round(w * 2), 2, R.steel, 0.5); } // coils
  for (const s of [-1, 1]) poly(c, [[cx + s * 42, 36], [cx + s * 54, 46], [cx + s * 55, 72], [cx + s * 46, 72]], R.steel, (x, y) => (s < 0 ? 5 : 2.4) - (y - 36) * 0.03); // fins
  box(c, cx - 5, 74, 10, 8, R.red, (i, j) => (i === 0 || j === 0 ? 6 : 3)); // a guarded switch
  return outline(c);
}
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
function flash(r, spikes, ramp = R.fire, k = 0) { // a star of light: emissive, drawn over the muzzle for a frame or two
  const c = cv(r * 2 + 4, r * 2 + 4, r + 2, r + 2), m = r + 2;
  for (let i = 0; i < spikes; i++) { const a = (i / spikes) * 6.283 + k * 0.5, len = r * (i & 1 ? 0.62 : 1); limb(c, m, m, m + Math.cos(a) * len, m + Math.sin(a) * len, r * 0.26, 0.4, ramp, { lo: 3, hi: 6 }); }
  ell(c, m, m, r * 0.5, r * 0.5, ramp, { lo: 5, hi: 7 }); ell(c, m, m, r * 0.28, r * 0.28, ramp, { flat: 7 });
  return c;
}
// frames: what weaponFrame names; muzzle: the flash's place on the canvas; kick: how hard it throws the view; top: the row of the canvas its tip is on
// (the world holds every weapon with its tip REST of the view's height up from the bar, and a shot throws it up to SHOT)
export const REST = 0.3, SHOT = 0.45;
export const WEAPONS = {
  pistol: { n: 1, frames: [pistol(0), pistol(4), pistol(2)], muzzle: [50, 4], flash: [flash(10, 6), flash(8, 6, R.fire, 1)], kick: 5, top: 2, ammo: 'CLIP' },
  shotgun: { n: 2, frames: [shotgun(0), shotgun(0), shotgun(5), shotgun(10), shotgun(5)], muzzle: [61, 8], flash: [flash(20, 9), flash(15, 9, R.fire, 1)], kick: 13, top: 4, ammo: 'SHEL' },
  rotary: { n: 3, frames: [rotary(0), rotary(1), rotary(2)], muzzle: [65, 8], flash: [flash(13, 7), flash(11, 7, R.fire, 1)], kick: 3, top: 7, ammo: 'BELT' },
  cannon: { n: 4, frames: [cannon(0), cannon(0.5), cannon(1)], muzzle: [70, 11], flash: [flash(22, 10, R.accB), flash(16, 10, R.accB, 1)], kick: 14, top: 6, ammo: 'CELL' },
};
/**
 * Which frame `age` seconds after its last shot, and which flash (an index, or -1). The shotgun's whole business:
 * bang, hold, haul the fore-end back, shove it home, in the song's time (`k`: its beat against half a second).
 */
export function weaponFrame(name, age, turn = 0, k = 1) {
  if (name === 'shotgun') { const f = age < 0.14 * k ? 1 : age < 0.25 * k ? 2 : age < 0.37 * k ? 3 : age < 0.5 * k ? 4 : 0; return { frame: f, flash: age < 0.035 ? 0 : age < 0.07 ? 1 : -1 }; }
  if (name === 'pistol') return { frame: age < 0.05 ? 1 : age < 0.1 ? 2 : 0, flash: age < 0.035 ? 0 : age < 0.06 ? 1 : -1 };
  if (name === 'rotary') return { frame: age < 0.3 ? turn % 3 : 0, flash: age < 0.03 ? 0 : age < 0.06 ? 1 : -1 };
  return { frame: age < 0.08 ? 2 : age < 0.5 ? 1 : 0, flash: age < 0.05 ? 0 : age < 0.1 ? 1 : -1 };
}

// ---------- the face ----------
// One person, drawn for every look the bar needs: where the eyes are (-1 left, 0, 1 right), the mood, and how badly hurt (0..3).
function face(look, mood, hurt) {
  const c = cv(28, 31, 14, 30), cx = 14;
  limb(c, cx, 30, cx, 24, 6, 5, R.flesh, { lo: 0.6, hi: 3 }); // neck
  poly(c, [[1, 31], [27, 31], [24, 26], [4, 26]], R.olive, (x) => 3.6 - (x - 1) * 0.08); // collar
  ell(c, cx, 14, 9.6, 11, R.flesh, { lo: 1.6, hi: 6 }); // the head
  poly(c, [[cx - 8, 16], [cx + 8, 16], [cx + 6, 25], [cx - 6, 25]], R.flesh, (x, y) => 5 - (x - cx + 8) * 0.18 - (y - 16) * 0.12); // a square jaw
  for (let y = 19; y < 26; y++) for (let x = cx - 7; x <= cx + 7; x++) if (get(c, x, y) && ((x + y) & 1) && (y > 21 || Math.abs(x - cx) > 4)) set(c, x, y, ix(R.flesh, 2)); // stubble
  poly(c, [[cx - 10, 11], [cx - 8, 3], [cx, 1], [cx + 8, 3], [cx + 10, 11], [cx + 7, 7], [cx - 7, 7]], R.brown, (x, y) => 2.4 - (x - cx + 10) * 0.06 + (y < 4 ? 1 : 0)); // cropped hair
  for (const [x, y] of [[cx - 3, 3], [cx - 2, 4], [cx - 2, 2], [cx - 1, 5]]) dot(c, x, y, R.bone, 6); // a grey streak
  box(c, cx - 11, 8, 22, 2, R.steel, (i) => 4 - i * 0.1); ell(c, cx - 10, 14, 2.6, 3.6, R.steel, { lo: 1, hi: 5 }); limb(c, cx - 10, 17, cx - 5, 22, 0.8, 0.8, R.steel, { lo: 1, hi: 4 }); dot(c, cx - 4, 22, R.accA, 7); // headset, earcup, boom
  ell(c, cx + 10, 14, 1.6, 2.6, R.flesh, { lo: 1.5, hi: 4 }); // the other ear
  const shut = mood === 'pain', by = mood === 'angry' ? 1 : mood === 'alert' ? -1 : 0;
  for (const s of [-1, 1]) {
    const ex = cx + s * 4;
    if (shut) { box(c, ex - 2, 13, 4, 1, R.brown, 0); dot(c, ex - 2 * s, 12, R.brown, 0); }
    else { box(c, ex - 2, 12, 4, 2, R.bone, (i, j) => (j ? 6 : 7)); box(c, ex - 1 + look, 12, 2, 2, R.steel, 0); if (mood === 'alert') box(c, ex - 2, 11, 4, 1, R.bone, 7); }
    for (let i = 0; i < 4; i++) dot(c, ex - 2 * s + i * s, 10 + by * (mood === 'angry' ? (i > 1 ? 1 : 0) : 1) * (mood === 'alert' ? 1 : 1) + (mood === 'angry' && i > 2 ? 0 : 0), R.brown, 0); // brow
    dot(c, ex - 2, 14, R.flesh, 2); dot(c, ex + 1, 14, R.flesh, 2);
  }
  box(c, cx - 1, 14, 2, 4, R.flesh, (i) => (i ? 2.4 : 6)); dot(c, cx - 1, 18, R.flesh, 1); dot(c, cx + 1, 18, R.flesh, 1); // nose
  if (mood === 'grin') { box(c, cx - 4, 20, 8, 2, R.bone, (i, j) => (j ? 5 : 7)); dot(c, cx - 5, 19, R.brown, 0); dot(c, cx + 4, 19, R.brown, 0); box(c, cx - 4, 22, 8, 1, R.brown, 0); }
  else if (mood === 'angry') { box(c, cx - 4, 20, 8, 3, R.brown, 0); box(c, cx - 3, 20, 6, 1, R.bone, 7); box(c, cx - 3, 22, 6, 1, R.bone, 5); for (const x of [-2, 0, 2]) dot(c, cx + x, 21, R.brown, 0); }
  else if (mood === 'pain') { box(c, cx - 3, 20, 6, 4, R.brown, 0); box(c, cx - 2, 20, 4, 1, R.bone, 7); box(c, cx - 2, 22, 4, 1, R.red, 3); }
  else if (mood === 'alert') { box(c, cx - 2, 21, 5, 1, R.brown, 0); dot(c, cx - 3, 20, R.flesh, 2); }
  else { box(c, cx - 3, 21, 6, 1, R.brown, 0); dot(c, cx - 4, 21, R.flesh, 2); dot(c, cx + 3, 21, R.flesh, 2); }
  if (hurt >= 1) { for (let j = 0; j < 6; j++) dot(c, cx + 5, 6 + j, R.red, 5 - (j % 2)); dot(c, cx + 6, 9, R.red, 4); dot(c, cx + 4, 12, R.red, 4); } // a cut over one eye
  if (hurt >= 2) { for (let j = 0; j < 5; j++) dot(c, cx - 1 + (j > 2 ? 1 : 0), 18 + j, R.red, 5 - (j % 2)); ell(c, cx - 6, 17, 2.4, 1.8, R.purple, { lo: 2, hi: 4 }); } // a bleeding nose, a bruise
  if (hurt >= 3) { for (const [x, y] of [[cx - 7, 9], [cx - 6, 10], [cx - 8, 11], [cx + 7, 19], [cx + 6, 21], [cx - 3, 24], [cx + 2, 5], [cx + 1, 7]]) dot(c, x, y, R.red, 4 + ((x + y) & 1)); ell(c, cx + 5, 13, 3, 2.2, R.purple, { lo: 1.5, hi: 3.5 }); }
  return outline(c);
}
export const FACES = {};
for (const hurt of [0, 1, 2, 3]) { for (const look of [-1, 0, 1]) FACES[`neutral${look}${hurt}`] = face(look, 'neutral', hurt); for (const m of ['alert', 'angry', 'pain', 'grin']) FACES[`${m}0${hurt}`] = face(0, m, hurt); }
/** The face for a moment: mood, where the eyes go, health. */
export const faceOf = (mood, look, health) => { const hurt = health > 75 ? 0 : health > 50 ? 1 : health > 25 ? 2 : 3; return FACES[`${mood}${mood === 'neutral' ? look : 0}${hurt}`] ?? FACES.neutral00; };

// ---------- the bar ----------
const plate = (fb, lut, x, y, w, h) => { rect(fb, lut, x, y, w, h, ix(R.steel, 0)); rect(fb, lut, x, y + h - 1, w, 1, ix(R.steel, 5)); rect(fb, lut, x + w - 1, y, 1, h, ix(R.steel, 4)); rect(fb, lut, x, y, w, 1, 1); rect(fb, lut, x, y, 1, h, 1); }; // sunk: dark above and left, lit below and right
/**
 * The status bar across the bottom of the frame. `v`: { health, armor, ammo, ammoName, kills, keys: [r, b, y], arms:
 * [owned x4], cur (1..4), sector (number), name, beat, beats, face (a bitmap), bpm }. This world's own arrangement:
 * the face at the left end, vitals beside it, the song in the middle, the count and the ammunition at the right.
 */
export function drawBar(fb, lut, v) {
  const W = fb.W, y = VH;
  panel(fb, lut, T.steel, 0, y, W, BAR, 7);
  rect(fb, lut, 0, y, W, 1, ix(R.steel, 6)); rect(fb, lut, 0, y + 1, W, 1, ix(R.steel, 3)); rect(fb, lut, 0, y + BAR - 1, W, 1, 1);
  const lab = ix(R.bone, 4), field = (x, w, name, val, ramp = R.red) => { plate(fb, lut, x, y + 3, w, BAR - 5); text(fb, lut, x + 3, y + 5, name, lab); digits(fb, lut, x + w - 2 - String(val).length * 12, y + 13, String(val), ramp); };
  plate(fb, lut, 3, y + 2, 32, BAR - 3); blit(fb, lut, v.face, 5, y + 3);
  field(38, 54, 'HEALTH', `${v.health}%`); field(95, 42, 'ARMOR', v.armor, v.armor ? R.blue : R.steel);
  plate(fb, lut, 140, y + 3, 40, BAR - 5); text(fb, lut, 143, y + 5, 'ARMS', lab); // the four weapon slots
  for (let k = 0; k < 4; k++) { const gx = 144 + (k % 2) * 18, gy = y + 13 + (k >> 1) * 9, own = v.arms[k], cur = v.cur === k + 1; if (cur) rect(fb, lut, gx - 2, gy - 1, 15, 8, ix(R.yellow, 2)); text(fb, lut, gx, gy, String(k + 1), own ? ix(R.yellow, cur ? 7 : 5) : ix(R.steel, 3)); if (own) rect(fb, lut, gx + 5, gy + 1, 6, 3, ix(cur ? R.fire : R.steel, cur ? 5 : 4)); }
  plate(fb, lut, 183, y + 3, 15, BAR - 5); // keys: three cards, lit when held
  [R.red, R.blue, R.yellow].forEach((ramp, k) => { rect(fb, lut, 186, y + 6 + k * 8, 9, 6, v.keys[k] ? ix(ramp, 5) : ix(R.steel, 1)); if (v.keys[k]) { rect(fb, lut, 186, y + 6 + k * 8, 9, 1, ix(ramp, 7)); rect(fb, lut, 188, y + 8 + k * 8, 3, 2, 1); } });
  const rx = W - 91; field(rx, 42, 'KILLS', v.kills); field(rx + 45, 43, v.ammoName, v.ammo, R.yellow);
  const mx = 201, mw = rx - 3 - mx; // the middle: where in the song this is
  if (mw > 40) {
    plate(fb, lut, mx, y + 3, mw, BAR - 5);
    text(fb, lut, mx + 3, y + 5, `SECTOR ${v.sector}`, lab); text(fb, lut, mx + 3, y + 13, String(v.name).slice(0, Math.floor((mw - 6) / 4)), ix(R.accA, 6));
    for (let k = 0; k < v.beats; k++) rect(fb, lut, mx + 3 + k * 7, y + 22, 5, 5, k === v.beat ? ix(R.accA, 7) : k < v.beat ? ix(R.accA, 2) : ix(R.steel, 2));
    if (mw > 70) text(fb, lut, mx + mw - 3 - 4 * `${v.bpm} BPM`.length, y + 22, `${v.bpm} BPM`, lab);
  }
}
