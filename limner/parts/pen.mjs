// Not a pack: the few drawing helpers the packs had each copied for themselves, in one place. It registers nothing and
// exports no table of names, so registry.mjs (which lists its packs by hand) never meets it. A pack may import from here
// and from portrait.mjs, never from another pack.
import { HAIR, FACIAL_HAIR, mapX, scaleAbout, path, lcg, tag } from '../portrait.mjs';

/** A pack's table of its own names, tagged: the table's plural keys are the registries' kinds. */
const KIND = { tops: 'top', jackets: 'jacket', hats: 'hat', beards: 'facialHair' };
export const tagPack = (table, ...tags) => { for (const [k, names] of Object.entries(table)) for (const n of names) tag(KIND[k] ?? k, n, ...tags); };

/** One decimal: a path's numbers as the packs print them. */
export const f1 = (v) => Math.round(v * 10) / 10;
export const fp = (fill, op = 1) => ({ fill, op });
/** As portrait.mjs: a top's torso runs past the sheet's bottom. */
export const torso = (d, fill) => path(d.replace(/\s*Z\s*$/, ' L 340 700 L 60 700 Z'), { fill });
/** The shoulders the newer tops are cut on. */
export const SHOULDERS = 'M 66 480 C 80 388, 126 358, 162 348 L 238 348 C 274 358, 320 388, 334 480 Z';
/** Where the light comes from: -1 the viewer's left, as portrait.mjs reads it (the lit cheekbone is at +side). */
export const sideOf = (p) => p.light?.side || -1;

/** A closed polygon through `pts`. */
export const poly = (pts) => `M ${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L ')} Z`;
/** A stroke as a shape: a band along the polyline `pts`, `w` wide at its start narrowing to `w * end` (a strap, a wipe, a drip). */
export const taper = (pts, w, end = 0.1) => {
  const n = pts.length, side = (sgn) => pts.map(([x, y], i) => { const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n - 1, i + 1)], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, h = (w / 2) * (1 - (1 - end) * (i / (n - 1))); return [x - (dy / l) * h * sgn, y + (dx / l) * h * sgn]; });
  return poly([...side(1), ...side(-1).reverse()]);
};
/** One person's own generator: from what a turn of the head does not change, so a rip or a smear stays put while the head moves, and two people who share a seed still differ. */
export const own = (p, k = 0) => { let h = 7 + k; for (const ch of `${p.skin}${p.hairColor}${p.face?.height}${p.mouth?.width}`) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return lcg((p.seed ?? 1) * 17 + h); };

// --- where the figure is: clip zones that ride with what they cover (the hologram's rows, the synthwave light) ---
/** The face's own number. */
export const keyOf = (p) => Math.round(((p.face?.width ?? 156) * 7 + (p.face?.height ?? 204) * 3) % 97);
/** An ellipse as four cubics: a clip is a path, and the renderers trace M/L/C/Q only. */
export const ell = (cx, cy, rx, ry) => { const a = rx * 0.5523, b = ry * 0.5523; return `M ${cx - rx} ${cy} C ${cx - rx} ${cy - b}, ${cx - a} ${cy - ry}, ${cx} ${cy - ry} C ${cx + a} ${cy - ry}, ${cx + rx} ${cy - b}, ${cx + rx} ${cy} C ${cx + rx} ${cy + b}, ${cx + a} ${cy + ry}, ${cx} ${cy + ry} C ${cx - a} ${cy + ry}, ${cx - rx} ${cy + b}, ${cx - rx} ${cy} Z`; };
/** A part's solid shapes as clip stacks: each run of filled shapes under the same clips becomes one zone, the clips it
 *  was drawn inside and then the shapes themselves (a beard is a band clipped to the face, and its band alone is wider
 *  than the head). */
export const zonesOf = (ops) => { const zones = [], stack = []; let run = null;
  for (const o of ops) {
    if (o.k === 'clip') { stack.push(o.d); run = null; } else if (o.k === 'unclip') { stack.pop(); run = null; }
    else if (o.fill && o.fill !== 'none' && (o.op ?? 1) >= 0.5 && (o.k === 'path' || o.k === 'ellipse')) { const d = o.k === 'path' ? o.d : ell(o.cx, o.cy, o.rx, o.ry); if (run) run.push(d); else { run = [d]; zones.push([...stack, run]); } }
  }
  return zones.map((z) => z.map((d) => (Array.isArray(d) ? d.join(' ') : d))); };
/** The hair as the portrait lays it out: drawn for the default head and following this one's width. */
export const hairZones = (p, { back = true } = {}) => { const r = HAIR[p.hair?.style] ?? (() => []), h = typeof r === 'function' ? r(p) : [...(back ? r.back(p) : []), ...r.front(p)]; return zonesOf(p.face.width === 156 ? h : mapX(h, scaleAbout(200, p.face.width / 156))); }; // back: false is the hair in front of the face only (the back hangs behind the head, so its zone covers the face)
/** A beard is already on this face's own outline. */
export const beardZones = (p) => zonesOf((FACIAL_HAIR[p.facialHair?.style] ?? (() => []))(p));
