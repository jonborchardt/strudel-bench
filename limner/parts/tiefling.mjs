// The tiefling pack: what the tieflings cast (casts/tieflings.mjs) wears that nobody else does, tagged
// `only:tiefling`; the plain kit it shares with the other fantasy casts is parts/fantasy.mjs, and the tapered ear is
// the portrait's own `ears.pointed`, which the cast pins. Two horns rising from the temples and curving back (on the
// `over` slot, so they come through the hair and over a hat), a sigil burned between the brows wherever this face
// carries them, and a brocade robe with a standing collar. parts.html?pack=tiefling is the sheet.
import { TOPS, MAKEUP, NECKLINES, shade, path, ellipse, line, stroke } from '../portrait.mjs';
import { tagPack, torso } from './pen.mjs';

const HORN = '#4a3b39', EMBER = '#8d1f22', GOLD = '#c9a03c';

/** A horn from each temple, up and back over the skull, ridged; laid out for the default head and fitted to this face's width. */
MAKEUP.curvedHorns = { fit: 'face', over: () => [-1, 1].flatMap((sd) => { const x = 200 + sd * 62, y = 146; return [
  path(`M ${x} ${y} C ${x + sd * 28} ${y - 32}, ${x + sd * 36} ${y - 74}, ${x + sd * 18} ${y - 98} C ${x + sd * 26} ${y - 68}, ${x + sd * 14} ${y - 34}, ${x - sd * 12} ${y - 4} Z`, { fill: HORN, horn: true }),
  path(`M ${x + sd * 4} ${y - 12} C ${x + sd * 24} ${y - 40}, ${x + sd * 30} ${y - 70}, ${x + sd * 17} ${y - 92}`, stroke('#8d7a72', 2, 0.45)),
  ...[0, 1, 2].map((i) => path(`M ${x - sd * (6 - i * 6)} ${y - 10 - i * 24} Q ${x + sd * (10 + i * 6)} ${y - 18 - i * 26} ${x + sd * (20 + i * 4)} ${y - 14 - i * 26}`, stroke('#2b2220', 1.6, 0.45)))]; }) }; // the growth ridges across it
/** A sigil between the brows: a ring with two rays and a stem, placed off this face's own brow line. */
MAKEUP.infernalSigil = { face: (p) => { const by = p.eyes.y - p.eyes.browLift - 46; return [ellipse(200, by, 9, 9, { fill: 'none', stroke: EMBER, sw: 2.4, op: 0.9 }), ...[-1, 1].map((sd) => line(200 + sd * 9, by - 6, 200 + sd * 17, by - 15, stroke(EMBER, 2.2, 0.9))), line(200, by + 9, 200, by + 21, stroke(EMBER, 2.2, 0.9))]; } };

TOPS.brocadeRobe = (p) => { const c = p.top.color, dark = shade(c, 0.62); return [
  torso('M 68 480 C 82 390, 126 360, 162 348 L 238 348 C 274 360, 318 390, 332 480 Z', c),
  path('M 164 350 Q 200 374 236 350 Q 222 342 200 340 Q 178 342 164 350 Z', { fill: '#000', op: 0.12 }),
  path('M 158 348 L 164 326 L 236 326 L 242 348 Z', { fill: dark, collar: true }), // a standing collar
  ...[0, 1, 2, 3].flatMap((r) => [-1, 0, 1].map((k) => path(`M ${200 + k * 46} ${400 + r * 54} L ${212 + k * 46} ${418 + r * 54} L ${200 + k * 46} ${436 + r * 54} L ${188 + k * 46} ${418 + r * 54} Z`, { fill: 'none', stroke: p.top.accent ?? GOLD, sw: 1.4, op: 0.55 }))), // the brocade's diamonds
  path('M 150 470 L 250 530', stroke(dark, 18, 1, 'butt')), // a sash across the waist
  path('M 96 456 Q 200 444 304 456', stroke('#fff', 1.5, 0.05))]; };
NECKLINES.brocadeRobe = 'M 164 350 Q 200 374 236 350';

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const TIEFLING = { makeup: ['curvedHorns', 'infernalSigil'], tops: ['brocadeRobe'] };
tagPack(TIEFLING, 'only:tiefling');
