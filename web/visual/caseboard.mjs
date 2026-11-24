// caseboard: the evidence board of a crime mystery, worked by somebody we never see, one thing at a time. A cork board
// fills the frame and the song performs the investigation on it.
//
// The case. Every case is a handful of seeded facts (five names, a time, a car and its plate, a place, a sum, a kind of
// crime) that the papers share, so a receipt, a witness note, a contact sheet and a vehicle record agree with each
// other. Every piece of evidence is about one suspect and one fact. The story has a shape: the board opens with a map
// and one suspect; suspects and evidence arrive; from a fifth of the way in the evidence leans toward a DECOY, who is
// circled at 38%; at 55% a note turns up that clears them (the twist), the decoy is crossed out and some of the yarn
// that ran to them is re-run to the culprit; the others go at 66%, 76% and 86%; at 89% two of the culprit's papers are
// tied to each other and boxed (the decisive link); at 94% the marker goes round the one left, at 98% the stamp lands.
// These are progress marks, so a song with no drums, a quiet ending or a sparse stream still closes its case.
//
// The music. A snare pins something up (near the suspect it is about, where there is room); a clap brings two papers
// that share a fact side by side, ties them and circles both. A melody note runs yarn from the newest untied evidence
// to its suspect, or along a chain to other evidence, the timeline or a map; with nothing to tie it takes the marker
// to a paper, and how it was played picks the mark (long: a highlighter stroke; loud: a box, a star, an exclamation;
// quiet: a question mark; its pitch picks whose papers). Hats are the breeze and the handwriting, an open hat sends a
// ripple across the board; the kick thumps the wall and stirs the dust; the bass sends a wave down the strings; the
// pad is the air in the room; a riser ties faster. Quiet bars revisit an old paper and question it, busy bars tidy,
// compare and strike out dead leads; a section that comes back goes back to the paper it was on.
//
// The hand. Only one big thing happens at a time (`busy`), and nothing queues. A paper arrives, then its pin presses
// in; a moved paper has its pin lifted first and leaves a pinhole behind; yarn runs out slack, tightens and settles,
// and comes down by letting go at one end. Papers never swing or fall: the wind lifts their free edge. Ink is only
// ever on a paper. A dead lead is struck through and left greyed, or taken down. The camera goes where the work is
// (both ends of a new string, the two papers compared, the suspect being crossed out), holds, and pulls back.
//
// The room. A tint, a pool of light that drifts toward what is being looked at, blinds whose shadows turn slowly as the
// song goes on and that are sometimes opened, bumped or crossed by a shadow (headlights, when it is late), and dust in
// the light. Nothing flickers or pulses. A song that loops takes the case down and starts another; the pinholes stay.
// The label on the frame is the song's name (score.name, which the host sets).
//
// A finished paper is the same picture every frame, so it is drawn once into a cached bitmap and stamped (limner takes
// ~20 ms for a face; a full board of vector papers was most of the frame). Deterministic: randomness only from the
// state's own seeded generator (kit.mjs); the caches are pure functions of the state and live outside it.
import { clamp, lerp, decay, ease, hsla, seed, rand, DEFAULT_SLOT } from './kit.mjs';
import { portraitOps, drawOn, eyeY, characterOf } from './limner.mjs';

const TAU = Math.PI * 2;
export const MAX = 34, SUSPECTS = 5, START = 2; // the board opens with a map and one suspect
const PIN = 0.012; // the pin sits this far under the paper's top edge; an item's x, y is its pin
// kind: width, height (canvas heights), how much the breeze moves it
const KINDS = {
  map: [0.3, 0.21, 0.2], suspect: [0.105, 0.13, 0.7], snap: [0.115, 0.125, 0.7], note: [0.08, 0.08, 1.4], card: [0.14, 0.088, 0.9], clip: [0.12, 0.165, 1],
  bag: [0.085, 0.12, 0.6], print: [0.08, 0.1, 0.9], receipt: [0.058, 0.14, 1.3], envelope: [0.14, 0.09, 0.8], phone: [0.1, 0.15, 1], strip: [0.24, 0.085, 0.6],
  plan: [0.15, 0.13, 0.8], ticket: [0.14, 0.06, 1.2], plate: [0.13, 0.1, 0.8], redact: [0.11, 0.15, 1], times: [0.27, 0.07, 0.5], shoe: [0.075, 0.13, 0.8],
};
const EVIDENCE = ['note', 'note', 'note', 'note', 'card', 'card', 'clip', 'snap', 'snap', 'bag', 'print', 'receipt', 'envelope', 'phone', 'strip', 'plan', 'ticket', 'plate', 'redact', 'shoe'];
const CAP = { plan: 2, strip: 2, plate: 2, shoe: 2, phone: 2, redact: 2, ticket: 2, print: 3, bag: 3 }; // how many of a kind a board holds (4 otherwise)
// the fact a paper is about: 0 the time, 1 the car, 2 the place, 3 the money and the calls (unlisted kinds: any)
const FACT_OF = { receipt: 0, ticket: 0, times: 0, phone: 3, strip: 1, plate: 1, plan: 2, clip: 2, shoe: 2, envelope: 3, bag: 3 };
const WRITTEN = { note: 1, card: 1, times: 1 };
const NAMES = ['VANCE', 'MORROW', 'KLINE', 'ABBOTT', 'REYES', 'DOYLE', 'HALE', 'IBARRA', 'QUINN', 'STROUD', 'LARKIN', 'OSEI', 'PIKE', 'WELLS', 'NAKAMURA', 'BRANDT'];
const PLACES = ['PIER 9', 'HOTEL ORSO', 'LOT C', 'UNION STN', 'THE ANNEX', 'DOCK 14', 'CAFE LUNE', 'GALLERY 3'];
const CARS = [['BLUE SEDAN', [215, 55, 40]], ['RED COUPE', [2, 65, 42]], ['GREEN VAN', [130, 40, 34]], ['BLACK SEDAN', [230, 10, 14]], ['WHITE VAN', [45, 10, 88]]];
const CRIMES = [['HOMICIDE', ['print', 'shoe', 'bag']], ['MISSING PERSON', ['phone', 'snap', 'ticket']], ['ART THEFT', ['plan', 'strip', 'redact']], ['ROBBERY', ['plate', 'strip', 'receipt']], ['FRAUD', ['phone', 'receipt', 'redact', 'envelope']]];
const clockText = (m) => `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, '0')}`;
/** What a note about fact `n` might say. */
const noteWords = (f, n) => [[clockText(f.tmin), 'ALIBI?', 'TOO LATE?', `${clockText(f.tmin + 12)}?`], ['SAME CAR?', f.plate, f.car, 'WHOSE CAR?'], [f.place, 'WHY HERE?', 'WHO SAW?', 'BACK DOOR?'], [f.sum, 'WHO PAID?', 'CALL BACK', 'DEBT?']][n];
// the room's light: a multiply tint (h, s, l), how dark the corners go, blinds, where the pool of light sits
const LIGHTS = [
  { h: 38, s: 70, l: 84, dark: 0.6, blinds: 0.18, lx: -0.25, ly: -0.5 }, // desk lamp
  { h: 205, s: 30, l: 90, dark: 0.3, blinds: 0.5, lx: 0.5, ly: -0.3 }, // daylight through blinds
  { h: 150, s: 14, l: 92, dark: 0.35, blinds: 0, lx: 0, ly: -0.7 }, // fluorescent tube
  { h: 26, s: 60, l: 76, dark: 0.75, blinds: 0.3, lx: 0.3, ly: -0.4 }, // late, amber
];
const TEMP = { warm: 0, cool: 1, pale: 2, dim: 3 };
const NOTE_COLS = [[52, 92, 72], [338, 80, 80], [195, 70, 78], [95, 55, 74]];
const PIN_COLS = [[2, 80, 48], [48, 90, 55], [212, 70, 50], [130, 50, 42], [0, 0, 92]];
const YARN = [[358, 82, 46], [4, 88, 54], [350, 70, 34], [12, 80, 48], [342, 75, 50]]; // a few balls of red: crimson, scarlet, maroon, brick, rose
const INK = [[2, 78, 44], [230, 25, 16], [218, 70, 38], [52, 95, 58]]; // marker red, black, biro blue, highlighter
const DARK = [230, 20, 18];

const hash = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x); };
const smooth = (u) => u * u * (3 - 2 * u);
const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
const byId = (s, id) => s.items.find((i) => i.id === id) ?? null;
const up = (it) => it.st === 'on' || it.st === 'move'; // on the board, pin in or in the hand
const counted = (it) => it.st !== 'off';
const alive = (s) => [...Array(SUSPECTS).keys()].filter((i) => !s.dead.includes(i));
const photoOf = (s, who) => s.items.find((i) => i.who === who && counted(i)) ?? null;
const marksOn = (s, it) => s.marks.filter((m) => m.id === it.id).length;
const tie = (it) => (it.kind === 'map' || it.kind === 'times' ? [it.cx - it.w * 0.42 * Math.cos(it.rest), it.cy - it.w * 0.42 * Math.sin(it.rest)] : [it.cx, it.cy]); // where yarn knots on: a pin (the left one of two)
const hole = (s, x, y) => { s.holes.push({ x, y }); if (s.holes.length > 40) s.holes.shift(); }; // where a pin was: the cork keeps it

/** How much a paper of w x h pinned at (x, y) would cover the others (padded a little: touching is crowding). */
function crowd(s, x, y, w, h, skip) {
  let c = 0;
  for (const o of s.items) {
    if (o.id === skip || !counted(o)) continue;
    const ox = Math.min(x + w / 2, o.x + o.w / 2) - Math.max(x - w / 2, o.x - o.w / 2) + 0.012, oy = Math.min(y + h, o.y + o.h) - Math.max(y, o.y) + 0.012;
    if (ox > 0 && oy > 0) c += ox * oy * (o.who >= 0 ? 4 : 1);
  }
  return c;
}
/** The best of sixty tries for a paper: least crowded (so papers overlap only when the board is full), and, with `near`, not far from that item: `pull` is how much a canvas height of distance costs. */
function place(s, w, h, skip = null, near = null, pull = 0.004) {
  let best = null;
  for (let i = 0; i < 60; i++) {
    const x = lerp(-s.bw + w / 2 + 0.01, s.bw - w / 2 - 0.01, rand(s)), y = lerp(-s.bh + 0.03, s.bh - h, rand(s));
    const c = crowd(s, x, y, w, h, skip) + (near ? pull * Math.hypot(x - near.x, y - near.y) : 0);
    if (!best || c < best.c) best = { x, y, c };
  }
  return best;
}

