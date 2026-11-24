// crawl's level: the song's form as a building, and everything that will happen in it. One section is one sector, a
// small grid map of its own (they are swapped behind a closed door, so nothing has to fit together and a long song
// is only more sectors). A sector is a chain of room modules laid west to east, each taking a share of the section's
// bars, with a standard airlock and door at both ends: the last thing seen in one sector and the first thing seen in
// the next are the same airlock wall and the same door, which is what hides the swap.
// Nothing here is simulated. It is a script, written once from the score and seed: the route as keyframes in bars,
// and for every creature the bar it wakes, the beats it is hit on, the beats it attacks on and the beat it dies on;
// for every barrel the beat it goes up; for every pickup the bar the walker reaches it. The world asks "what is true
// at bar b" and gets the same answer whether it played up to b or was dropped there by a seek.
import { T } from './art.mjs';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const GH = 41, MID = 20; // every sector's grid is this tall; the route starts on the middle row
export const AIR = 3; // cells of airlock before a door
export const STAND = 1.6; // how far from a door the walker waits: the same before an exit and before the entry that replaces it
const LOOK = 1.1; // the walker faces the point this far ahead along the route, so a corner is turned before it is reached
const beat = (b) => Math.round(b * 4) / 4; // the script lands on quarter bars
export const FLY = 0.25; // bars a thrown thing takes to reach the walker

export const THEMES = {
  base: { wall: T.steel, alt: [T.tech, T.tech, T.hazard, T.pipes], pillar: T.tech, floor: T.floor, ceil: T.ceil, light: 8, liquid: T.toxic, sky: T.sky, props: ['lamp', 'terminal', 'crate', 'terminal'], mods: ['hall', 'room', 'store', 'bend', 'room'] },
  plant: { wall: T.rust, alt: [T.pipes, T.pipes, T.hazard, T.conc], pillar: T.pipes, floor: T.plate, ceil: T.ceil, light: 7, liquid: T.toxic, sky: T.sky, props: ['crate', 'lamp', 'crate', 'gore'], mods: ['hall', 'bridge', 'store', 'bend', 'pillars', 'court'] },
  under: { wall: T.stone, alt: [T.brick, T.brick, T.skull, T.conc], pillar: T.brick, floor: T.dirt, ceil: T.rock, light: 6, liquid: T.toxic, sky: T.sky, props: ['torch', 'skulls', 'torch', 'chain', 'gore'], mods: ['hall', 'pillars', 'bend', 'room', 'bridge'] },
  rot: { wall: T.conc, alt: [T.flesh, T.tech, T.flesh, T.rust], pillar: T.flesh, floor: T.blood, ceil: T.ceil, light: 6, liquid: T.lava, sky: T.skyHell, props: ['gore', 'chain', 'terminal', 'skulls', 'gore'], mods: ['room', 'bridge', 'pillars', 'bend', 'court', 'store'] },
  hell: { wall: T.hell, alt: [T.skull, T.flesh, T.gate, T.skull], pillar: T.skull, floor: T.hellFloor, ceil: T.rock, light: 7, liquid: T.lava, sky: T.skyHell, props: ['torch', 'skulls', 'chain', 'torch', 'gore'], mods: ['court', 'pillars', 'bridge', 'hall', 'court'] },
};
const ORDER = ['base', 'plant', 'under', 'rot', 'hell'];
export const HP = { husk: 1, gnasher: 2, drifter: 3, warden: 14 }; // hits a creature takes, the last one being its death
export const WEAPON_ORDER = ['pistol', 'shotgun', 'rotary', 'cannon'];

// ---------- a sector's grids ----------
const grid = (w, th) => { const n = w * GH; return { w, h: GH, wall: new Uint8Array(n).fill(th.wall), floor: new Uint8Array(n).fill(th.floor), ceil: new Uint8Array(n).fill(th.ceil), light: new Uint8Array(n).fill(th.light), tall: new Uint8Array(n), lampOf: new Uint8Array(n), lamps: 0, sky: th.sky }; };
const carve = (g, x0, y0, x1, y1, o = {}) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * g.w + x; g.wall[i] = 0; if (o.floor) g.floor[i] = o.floor; if (o.ceil !== undefined) g.ceil[i] = o.ceil; if (o.light !== undefined) g.light[i] = clamp(o.light, 0, 15); } };
const setWall = (g, x, y, id, tall = 0) => { const i = y * g.w + x; g.wall[i] = id; if (tall) g.tall[i] = tall; };
const open = (g, x, y) => x >= 0 && y >= 0 && x < g.w && y < GH && g.wall[y * g.w + x] === 0;
/** A lamp in the ceiling at (x, y): the tile, and light pooled on the cells around it. */
const lamp = (g, x, y, power = 6) => {
  if (g.ceil[y * g.w + x]) g.ceil[y * g.w + x] = T.lamp;
  const id = g.lamps < 255 ? ++g.lamps : 0; // its pool of floor: the renderer can raise and lower each lamp by itself, which is how the lamps keep time
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = x + i, Y = y + j; if (id && X >= 0 && Y >= 0 && X < g.w && Y < GH && Math.hypot(i, j) < 2.3 && !g.lampOf[Y * g.w + X]) g.lampOf[Y * g.w + X] = id; }
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= g.w || Y >= GH) continue; const k = Y * g.w + X; g.light[k] = clamp(g.light[k] + Math.max(0, power - Math.round(Math.hypot(i, j) * 2.2)), 0, 15); }
};
/** Dress the walls of a carved span: the theme's other textures along what would be one flat wall. */
const dress = (g, x0, x1, th, rnd, p = 0.3) => {
  for (let y = 1; y < GH - 1; y++) for (let x = Math.max(1, x0); x <= Math.min(g.w - 2, x1); x++) {
    const i = y * g.w + x; if (g.wall[i] !== th.wall) continue;
    if (!(open(g, x, y - 1) || open(g, x, y + 1) || open(g, x - 1, y) || open(g, x + 1, y))) continue;
    if (rnd() < p) g.wall[i] = th.alt[Math.floor(rnd() * th.alt.length)];
  }
};
/** Make a carved span high: its ceiling two units up, the walls round it and anything standing in it as tall. */
const raise = (g, x0, y0, x1, y1) => { for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) { if (x < 0 || x >= g.w || y < 0 || y >= GH) continue; const inside = x >= x0 && x <= x1 && y >= y0 && y <= y1; if (inside || !open(g, x, y)) g.tall[y * g.w + x] = 2; } };
/** Open the sky over a span. */
const unroof = (g, x0, y0, x1, y1, light) => { carve(g, x0, y0, x1, y1, { ceil: 0, light }); raise(g, x0, y0, x1, y1); };

