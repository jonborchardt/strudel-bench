// The orc pack: what the orcs cast (casts/orcs.mjs) wears that nobody else does, tagged `only:orc`; the plain
// adventurer's kit it shares with the other fantasy casts is parts/fantasy.mjs. Tusks drawn from the mouth's own
// corners, so a wide mouth carries them wide and a smile lifts them with it; a riveted iron cap with cheek plates
// and a bone ridge over the crown; a hide shirt with fur at the shoulders and a strap across the chest; a clan
// tattoo of chevrons down the chest. parts.html?pack=orc is the sheet.
import { TOPS, JACKETS, HATS, HAT_CROWN, MAKEUP, MARKS, NECKLINES, shade, path, ellipse, stroke } from '../portrait.mjs';
import { tagPack, torso } from './pen.mjs';

const BONE = '#e8dcc0', INK = '#1f2a22';

/** Two tusks, rooted on the mouth's own parting and rising in front of the upper lip. The root is not placed beside
 *  the mouth at a fixed height: it sits on the lip line where that line actually runs on this face, which is the
 *  portrait's own `2t(1-t)` curve between the corners, so a smile lifts them, an open mouth drops them and a wide
 *  mouth sets them wide and makes them bigger. Each one is drawn with the shadow it casts on the lip under it, so it
 *  comes out of the mouth instead of lying on the chin. */
MAKEUP.tusks = { mouth: (p) => { const m = p.mouth, w = Math.max(m.width, 40), hw = w / 2, my = m.y, mid = my + (m.smile ?? 0) * 18 - 2 * (m.open ?? 0);
  const lineY = (f) => { const t = (f + 1) / 2; return my + 2 * t * (1 - t) * (mid - my); }; // the parting's height at this fraction across the mouth
  return [-1, 1].flatMap((sd) => { const f = sd * 0.72, x = 200 + f * hw, y = lineY(f), h = 18 + w * 0.14, bw = 5.2; return [
    ellipse(x, y + 1, bw + 2, 2.8, { fill: '#000', op: 0.22 }), // where it meets the lip
    path(`M ${x - bw} ${y + 1} C ${x - bw + sd * 0.6} ${y - h * 0.5}, ${x - sd * 1} ${y - h * 0.85}, ${x + sd * 3} ${y - h}`
      + ` C ${x + sd * 5} ${y - h * 0.72}, ${x + bw + sd * 1} ${y - h * 0.3}, ${x + bw} ${y + 1} Z`, { fill: BONE, tusk: true }),
    path(`M ${x - bw + 1.6} ${y - 2} C ${x - bw + 2 + sd * 0.6} ${y - h * 0.5}, ${x - sd * 0.6} ${y - h * 0.8}, ${x + sd * 2.6} ${y - h * 0.92}`, stroke('#fff', 1.8, 0.45)), // the light down its front
    path(`M ${x + bw - 1.2} ${y - 2} C ${x + bw + sd * 0.4} ${y - h * 0.32}, ${x + sd * 4.4} ${y - h * 0.68}, ${x + sd * 2.9} ${y - h * 0.9}`, stroke('#8d7f60', 1.4, 0.55))]; }); } }; // and the shaded edge behind it