function newCase(s) {
  const names = []; while (names.length < SUSPECTS) { const n = pick(s, NAMES); if (!names.includes(n)) names.push(n); }
  const L = 'ABCDEFGHJKLMNPRSTVWXYZ', ch = () => L[Math.floor(rand(s) * L.length)], car = Math.floor(rand(s) * CARS.length);
  s.facts = { names, tmin: 21 * 60 + Math.floor(rand(s) * 170), plate: `${ch()}${ch()}${ch()} ${100 + Math.floor(rand(s) * 900)}`, car, place: pick(s, PLACES), sum: `$${(2 + Math.floor(rand(s) * 88)) * 50}`, crime: Math.floor(rand(s) * CRIMES.length) };
  s.made = 0; s.sus = 0; s.lastKind = ''; s.dead = []; s.fin = 0; s.stamp = 0; s.lead = 0; s.twist = 0; s.key = 0; s.seen = {};
  s.culprit = Math.floor(rand(s) * SUSPECTS); s.decoy = (s.culprit + 1 + Math.floor(rand(s) * (SUSPECTS - 1))) % SUSPECTS; s.caseNo = 100 + Math.floor(rand(s) * 900);
}
/** The next thing to go up: the first map, the five suspects among the first nine, the timeline, a second map, evidence (the crime's own kinds favoured, never the same kind twice running). */
function kindFor(s) {
  const n = s.made++;
  if (n === 0 || n === 13) return ['map', -1];
  if (s.sus < SUSPECTS && ([1, 2, 4, 6, 8].includes(n) || s.p >= 0.25)) return ['suspect', s.sus++]; // all five are up by a quarter of the way in, however sparse the song: the story needs their photos
  if (n === 6) return ['times', -1];
  const fav = CRIMES[s.facts.crime][1];
  for (let i = 0; i < 4; i++) {
    const k = rand(s) < 0.3 ? pick(s, fav) : pick(s, EVIDENCE);
    if (k !== s.lastKind && s.items.filter((it) => it.kind === k && counted(it)).length < (CAP[k] ?? 4)) { s.lastKind = k; return [k, -1]; }
  }
  s.lastKind = 'note'; return ['note', -1];
}
/** Pin something up. `force` ({ kind, about, word, role, near }) is a staged paper: the note that clears the decoy. */
function addItem(s, st = 'in', force = null) {
  const [kind, who] = force ? [force.kind, -1] : kindFor(s), live = alive(s), lone = kind === 'map' || kind === 'times' || who >= 0;
  const size = lone ? 1 : lerp(0.86, 1.18, rand(s)), stretch = kind === 'envelope' ? lerp(0.8, 1.25, rand(s)) : 1, w = KINDS[kind][0] * size * stretch, h = (KINDS[kind][1] * size) / stretch;
  // who it is about: the decoy for a while, the culprit more and more, else anyone still in it
  const about = lone ? -1 : force?.about ?? (s.p >= 0.18 && s.p < 0.55 && live.includes(s.decoy) && rand(s) < 0.5 ? s.decoy : rand(s) < 0.2 + 0.6 * s.p ? s.culprit : pick(s, live));
  const fact = kind === 'map' ? 2 : who >= 0 ? -1 : FACT_OF[kind] ?? Math.floor(rand(s) * 4);
  const at = place(s, w, h, null, force?.near ?? (about >= 0 ? photoOf(s, about) : null), 0.003); // toward its suspect, but room comes first: loose clusters, little overlap
  const it = {
    id: ++s.ids, kind, w, h, x: at.x, y: at.y, cx: at.x, cy: at.y, fx: at.x, fy: at.y, k: 1, al: st === 'on' ? 1 : 0, st, u: 0, pt: st === 'on' ? 1 : 0,
    rest: (rand(s) - 0.5) * (kind === 'map' || kind === 'times' ? 0.03 : 0.16), a: 0, va: 0, z: ++s.z,
    sd: Math.floor(rand(s) * 1e6), who, pin: Math.floor(rand(s) * PIN_COLS.length), col: Math.floor(rand(s) * NOTE_COLS.length),
    about, fact, role: force?.role ?? 'lead', dim: 0,
    word: kind === 'note' ? force?.word ?? (rand(s) < 0.65 ? (rand(s) < 0.2 && about >= 0 ? `${s.facts.names[about]}?` : pick(s, noteWords(s.facts, fact))) : null) : null,
    ink: WRITTEN[kind] ? (st === 'on' ? 1 : 0.15) : 1, char: who >= 0 ? characterOf(s, 'none', 0.3) : null,
  };
  it.a = it.rest;
  s.items.push(it); s.last = it.id; s.busy = Math.max(s.busy, 0.3);
  return it;
}

const mk = (it, kind, o = {}) => ({ id: it.id, kind, x: 0.5, y: 0.5, x2: 0, y2: 0, r: 0.02, ry: 0, turns: 1.12, u: 0, col: 0, sd: it.sd % 1000, ...o });
const yarnOf = (s, a, b, x = 0) => ({ a: a.id, b: b.id, x, u: 0, set: 0, die: null, pl: 0, ph: rand(s) * TAU, sag: lerp(0.03, 0.1, rand(s)), c: Math.floor(rand(s) * YARN.length) });
const primary = (s) => new Set(s.yarn.filter((y) => !y.x).map((y) => y.a)); // papers already tied on (a comparison's string is extra)
const loose = (s) => { const tied = primary(s); return s.items.filter((i) => i.st === 'on' && i.about >= 0 && !i.dim && !s.dead.includes(i.about) && !tied.has(i.id)); };

/**
 * Yarn from the newest untied evidence: often along a chain (to tied evidence about the same suspect and fact), now
 * and then to the timeline or a map, else to its suspect's photo. So the case is a network, and it still reads.
 */
function link(s) {
  const tied = primary(s), from = loose(s).sort((a, b) => b.z - a.z)[0];
  if (!from) return null;
  const on = s.items.filter((i) => i.st === 'on' && i.id !== from.id), k = rand(s);
  const chain = on.find((i) => i.about === from.about && i.fact === from.fact && tied.has(i.id));
  const to = (k < 0.6 && chain) || (k > 0.82 && from.fact === 0 && on.find((i) => i.kind === 'times')) || (k > 0.82 && from.fact === 2 && on.find((i) => i.kind === 'map'))
    || on.find((i) => i.who === from.about) || chain || on.find((i) => i.about === from.about) || on.find((i) => i.kind === 'map');
  if (!to) return null;
  s.yarn.push(yarnOf(s, from, to)); s.last = from.id; s.busy = Math.max(s.busy, 0.25);
  return [from, to];
}

/**
 * The marker on a paper (never a suspect's photo, never more than three marks a paper). On a map or a plan: a circle,
 * or a route between two circles. Elsewhere how the note was played picks it: `quiet` a question, `loud` a box, a star
 * or an exclamation, `long` a highlighter stroke. `note` (a pitch) picks whose papers, so a repeated phrase keeps
 * going back to the same corner of the board; `item` is a paper being revisited.
 */
function addMark(s, { item = null, long = false, loud = false, quiet = false, note = null } = {}) {
  const on = s.items.filter((i) => i.st === 'on' && !i.dim && i.kind !== 'suspect' && marksOn(s, i) < 3);
  let pool = item ? [item] : on;
  if (!item && note !== null) { const live = alive(s), who = live[note % live.length], mine = on.filter((i) => i.about === who || i.kind === 'map'); if (mine.length) pool = mine; }
  if (!pool.length) return null;
  const it = pick(s, pool), sd = Math.floor(rand(s) * 1000);
  let m = mk(it, 'circle', { x: lerp(0.15, 0.85, rand(s)), y: lerp(0.2, 0.8, rand(s)), r: lerp(0.016, 0.028, rand(s)), sd });
  if (it.kind === 'map' || it.kind === 'plan') {
    const spots = s.marks.filter((k) => k.id === it.id && k.kind === 'circle');
    if (spots.length >= 2 && rand(s) < 0.45) { const a = pick(s, spots), b = pick(s, spots); if (a !== b) m = mk(it, 'route', { x: a.x, y: a.y, x2: b.x, y2: b.y, sd }); }
  } else {
    const kind = pick(s, quiet ? ['q', 'q', 'under'] : loud ? ['box', 'bang', 'star', 'circle'] : long ? ['hi', 'hi', 'under'] : ['under', 'tick', 'circle', 'q', 'hi', 'star']);
    const col = kind === 'hi' ? 3 : rand(s) < 0.6 ? 0 : 1 + Math.floor(rand(s) * 2), y = lerp(0.3, 0.82, rand(s));
    if (kind === 'circle') m = mk(it, kind, { r: it.w * 0.42, ry: it.h * 0.42, col, sd });
    else if (kind === 'box') m = mk(it, kind, { r: it.w * 0.4, ry: it.h * 0.37, col, sd });
    else if (kind === 'hi') m = mk(it, kind, { y, r: it.w * 0.36, col, sd });
    else if (kind === 'under') m = mk(it, kind, { y, r: it.w * 0.2, col, sd });
    else m = mk(it, kind, { x: lerp(0.22, 0.78, rand(s)), y: lerp(0.28, 0.72, rand(s)), r: lerp(0.014, 0.022, rand(s)), col, sd });
  }
  s.marks.push(m); s.last = it.id;
  return it;
}

/** Where the work is: frame these papers (both ends of a string, the two compared), hold, and do not be pulled off it unless `force`. Nothing: the whole board. */
function attend(s, its, hold = 2.5, force = false) {
  if (!force && s.hold > 0) return;
  its = its.filter(Boolean); s.hold = hold;
  if (!its.length) { s.camTo = { x: 0, y: 0, z: 1 }; return; }
  const x0 = Math.min(...its.map((i) => i.x - i.w / 2)) - 0.16, x1 = Math.max(...its.map((i) => i.x + i.w / 2)) + 0.16, y0 = Math.min(...its.map((i) => i.y)) - 0.16, y1 = Math.max(...its.map((i) => i.y + i.h)) + 0.16;
  const z = clamp(Math.min(s.aspect / (x1 - x0), 1 / (y1 - y0)), 1, 1.45), mx = (s.aspect / 2) * (1 - 1 / z), my = 0.5 * (1 - 1 / z);
  s.camTo = { x: clamp((x0 + x1) / 2, -mx, mx), y: clamp((y0 + y1) / 2, -my, my), z };
}