// ---------- room modules ----------
// A module carves itself east of (x, cy), where the route enters on row cy, and returns { len (cells east), cy (the
// row it leaves on), path: [[u, x, y]] (u in 0..1 of its share of the bars; the first point is the entry, the last
// the exit), spots: where a creature, a barrel or a prop may stand ({ x, y, niche?, air? }), dress: how busy its walls are }.
const MODULES = {
  hall(g, x, cy, th, rnd) { // a corridor three wide with niches down both sides and a lamp between each pair
    const len = 12 + Math.floor(rnd() * 3) * 2, spots = [];
    carve(g, x, cy - 1, x + len - 1, cy + 1);
    for (let k = 2; k < len - 2; k += 4) {
      for (const s of [-1, 1]) if (rnd() < 0.75) { carve(g, x + k, cy + s * 2, x + k + 1, cy + s * 2, { light: 3 }); spots.push({ x: x + k + 1, y: cy + s * 2 + 0.5 }); }
      lamp(g, x + k + 2, cy, 5);
    }
    spots.push({ x: x + len - 3.5, y: cy - 0.55, drum: true }, { x: x + 5.5, y: cy + 1.55, drum: true }); // barrels left against the wall
    return { len, cy, path: [[0, x, cy + 0.5], [1, x + len, cy + 0.5]], spots };
  },
  bend(g, x, cy, th, rnd) { // the corridor jogs sideways: two corners, and whatever is round the first one is a surprise
    const up = cy > MID + 5 ? true : cy < MID - 5 ? false : rnd() < 0.5, run = 5 + Math.floor(rnd() * 3), ny = cy + (up ? -run : run), d = up ? -1 : 1;
    carve(g, x, cy - 1, x + 4, cy + 1); carve(g, x + 2, Math.min(cy, ny) - 1, x + 4, Math.max(cy, ny) + 1); carve(g, x + 2, ny - 1, x + 8, ny + 1);
    lamp(g, x + 3, cy, 4); lamp(g, x + 6, ny, 6);
    return { len: 9, cy: ny, path: [[0, x, cy + 0.5], [0.3, x + 3.5, cy + 0.5], [0.7, x + 3.5, ny + 0.5], [1, x + 9, ny + 0.5]], spots: [{ x: x + 3.5, y: ny + 0.5 + d * 0.9 }, { x: x + 7.5, y: ny + 0.5 - d * 0.9 }, { x: x + 2.6, y: cy + 0.5 + d * 3 }] };
  },
  room(g, x, cy, th, rnd) { // a square room, four pillars, a bank of lamps: the route crosses it off the straight line
    const len = 11 + Math.floor(rnd() * 2) * 2, hw = 4 + Math.floor(rnd() * 2), side = rnd() < 0.5 ? -1 : 1;
    carve(g, x, cy - 1, x + 1, cy + 1); carve(g, x + 2, cy - hw, x + len - 3, cy + hw, { light: th.light + 1 }); carve(g, x + len - 2, cy - 1, x + len - 1, cy + 1);
    if (rnd() < 0.5) raise(g, x + 2, cy - hw, x + len - 3, cy + hw); // half of them are two storeys: the doorway in is a hole in a tall wall
    for (const px of [x + 4, x + len - 5]) for (const py of [cy - hw + 2, cy + hw - 2]) setWall(g, px, py, th.pillar);
    lamp(g, x + (len >> 1), cy, 7); lamp(g, x + 3, cy - hw + 1, 4); lamp(g, x + len - 4, cy + hw - 1, 4);
    const my = cy + side * (hw - 2.6) + 0.5;
    return { len, cy, dress: 0.55, path: [[0, x, cy + 0.5], [0.2, x + 3, cy + 0.5], [0.5, x + len / 2, my], [0.8, x + len - 3, cy + 0.5], [1, x + len, cy + 0.5]], spots: [{ x: x + len / 2 + 1, y: cy - side * (hw - 1.4) + 0.5 }, { x: x + len - 4.5, y: cy - side * 2 + 0.5 }, { x: x + 6.5, y: cy - side * 2.6 + 0.5 }, { x: x + len - 3.5, y: cy + side * (hw - 0.6) + 0.5 }, { x: x + 3, y: cy + side * (hw - 0.6) + 0.5 }, { x: x + len - 4.4, y: cy + side * (hw - 1.4) + 0.5, drum: true }, { x: x + 3.6, y: cy - side * (hw - 1.4) + 0.5, drum: true }] };
  },
  store(g, x, cy, th, rnd) { // a store room: crates stacked into walls, a lane between them, and the barrels are kept here
    const len = 13, hw = 4;
    carve(g, x, cy - 1, x + 1, cy + 1); carve(g, x + 2, cy - hw, x + len - 3, cy + hw, { light: th.light - 1 }); carve(g, x + len - 2, cy - 1, x + len - 1, cy + 1);
    for (const [px, py] of [[x + 4, cy - 3], [x + 5, cy - 3], [x + 4, cy - 4], [x + 8, cy + 3], [x + 8, cy + 4], [x + 9, cy + 3], [x + 6, cy + 3], [x + 8, cy - 4]]) setWall(g, px, py, T.crate);
    lamp(g, x + 6, cy, 6); lamp(g, x + 9, cy - 2, 3);
    return { len, cy, path: [[0, x, cy + 0.5], [0.35, x + 4.5, cy + 0.5], [0.65, x + 8, cy + 0.8], [1, x + len, cy + 0.5]], spots: [{ x: x + 7, y: cy - 2.6, drum: true }, { x: x + 9.6, y: cy - 2.2 }, { x: x + 5.5, y: cy + 3.6, drum: true }, { x: x + 3.4, y: cy + 3.2 }, { x: x + 9.6, y: cy + 1.9, drum: true }, { x: x + 6.4, y: cy - 3.6 }] };
  },
  pillars(g, x, cy, th, rnd) { // a long dark hall of columns: light only at the ends, and things between the columns
    const len = 15, hw = 4;
    carve(g, x, cy - 1, x, cy + 1); carve(g, x + 1, cy - hw, x + len - 2, cy + hw, { light: th.light - 2 }); carve(g, x + len - 1, cy - 1, x + len - 1, cy + 1);
    raise(g, x + 1, cy - hw, x + len - 2, cy + hw); // a great hall: the columns go up two storeys into the dark
    for (let k = 2; k < len - 1; k += 3) for (const s of [-1, 1]) setWall(g, x + k, cy + s * 2, th.pillar, 2);
    lamp(g, x + 1, cy, 6); lamp(g, x + len - 2, cy, 6);
    const spots = []; for (let k = 3; k < len - 2; k += 3) for (const s of [-1, 1]) spots.push({ x: x + k + 1.5, y: cy + s * 3.3 + 0.5 });
    return { len, cy, dress: 0.2, path: [[0, x, cy + 0.5], [0.3, x + 4.5, cy + 0.9], [0.65, x + 9.5, cy + 0.1], [1, x + len, cy + 0.5]], spots };
  },
  bridge(g, x, cy, th, rnd) { // a catwalk over a tank of something that glows; what lives here does not need a floor
    const len = 14, hw = 4;
    carve(g, x, cy - 1, x + 1, cy + 1); carve(g, x + 2, cy - hw, x + len - 3, cy + hw, { floor: th.liquid, light: th.light }); carve(g, x + len - 2, cy - 1, x + len - 1, cy + 1);
    raise(g, x + 2, cy - hw, x + len - 3, cy + hw); // the tank room is tall and its floor is sunk: the walkway really is over something
    carve(g, x + 2, cy, x + len - 3, cy, { floor: T.grate });
    for (const [px, py] of [[x + 5, cy - 3], [x + 9, cy + 3]]) { carve(g, px, py, px + 1, py, { floor: T.plate }); }
    lamp(g, x + 1, cy, 4); lamp(g, x + len - 2, cy, 4);
    return { len, cy, dress: 0.45, path: [[0, x, cy + 0.5], [1, x + len, cy + 0.5]], spots: [{ x: x + 6, y: cy - 2.4, air: true }, { x: x + 9.5, y: cy + 3.4, air: true }, { x: x + 10, y: cy - 2.6, air: true }, { x: x + 5.5, y: cy + 2.6, air: true }] };
  },
  court(g, x, cy, th, rnd) { // out under the sky: high walls, crates left about, more light than anywhere inside
    const len = 15, hw = 5 + Math.floor(rnd() * 2);
    carve(g, x, cy - 1, x + 1, cy + 1); unroof(g, x + 2, cy - hw, x + len - 3, cy + hw, th.light + 3); carve(g, x + len - 2, cy - 1, x + len - 1, cy + 1);
    for (const [px, py] of [[x + 5, cy - 3], [x + 9, cy + 3], [x + 10, cy - 4], [x + 4, cy + 4]]) setWall(g, px, py, T.crate);
    const side = rnd() < 0.5 ? -1 : 1;
    return { len, cy, dress: 0.25, path: [[0, x, cy + 0.5], [0.25, x + 4, cy + 0.5 + side], [0.6, x + 8, cy + 0.5 - side * 1.2], [1, x + len, cy + 0.5]], spots: [{ x: x + 8, y: cy + side * (hw - 1) + 0.5 }, { x: x + 11, y: cy - side * 2.4 + 0.5 }, { x: x + 6, y: cy - side * (hw - 1) + 0.5, drum: true }, { x: x + 11.5, y: cy + side * 3.6 + 0.5 }, { x: x + 3.4, y: cy - side * 3.4 + 0.5, drum: true }, { x: x + 7, y: cy + side * 2 + 0.5, air: true }] };
  },
  arena(g, x, cy, th, rnd) { // where it ends: a great open floor, four columns, a pit of fire in the middle, and room to keep moving
    const len = 21, hw = 8;
    carve(g, x, cy - 1, x + 1, cy + 1); unroof(g, x + 2, cy - hw, x + len - 3, cy + hw, th.light + 2); carve(g, x + len - 2, cy - 1, x + len - 1, cy + 1);
    carve(g, x + 3, cy - hw, x + len - 4, cy - hw, { floor: th.liquid }); carve(g, x + 3, cy + hw, x + len - 4, cy + hw, { floor: th.liquid }); // a moat of it along both long walls
    for (const px of [x + 3, x + 18]) for (const py of [cy - 6, cy + 6]) { setWall(g, px, py, th.pillar, 2); } // columns in the corners: nothing stands between the walker and the middle
    const c = cy + 0.5;
    return { len, cy, arena: true, dress: 0.4, boss: { x: x + 11, y: c, x0: x + len - 3, y0: c },
      path: [[0, x, c], [0.07, x + 4, c], [0.17, x + 6, c - 5], [0.29, x + 11, c - 6.2], [0.4, x + 16, c - 4.6], [0.5, x + 17.2, c], [0.6, x + 16, c + 4.6], [0.71, x + 11, c + 6.2], [0.8, x + 6, c + 5], [0.84, x + 5.2, c + 2.5], [0.88, x + 5.2, c + 2.5], [0.93, x + 9, c + 5.2], [0.97, x + 16.5, c + 2.5], [1, x + len, c]],
      spots: [{ x: x + 13.5, y: c - 2.6 }, { x: x + 8.5, y: c + 2.6 }, { x: x + 14.2, y: c + 2.4, drum: true }, { x: x + 8, y: c - 2.4, drum: true }, { x: x + 11, y: c - 3.4, air: true }, { x: x + 11, y: c + 3.4, air: true }] };
  },
  exit(g, x, cy, th) { // the way out: a small bright room, the word on the wall, and a switch under it
    const len = 8;
    carve(g, x, cy - 1, x + 1, cy + 1); carve(g, x + 2, cy - 2, x + len - 2, cy + 2, { floor: T.plate, light: 11 });
    for (const dy of [-2, -1, 1, 2]) setWall(g, x + len - 1, cy + dy, T.hazard);
    setWall(g, x + len - 1, cy, T.sw); lamp(g, x + 4, cy, 5);
    return { len, cy, dress: 0, end: true, path: [[0, x, cy + 0.5], [0.8, x + len - 2.1, cy + 0.5], [1, x + len - 2.1, cy + 0.5]], spots: [] };
  },
};

