// Step-grid strings: 'x' = hit, '.' = rest. All drum/bass rhythm decisions are made on these
// so that structural axes stay deterministic and drive can move hits without changing their number.
const tz = (i) => { if (i === 0) return 99; let d = 0; while (i % 2 === 0) { i /= 2; d++; } return d; };
const byKey = (steps, key) => Array.from({ length: steps }, (_, i) => i).sort((a, b) => key(a) - key(b) || a - b);

/**
 * Position rankings for a bar of `steps` sixteenths with `pulse` steps per beat.
 * on: downbeat, half-bar (when it is a beat), beats, 8ths, 16ths. off: 8ths, 16ths, beats, downbeat/half-bar.
 * snare: odd-numbered beats (the backbeat), then 8ths inside odd beats, other 8ths, even beats, 16ths.
 */
export function rankings(steps, pulse) {
  const halfBar = steps % (2 * pulse) === 0 ? steps / 2 : -1; // 3/4 and 7/8 have no half-bar beat
  // metric depth: 0 downbeat, 1 half-bar, 2 beat, 3 8th (halfway through a beat), 4 16th
  const depth = (i) => (i === 0 ? 0 : i === halfBar ? 1 : i % pulse === 0 ? 2 : (i % pulse) % (pulse / 2) === 0 ? 3 : 4);
  const on = byKey(steps, depth);
  const off = byKey(steps, (i) => ({ 3: 0, 4: 1, 2: 2 })[depth(i)] ?? 3);
  const snare = byKey(steps, (i) => (i % pulse === 0 ? ((i / pulse) % 2 === 1 ? 0 : 3) : tz(i) === 1 ? (Math.floor(i / pulse) % 2 === 1 ? 1 : 2) : 4));
  return { on, off, snare };
}

export const fit = (template, steps) => template.repeat(Math.ceil(steps / template.length)).slice(0, steps);
/** count 1: the downbeat; 2: downbeat and half-bar; 4: every beat; 8: every half-beat. */
export function bassGrid(count, { steps, pulse }) {
  const spacing = count === 1 ? steps : count === 2 ? Math.round(steps / 2) : count === 4 ? pulse : Math.max(1, Math.round(pulse / 2));
  return Array.from({ length: steps }, (_, i) => (i % spacing === 0 ? 'x' : '.')).join('');
}