function move(s, it, at) { hole(s, it.x, it.y); Object.assign(it, { fx: it.cx, fy: it.cy, x: at.x, y: at.y, st: 'move', u: 0, z: ++s.z }); s.last = it.id; s.busy = Math.max(s.busy, 0.9); }
/** One paper lifted and re-pinned: the most crowded one to where there is room, else a tied one nearer what it is tied to. */
function tidy(s) {
  if (s.items.some((i) => i.st === 'move')) return;
  const on = s.items.filter((i) => i.st === 'on' && i.kind !== 'map');
  let worst = null, wc = 0.0003;
  for (const it of on) { const c = crowd(s, it.x, it.y, it.w, it.h, it.id); if (c > wc) { wc = c; worst = it; } }
  if (worst) { const at = place(s, worst.w, worst.h, worst.id, worst.about >= 0 ? photoOf(s, worst.about) : null); if (at.c < 0.5 * wc) move(s, worst, at); return; }
  const far = s.yarn.filter((y) => y.die === null).map((y) => [byId(s, y.a), byId(s, y.b)]).filter(([a, b]) => a?.st === 'on' && b && Math.hypot(a.x - b.x, a.y - b.y) > 0.55);
  if (far.length && rand(s) < 0.5) { const [a, b] = pick(s, far), at = place(s, a.w, a.h, a.id, b); if (Math.hypot(at.x - b.x, at.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y)) move(s, a, at); }
}
/** A discovery: two papers that share a fact are brought side by side, tied with a short string and circled alike. */
function compare(s) {
  if (s.items.some((i) => i.st === 'move') || s.yarn.filter((y) => y.x).length >= 5) return false; // a handful of these: the board is a network, not a web
  const on = s.items.filter((i) => i.st === 'on' && i.about >= 0 && !i.dim && !s.dead.includes(i.about)), pairs = [];
  for (const a of on) for (const b of on) if (a.id < b.id && a.fact === b.fact && a.about === b.about && !s.yarn.some((y) => (y.a === a.id && y.b === b.id) || (y.a === b.id && y.b === a.id))) pairs.push([a, b]);
  if (!pairs.length) return false;
  const [a, b] = pick(s, pairs), at = place(s, a.w, a.h, a.id, b, 0.05);
  if (at.c < 0.002 && Math.hypot(at.x - b.x, at.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y)) move(s, a, at);
  const sd = Math.floor(rand(s) * 1000), spot = { x: lerp(0.3, 0.7, rand(s)), y: lerp(0.35, 0.7, rand(s)), r: 0.017, col: 2, sd };
  for (const it of [a, b]) if (marksOn(s, it) < 3) s.marks.push(mk(it, 'circle', spot));
  s.yarn.push(yarnOf(s, a, b, 1)); s.busy = 1.2; s.last = a.id;
  attend(s, [{ ...a, x: at.x, y: at.y }, b], 3, true);
  return true;
}
/** A quiet bar: go back to something that has been up a while and question it. */
function revisit(s, item = null) {
  const old = item ?? s.items.filter((i) => i.st === 'on' && !i.dim && i.kind !== 'suspect' && i.kind !== 'map' && marksOn(s, i) < 2).sort((a, b) => a.z - b.z)[0];
  if (!old || !addMark(s, { item: old, quiet: true })) return false;
  attend(s, [old], 3.5); s.busy = 0.8;
  return true;
}
/** A paper about a suspect already crossed out, with no yarn left on it: struck through and left there greyed (the board keeps its history), or taken down. */
function discard(s) {
  const it = s.items.find((i) => i.st === 'on' && i.about >= 0 && !i.dim && i.role !== 'exon' && s.dead.includes(i.about) && !s.yarn.some((y) => y.a === i.id || y.b === i.id));
  if (!it) return;
  if (rand(s) < 0.4 && s.items.filter((i) => i.dim).length < 4) { it.dim = 1; s.marks.push(mk(it, 'strike', { r: it.w * 0.4, ry: it.h * 0.22, col: 1 })); } else { it.st = 'off'; it.u = 0; hole(s, it.x, it.y); } // a few stay up, struck through; the rest come down
}

/**
 * Cross a suspect out: the decoy first, then whoever has the least yarn and is not the culprit. The decoy does not go
 * at once: the first call pins up the note that clears them (the twist) and the next crosses them out, and two of the
 * strings that ran to them are re-run to the culprit. The rest come down one by one.
 */
function eliminate(s) {
  const strings = (w) => { const p = photoOf(s, w); return p ? s.yarn.filter((y) => y.b === p.id).length : 0; };
  const live = alive(s).filter((w) => w !== s.culprit), out = live.includes(s.decoy) ? s.decoy : live.sort((a, b) => strings(a) - strings(b))[0];
  if (out === undefined) return;
  const p = photoOf(s, out);
  if (out === s.decoy && !s.twist && p && !s.fin) { s.twist = 1; const n = addItem(s, 'in', { kind: 'note', about: out, word: pick(s, ['ALIBI HOLDS', 'WRONG MAN', 'NOT THERE', `NOT ${s.facts.names[out]}`]), role: 'exon', near: p }); attend(s, [n, p], 3, true); s.busy = 1; return; }
  s.dead.push(out); s.busy = 1;
  if (!p) return;
  s.marks.push(mk(p, 'x', { y: 0.45, r: 0.038 }));
  const cp = photoOf(s, s.culprit);
  let n = 0, moved = 0;
  for (const y of s.yarn) {
    const a = byId(s, y.a);
    if (y.die !== null || !(y.b === p.id || a?.about === out)) continue;
    if (out === s.decoy && cp?.st === 'on' && y.b === p.id && a?.role === 'lead' && moved < 2) { a.about = s.culprit; y.b = cp.id; y.u = 0; y.set = 0; moved++; } // it pointed at the wrong one all along
    else y.die = 0.6 + 0.45 * n++;
  }
  s.last = p.id; attend(s, [p], 3, true);
}
/** The decisive link: two of the culprit's papers are tied to each other and boxed. */
function decisive(s) {
  const mine = s.items.filter((i) => i.st === 'on' && i.about === s.culprit && !i.dim).sort((a, b) => b.z - a.z);
  const a = mine[0], b = mine.find((i) => i !== a && i.fact === a.fact) ?? mine[1];
  if (!a || !b) return;
  for (const it of [a, b]) s.marks.push(mk(it, 'box', { r: it.w * 0.43, ry: it.h * 0.4, sd: 3 }));
  s.yarn.push(yarnOf(s, a, b, 1)); attend(s, [a, b], 4, true); s.busy = 1.5;
}