HATS.boneHelm = (p) => [...[-1, 1].map((sd) => path(`M ${200 + sd * 60} 128 Q ${200 + sd * 90} 130 ${200 + sd * 88} 176 Q ${200 + sd * 86} 206 ${200 + sd * 72} 208 Q ${200 + sd * 60} 206 ${200 + sd * 60} 180 Z`, { fill: shade(p.hat.color, 0.8) })), // cheek plates over the ears, out past the face's edge with a rounded foot: drawn inside the face from the rim to a point on the cheek they were two daggers on the temples, blinkers rather than armour (T182)
  path('M 128 134 C 130 84, 162 62, 200 62 C 238 62, 270 84, 272 134 Z', { fill: p.hat.color }),
  path('M 128 134 Q 200 122 272 134', stroke(shade(p.hat.color, 0.62), 5, 0.9, 'butt')),
  path('M 200 60 L 200 132', stroke(BONE, 7, 0.9)), ...[0, 1, 2].map((i) => path(`M 188 ${80 + i * 20} L 212 ${80 + i * 20}`, stroke(BONE, 3, 0.8))), // a bone ridge, lashed down
  ...[-1, 1].flatMap((sd) => [ellipse(200 + sd * 46, 116, 3.2, 3.2, { fill: shade(p.hat.color, 0.55) }), ellipse(200 + sd * 26, 92, 3, 3, { fill: shade(p.hat.color, 0.55) })])];
HAT_CROWN.boneHelm = 134;

TOPS.hideArmor = (p) => [torso('M 64 480 C 78 386, 124 356, 160 344 L 240 344 C 276 356, 322 386, 336 480 Z', p.top.color),
  path('M 160 346 Q 200 384 240 346', stroke(shade(p.top.color, 0.55), 7, 0.7, 'butt')),
  ...Array.from({ length: 18 }, (_, i) => { const x = 86 + i * 13, y = 392 + Math.sin(i * 1.9) * 7; return path(`M ${x} ${y - 16} Q ${x + 4} ${y} ${x - 2} ${y + 14}`, stroke(i % 2 ? shade(p.top.color, 0.6) : shade(p.top.color, 1.3), 3, 0.65)); }), // fur over the shoulders, in tufts
  ...[[128, 452], [226, 472], [162, 508]].map(([x, y], i) => path(`M ${x} ${y} Q ${x + 30} ${y - 14} ${x + 54} ${y + 6} Q ${x + 28} ${y + 30} ${x} ${y} Z`, { fill: shade(p.top.color, i % 2 ? 1.18 : 0.82), op: 0.9 })), // patches of other hide, stitched on
  path('M 112 422 L 290 518', stroke('#4b3426', 16, 1, 'butt')), ellipse(201, 470, 8, 8, { fill: '#b9a06a' })];
NECKLINES.hideArmor = 'M 160 346 Q 200 384 240 346';
JACKETS.wolfPelt = (p) => { const c = p.jacket.color, dark = shade(c, 0.6), light = shade(c, 1.35); return [
  path('M 52 700 L 48 436 C 54 382, 112 352, 170 348 L 158 700 Z', { fill: c }), path('M 348 700 L 352 436 C 346 382, 288 352, 230 348 L 242 700 Z', { fill: c }),
  ...Array.from({ length: 30 }, (_, i) => { const x = 56 + i * 10.4, y = 372 + Math.sin(i * 1.4) * 10; return path(`M ${x} ${y - 18} Q ${x + 4} ${y + 2} ${x - 3} ${y + 20}`, stroke(i % 2 ? dark : light, 3.2, 0.6)); }),
  path('M 170 350 Q 200 374 230 350', stroke(dark, 4, 0.5)), ellipse(200, 358, 6, 6, { fill: '#8d7f60' })]; }; // a pelt over both shoulders, the fur drawn in tufts, pinned at the throat
MARKS.clanTattoo = { chest: () => [path('M 150 400 L 200 388 L 250 400', stroke(INK, 4, 0.75)), path('M 160 424 L 200 412 L 240 424', stroke(INK, 3.4, 0.7)), path('M 176 452 L 200 440 L 224 452', stroke(INK, 3, 0.65)), ellipse(200, 486, 10, 10, { fill: 'none', stroke: INK, sw: 3, op: 0.7 }), ellipse(200, 486, 3, 3, { fill: INK, op: 0.7 })] };

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const ORC = { makeup: ['tusks'], hats: ['boneHelm'], tops: ['hideArmor'], jackets: ['wolfPelt'], marks: ['clanTattoo'] };
tagPack(ORC, 'only:orc');