// ---------- the route ----------
const seg = (K, b) => { let i = 0; while (i < K.length - 2 && K[i + 1].b <= b) i++; return i; };
const alongLen = (K, s) => { // the point `s` units along the polyline; past its end, straight on
  let i = 0; while (i < K.length - 2 && K[i + 1].s <= s) i++;
  let a = K[i], c = K[i + 1];
  if (s > c.s) { let j = K.length - 1; while (j > 1 && K[j].s === K[j - 1].s) j--; a = K[j - 1]; c = K[j]; const d = c.s - a.s || 1, t = 1 + (s - c.s) / d; return [a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t]; }
  const d = c.s - a.s, t = d > 0 ? (s - a.s) / d : 0;
  return [a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t];
};
/** Where the walker stands and which way the route points at bar `b`: { x, y, a, s (distance walked), v (speed, units per bar) }. */
export function routeAt(sec, b) {
  const K = sec.keys; b = clamp(b, 0, sec.bars);
  const i = seg(K, b), a = K[i], c = K[i + 1], span = c.b - a.b, lin = span > 0 ? clamp((b - a.b) / span, 0, 1) : 1;
  const stopA = i === 0 || K[i - 1].s === a.s, stopC = i + 2 >= K.length || K[i + 2].s === c.s; // ease only into and out of a stand-still
  const t = stopA && stopC ? ss(lin) : stopA ? lin * lin * (2 - lin) : stopC ? 1 - (1 - lin) * (1 - lin) * (1 + lin) : lin;
  const x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t, s = a.s + (c.s - a.s) * t;
  const [tx, ty] = alongLen(K, s + LOOK);
  return { x, y, a: Math.atan2(ty - y, tx - x), s, v: span > 0 ? (c.s - a.s) / span : 0 };
}
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const bump = (t) => (t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI) ** 2);
/**
 * The camera at bar `b`: the route, turned toward whatever has the walker's attention (the creature it is fighting,
 * each in turn, cross-faded so the head never snaps) and stepped aside when something is thrown at it.
 */