export const TEMPLATES = {
  house:    { bd: 'x...x...x...x...', sd: '....x.......x...', hh: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.', cp: '....x.......x...' },
  breaks:   { bd: 'x..x..x...x.x...', sd: '....x..x.x..x...', hh: 'x.xxx.xxx.xxx.xx', oh: '......x.......x.', cp: '..........x.....' },
  minimal:  { bd: 'x.......x.......', sd: '........x.......', hh: '..x...x...x...x.', oh: '..............x.', cp: '.......x........' },
  halftime: { bd: 'x.........x.....', sd: '........x.......', hh: 'x.x.x.x.x.x.x.x.', oh: '..............x.', cp: '...x......x.....' },
  // lub-dub: two kicks a dotted-eighth apart, then nothing, twice a bar -- a resting pulse rather than a beat.
  // the other voices are empty on purpose: this is a body, not a kit. keep `drive` at its baseline, because
  // moving hits toward the pulse is exactly what destroys the pairing.
  heartbeat: { bd: 'x..x....x..x....', sd: '................', hh: '................', oh: '................', cp: '................' },
};

export const hasHit = (c) => 'xXo'.includes(c);
/** A grid string cut into its bars of `steps` (the inverse of the `|` parseGrid joins on). */
export const barsOf = (g, steps) => g.match(new RegExp(`.{1,${steps}}`, 'g')) ?? [];
export const positions = (g) => [...g].map((c, i) => (hasHit(c) ? i : -1)).filter((i) => i >= 0);
/** A grid from hit positions; `chars` maps a position to its character (accent X, ghost o), default x. */
export const fromPositions = (ps, steps, chars = {}) => Array.from({ length: steps }, (_, i) => (ps.includes(i) ? chars[i] ?? 'x' : '.')).join('');
export const gridToMini = (g) => [...g].map((c) => (hasHit(c) ? 'x' : '~')).join(' ');
const GAIN = { x: 1, X: 1.25, o: 0.4 };
/** Per-step gain multipliers for a grid's accents and ghosts, a mini string; null when every hit is plain. */
export const gains = (g) => (/[Xo]/.test(g) ? [...g].map((c) => String(GAIN[c] ?? 1).replace(/^0\./, '.')).join(' ') : null);

/** Bjorklund's algorithm: `pulses` hits spread as evenly as possible over `steps`, rotated left by `rotation`. */
export function bjorklund(pulses, steps, rotation = 0) {
  if (pulses <= 0) return '.'.repeat(steps);
  if (pulses >= steps) return 'x'.repeat(steps);
  let a = Array.from({ length: pulses }, () => ['x']), b = Array.from({ length: steps - pulses }, () => ['.']);
  while (b.length > 1) {
    const n = Math.min(a.length, b.length);
    const next = a.slice(0, n).map((x, i) => x.concat(b[i]));
    const rest = a.length > n ? a.slice(n) : b.slice(n);
    a = next; b = rest;
  }
  const s = a.concat(b).flat().join('');
  const r = ((rotation % steps) + steps) % steps;
  return s.slice(r) + s.slice(0, r);
}

/**
 * The grid a rhythm string means, over bars of `steps`: x hit, X accent, o ghost, . - ~ rest, spaces ignored, | between
 * bars; or `p/s` (`p/s+r`) for p euclidean hits over s slots of the bar, rotated r. Shorter than a bar tiles; longer must be
 * whole bars. -> { grid, bars }
 */
export function parseGrid(text, steps) {
  const src = String(text).replace(/\s+/g, '');
  const eu = /^(\d+)\/(\d+)(?:\+(\d+))?$/.exec(src);
  if (eu) {
    const p = +eu[1], s = +eu[2], r = +(eu[3] ?? 0);
    if (!s || steps % s !== 0) throw new Error(`rhythm "${text}": ${s} slots do not divide the bar's ${steps} steps`);
    const slot = steps / s;
    return { grid: [...bjorklund(p, s, r)].map((c) => c + '.'.repeat(slot - 1)).join(''), bars: 1 };
  }
  const bars = src.split('|').map((b) => [...b].map((c) => { if (hasHit(c)) return c; if ('.-~'.includes(c)) return '.'; throw new Error(`rhythm "${text}": unknown character "${c}" (x X o . - ~ | or p/s)`); }).join(''));
  if (bars.length > 1) {
    if (bars.some((b) => b.length !== steps)) throw new Error(`rhythm "${text}": every bar between | must be ${steps} steps`);
    return { grid: bars.join(''), bars: bars.length };
  }
  const g = bars[0];
  if (g.length === 0) throw new Error(`rhythm "${text}": empty`);
  if (g.length <= steps) return { grid: fit(g, steps), bars: 1 };
  if (g.length % steps !== 0) throw new Error(`rhythm "${text}": ${g.length} steps is not a whole number of bars of ${steps}`);
  return { grid: g, bars: g.length / steps };
}

/**
 * A drum template as [{ voice, grid, bars }] over bars of `steps`. A name is looked up in TEMPLATES: a plain x/. string
 * sized for 4/4 (16 steps), fitted to the meter first (tiling or truncating) so a non-4/4 section still gets a grid
 * instead of parseGrid's "whole number of bars" error. A written { voice: rhythm } object is meant for this meter
 * exactly, so its bars/euclid/accents go through parseGrid unfitted. Shared by the drums layer and the step grid editor.
 */
export function parseTemplate(template, steps) {
  const named = !(template && typeof template === 'object');
  const t = named ? TEMPLATES[template ?? 'house'] : template;
  if (!t) throw new Error(`unknown template "${template}" (known: ${Object.keys(TEMPLATES).join(', ')}, or an object of voice: grid)`);
  return Object.entries(t).map(([voice, g]) => ({ voice, ...parseGrid(named ? fit(g, steps) : g, steps) }));
}

/**
 * Move hits toward the pulse (v > .5) or away from it (v < .5) without changing their number.
 * k = round(|v-.5|*2 * count) hits are relocated: the ones ranked worst by the target ranking are
 * replaced by the best unused target positions. v === .5 returns the grid unchanged.
 * `voice` names the ranking that is this voice's idea of the pulse ('on', or 'snare' for snares); retreating
 * off-pulse is voice-agnostic. `r` is rankings(steps, pulse) for the section's meter.
 * Accent (X) and ghost (o) characters ride along with the hits this moves: a moved hit keeps its own character.
 */
export function place(grid, v, r = rankings(grid.length, 4), voice = 'on') {
  if (v === 0.5) return grid;
  const ranking = v > 0.5 ? r[voice] : r.off;
  const rank = (i) => ranking.indexOf(i);
  const cur = positions(grid);
  const k = Math.round(Math.abs(v - 0.5) * 2 * cur.length);
  if (k === 0) return grid;
  const chars = Object.fromEntries(cur.map((i) => [i, grid[i]]));
  const byRank = [...cur].sort((a, b) => rank(a) - rank(b));
  const keep = byRank.slice(0, cur.length - k), moved = byRank.slice(cur.length - k); // the hits that go, in the order they leave
  const free = ranking.filter((i) => !keep.includes(i)).slice(0, k);
  return fromPositions([...keep, ...free].sort((a, b) => a - b), grid.length, { ...chars, ...Object.fromEntries(free.map((i, j) => [i, chars[moved[j]]])) }); // a vacated position's char is unused: fromPositions only reads the kept and landed ones
}

/** Per-step accent multipliers: on-pulse steps stay at 1, off-pulse steps get quieter as v rises above .5. */
export function accents(v, { steps, pulse }) {
  const off = v <= 0.5 ? 1 : 1 - 0.4 * (v - 0.5) * 2;
  return Array.from({ length: steps }, (_, i) => (i % pulse === 0 ? 1 : +off.toFixed(3))).join(' ');
}