export default {
  name: 'caseboard',

  init(score, rng, size) {
    const aspect = size?.w && size?.h ? size.w / size.h : 16 / 9;
    const s = {
      t: 0, total: score.total ?? 0, name: score.name ?? null, aspect, bw: aspect / 2 - 0.07, bh: 0.42, p: 0, uid: 0,
      slotOf: Object.fromEntries(Object.entries(score.cast).map(([n, c]) => [n, c.slot])),
      items: [], yarn: [], marks: [], holes: [], ids: 0, z: 0, last: 0, busy: 0, hold: 0, sec: null, seen: {},
      made: 0, sus: 0, lastKind: '', dead: [], fin: 0, stamp: 0, stampY: 0.12, lead: 0, twist: 0, key: 0, culprit: 0, decoy: 0, caseNo: 0, facts: null,
      beatNo: -1, energy: 0.5, dark: 0, riser: 0, air: 0, gust: 0, wind: 0, shake: 0, side: 1, rip: 9, dx: 0, dy: 0,
      slat: 0.04, slatTo: 0.04, bump: 0, pass: 9, passLit: 0, // the blinds: how closed (a slat's shadow, of a 0.09 pitch), how hard they sway, where the passing shadow is (9: nobody), headlights instead
      lamp: { x: 0, v: 0 }, lightTo: TEMP[score.palette?.temperature] ?? 0, li: null,
      cam: { x: 0, y: 0, z: 1 }, camTo: { x: 0, y: 0, z: 1 },
    };
    seed(s, rng);
    s.uid = s.rnd; s.li = { ...LIGHTS[s.lightTo] };
    newCase(s);
    for (let i = 0; i < START; i++) addItem(s, 'on');
    s.busy = 0;
    return s;
  },

  step(s, dt, events, clock) {
    s.t += dt;
    const p = s.total > 0 ? clamp(clock.cycle / s.total) : clamp(s.t / 180);
    if (p < s.p - 0.5) { // the song came round again: the old case is taken down and a new one starts
      for (const it of s.items) if (it.st !== 'off') { it.st = 'off'; it.u = 0; hole(s, it.x, it.y); }
      s.yarn = []; s.marks = []; newCase(s); s.camTo = { x: 0, y: 0, z: 1 }; s.hold = 0;
    }
    s.p = p;
    s.energy = ease(s.energy, clock.energy, 1.5, dt);
    s.dark = ease(s.dark, clock.dropout ? 1 : 0, 3, dt);
    s.riser = clock.riserBars && clock.riser > 0 ? clamp(1 - clock.riser / clock.riserBars) : 0;
    s.busy = Math.max(0, s.busy - dt); s.hold = Math.max(0, s.hold - dt);
    const still = 1 - 0.8 * s.dark, E = s.energy, count = () => s.items.filter(counted).length, quiet = E < 0.38 || clock.dropout;
    const itemsT = Math.min(MAX, Math.round(START + (MAX - START) * p ** 0.6)), marksT = Math.round(2 + 30 * p);

    if (clock.boundary) {
      if (rand(s) < 0.5) s.lightTo = (s.lightTo + 1 + Math.floor(rand(s) * (LIGHTS.length - 1))) % LIGHTS.length; // now and then the light in the room changes, slowly
      if (s.sec !== null) s.seen[s.sec] = s.last; // where the work was when this section ended
      const back = byId(s, s.seen[clock.section] ?? 0);
      if (!s.fin && back?.st === 'on' && !back.dim) revisit(s, back); else if (!s.fin) attend(s, [], 2); // a section that comes back goes back to its paper; a new one starts from the whole board
    }
    s.sec = clock.section;
    const beatNo = (clock.index + 1) * 1e5 + clock.bar * clock.beats + clock.beat;
    if (beatNo !== s.beatNo) { // the work that does not wait for a hit: a song without a snare still builds its case
      const first = s.beatNo < 0; s.beatNo = beatNo;
      const due = [0.55, 0.66, 0.76, 0.86].filter((x) => p >= x).length;
      if (!s.fin && !first) {
        if (count() < itemsT - 2) addItem(s);
        if (loose(s).length >= 3 || s.riser > 0.3) link(s); // a build ties faster
        if (s.dead.length < due && !s.yarn.some((y) => y.die !== null) && s.busy <= 0.3) eliminate(s);
        else if (clock.beat === 0) {
          if (s.busy <= 0) {
            if (quiet) { if (clock.bar % 2 === 0) revisit(s); else tidy(s); } // quiet bars read and question; busy ones tidy, compare and strike out
            else if (clock.bar % 4 !== 1 || !compare(s)) tidy(s);
            if (clock.bar % 2 && rand(s) < 0.6) discard(s);
          }
          if (s.marks.length < marksT - 3) addMark(s, { quiet });
          if (clock.bar % 4 === 2 && rand(s) < 0.6) { // the window: somebody opens or closes the blinds a little, bumps them, or something passes outside
            const k = rand(s);
            if (k < 0.4) s.slatTo = lerp(0.015, 0.07, rand(s)); else if (k < 0.75) s.bump = 1; else if (s.pass > 2) { s.pass = -2; s.passLit = s.lightTo === 3 ? 1 : 0; }
          }
          if (clock.bar % 4 === 0) attend(s, quiet || rand(s) < 0.5 ? [byId(s, s.last)] : [], quiet ? 4 : 2.5);
        }
      }
    }

    for (const e of events) {
      const slot = s.slotOf[e.layer] ?? DEFAULT_SLOT[e.kind] ?? 'grain', g = clamp(e.gain * e.velocity, 0, 1.5) * still;
      if (e.role === 'impact') { // a snare pins something up, a clap compares two papers; with the board full or the hand busy it rattles one
        s.shake = Math.min(1, s.shake + 0.1 * g);
        if (!s.fin && s.busy <= 0 && e.voice === 'cp' && compare(s)) continue;
        if (!s.fin && s.busy <= 0 && count() < itemsT) addItem(s);
        else { const it = pick(s, s.items.filter((i) => i.st === 'on')); if (it) it.va += (rand(s) < 0.5 ? -1 : 1) * (1.5 + 2 * E) * g; }
      } else if (e.role === 'grain' || (slot === 'grain' && e.note === null)) { // hats: a gust and a word of handwriting; an open hat sends a ripple across the board
        s.gust = Math.min(1.5, s.gust + (e.voice === 'oh' ? 0.6 : 0.3) * g);
        if (e.voice === 'oh' && s.rip > s.bw) s.rip = -s.bw - 0.1;
        const it = pick(s, s.items.filter(up)); if (it) it.va += (rand(s) - 0.5) * 1.2 * g * KINDS[it.kind][2];
        const w = s.items.findLast((i) => i.ink < 1 && up(i)); if (w) w.ink = Math.min(1, w.ink + 0.07);
      } else if (slot === 'ground' || (e.note !== null && e.note < 48 && slot !== 'line' && slot !== 'counter' && slot !== 'field')) { // the bass sends a wave down the strings: every other one, by its pitch
        s.yarn.forEach((y, i) => { if ((i + (e.note ?? 0)) % 2 === 0) y.pl = Math.min(0.014, y.pl + 0.006 * g); });
      } else if (slot === 'field') s.air = Math.min(1, s.air + 0.25 * g);
      else if (slot === 'transition') s.gust = Math.min(1.5, s.gust + 0.6 * g);
      else if (e.note !== null) { // a line: tie something, else mark something; its pitch plucks one string
        if (!s.fin) {
          const tie = s.busy <= 0 ? link(s) : null;
          if (tie) attend(s, tie, 2.2);
          else if (s.marks.length < marksT) addMark(s, { long: e.dur >= 0.5, loud: g > 1, quiet, note: e.note });
        }
        if (s.yarn.length) s.yarn[e.note % s.yarn.length].pl = 0.016;
      } else { // a kick, or any other thump: the wall takes it, the lamp sways, the dust jumps
        s.side = -s.side; s.lamp.v += 0.08 * g * s.side; s.shake = Math.min(1, s.shake + 0.12 * g); s.dy -= 0.004 * g;
        const it = byId(s, s.last); if (it && up(it)) it.va += 0.5 * g * s.side;
      }
    }

    // the room
    s.air = decay(s.air, 0.4, dt); s.gust = decay(s.gust, 2.5, dt); s.shake = decay(s.shake, 6, dt);
    s.wind = (0.12 + 0.5 * s.air + 0.8 * s.riser + s.gust) * still;
    s.dx += dt * (0.008 + 0.05 * s.wind); s.dy -= dt * 0.005;
    s.slat = ease(s.slat, s.slatTo, 0.8, dt); s.bump = decay(s.bump, 0.5, dt); if (s.pass < 3) s.pass += dt * 0.55;
    s.lamp.v += (-5 * s.lamp.x - 0.5 * s.lamp.v) * dt; s.lamp.x += s.lamp.v * dt;
    const L = LIGHTS[s.fin === 2 ? 0 : s.lightTo]; for (const k of Object.keys(s.li)) s.li[k] = ease(s.li[k], L[k], 0.2, dt);
    s.cam.x = ease(s.cam.x, s.camTo.x, 0.9, dt); s.cam.y = ease(s.cam.y, s.camTo.y, 0.9, dt); s.cam.z = ease(s.cam.z, s.camTo.z, 0.9, dt);
    const rip0 = s.rip; if (s.rip < 9) { s.rip += dt * 1.6; if (s.rip > s.bw + 0.2) s.rip = 9; }

    // the papers
    for (const it of s.items) {
      if (it.st === 'in') { it.u = Math.min(1, it.u + dt / 0.45); const e = 1 - (1 - it.u) ** 3; it.cx = it.x; it.cy = it.y + (1 - e) * 0.12; it.k = 1 + (1 - e) * 0.35; it.al = Math.min(1, it.u * 3); if (it.u >= 1) { it.st = 'on'; it.pt = 0; s.shake = Math.min(1, s.shake + 0.25); it.va += s.side; } }
      else if (it.st === 'move') { it.u = Math.min(1, it.u + dt / 0.95); const e = smooth(clamp((it.u - 0.15) / 0.85)); it.cx = lerp(it.fx, it.x, e); it.cy = lerp(it.fy, it.y, e); it.k = 1 + 0.07 * Math.sin(Math.PI * e); if (it.u >= 1) { it.st = 'on'; it.pt = 0; s.shake = Math.min(1, s.shake + 0.15); } } // the pin comes out first (the first 15%), then the paper travels
      else if (it.st === 'off') { it.u = Math.min(1, it.u + dt / 0.5); it.k = 1 + 0.35 * it.u; it.al = 1 - it.u; it.cy = it.y + 0.1 * it.u * it.u; if (it.u >= 1) it.st = 'gone'; }
      else { it.cx = it.x; it.cy = it.y; it.pt = Math.min(1, it.pt + dt); it.k = 1 - 0.025 * Math.max(0, 1 - it.pt / 0.18); it.al = 1; } // the pin presses in: the paper gives a little
      if (rip0 < it.x && s.rip >= it.x && s.rip < 9) it.va += 1.6 * KINDS[it.kind][2];
      const torque = KINDS[it.kind][2] * s.wind * Math.sin(s.t * (1.3 + (it.sd % 7) * 0.12) + it.sd + it.x * 4);
      it.va += (-60 * (it.a - it.rest) - 5 * it.va + 12 * torque) * dt; it.a += it.va * dt;
    }
    if (s.items.some((i) => i.st === 'gone')) { s.items = s.items.filter((i) => i.st !== 'gone'); s.marks = s.marks.filter((m) => byId(s, m.id)); }
    for (const y of s.yarn) { // run out slack, tighten, settle; come down by letting go at the far end and being drawn back
      const a = byId(s, y.a), b = byId(s, y.b);
      if (y.die === null && (!a || !b || !up(a) || !up(b))) y.die = 0;
      if (y.die !== null && (y.die -= dt) < 0) { y.u -= dt * 2.2; y.set = Math.max(0, y.set - dt * 4); }
      else if (y.u < 1) { y.u = Math.min(1, y.u + dt * 2.5); if (y.u >= 1) y.pl = Math.max(y.pl, 0.008); }
      else y.set = Math.min(1, y.set + dt * 2.5);
      y.ph += dt * 22; y.pl = decay(y.pl, 4, dt);
    }
    s.yarn = s.yarn.filter((y) => y.u > 0 || y.die === null);
    for (const m of s.marks) m.u = Math.min(1, m.u + dt * (m.turns > 1.5 ? 0.45 : m.kind === 'strike' || m.kind === 'box' ? 1 : 1.6));

    // the story's fixed points, by progress: the false lead, the decisive link, the solve
    if (p >= 0.38 && !s.lead && !s.fin) { const d = photoOf(s, s.decoy); if (p > 0.5) s.lead = 1; if (d?.st === 'on' && !s.dead.includes(s.decoy)) { s.lead = 1; s.marks.push(mk(d, 'circle', { r: d.w * 0.43, ry: d.h * 0.43, turns: 1.7, sd: 11 })); attend(s, [d], 3.5, true); } }
    if (p >= 0.89 && !s.key && !s.fin) { s.key = 1; decisive(s); }
    if (p >= 0.94 && s.fin === 0) {
      s.fin = 1; s.twist = 1;
      while (alive(s).length > 1) eliminate(s);
      const c = photoOf(s, s.culprit);
      if (c) { c.z = ++s.z; s.stampY = c.y + c.h / 2 > 0 ? -0.17 : 0.17; s.marks.push(mk(c, 'circle', { r: c.w * 0.43, ry: c.h * 0.43, turns: 2.6, sd: 7 })); attend(s, [c], 9, true); }
    }
    if (p >= 0.98 && s.fin === 1) { s.fin = 2; s.shake = 1; attend(s, [], 9, true); }
    s.stamp = s.fin === 2 ? Math.min(1, s.stamp + dt * 6) : 0;
  },

  draw(s, ctx, w, h) {
    const U = Math.min(h, w / s.aspect), L = s.li, items = [...s.items].sort((a, b) => a.z - b.z), at = Object.fromEntries(items.map((i) => [i.id, i]));
    const jx = s.shake * 0.006 * Math.sin(s.t * 71), jy = s.shake * 0.006 * Math.cos(s.t * 53), res = Math.ceil((U * 1.5) / 64) * 64;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = 'hsl(200 14% 34%)'; ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2); ctx.scale(U * s.cam.z, U * s.cam.z); ctx.translate(-s.cam.x + jx, -s.cam.y + jy + 0.004 * Math.sin(s.t * 0.3));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    board(ctx, s);
    for (const it of items) paper(ctx, s, it, res);
    // the yarn, over the papers, pin to pin: a sagging line with a wave running down it
    for (let i = 0; i < s.yarn.length; i++) {
      const y = s.yarn[i], a = at[y.a], b = at[y.b]; if (!a || !b) continue;
      const [ax, ay] = tie(a), [bx, by] = tie(b), dx = (bx - ax) * y.u, dy = (by - ay) * y.u, len = Math.hypot(dx, dy) || 1e-6, nx = -dy / len, ny = dx / len, sag = y.sag * len * 0.25 * (1 + 1.8 * (1 - y.set));
      const [yh, ys, yl] = YARN[y.c];
      for (const [wd, l] of [[0.0052, yl * 0.45], [0.003, yl]]) {
        ctx.beginPath(); ctx.moveTo(ax, ay);
        for (let k = 1; k <= 10; k++) { const t = k / 10, v = Math.sin(Math.PI * t) * (y.pl * 0.5 * Math.sin(y.ph - 5 * t) + s.wind * 0.004 * Math.sin(s.t * 2.1 + i + 3 * t)); ctx.lineTo(ax + dx * t + nx * v, ay + dy * t + sag * 4 * t * (1 - t) + ny * v); }
        ctx.strokeStyle = hsla(yh, ys, l); ctx.lineWidth = wd; ctx.stroke();
      }
    }
    for (const it of items) { // the pins: pressing in as a paper lands, lifting out before it moves
      const near = it.st === 'on' ? 1 - Math.min(1, it.pt / 0.15) : it.st === 'in' && it.u > 0.75 ? 1 : it.st === 'move' && it.u < 0.15 ? it.u / 0.15 : -1;
      if (near < 0) continue;
      for (const dx of it.kind === 'map' || it.kind === 'times' ? [-it.w * 0.42, it.w * 0.42] : [0]) pin(ctx, it.cx + dx * Math.cos(it.rest), it.cy + dx * Math.sin(it.rest), PIN_COLS[it.pin], 1 + 1.1 * near, it.st === 'move' ? 1 - near : 1);
    }
    if (s.stamp > 0.01) stamp(ctx, s);
    // the light: a tint on everything, blinds that turn with the hour, a pool that leans toward the work, the dark, dust
    const R = 3, lx = L.lx * 0.6 + s.cam.x * 0.5 + s.lamp.x * 0.2, ly = L.ly + s.cam.y * 0.3;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hsla(L.h, L.s, L.l); ctx.fillRect(-R, -R, 2 * R, 2 * R);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.rotate(-0.16 + 0.16 * (s.p - 0.5));
    if (L.blinds > 0.02) { // each slat's shadow sways on its own phase after a bump, so the blind swings like a hanging thing
      ctx.fillStyle = `rgba(6 8 16 / ${0.3 * L.blinds})`;
      for (let i = -14; i < 14; i++) ctx.fillRect(-R, i * 0.09 + 0.004 * Math.sin(s.t * 0.4) + s.bump * 0.014 * Math.sin(s.t * 5 + i * 0.7), 2 * R, s.slat);
    }
    if (s.pass < 2) { // somebody crosses the light, or headlights cross the wall: a soft band, stronger toward its middle
      if (s.passLit) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = s.passLit ? 'rgba(255 235 190 / 0.035)' : 'rgba(6 8 16 / 0.09)'; for (const wd of [0.5, 0.36, 0.22]) ctx.fillRect(s.pass - wd / 2, -R, wd, 2 * R);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    const g = ctx.createRadialGradient(lx, ly, 0.2, lx, ly, 1.5);
    g.addColorStop(0, 'rgba(8 6 14 / 0)'); g.addColorStop(1, `rgba(8 6 14 / ${clamp(L.dark)})`);
    ctx.fillStyle = g; ctx.fillRect(-R, -R, 2 * R, 2 * R);
    if (s.dark > 0.01) { ctx.fillStyle = `rgba(0 0 0 / ${0.55 * s.dark})`; ctx.fillRect(-R, -R, 2 * R, 2 * R); }
    ctx.globalCompositeOperation = 'lighter'; // dust in the light: it drifts on the air, lifts on a kick, shows only near the pool
    const A = s.aspect / 2, wrap = (x, m) => ((x % m) + m) % m;
    for (let i = 0; i < 28; i++) {
      const x = wrap(hash(i, 1) * 2 * A + s.dx * (0.4 + hash(i, 3)), 2 * A) - A, y = wrap(hash(i, 2) + s.dy * (0.5 + hash(i, 4)) + 0.02 * Math.sin(s.t * 0.5 + i), 1) - 0.5;
      const a = clamp(1 - Math.hypot(x - lx, y - ly) / 1.1) * 0.3; if (a < 0.02) continue;
      ctx.beginPath(); ctx.arc(x, y, 0.0014 + 0.0016 * hash(i, 5), 0, TAU); ctx.fillStyle = `rgba(255 240 210 / ${a})`; ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
};

// --- drawing ---
const fill = (ctx, c, a = 1) => { ctx.fillStyle = hsla(...c, a); ctx.fill(); };
const rect = (ctx, x, y, w, h, c, a = 1) => { ctx.fillStyle = hsla(...c, a); ctx.fillRect(x, y, w, h); };
const line = (ctx, pts, c, wd, a = 1) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = hsla(...c, a); ctx.lineWidth = wd; ctx.stroke(); };
/** Text `size` canvas heights tall: set in a 100x frame, since a font under a pixel is not a size a canvas keeps. */
function text(ctx, str, x, y, size, face, col, align = 'center') {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100);
  ctx.fillStyle = col; ctx.font = `bold 100px ${face}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, 0, 0);
  ctx.restore();
}
const HAND = 'cursive', TYPE = 'monospace', STAMP = 'Impact, Haettenschweiler, sans-serif', INKC = 'hsl(230 20% 18%)';

function board(ctx, s) {
  const bw = s.bw + 0.03, bh = s.bh + 0.04;
  rect(ctx, -bw - 0.012, -bh - 0.006, 2 * bw + 0.03, 2 * bh + 0.03, [0, 0, 0], 0.3); // its shadow on the wall
  rect(ctx, -bw, -bh, 2 * bw, 2 * bh, [28, 46, 50]);
  for (const lightOnes of [0, 1]) { // the cork's flecks, one path a tone
    ctx.beginPath();
    for (let i = 0; i < 260; i++) if (!(i % 3) === !!lightOnes) ctx.rect(lerp(-bw, bw, hash(i, 1)), lerp(-bh, bh, hash(i, 2)), 0.004 + 0.008 * hash(i, 3), 0.004);
    fill(ctx, lightOnes ? [34, 50, 62] : [24, 50, 40], 0.5);
  }
  ctx.beginPath(); for (const p of s.holes) { ctx.moveTo(p.x + 0.0022, p.y); ctx.arc(p.x, p.y, 0.0022, 0, TAU); } fill(ctx, [20, 40, 18], 0.7); // the pinholes of everything that has been moved or taken down
  ctx.strokeStyle = 'hsl(22 45% 22%)'; ctx.lineWidth = 0.028; ctx.strokeRect(-bw, -bh, 2 * bw, 2 * bh);
  ctx.strokeStyle = 'hsl(26 45% 36%)'; ctx.lineWidth = 0.005; ctx.strokeRect(-bw - 0.008, -bh - 0.008, 2 * bw + 0.016, 2 * bh + 0.016);
  // the case label, taped to the top of the frame
  const label = s.name ? String(s.name).replace(/[-_.]+/g, ' ').toUpperCase() : `CASE ${s.caseNo}`, lw = Math.max(0.15, label.length * 0.0135 + 0.04); // the song is the case
  rect(ctx, -lw / 2, -bh - 0.016, lw, 0.034, [44, 40, 80]);
  text(ctx, label, 0, -bh + 0.002, 0.022, TYPE, INKC);
}

function pin(ctx, x, y, c, k = 1, a = 1) { // k: how far off the board it is (bigger, its shadow further away)
  const r = 0.0065 * k, off = 0.003 + 0.012 * (k - 1);
  ctx.beginPath(); ctx.arc(x + off, y + off * 1.3, r, 0, TAU); fill(ctx, [0, 0, 0], 0.3 * a);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); fill(ctx, c, a);
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, TAU); fill(ctx, [0, 0, 100], 0.7 * a);
}

/** Handwriting: rows of wavy words, as many of them as the ink has got to. */
function scribble(ctx, x0, y0, x1, rows, gap, ink, sd, col) {
  const words = [];
  for (let r = 0; r < rows; r++) for (let x = x0, k = 0; x < x1 - 0.008; k++) { const len = Math.min(x1 - x, (0.2 + 0.4 * hash(sd + r, k)) * (x1 - x0)); words.push([x, y0 + r * gap, len]); x += len + 0.008; }
  const n = Math.floor(ink * words.length + 1e-6);
  ctx.beginPath(); // one path for the whole note
  for (let i = 0; i < n; i++) { const [x, y, len] = words[i]; for (let j = 0; j < 7; j++) { const px = x + (len * j) / 6, py = y + (j % 2 ? -1 : 1) * gap * 0.16 * (0.5 + hash(sd + i, j)); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); } }
  ctx.strokeStyle = hsla(...col); ctx.lineWidth = 0.0016; ctx.stroke();
}

// a finished paper (all its ink down, no mark still being drawn) is the same picture every frame: drawn once at the
// resolution the closest shot needs and stamped after. A pure function of the item, so a cache outside the state.
const ART = new Map(), PAD = 0.004;
function sprite(s, it, res) {
  if (typeof OffscreenCanvas === 'undefined' || it.ink < 1) return null;
  let n = 0; for (const m of s.marks) if (m.id === it.id) { if (m.u < 1) return null; n++; }
  const key = `${s.uid}:${it.id}:${it.sd}:${it.kind}:${it.word}`, ver = `${n}:${it.dim}:${res}`;
  let e = ART.get(key);
  if (!e || e.ver !== ver) {
    if (ART.size > 90) ART.clear();
    const can = new OffscreenCanvas(Math.ceil((it.w + 2 * PAD) * res), Math.ceil((it.h + 2 * PAD) * res)), c = can.getContext('2d');
    c.scale(res, res); c.translate(it.w / 2 + PAD, PIN + PAD); c.lineCap = 'round'; c.lineJoin = 'round';
    art(c, s, it); e = { ver, can }; ART.set(key, e);
  }
  return e.can;
}

/** One paper where it is: the pin at the origin. A pinned paper does not swing: it stays at its angle and the wind
 *  lifts its free end (`a - rest` is that lift: the sheet shears and foreshortens away from the pin, which stays put,
 *  and its shadow opens under it). */
function paper(ctx, s, it, res) {
  const { w, h } = it, lift = it.a - it.rest, so = 0.005 + (it.k - 1) * 0.12 + Math.min(0.012, Math.abs(lift) * 0.05);
  ctx.save(); ctx.translate(it.cx, it.cy); ctx.scale(it.k, it.k); ctx.rotate(it.rest); ctx.transform(1, 0, lift * 0.3, 1 - Math.min(0.1, Math.abs(lift) * 0.45), 0, 0); ctx.globalAlpha = it.al;
  rect(ctx, -w / 2 + so, -PIN + so * 1.4, w, h, [0, 0, 0], 0.3);
  const img = sprite(s, it, res);
  if (img) ctx.drawImage(img, -w / 2 - PAD, -PIN - PAD, img.width / res, img.height / res); else art(ctx, s, it);
  ctx.restore();
}

/** A paper's picture in its own frame (the pin at the origin): the sheet, what is on it, the marker's ink, and the grey of a dead lead. */
function art(ctx, s, it) {
  const { w, h, sd } = it, F = s.facts, X = (f) => -w / 2 + f * w, Y = (f) => -PIN + f * h;
  const R = (x0, y0, x1, y1, c, a) => rect(ctx, X(x0), Y(y0), (x1 - x0) * w, (y1 - y0) * h, c, a), T = (str, fx, fy, size, face = TYPE, col = INKC, align = 'center') => text(ctx, str, X(fx), Y(fy), size * h, face, col, align);
  const rows = (x0, x1, y0, n, gap, k = 0, a = 0.55) => { for (let r = 0; r < n; r++) { const y = y0 + r * gap; R(x0, y, x0 + (x1 - x0) * (0.6 + 0.4 * hash(sd + k, r)), y + gap * 0.32, DARK, a); } }; // lines of print
  if (it.kind === 'note') {
    R(0, 0, 1, 1, NOTE_COLS[it.col]); R(0, 0, 1, 0.14, [0, 0, 0], 0.06);
    if (it.word) { if (it.ink >= 0.5) { const two = it.word.length > 7 && it.word.includes(' '), parts = two ? [it.word.slice(0, it.word.lastIndexOf(' ')), it.word.slice(it.word.lastIndexOf(' ') + 1)] : [it.word]; parts.forEach((p, i) => T(p, 0.5, two ? 0.42 + i * 0.3 : 0.56, Math.min(two ? 0.27 : 0.4, (1.25 * w) / (h * p.length)), HAND, hsla(...INK[it.role === 'exon' ? 2 : sd % 2 ? 0 : 1]))); } }
    else scribble(ctx, X(0.12), Y(0.34), X(0.9), 4, h * 0.16, it.ink, sd, INK[1 + sd % 2]);
  } else if (it.kind === 'card') { // index, manila, legal pad
    const v = sd % 3;
    R(0, 0, 1, 1, v === 0 ? [48, 30, 93] : v === 1 ? [38, 50, 74] : [54, 85, 80]);
    if (v === 0) R(0, 0.2, 1, 0.215, [0, 70, 60], 0.7);
    if (v !== 1) for (let i = 1; i < 5; i++) R(0, 0.2 + i * 0.16, 1, 0.207 + i * 0.16, [205, 50, 65], 0.5);
    if (v === 2) R(0.12, 0, 0.127, 1, [0, 70, 60], 0.7);
    if (it.about >= 0) T(`RE: ${F.names[it.about]}`, v === 2 ? 0.17 : 0.06, 0.13, 0.13, HAND, hsla(...INK[1 + sd % 2]), 'left');
    scribble(ctx, X(v === 2 ? 0.16 : 0.06), Y(0.31), X(0.94), 4, h * 0.16, it.ink, sd, INK[1 + sd % 2]);
  } else if (it.kind === 'receipt') { // the time on it is the case's
    R(0, 0, 1, 1, [50, 8, 95]); T(F.place, 0.5, 0.07, 0.055); T(clockText(F.tmin - 2 + sd % 5), 0.5, 0.14, 0.05);
    for (let i = 0; i < 7; i++) { const y = 0.22 + i * 0.075; R(0.1, y, 0.3 + 0.3 * hash(sd, i), y + 0.018, DARK, 0.5); R(0.72, y, 0.9, y + 0.018, DARK, 0.5); }
    R(0.1, 0.78, 0.9, 0.785, DARK, 0.4); T('TOTAL', 0.1, 0.86, 0.05, TYPE, INKC, 'left'); R(0.62, 0.84, 0.9, 0.875, DARK, 0.85);
  } else if (it.kind === 'envelope') { // four papers, three flaps, an address or a window, one stamp or two, sometimes a word across it
    const v = sd % 4, flap = (sd >> 2) % 3, win = (sd >> 4) % 3 === 0, paperCol = [[38, 32, 82], [0, 0, 95], [205, 35, 84], [30, 45, 68]][v];
    R(0, 0, 1, 1, paperCol);
    if (v === 1) for (let i = 0; i < 14; i++) { R(i / 14, 0, (i + 0.5) / 14, 0.07, i % 2 ? [2, 70, 50] : [215, 60, 45]); R(i / 14, 0.93, (i + 0.5) / 14, 1, i % 2 ? [215, 60, 45] : [2, 70, 50]); } // airmail
    const edge = [paperCol[0], paperCol[1], paperCol[2] - 22];
    if (flap === 0) line(ctx, [[X(0), Y(0)], [X(0.5), Y(0.55)], [X(1), Y(0)]], edge, 0.0016);
    else if (flap === 1) line(ctx, [[X(0), Y(0.3)], [X(1), Y(0.3)]], edge, 0.0016);
    else { line(ctx, [[X(0), Y(0)], [X(0.5), Y(0.34)], [X(1), Y(0)]], edge, 0.0016); line(ctx, [[X(0), Y(1)], [X(0.5), Y(0.5)], [X(1), Y(1)]], edge, 0.0012); }
    for (let i = 0; i <= (sd >> 6) % 2; i++) R(0.8 - i * 0.15, 0.1, 0.93 - i * 0.15, 0.36, [[2, 60, 50], [212, 50, 45], [130, 40, 40], [45, 80, 50]][(sd + i) % 4]);
    ctx.strokeStyle = hsla(...DARK, 0.5); ctx.lineWidth = 0.0014; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(X(0.72), Y(0.24), h * (0.1 + 0.04 * i), 0, TAU); ctx.stroke(); }
    if (win) { R(0.12, 0.55, 0.6, 0.85, [200, 20, 96]); scribble(ctx, X(0.16), Y(0.66), X(0.56), 2, h * 0.1, 1, sd, INK[1]); }
    else scribble(ctx, X(0.3), Y(0.62), X(0.72), 2 + (sd >> 7) % 2, h * 0.12, 1, sd, INK[1 + sd % 2]);
    if ((sd >> 8) % 3 === 0) { ctx.save(); ctx.translate(X(0.3), Y(0.3)); ctx.rotate(-0.2); text(ctx, ['URGENT', 'PRIVATE', 'RETURN', 'OPENED'][(sd >> 10) % 4], 0, 0, h * 0.17, STAMP, 'hsl(2 75% 45% / 0.8)'); ctx.restore(); }
  } else if (it.kind === 'clip') { // three layouts, three papers
    const v = sd % 3, two = (sd >> 2) % 2;
    R(0, 0, 1, 1, [[44, 22, 84], [36, 26, 76], [52, 14, 90]][(sd >> 3) % 3]); R(0.07, 0.06, 0.93, 0.13, DARK); if (two) R(0.07, 0.15, 0.7, 0.2, DARK);
    const photo = (x0, y0, x1, y1) => { R(x0, y0, x1, y1, [40, 8, 45]); R(lerp(x0, x1, 0.12), lerp(y0, y1, 0.35), lerp(x0, x1, 0.5), y1, [40, 8, 30]); R(lerp(x0, x1, 0.5), lerp(y0, y1, 0.2), lerp(x0, x1, 0.9), y1, [40, 8, 36]); };
    if (v === 0) { photo(0.07, 0.25, 0.52, 0.5); rows(0.07, 0.5, 0.55, 9, 0.044, 0); rows(0.57, 0.93, 0.26, 16, 0.044, 1); }
    else if (v === 1) { photo(0.07, 0.25, 0.93, 0.56); rows(0.07, 0.47, 0.6, 8, 0.044, 0); rows(0.53, 0.93, 0.6, 8, 0.044, 1); }
    else for (let c = 0; c < 3; c++) rows(0.07 + c * 0.3, 0.33 + c * 0.3, 0.26, 16, 0.044, c);
  } else if (it.kind === 'map') map(ctx, it, X, Y, R);
  else if (it.kind === 'bag') {
    R(0, 0, 1, 1, [200, 30, 88], 0.6); ctx.strokeStyle = 'hsl(200 20% 70%)'; ctx.lineWidth = 0.002; ctx.strokeRect(X(0), Y(0), w, h);
    R(0, 0, 1, 0.16, [2, 75, 46]); T('EVIDENCE', 0.5, 0.085, 0.085, STAMP, 'hsl(0 0% 98%)'); R(0.1, 0.22, 0.9, 0.42, [0, 0, 97]); T(`No. ${100 + sd % 900}`, 0.15, 0.32, 0.07, TYPE, INKC, 'left');
    const cx = X(0.5), cy = Y(0.7), o = sd % 4, brass = [42, 60, 48];
    if (o === 0) { ctx.beginPath(); ctx.arc(cx - 0.012, cy, 0.011, 0, TAU); ctx.strokeStyle = hsla(...brass); ctx.lineWidth = 0.005; ctx.stroke(); line(ctx, [[cx, cy], [cx + 0.03, cy], [cx + 0.03, cy + 0.008]], brass, 0.005); line(ctx, [[cx + 0.02, cy], [cx + 0.02, cy + 0.008]], brass, 0.004); } // a key
    else if (o === 1) { rect(ctx, cx - 0.006, cy - 0.016, 0.012, 0.03, brass); rect(ctx, cx - 0.007, cy + 0.012, 0.014, 0.004, [42, 50, 34]); } // a casing
    else if (o === 2) { ctx.beginPath(); ctx.arc(cx, cy, 0.012, 0, TAU); ctx.strokeStyle = hsla(48, 80, 58); ctx.lineWidth = 0.004; ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - 0.014, 0.005, 0, TAU); fill(ctx, [190, 70, 75]); } // a ring
    else { rect(ctx, cx - 0.016, cy - 0.012, 0.032, 0.026, [355, 65, 38]); rect(ctx, cx - 0.016, cy + 0.006, 0.032, 0.004, [40, 30, 20]); } // a matchbook
  } else if (it.kind === 'print') {
    R(0, 0, 1, 1, [50, 15, 95]); R(0.1, 0.8, 0.9, 0.82, DARK, 0.5); R(0.1, 0.88, 0.6, 0.9, DARK, 0.5);
    ctx.strokeStyle = hsla(...DARK, 0.75); ctx.lineWidth = 0.0016;
    for (let i = 1; i <= 7; i++) { ctx.beginPath(); ctx.ellipse(X(0.5) + (hash(sd, i) - 0.5) * 0.004, Y(0.42) + i * 0.0012, i * 0.0042, i * 0.0052, 0.2, Math.PI * (0.9 + 0.3 * hash(sd, i + 9)), Math.PI * (2.2 + 0.4 * hash(sd, i + 20))); ctx.stroke(); }
  } else if (it.kind === 'phone') { // call records: one row is the call that matters, highlighted
    R(0, 0, 1, 1, [0, 0, 96]); R(0, 0, 1, 0.1, [215, 30, 40]); T('CALL RECORD', 0.5, 0.052, 0.05, TYPE, 'hsl(0 0% 96%)');
    const hot = 2 + sd % 6;
    for (let i = 0; i < 10; i++) { const y = 0.17 + i * 0.08; if (i === hot) R(0.04, y - 0.035, 0.96, y + 0.035, INK[3], 0.5); T(`555-01${String(10 + Math.floor(hash(sd, i) * 89))}`, 0.07, y, 0.045, TYPE, INKC, 'left'); T(clockText(F.tmin - 40 + (i === hot ? 40 : Math.floor(hash(sd, i + 20) * 90))), 0.93, y, 0.045, TYPE, INKC, 'right'); }
  } else if (it.kind === 'strip') { // a surveillance contact sheet: the car coming through, frame by frame
    R(0, 0, 1, 1, [0, 0, 9]);
    for (let i = 0; i < 3; i++) { const fx = 0.03 + i * 0.325; scene(ctx, sd, 1, CARS[F.car][1], X(fx), Y(0.1), w * 0.295, h * 0.62, i * 0.3 - 0.3); R(fx, 0.1, fx + 0.295, 0.72, [200, 20, 50], 0.18); T(`CAM 3  ${clockText(F.tmin + i)}`, fx + 0.147, 0.86, 0.12, TYPE, 'hsl(48 80% 70%)'); }
  } else if (it.kind === 'plan') { // a floor plan, as a blueprint
    R(0, 0, 1, 1, [215, 50, 34]);
    const wall = (pts) => line(ctx, pts.map(([x, y]) => [X(x), Y(y)]), [205, 40, 92], 0.0022), a = 0.3 + 0.3 * hash(sd, 1), b = 0.35 + 0.3 * hash(sd, 2);
    wall([[0.08, 0.2], [0.92, 0.2], [0.92, 0.9], [0.08, 0.9], [0.08, 0.2]]); wall([[a, 0.2], [a, b - 0.08]]); wall([[a, b + 0.06], [a, 0.9]]); wall([[a, b + 0.14], [0.6, b + 0.14]]); wall([[0.72, b + 0.14], [0.92, b + 0.14]]);
    R(0.5, 0.885, 0.62, 0.915, [215, 50, 34]); T(F.place, 0.08, 0.1, 0.075, TYPE, 'hsl(205 40% 92%)', 'left'); T('ENTRY', 0.56, 0.955, 0.045, TYPE, 'hsl(205 40% 92%)');
  } else if (it.kind === 'ticket') { // a stub: a place, a time, a serial, a perforation
    R(0, 0, 1, 1, [[40, 60, 82], [190, 35, 82], [350, 45, 86]][sd % 3]); R(0, 0, 1, 0.2, [[20, 70, 45], [200, 55, 38], [345, 55, 42]][sd % 3]);
    for (let i = 0; i < 9; i++) R(0.74, 0.24 + i * 0.085, 0.746, 0.28 + i * 0.085, DARK, 0.6);
    T(['ADMIT ONE', 'PARKING', 'ONE WAY'][(sd >> 2) % 3], 0.37, 0.1, 0.12, TYPE, 'hsl(0 0% 97%)'); T(F.place, 0.37, 0.48, 0.24, STAMP); T(clockText(F.tmin - 20 + sd % 25), 0.37, 0.8, 0.17); T(`${1000 + sd % 9000}`, 0.87, 0.6, 0.13);
  } else if (it.kind === 'plate') { // a vehicle record: the plate, the car in its colour
    R(0, 0, 1, 1, [48, 20, 92]); T('VEHICLE REG.', 0.06, 0.1, 0.085, TYPE, INKC, 'left');
    R(0.08, 0.2, 0.92, 0.5, DARK); R(0.1, 0.225, 0.9, 0.475, [48, 70, 92]); T((sd >> 3) % 3 ? F.plate : `${F.plate.slice(0, 4)}??`, 0.5, 0.36, 0.2, STAMP);
    const c = CARS[F.car][1]; R(0.12, 0.72, 0.62, 0.86, c); R(0.24, 0.6, 0.5, 0.73, c); R(0.28, 0.63, 0.46, 0.71, [200, 30, 80]);
    for (const x of [0.22, 0.52]) { ctx.beginPath(); ctx.arc(X(x), Y(0.87), h * 0.055, 0, TAU); fill(ctx, [0, 0, 10]); }
    T(CARS[F.car][0], 0.94, 0.68, 0.075, TYPE, INKC, 'right'); rows(0.68, 0.94, 0.78, 2, 0.07, 3);
  } else if (it.kind === 'redact') { // an official paper, mostly blacked out
    R(0, 0, 1, 1, [50, 6, 94]); T(CRIMES[F.crime][0], 0.5, 0.07, 0.05); R(0.08, 0.11, 0.92, 0.115, DARK, 0.7);
    for (let r = 0; r < 14; r++) { const y = 0.16 + r * 0.052; R(0.08, y, 0.92 - 0.2 * hash(sd, r), y + 0.016, DARK, 0.4); if (hash(sd, r + 30) < 0.55) { const x = 0.1 + 0.5 * hash(sd, r + 60); R(x, y - 0.008, x + 0.14 + 0.2 * hash(sd, r + 90), y + 0.026, [0, 0, 6]); } }
    ctx.save(); ctx.translate(X(0.58), Y(0.9)); ctx.rotate(-0.12); text(ctx, 'CONFIDENTIAL', 0, 0, h * 0.065, STAMP, 'hsl(2 75% 45% / 0.75)'); ctx.restore();
  } else if (it.kind === 'times') { // the timeline: the night in order, filled in as it is worked out
    R(0, 0, 1, 1, [46, 34, 88]); R(0.04, 0.42, 0.96, 0.45, DARK, 0.8);
    const n = Math.floor(it.ink * 5 + 1e-6), what = ['SEEN', 'CALL', F.place, 'CAR', 'GONE'];
    for (let i = 0; i < 5; i++) { const x = 0.1 + i * 0.2; R(x - 0.003, 0.3, x + 0.003, 0.57, DARK, 0.8); if (i < n) { T(clockText(F.tmin - 30 + i * 15), x, 0.17, 0.2, HAND, hsla(...INK[2])); T(what[i], x, 0.78, 0.16, HAND, hsla(...INK[1])); } }
  } else if (it.kind === 'shoe') { // a shoeprint card: a tread and a scale
    R(0, 0, 1, 1, [50, 12, 93]);
    ctx.save(); ctx.beginPath(); ctx.ellipse(X(0.5), Y(0.36), w * 0.24, h * 0.24, 0, 0, TAU); ctx.ellipse(X(0.5), Y(0.76), w * 0.19, h * 0.13, 0, 0, TAU); ctx.clip();
    R(0, 0, 1, 1, [0, 0, 14], 0.85); for (let i = 0; i < 16; i++) { const y = 0.1 + i * 0.055; sd % 2 ? R(0, y, 1, y + 0.02, [50, 12, 93]) : line(ctx, [[X(0.2), Y(y)], [X(0.5), Y(y + 0.03)], [X(0.8), Y(y)]], [50, 12, 93], 0.002); }
    ctx.restore();
    for (let i = 0; i < 9; i++) R(0.9, 0.1 + i * 0.1, i % 2 ? 0.94 : 0.97, 0.104 + i * 0.1, DARK, 0.8);
  } else { // a polaroid: a suspect's mugshot with the name under it, or a snapshot of somewhere
    R(0, 0, 1, 1, [45, 15, 94]);
    const px = X(0.08), py = Y(0.07), pw = w * 0.84, ph = h * 0.7;
    if (it.kind === 'suspect') {
      const img = mugshot(it);
      if (img) ctx.drawImage(img, px, py, pw, ph);
      else { rect(ctx, px, py, pw, ph, [210, 14, 62]); ctx.beginPath(); ctx.ellipse(X(0.5), py + ph * 0.42, pw * 0.2, ph * 0.26, 0, 0, TAU); fill(ctx, [25, 30, 40]); rect(ctx, px + pw * 0.15, py + ph * 0.75, pw * 0.7, ph * 0.25, [25, 20, 25]); } // no OffscreenCanvas (Node): a placeholder
      T(F.names[it.who], 0.5, 0.885, Math.min(0.12, (1.1 * w) / (h * F.names[it.who].length)), HAND);
    } else scene(ctx, sd, it.fact === 1 ? 1 : [0, 2, 3][(sd >> 1) % 3], CARS[F.car][1], px, py, pw, ph, 0);
  }
  if (sd % 6 === 0 && it.who < 0 && it.kind !== 'bag') for (const d of [-1, 1]) { ctx.save(); ctx.translate(d * w * 0.44, -PIN + h * 0.04); ctx.rotate(d * 0.7); rect(ctx, -0.014, -0.005, 0.028, 0.01, [50, 40, 88], 0.55); ctx.restore(); } // some are taped at the corners too
  if (it.dim) R(0, 0, 1, 1, [30, 12, 50], 0.42);
  for (const m of s.marks) if (m.id === it.id) mark(ctx, m, X(m.x), Y(m.y), X(m.x2), Y(m.y2), [X(0), Y(0), w, h]);
}

/** A photograph's picture: 0 a skyline at night, 1 a car in the street (in `car`'s colour, shifted along by `dx`), 2 a house at dusk, 3 a bridge. */
function scene(ctx, sd, v, car, px, py, pw, ph, dx) {
  const P = (fx, fy, fw, fh, c, a) => rect(ctx, px + fx * pw, py + fy * ph, fw * pw, fh * ph, c, a), disc = (fx, fy, r, c) => { ctx.beginPath(); ctx.arc(px + fx * pw, py + fy * ph, r * pw, 0, TAU); fill(ctx, c); };
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  if (v === 0) {
    P(0, 0, 1, 1, [215, 30, 30 + 25 * hash(sd, 1)]); disc(0.2 + 0.6 * hash(sd, 2), 0.25, 0.07, [50, 60, 85]);
    for (let i = 0; i < 5; i++) { const bh = 0.25 + 0.4 * hash(sd, i + 3); P(i / 5, 1 - bh, 0.204, bh, [220, 20, 12 + 8 * hash(sd, i + 9)]); if (hash(sd, i + 20) < 0.6) P((i + 0.35) / 5, 1 - bh * 0.7, 0.05, 0.06, [48, 85, 65]); }
    P(0, 0.9, 1, 0.1, [220, 15, 8]);
  } else if (v === 1) {
    P(0, 0, 1, 0.62, [200, 40, 72]); P(0, 0.62, 1, 0.38, [30, 8, 38]); P(0, 0.4, 0.3, 0.22, [25, 20, 55]); P(0.62, 0.3, 0.38, 0.32, [15, 25, 48]); P(0.1, 0.8, 0.2, 0.03, [50, 20, 85]); P(0.5, 0.8, 0.2, 0.03, [50, 20, 85]);
    P(0.26 + dx, 0.52, 0.46, 0.14, car); P(0.36 + dx, 0.42, 0.24, 0.11, [car[0], car[1], car[2] * 0.8]); P(0.4 + dx, 0.44, 0.16, 0.07, [200, 30, 80]); disc(0.36 + dx, 0.67, 0.045, [0, 0, 10]); disc(0.62 + dx, 0.67, 0.045, [0, 0, 10]);
  } else if (v === 2) {
    P(0, 0, 1, 0.7, [18, 55, 62]); P(0, 0, 1, 0.3, [260, 30, 45], 0.6); P(0, 0.7, 1, 0.3, [110, 25, 22]);
    P(0.28, 0.4, 0.46, 0.36, [30, 15, 30]); ctx.beginPath(); ctx.moveTo(px + 0.22 * pw, py + 0.4 * ph); ctx.lineTo(px + 0.51 * pw, py + 0.18 * ph); ctx.lineTo(px + 0.8 * pw, py + 0.4 * ph); fill(ctx, [10, 25, 20]);
    P(0.46, 0.56, 0.1, 0.2, [20, 30, 15]); P(0.6, 0.48, 0.09, 0.1, [48, 90, 68]); P(0.33, 0.48, 0.09, 0.1, [30, 15, 18]); P(0.05, 0.5, 0.03, 0.22, [25, 30, 18]); disc(0.065, 0.44, 0.09, [120, 30, 20]);
  } else {
    P(0, 0, 1, 0.6, [205, 18, 60]); P(0, 0.6, 1, 0.4, [205, 35, 32]); P(0, 0.5, 1, 0.035, [0, 0, 15]);
    for (const x of [0.25, 0.72]) { P(x, 0.16, 0.035, 0.6, [0, 0, 15]); line(ctx, [[px + (x - 0.25) * pw, py + 0.5 * ph], [px + (x + 0.017) * pw, py + 0.17 * ph], [px + (x + 0.28) * pw, py + 0.5 * ph]], [0, 0, 15], 0.0016); }
    for (let i = 0; i < 4; i++) P(0.1 + 0.22 * i + 0.1 * hash(sd, i), 0.7 + 0.07 * i, 0.16, 0.012, [205, 30, 60], 0.7);
  }
  ctx.restore();
}

function map(ctx, it, X, Y, R) {
  const sd = it.sd;
  R(0, 0, 1, 1, [48, 34, 84]);
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(X(0.15 + 0.7 * hash(sd, i)), Y(0.2 + 0.6 * hash(sd, i + 5)), it.w * 0.09, it.h * 0.1, hash(sd, i + 8), 0, TAU); fill(ctx, [100, 30, 68], 0.8); } // parks
  line(ctx, Array.from({ length: 13 }, (_, j) => [X(j / 12), Y(0.5 + 0.3 * Math.sin(j * 0.55 + sd) + 0.05 * Math.sin(j * 1.9))]), [200, 50, 66], 0.011); // the river
  for (let i = 0; i < 7; i++) { // roads: a warped grid
    const f = (i + 0.5 + 0.5 * (hash(sd, i + 30) - 0.5)) / 7, k = hash(sd, i + 40) - 0.5, wd = i % 3 ? 0.0022 : 0.0045;
    line(ctx, [[X(f), Y(0)], [X(f + 0.08 * k), Y(0.5)], [X(f - 0.05 * k), Y(1)]], [40, 10, 99], wd);
    if (i < 5) { const g = (i + 0.5) / 5; line(ctx, [[X(0), Y(g)], [X(0.5), Y(g + 0.1 * k)], [X(1), Y(g - 0.06 * k)]], [40, 10, 99], wd); }
  }
  for (const f of [1 / 3, 2 / 3]) R(f, 0, f + 0.004, 1, [40, 20, 50], 0.3); // the folds
  R(0, 0.5, 1, 0.504, [40, 20, 50], 0.3);
}

/** A marker stroke as polylines, in the paper's frame; `u` of the points are down (the pen itself is never drawn).
 *  The ink is clipped to the paper (`edge`): a marker writes on the sheet, never on the cork. */
function mark(ctx, m, x, y, x2, y2, edge) {
  const r = m.r, ry = m.ry || r * 0.86, P = [], wob = (i) => (hash(m.sd, i) - 0.5) * r * 0.12, seg = (a, b, n) => Array.from({ length: n }, (_, i) => [lerp(a[0], b[0], i / (n - 1)) + wob(i + a[0] * 99), lerp(a[1], b[1], i / (n - 1)) + wob(i + 7 + a[1] * 99)]);
  if (m.kind === 'circle') { const n = Math.round(36 * m.turns); P.push(Array.from({ length: n + 1 }, (_, i) => { const t = i / n, a = m.sd + t * TAU * m.turns, rr = 0.92 + 0.1 * t + 0.05 * Math.sin(3 * a); return [x + Math.cos(a) * r * rr, y + Math.sin(a) * ry * rr]; })); }
  else if (m.kind === 'x') for (const d of [1, -1]) P.push(Array.from({ length: 6 }, (_, i) => [x + d * r * (i / 2.5 - 1) + wob(i), y + r * 1.25 * (i / 2.5 - 1)]));
  else if (m.kind === 'under') for (const d of [0, 1]) P.push(Array.from({ length: 9 }, (_, i) => [x + r * 1.6 * (d ? 1 - i / 4 : i / 4 - 1), y + d * r * 0.25 + wob(i + d * 9)]));
  else if (m.kind === 'hi') P.push(seg([x - r, y], [x + r, y + wob(3)], 7)); // a highlighter: one wide pale stroke
  else if (m.kind === 'box') P.push([...seg([x - r, y - ry], [x + r, y - ry], 5), ...seg([x + r, y - ry], [x + r, y + ry], 5), ...seg([x + r, y + ry], [x - r, y + ry], 5), ...seg([x - r, y + ry], [x - r * 1.04, y - ry * 1.15], 5)]); // it overshoots its own corner
  else if (m.kind === 'strike') P.push(Array.from({ length: 12 }, (_, i) => [x + r * (i / 5.5 - 1) + wob(i), y + (i % 2 ? ry : -ry) * (0.7 + 0.3 * hash(m.sd, i + 40))])); // a discarded theory, scribbled through
  else if (m.kind === 'star') P.push(Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; return [x + Math.cos(a) * r + wob(i), y + Math.sin(a) * r + wob(i + 6)]; }));
  else if (m.kind === 'bang') { P.push([[x + wob(1), y - r * 1.1], [x, y + r * 0.35]]); P.push([[x, y + r * 0.85], [x + r * 0.06, y + r * 0.92]]); }
  else if (m.kind === 'q') { P.push([...Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (-1 + (1.5 * i) / 9); return [x + Math.cos(a) * r * 0.6, y - r * 0.6 + Math.sin(a) * r * 0.6]; }), [x, y + r * 0.45]]); P.push([[x, y + r * 0.9], [x + r * 0.05, y + r * 0.95]]); }
  else if (m.kind === 'tick') P.push([[x - r, y], [x - r * 0.4, y + r * 0.7], [x - r * 0.1, y + r * 0.2], [x + r * 1.1, y - r]]);
  else { const a = Math.atan2(y2 - y, x2 - x); P.push(Array.from({ length: 12 }, (_, i) => [lerp(x, x2, i / 11) + wob(i) * 0.5, lerp(y, y2, i / 11) + wob(i + 12) * 0.5])); P.push([[x2 - Math.cos(a - 0.5) * r * 0.6, y2 - Math.sin(a - 0.5) * r * 0.6], [x2, y2], [x2 - Math.cos(a + 0.5) * r * 0.6, y2 - Math.sin(a + 0.5) * r * 0.6]]); }
  let left = Math.floor(m.u * P.reduce((n, p) => n + p.length, 0));
  ctx.save(); ctx.beginPath(); ctx.rect(...edge); ctx.clip();
  for (const p of P) { const k = Math.min(left, p.length); left -= k; if (k > 1) line(ctx, p.slice(0, k), INK[m.col], m.kind === 'hi' ? 0.013 : m.turns > 2 ? 0.005 : 0.0032, m.kind === 'hi' ? 0.45 : 0.9); }
  ctx.restore();
}

function stamp(ctx, s) {
  const k = lerp(2.6, 1, s.stamp ** 0.5), wd = 0.56, ht = 0.13;
  ctx.save(); ctx.translate(0, s.stampY); ctx.rotate(-0.13); ctx.scale(k, k); ctx.globalAlpha = 0.88 * s.stamp;
  ctx.strokeStyle = ctx.fillStyle = 'hsl(2 78% 42%)'; ctx.lineWidth = 0.012; ctx.strokeRect(-wd / 2, -ht / 2, wd, ht); ctx.lineWidth = 0.003; ctx.strokeRect(-wd / 2 + 0.012, -ht / 2 + 0.012, wd - 0.024, ht - 0.024);
  text(ctx, 'CASE CLOSED', 0, 0.006, 0.085, STAMP, 'hsl(2 78% 42%)');
  ctx.restore();
}

// a suspect's mugshot: limner draws it once (hat to collar, on the height chart). A pure function of the character,
// so a cache outside the state, not memory of the world.
const MUGS = new Map(), BMP = 224;
function mugshot(it) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  const key = `${it.sd}:${it.id}:${it.char.skin}`;
  let img = MUGS.get(key);
  if (!img) {
    if (MUGS.size > 24) MUGS.clear();
    img = new OffscreenCanvas(BMP, Math.round(BMP * (0.7 * it.h) / (0.84 * it.w))); const c = img.getContext('2d'), H = img.height;
    c.fillStyle = 'hsl(210 14% 70%)'; c.fillRect(0, 0, BMP, H);
    c.fillStyle = 'hsl(210 14% 52%)'; for (let y = H * 0.1; y < H; y += H * 0.13) c.fillRect(0, y, BMP, 2);
    const k = (H / 480) * (480 / 330);
    c.translate(BMP / 2, H * 0.44); c.scale(k, k); c.translate(-200, -eyeY(it.char));
    drawOn(c, portraitOps({ ...it.char, mouth: { ...it.char.mouth, smile: -0.1 } }));
    MUGS.set(key, img);
  }
  return img;
}
