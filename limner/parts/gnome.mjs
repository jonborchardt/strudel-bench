// The gnome pack: what the gnomes cast (casts/gnomes.mjs) wears that nobody else does, tagged `only:gnome`; the
// tapered ears and the plain kit it shares with the other fantasy casts are parts/fantasy.mjs. A tall pointed felt
// hat leaning off the crown with a floppy tip, a tinker's leather apron over a shirt with pockets and a strap, and
// brass goggles (a GLASSES entry, so the generator's own "one memorable thing" can hand them out).
// parts.html?pack=gnome is the sheet.
import { TOPS, HATS, HAT_CROWN, GLASSES, NECKLINES, shade, path, ellipse, line, rect, stroke } from '../portrait.mjs';
import { tagPack, torso } from './pen.mjs';

const BRASS = '#b08d3c', LEATHER = '#6b4a30';

// one closed outline, left edge up to the tip and the right edge back down: the old path doubled back through its own
// dome, so the fill rule punched a wedge of scalp out of the hat
HATS.pointedFeltHat = (p) => [path('M 118 138 C 140 100, 178 66, 226 36 C 238 24, 254 18, 262 24 C 268 30, 266 46, 262 60 C 272 86, 270 112, 268 134 C 230 150, 160 152, 118 138 Z', { fill: p.hat.color }),
  path('M 118 138 C 160 152, 230 150, 268 134 L 266 120 C 230 136, 160 138, 120 124 Z', { fill: p.hat.accent }), // the band shares the hat's own base curve, so nothing of it hangs below the felt
  path('M 250 56 Q 262 94 258 128', stroke(shade(p.hat.color, 0.7), 2, 0.4)),
  ellipse(262, 22, 7, 7, { fill: p.hat.accent })];
HAT_CROWN.pointedFeltHat = 136;

TOPS.tinkerApron = (p) => { const c = p.top.color; return [
  torso('M 70 480 C 84 392, 128 364, 164 350 L 236 350 C 272 364, 316 392, 330 480 Z', c),
  path('M 160 388 L 240 388 L 254 700 L 146 700 Z', { fill: LEATHER }), path('M 160 388 L 240 388', stroke(shade(LEATHER, 0.7), 3, 0.7)),
  ...[-1, 1].map((s) => path(`M ${200 + s * 34} 390 L ${200 + s * 70} 356`, stroke(shade(LEATHER, 1.15), 9, 1, 'butt'))), // the apron's straps over the shoulders
  rect(166, 470, 32, 30, { fill: shade(LEATHER, 0.78) }), rect(206, 470, 32, 30, { fill: shade(LEATHER, 0.78) }), // pockets
  ...[0, 1].map((i) => line(172 + i * 44, 530, 184 + i * 44, 560, stroke(BRASS, 3, 0.85))), // a tool's handle out of each
  path('M 166 352 Q 200 376 234 352', stroke(shade(c, 0.6), 3, 0.5))]; };
NECKLINES.tinkerApron = 'M 166 352 Q 200 376 234 352';

GLASSES.brassGoggles = () => [ellipse(166, 196, 24, 22, { fill: '#2c3a40', op: 0.45 }), ellipse(234, 196, 24, 22, { fill: '#2c3a40', op: 0.45 }),
  ellipse(166, 196, 24, 22, { fill: 'none', stroke: BRASS, sw: 5 }), ellipse(234, 196, 24, 22, { fill: 'none', stroke: BRASS, sw: 5 }),
  line(190, 196, 210, 196, { stroke: BRASS, sw: 4 }), path('M 142 192 L 118 188', stroke('#5e4a22', 7)), path('M 258 192 L 282 188', stroke('#5e4a22', 7)),
  ellipse(158, 188, 5, 4, { fill: '#fff', op: 0.35 }), ellipse(226, 188, 5, 4, { fill: '#fff', op: 0.35 })];

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const GNOME = { tops: ['tinkerApron'], hats: ['pointedFeltHat'], glasses: ['brassGoggles'] };
tagPack(GNOME, 'only:gnome');