export function viewAt(sec, b) {
  const p = routeAt(sec, b);
  let off = 0, wsum = 0;
  for (const f of sec.foes) {
    const w = ss((b - f.focus) / 0.35) * (1 - ss((b - f.die - 0.05) / 0.3)) * (1 - ss((b - sec.tOut + 0.6) / 0.5)); if (w <= 0.001) continue; // by the door the walker faces the door
    const q = foeAt(f, b), lim = f.boss ? 2.4 : 1.15, da = clamp(wrap(Math.atan2(q.y - p.y, q.x - p.x) - p.a), -lim, lim);
    off += da * w; wsum += w;
  }
  let a = p.a + (wsum > 0 ? (off / Math.max(1, wsum)) * 0.94 : 0), side = 0;
  for (const h of sec.dodges) side += bump((b - h.b + 0.3) / 0.6) * h.side * 0.42;
  let back = 0; for (const h of sec.hurts) back += bump((b - h.b + 0.05) / 0.5) * 0.22; // hit: a step back
  const scan = wsum > 0 ? 0 : Math.sin(b * 1.9) * 0.1 * clamp(1 - p.v / 5, 0, 1); // standing with nothing to shoot, the head keeps moving
  return { ...p, a: a + scan, x: p.x - Math.sin(p.a) * side - Math.cos(p.a) * back, y: p.y + Math.cos(p.a) * side - Math.sin(p.a) * back, route: p.a, target: wsum > 0.5 };
}

// ---------- who is where, when ----------
/** A creature at bar `b`: { x, y, pose, alive }. Its whole life is in its script: wake, come forward, be hit, attack, die, lie there. */
const GAIT = { husk: [1, 0.16, 4], gnasher: [2, 0.22, 8], drifter: [0.5, 0.3, 2], warden: [0.5, 0.2, 2] }; // per kind: sways across per bar, how far, steps per bar
/**
 * `die`: the bar it actually fell, when a drum got there before the script did; `atk`: its attacks' actual bars,
 * likewise. It comes forward in lunges, one to each of its steps (a husk marches on the beat, a gnasher scuttles in
 * eighths, a drifter and the warden take the half bar), and sways across the walker's aim at its own rate.
 */
export function foeAt(f, b, die = f.die, atk = f.attacks, bm = b, par = null) { // bm: the bar its feet have got to (it steps on the hats, so behind b); par: which foot, when the hats are counting
  const [rate, amp, steps] = GAIT[f.kind] ?? GAIT.husk, bb = Math.min(bm, die);
  const p = clamp((bb - f.wake) / f.walk, 0, 1), n = Math.max(1, Math.round(f.walk * steps)), q = p * n, t = (Math.floor(q) + ss(Math.min(1, (q - Math.floor(q)) / 0.45))) / n; // a lunge in the first half of each step, a plant in the second
  const dx = f.x1 - f.x0, dy = f.y1 - f.y0, L = Math.hypot(dx, dy) || 1, sway = bb > f.wake ? Math.sin(bb * rate * 2 * Math.PI) * amp * Math.min(1, (bb - f.wake) * 2) : 0;
  const x = f.x0 + dx * t - (dy / L) * sway, y = f.y0 + dy * t + (dx / L) * sway;
  if (b >= die) return { x, y, pose: b < die + 0.07 ? 'die1' : b < die + 0.15 ? 'die2' : b < die + 0.25 ? 'die3' : 'dead', alive: false };
  for (const a of atk) if (b >= a - 0.08 && b < a + 0.12) return { x, y, pose: 'attack', alive: true };
  return { x, y, pose: b > f.wake ? ((par ?? Math.floor(b * steps)) & 1 ? 'walkA' : 'walkB') : 'idle', alive: true };
}

