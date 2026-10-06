// The dwarf pack: what the dwarves cast (casts/dwarves.mjs) wears that nobody else does, registered by name into the
// portrait's registries and tagged `only:dwarf`, so no pool that does not name that tag ever gets one. Two beards on
// portrait.mjs's own beard band (`beardOps`: a long braided one with a walrus moustache, a forked one), the beads
// down the braids as a mark on the `over` slot (drawn after the beard's mass, or they would be under it), two hats
// (a hornless steel helm with a nasal, a leather cap with ear flaps), a mail shirt (a ring texture over the chest)
// and a fur mantle over the shoulders with a clasp. parts.html?pack=dwarf is the sheet.
import { FACIAL_HAIR, HATS, HAT_CROWN, TOPS, JACKETS, MARKS, NECKLINES, beardOps, shade, path, ellipse, rect, stroke, tag } from '../portrait.mjs';

const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill }); // as portrait.mjs: a top's torso runs past the sheet's bottom
const GOLD = '#c9a03c';

// --- beards: the band is portrait.mjs's, cut to this face's own outline; the specs are what BEARDS entries carry ---
FACIAL_HAIR.braidedBeard = (p) => beardOps(p, { top: 22, cheek: 0.02, lip: 6, chin: 90, stache: true, stacheStyle: 'walrus' }); // long and full, down past the collar: the braids and beads are the beadedBraids mark
FACIAL_HAIR.forkedBeard = (p) => beardOps(p, { top: 26, cheek: 0.1, lip: 8, chin: 70, width: 0.8, sharp: true, stache: true, stacheStyle: 'chevron' }); // narrower and drawn to points
/** Three braids hanging from the chin with three beads each, in the beard's own colour; on the `over` slot, laid out by the face. */
MARKS.beadedBraids = { fit: 'face', over: (p) => { const c = p.facialHair?.color ?? p.hairColor; return [184, 200, 216].flatMap((x) => { const dx = (x - 200) * 0.3, at = (t) => x + dx * t; return [path(`M ${x} 330 Q ${at(0.5) - dx * 0.1} 372 ${at(1)} 414`, stroke(c, 6, 1)), path(`M ${x} 330 Q ${at(0.5) - dx * 0.1} 372 ${at(1)} 414`, stroke('#000', 1.2, 0.2)), ...[0.25, 0.55, 0.85].map((t) => ellipse(at(t), 330 + 84 * t, 3.4, 3.4, { fill: GOLD })), ...[0.25, 0.55, 0.85].map((t) => ellipse(at(t) - 1, 330 + 84 * t - 1, 1.2, 1.2, { fill: '#fff3c8', op: 0.7 }))]; }); } };

// --- hats: a crown line like a cap's, so the hair is cut under them and the brim's shadow falls on the face ---
HATS.hornlessHelm = (p) => [path('M 124 128 C 124 74, 158 50, 200 50 C 242 50, 276 74, 276 128 Z', { fill: p.hat.color }), path('M 124 128 Q 200 116 276 128 L 276 142 Q 200 130 124 142 Z', { fill: shade(p.hat.color, 0.7) }), rect(196, 128, 8, 52, { rx: 2, fill: shade(p.hat.color, 0.75) }), path('M 150 72 Q 200 58 250 72', stroke('#fff', 3, 0.2)), path('M 200 52 L 200 126', stroke(shade(p.hat.color, 0.6), 2.5, 0.6)), ...[-1, 1].flatMap((s) => [ellipse(200 + s * 44, 112, 3, 3, { fill: shade(p.hat.color, 0.5) }), ellipse(200 + s * 22, 94, 3, 3, { fill: shade(p.hat.color, 0.5) })])]; // a steel dome with a rim band, a nasal down the forehead and rivets
HAT_CROWN.hornlessHelm = 128;
HATS.leatherCap = (p) => [...[-1, 1].map((s) => path(`M ${200 + s * 62} 126 Q ${200 + s * 80} 152 ${200 + s * 72} 196 Q ${200 + s * 58} 184 ${200 + s * 52} 140 Z`, { fill: shade(p.hat.color, 0.85) })), path('M 126 137 C 128 90, 160 70, 200 70 C 240 70, 272 90, 274 137 Z', { fill: p.hat.color }), path('M 126 137 Q 200 124 274 137', stroke(p.hat.accent, 5, 0.9, 'butt')), path('M 200 72 L 200 128', stroke(shade(p.hat.color, 0.6), 2, 0.5)), path('M 160 86 Q 200 76 240 86', stroke('#fff', 2.5, 0.12))]; // a soft leather cap with a seam, a band and ear flaps
HAT_CROWN.leatherCap = 137;

// --- clothes ---
const rings = (p) => { const out = [], c = shade(p.top.color, 0.55); for (let r = 0; r < 12; r++) for (let k = 0; k < 10; k++) out.push(ellipse(92 + k * 24 + (r % 2) * 12, 372 + r * 20, 5, 4.2, { fill: 'none', stroke: c, sw: 1.2, op: 0.55 })); return out; }; // the mail: rows of rings, each row offset half a ring
TOPS.mailShirt = (p) => [torso('M 70 480 C 84 394, 128 365, 162 352 L 238 352 C 272 365, 316 394, 330 480 Z', p.top.color), ...rings(p), path('M 160 354 Q 200 386 240 354', stroke(shade(p.top.color, 0.6), 7, 0.6, 'butt'))];
NECKLINES.mailShirt = 'M 160 354 Q 200 386 240 354';
JACKETS.furMantle = (p) => { const c = p.jacket.color, dark = shade(c, 0.6), light = shade(c, 1.3); return [path('M 56 420 C 72 372, 130 348, 200 346 C 270 348, 328 372, 344 420 L 338 452 C 290 436, 240 428, 200 428 C 160 428, 110 436, 62 452 Z', { fill: c }), ...Array.from({ length: 26 }, (_, i) => { const x = 66 + i * 10.8, y = 436 + Math.sin(i * 1.7) * 6; return path(`M ${x} ${y - 14} Q ${x + 3} ${y + 2} ${x - 2} ${y + 16}`, stroke(i % 2 ? dark : light, 3, 0.7)); }), path('M 150 356 Q 200 390 250 356', stroke(dark, 3, 0.4)), ellipse(200, 372, 7, 7, { fill: GOLD }), ellipse(198, 370, 2.4, 2.4, { fill: '#fff3c8', op: 0.7 })]; }; // a fur band over both shoulders, its lower edge in tufts, a clasp at the throat

/** The pack's own names, by kind: what its sheet shows and what is tagged. */
export const DWARF = { beards: ['braidedBeard', 'forkedBeard'], hats: ['hornlessHelm', 'leatherCap'], tops: ['mailShirt'], jackets: ['furMantle'], marks: ['beadedBraids'] };
for (const n of DWARF.beards) tag('facialHair', n, 'only:dwarf');
for (const n of DWARF.hats) tag('hat', n, 'only:dwarf');
for (const n of DWARF.tops) tag('top', n, 'only:dwarf');
for (const n of DWARF.jackets) tag('jacket', n, 'only:dwarf');
for (const n of DWARF.marks) tag('marks', n, 'only:dwarf');