/** Nothing solid between two points of a sector. */
export const los = (g, x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.2); for (let i = 1; i < n; i++) { const t = i / n; if (!open(g, Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false; } return true; };
const distToRoute = (keys, x, y) => { let best = 1e9; for (let i = 1; i < keys.length; i++) { const a = keys[i - 1], c = keys[i], dx = c.x - a.x, dy = c.y - a.y, L = dx * dx + dy * dy, t = L ? clamp(((x - a.x) * dx + (y - a.y) * dy) / L, 0, 1) : 0; best = Math.min(best, Math.hypot(x - a.x - dx * t, y - a.y - dy * t)); } return best; };

/** Fill a built sector with its script: creatures, barrels, pickups, props, and the times the walker steps aside. */
function populate(sec, sp, th, rnd) {
  const foes = [], drums = [], picks = [], props = [], dodges = [], hurts = [];
  const pass = (s, b0, b1, r = 3.4) => { for (let b = b0; b < b1 + 1.5; b += 0.05) { const p = routeAt(sec, b); if (Math.hypot(p.x - s.x, p.y - s.y) < r) return b; } return b1 + 0.5; };
  const seen = (f, b, cone = 9) => { const p = routeAt(sec, b), q = foeAt(f, b); return los(sec, p.x, p.y, q.x, q.y) && Math.abs(wrap(Math.atan2(q.y - p.y, q.x - p.x) - p.a)) < cone; };
  for (const m of sec.mods) {
    const spots = sec.spots.filter((s) => s.mod === m.k && open(sec, Math.floor(s.x), Math.floor(s.y))); let used = 0;
    // the song stocks the room: a creature for every few drum hits it will play here (so there is always something for
    // a backbeat to land on), and of the kind its parts ask for: gnashers for drums, drifters for a tune, husks for a bass
    const rate = clamp((sp.drum || 2 + sp.energy * 8) / 7, 0.4, 2.2), want = m.end || sp.quiet ? 0 : clamp(Math.round((m.b1 - m.b0) * rate + (m.arena ? 2 : 0)), sp.first && m.k === 0 ? 0 : 1, 8);
    const mix = [['gnasher', 1 + (sp.drum || 0)], ['drifter', (sp.tune || 0) * 1.5], ['husk', 1 + (sp.low || 0) * 1.5]], mixSum = mix.reduce((n, [, w]) => n + w, 0);
    const pickKind = () => { let r = rnd() * mixSum; for (const [kd, w] of mix) { r -= w; if (r <= 0) return kd; } return 'gnasher'; };
    const cand = [];
    for (let cyy = 1; cyy < GH - 1; cyy++) for (let cx = m.x0; cx < m.x1; cx++) {
      if (!open(sec, cx, cyy) || sec.floor[cyy * sec.w + cx] === th.liquid) continue; const dr = distToRoute(sec.keys, cx + 0.5, cyy + 0.5);
      if (dr >= 1.25) cand.push([cx, cyy, dr, [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, j]) => !open(sec, cx + i, cyy + j))]);
    }
    for (let n = cand.length - 1; n > 0; n--) { const j = Math.floor(rnd() * (n + 1)); [cand[n], cand[j]] = [cand[j], cand[n]]; }
    for (const [cx, cyy] of cand.slice(0, 10)) spots.push({ x: cx + 0.5, y: cyy + 0.5 }); // more places to come from than the room's own niches
    if (m.boss) { // the warden: it is there when the door opens, it takes the whole room to kill
      const wake = beat(m.b0 + (m.b1 - m.b0) * m.ps * 0.06), die = beat(m.b0 + (m.b1 - m.b0) * m.ps * 0.84), span = die - wake, n = HP.warden - 1; // dead while the walker is still in the room to see it
      const f = { kind: 'warden', boss: true, x0: m.boss.x0, y0: m.boss.y0, x1: m.boss.x, y1: m.boss.y, wake, die, walk: Math.min(2, span * 0.3), hits: [], attacks: [] };
      for (let k = 1; k <= n; k++) f.hits.push(beat(wake + (span * k) / (n + 1)));
      for (let b = wake + 1; b < die - 0.5; b += Math.max(1, span / 6)) f.attacks.push(beat(b));
      foes.push(f);
    }
    for (const s of spots) {
      if (used >= want || s.drum) continue;
      const kind = s.air ? 'drifter' : pickKind(), hp = HP[kind];
      const near = pass(s, m.b0, m.b1, 4.6), die = beat(Math.min(near - 0.1, m.b1 - 0.25) - (m.boss ? rnd() * (m.b1 - m.b0) * 0.5 : 0));
      const life = 1.5 + hp * 0.75 + Math.floor(rnd() * 3) * 0.25, wake = Math.max(beat(die - life), beat(Math.max(sec.tIn, m.b0 - 0.5)));
      if (die - wake < 0.5 || die <= sec.tIn + 0.5 || foes.some((o) => Math.abs(o.die - die) < 0.2)) continue;
      const at = routeAt(sec, die), f = { kind, x0: s.x, y0: s.y, x1: s.x, y1: s.y, wake, die, walk: Math.max(0.5, (die - wake) * 0.9), hits: [], attacks: [] };
      // where it falls: a few steps in front of where the walker will be standing, on the side it came from
      const toS = Math.atan2(s.y - at.y, s.x - at.x), aim = at.a + clamp(wrap(toS - at.a), -0.5, 0.5), reach = m.boss ? 4 : kind === 'drifter' ? 3 : 2.5;
      for (const D of [reach, reach + 0.7, reach + 1.5, reach + 2.6, reach + 4]) {
        const X = at.x + Math.cos(aim) * D, Y = at.y + Math.sin(aim) * D;
        if (!open(sec, Math.floor(X), Math.floor(Y)) || (!s.air && sec.floor[Math.floor(Y) * sec.w + Math.floor(X)] === th.liquid)) continue;
        if (los(sec, at.x, at.y, X, Y) && los(sec, s.x, s.y, X, Y)) { f.x1 = X; f.y1 = Y; break; }
      }
      if (!seen(f, die, 1.0) || !seen(f, die - 0.25, 1.1)) continue; // the kill has to be on screen
      let first = f.wake; while (first < die - 0.5 && !seen(f, first + 0.25)) first = beat(first + 0.25);
      f.wake = Math.max(f.wake, beat(first - 0.75)); // it is heard coming a little before it is seen, not a whole room away
      for (let k = 1; k < hp; k++) { const h = beat(die - k * 0.5); if (h > f.wake + 0.2) f.hits.unshift(h); }
      for (let a = f.wake + 0.75; a < die - 0.3; a += 1) f.attacks.push(a); // an attack a bar, on a beat: an onset of the creatures' own instrument may take each one early
      foes.push(f); used++;
    }
    // barrels are the song's: none where it has no drums, one for about every other backbeat where it has, and each
    // stands ahead of where the walker will be on the bar it is meant for, so they come up at the rate the drums do.
    // (A room has no barrels of its own any more: the `drum` spots of a module are just more places one may stand.)
    const beats = sp.drum ? clamp(sp.drum / 4, 0.25, 2) : sp.low || sp.tune ? 0.3 : 0, nb = m.end ? 0 : Math.min(8, Math.round((m.b1 - m.b0) * beats));
    const places = [...cand.filter((c) => c[2] >= 1.8 && c[2] < 3.8).map(([cx, cyy]) => ({ x: cx + 0.5, y: cyy + 0.5 })), ...spots.filter((sp2) => sp2.drum)];
    for (let k = 0; k < nb && places.length; k++) {
      const due = m.b0 + ((k + 0.5) / nb) * (m.b1 - m.b0), w = routeAt(sec, due), ax = w.x + Math.cos(w.a) * 4, ay = w.y + Math.sin(w.a) * 4; // four steps ahead of the walker on that bar
      let best = -1, bd = 1e9; places.forEach((q, i) => { const d = Math.hypot(q.x - ax, q.y - ay); if (d < bd) { bd = d; best = i; } });
      const { x, y } = places.splice(best, 1)[0];
      if (bd > 6 || drums.some((d) => Math.hypot(d.x - x, d.y - y) < 1.4) || foes.some((f2) => Math.hypot(f2.x0 - x, f2.y0 - y) < 1 || Math.hypot(f2.x1 - x, f2.y1 - y) < 1.2)) continue;
      const boom = beat(Math.min(pass({ x, y }, m.b0, m.b1, 3.6) - 0.1, m.b1 - 0.25)); if (boom > sec.tIn + 0.25) drums.push({ x, y, boom, shot: true });
    }
    // props stand against the walls, where the route does not go; any of them can be shot to pieces
    const walls = cand.filter((c) => c[3]);
    for (let k = 0, n = m.end ? 0 : 3 + Math.floor(rnd() * 3) + (m.arena ? 4 : 0); k < n && walls.length; k++) {
      const [cx, cyy] = walls.splice(Math.floor(rnd() * walls.length), 1)[0], x = cx + 0.5, y = cyy + 0.5;
      if (props.some((p) => Math.hypot(p.x - x, p.y - y) < 1.5) || foes.some((f) => Math.hypot(f.x0 - x, f.y0 - y) < 1 || Math.hypot(f.x1 - x, f.y1 - y) < 1) || drums.some((d) => Math.hypot(d.x - x, d.y - y) < 1)) continue;
      props.push({ x, y, kind: th.props[Math.floor(rnd() * th.props.length)] });
    }
  }
  foes.sort((a, b) => a.die - b.die);
  let last = 0; for (const f of foes) { f.focus = Math.max(f.wake, last); last = f.die; }
  foes.forEach((f, i) => f.attacks.forEach((a, k) => { const lands = !f.boss ? k % 3 !== 1 : k % 2 === 0; if (lands) hurts.push({ b: a + FLY, n: f.boss ? 12 : f.kind === 'drifter' ? 9 : 6, foe: i, k }); else dodges.push({ b: a + FLY, side: rnd() < 0.5 ? -1 : 1 }); }));
  // pickups lie on the route itself, so they are walked over: where a module hands over to the next
  const kinds = [];
  if (sp.ammo) kinds.push('ammo'); if (hurts.length) kinds.push('med'); if (sp.armor) kinds.push('armor'); if (sp.keyGet) kinds.push(sp.keyGet);
  const places = sec.keys.filter((k) => k.join && k.b > sec.tIn && k.b < sec.tOut - 0.2);
  kinds.forEach((kind, i) => { // each lies where the walker will be on a downbeat, so it is taken on one
    const k = places[Math.floor(((i + 0.5) / kinds.length) * places.length)]; if (!k) return;
    const B = clamp(Math.round(k.b), Math.ceil(sec.tIn + 0.25), Math.floor(sec.tOut - 0.25)); if (!(B > sec.tIn && B < sec.tOut) || picks.some((p) => p.b === B)) return;
    const at = routeAt(sec, B); picks.push({ x: at.x, y: at.y, kind, b: B });
  });
  const poi = [...picks, ...drums, ...props.filter((p) => p.kind !== 'gore' && p.kind !== 'chain')].map((p) => ({ x: p.x, y: p.y })); // what an idle eye goes to
  if (sec.exit) poi.push({ x: sec.exit.x + 0.5, y: sec.exit.y + 0.5 });
  Object.assign(sec, { foes, drums, picks, props, dodges, hurts, poi });
}

/** One sector from its section's plan. */
function buildSector(sp, th, rnd) {
  const wait = sp.last ? 0 : sp.dropout ? Math.min(sp.dropout, sp.bars * 0.5) : Math.min(0.125, sp.bars * 0.1); // bars stood at the exit door: a dropout is a wait in the dark, otherwise the walker arrives as the bar turns
  const card = sp.last ? clamp(sp.bars * 0.3, Math.min(1, sp.bars * 0.4), 4) : 0; // bars the end card is up
  const tIn = Math.min(0.5, sp.bars * 0.15), tOut = sp.bars - wait - card, per = 3.6 - 1.8 * sp.energy; // bars a room takes: a loud section is crossed at a run
  let n = clamp(Math.round((tOut - tIn) / per), 1, 18);
  const kinds = []; for (let k = 0; k < n; k++) { let kind; do kind = th.mods[Math.floor(rnd() * th.mods.length)]; while (kind === kinds[k - 1] && th.mods.length > 1); kinds.push(kind); }
  if (sp.boss) { if (n > 1) kinds[n - 1] = 'arena'; else kinds.push('arena'); if (sp.bars >= 12 && n > 2) kinds.splice(n - 2, 1); }
  if (sp.last) kinds.push('exit');
  n = kinds.length;
  const weight = kinds.map((k) => (k === 'arena' ? Math.max(2.5, n * 0.6) : k === 'exit' ? 0.6 : k === 'bend' ? 0.7 : 1)), total = weight.reduce((a, c) => a + c, 0);
  const g = grid(AIR + 2 + n * 22 + AIR + 6, th);
  // the entry airlock, its door, and the first cell beyond
  carve(g, 1, MID, AIR, MID, { floor: T.plate, ceil: T.ceil, light: 8 });
  for (let x = 0; x <= AIR + 1; x++) for (const y of [MID - 1, MID + 1]) setWall(g, x, y, T.frame);
  setWall(g, 0, MID, T.frame); setWall(g, AIR + 1, MID, sp.doorIn ?? T.door);
  let x = AIR + 2, cy = MID, acc = 0;
  const keys = [{ b: 0, x: AIR + 1 - STAND, y: MID + 0.5 }, { b: tIn * 0.12, x: AIR + 1 - STAND, y: MID + 0.5 }, { b: tIn, x: x + 0.5, y: MID + 0.5 }], spots = [], mods = [];
  for (let k = 0; k < n; k++) {
    const b0 = tIn + ((tOut - tIn) * acc) / total, b1 = tIn + ((tOut - tIn) * (acc + weight[k])) / total; acc += weight[k];
    const x0 = x, m = MODULES[kinds[k]](g, x, cy, th, rnd), lastMod = k === n - 1;
    m.path.slice(1).forEach(([u, px, py], j, arr) => keys.push({ b: b0 + (b1 - b0) * (lastMod && !m.end ? u * 0.85 : u), x: px, y: py, join: j === arr.length - 1 }));
    for (const s of m.spots) spots.push({ ...s, mod: k });
    mods.push({ k, kind: kinds[k], x0, x1: x + m.len, b0, b1, ps: lastMod && !m.end ? 0.85 : 1, arena: !!m.arena, end: !!m.end, boss: sp.boss && m.arena ? m.boss : null });
    dress(g, x0 - 1, x + m.len, th, rnd, m.dress ?? 0.3);
    x += m.len; cy = m.cy;
  }
  if (sp.rot) for (let y = 1; y < GH - 1; y++) for (let X = AIR + 2; X < x; X++) { // something has been growing here since the last visit
    const i = y * g.w + X;
    if (g.wall[i] === 0) { if (g.floor[i] === th.floor && rnd() < 0.09 * sp.rot) g.floor[i] = T.blood; }
    else if ((g.wall[i] === th.wall || th.alt.includes(g.wall[i])) && (open(g, X, y - 1) || open(g, X, y + 1) || open(g, X - 1, y) || open(g, X + 1, y)) && rnd() < 0.14 * sp.rot) g.wall[i] = T.flesh;
  }
  let exit = null;
  if (!sp.last) { // the exit airlock: the route stops in front of its door and waits for the bar line
    carve(g, x, cy, x + AIR - 1, cy, { floor: T.plate, ceil: T.ceil, light: 8 });
    for (let i = -1; i <= AIR; i++) for (const y of [cy - 1, cy + 1]) if (i >= 0 && !open(g, x + i, y)) setWall(g, x + i, y, T.frame);
    setWall(g, x + AIR, cy, sp.doorOut ?? T.door);
    keys.push({ b: tOut, x: x + AIR - STAND, y: cy + 0.5 }, { b: sp.bars, x: x + AIR - STAND, y: cy + 0.5 });
    exit = { x: x + AIR, y: cy };
  } else keys.push({ b: sp.bars, x: keys[keys.length - 1].x, y: keys[keys.length - 1].y });
  let len = 0; keys[0].s = 0;
  for (let i = 1; i < keys.length; i++) { len += Math.hypot(keys[i].x - keys[i - 1].x, keys[i].y - keys[i - 1].y); keys[i].s = len; }
  const sec = { ...g, face: th.wall, name: sp.name, bars: sp.bars, theme: sp.theme, weapon: sp.weapon, blast: !!sp.impact, rot: sp.rot ?? 0, keys, spots, mods, tIn, tOut, card, last: !!sp.last, door: MID * g.w + AIR + 1, exit };
  populate(sec, sp, th, rnd);
  return sec;
}

// ---------- the song as a level ----------
/** The part of a score a level is built from, as plain data (it lives in the world's state): sections with their bars, energy, role and transition marks, the cast's slots, and the song's length. */
export function planOf(score) {
  const per = (s, slots) => Object.entries(s.parts ?? {}).reduce((n, [k, p]) => n + (slots.includes(score.cast?.[k]?.slot) ? p.onsets ?? 0 : 0), 0);
  const secs = (score.sections ?? []).map((s) => ({ drum: per(s, ['impulse']), tune: per(s, ['line', 'counter']), low: per(s, ['ground']), name: s.name, at: s.at, until: s.until, bars: Math.max(1, s.bars), energy: s.energy ?? 0.5, role: s.role ?? null, riser: s.riser ?? 0, dropout: s.dropout ?? 0, impact: !!s.impact, sig: Object.entries(s.parts ?? {}).filter(([, p]) => p.onsets > 0).map(([k]) => k).sort().join(',') }));
  const cast = Object.fromEntries(Object.entries(score.cast ?? {}).map(([k, v]) => [k, v.slot]));
  if (!secs.length) return { total: 16, cps: score.cps ?? 0.5, cast, loop: true, sections: [{ name: 'sector', at: 0, until: 16, bars: 16, energy: 0.5, role: null, riser: 0, dropout: 0, impact: false, sig: '' }] }; // no song behind the pattern: one sector, walked again and again
  return { total: score.total, cps: score.cps ?? 0.5, cast, sections: secs };
}
const KEYS = ['keyR', 'keyB', 'keyY'], KEY_DOOR = [T.doorR, T.doorB, T.doorY];
/**
 * The level for a plan and seed. The building gets worse as the song goes on (base, plant, underground, rot, hell),
 * a section that sounds like an earlier one returns to that wing, the loudest late section holds the warden, the
 * last one the way out; weapons come with the energy. Then the running totals the status bar shows, as a timeline.
 */
export function buildLevel(plan, seed, prng) {
  const S = plan.sections, n = S.length, seen = new Map();
  let boss = -1; for (let i = 0; i < n; i++) if (S[i].role === 'climax') boss = i;
  if (boss < 0 && n > 1) { let e = -1; for (let i = Math.floor(n * 0.4); i < n; i++) if (S[i].energy >= e) { e = S[i].energy; boss = i; } }
  if (plan.loop) boss = -1;
  let arms = 0, keyN = 0, pendingKey = -1;
  const sectors = S.map((sp, i) => {
    const prog = n > 1 ? i / (n - 1) : 0, rnd = prng(seed * 131 + i * 17 + 1);
    let theme = ORDER[Math.min(ORDER.length - 1, Math.floor(prog * ORDER.length * 0.999))];
    let rot = 0;
    if (sp.sig && seen.has(sp.sig)) { const was = seen.get(sp.sig); theme = was.theme; rot = Math.max(++was.n, Math.round(prog * 3)); } // the same wing, as far gone as the run is long: a late return to the opening is not a reset else if (sp.sig) seen.set(sp.sig, { theme, n: 0 });
    if (i === boss && i >= n / 2) theme = 'hell';
    const want = i === boss ? 3 : sp.energy < 0.3 ? 0 : sp.energy < 0.68 ? 1 : 2; arms = Math.max(arms, Math.min(want, arms + 1)); // a weapon is found, never skipped to
    const weapon = WEAPON_ORDER[i === boss ? Math.max(arms, 2) : Math.min(want, arms)];
    const doorIn = pendingKey >= 0 ? KEY_DOOR[pendingKey] : undefined; let keyGet = null, doorOut;
    pendingKey = -1;
    if (i < n - 1 && i !== boss && sp.bars >= 8 && keyN < 3 && (i % 2 === 1 || n <= 3)) { keyGet = KEYS[keyN]; doorOut = KEY_DOOR[keyN]; pendingKey = keyN; keyN++; }
    if (i + 1 === boss) { doorOut = T.gate; pendingKey = -1; if (keyGet) { keyGet = null; keyN--; } }
    const sec = buildSector({ ...sp, theme, weapon, boss: i === boss, last: i === n - 1, first: i === 0, rot, quiet: sp.energy < 0.12, ammo: i % 2 === 0, armor: i > 0 && sp.energy > 0.6, keyGet, doorOut, doorIn: i > 0 && S[i - 1] && i === boss ? T.gate : doorIn }, THEMES[theme], rnd);
    sec.keyGet = keyGet;
    return sec;
  });
  // the bar's numbers: one pass over everything that will happen, in order
  let health = 100, armor = 0, ammo = 50, kills = 0, items = 0; const keys = [false, false, false], own = [true, false, false, false];
  let foes = 0, things = 0;
  sectors.forEach((sec) => {
    own[WEAPON_ORDER.indexOf(sec.weapon)] = true;
    const ev = [];
    for (const f of sec.foes) { foes++; for (const h of f.hits) ev.push([h, 'shot']); ev.push([f.die, 'kill']); }
    for (const h of sec.hurts) ev.push([h.b, 'hurt', h.n]);
    for (const p of sec.picks) { things++; ev.push([p.b, p.kind]); }
    for (const d of sec.drums) if (d.shot) ev.push([d.boom, 'shot']);
    ev.sort((a, b) => a[0] - b[0]);
    const snap = () => ({ health, armor, ammo, kills, items, keys: [...keys], own: [...own] });
    sec.tl = [{ b: -1, ...snap() }];
    for (const [b, what, n2] of ev) {
      if (what === 'shot') ammo = Math.max(1, ammo - 1); else if (what === 'kill') { kills++; ammo = Math.max(1, ammo - 1); }
      else if (what === 'hurt') { const d = armor > 0 ? Math.ceil(n2 / 2) : n2; armor = Math.max(0, armor - (armor > 0 ? n2 : 0)); health = Math.max(11, health - d); }
      else { items++; if (what === 'ammo') ammo = Math.min(99, ammo + 20); else if (what === 'med') health = Math.min(100, health + 25); else if (what === 'armor') armor = 100; else keys[KEYS.indexOf(what)] = true; }
      sec.tl.push({ b, ...snap() });
    }
  });
  return { sectors, plan, stats: { foes, things, sectors: n } };
}
/** The bar's numbers at bar `b` of a sector: the last entry of its timeline at or before b. */
export const tallyAt = (sec, b) => { const tl = sec.tl; let i = tl.length - 1; while (i > 0 && tl[i].b > b) i--; return tl[i]; };
/** The sector index and the bar within it at song cycle `c`. */
export function whereAt(plan, c) {
  c = plan.total > 0 ? ((c % plan.total) + plan.total) % plan.total : c;
  let i = plan.sections.length - 1; while (i > 0 && plan.sections[i].at > c) i--;
  const s = plan.sections[i];
  return { i, b: clamp(((c - s.at) * s.bars) / (s.until - s.at), 0, s.bars), prog: plan.total > 0 ? c / plan.total : 0 };
}
