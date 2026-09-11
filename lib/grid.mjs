// Step-grid strings: 'x' = hit, '.' = rest. All drum/bass rhythm decisions are made on these
// so that structural axes stay deterministic and drive can move hits without changing their number.
export const GRID44 = { steps: 16, pulse: 4, beats: 4 };
const tz = (i) => { if (i === 0) return 99; let d = 0; while (i % 2 === 0) { i /= 2; d++; } return d; };
const byKey = (steps, key) => Array.from({ length: steps }, (_, i) => i).sort((a, b) => key(a) - key(b) || a - b);

/**
 * Position rankings for a bar of `steps` sixteenths with `pulse` steps per beat.
 * on: downbeat, half-bar, beats, 8ths, 16ths (trailing-zero depth, descending). off: 8ths, 16ths, beats, downbeat.
 * snare: odd-numbered beats (the backbeat), then 8ths inside odd beats, other 8ths, even beats, 16ths.
 */
export function rankings(steps, pulse) {
  const on = byKey(steps, (i) => -tz(i));
  const off = byKey(steps, (i) => ({ 1: 0, 0: 1, 2: 2 })[Math.min(tz(i), 3)] ?? 3);
  const snare = byKey(steps, (i) => (i % pulse === 0 ? ((i / pulse) % 2 === 1 ? 0 : 3) : tz(i) === 1 ? (Math.floor(i / pulse) % 2 === 1 ? 1 : 2) : 4));
  return { on, off, snare };
}
const R16 = rankings(16, 4);
export const ON_PULSE = R16.on, OFF_PULSE = R16.off, SNARE_ON = R16.snare;

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
};

export const countX = (g) => [...g].filter((c) => c === 'x').length;
export const positions = (g) => [...g].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0);
export const fromPositions = (ps, steps = GRID44.steps) => Array.from({ length: steps }, (_, i) => (ps.includes(i) ? 'x' : '.')).join('');
export const gridToMini = (g) => [...g].map((c) => (c === 'x' ? 'x' : '~')).join(' ');

/**
 * Move hits toward the pulse (v > .5) or away from it (v < .5) without changing their number.
 * k = round(|v-.5|*2 * count) hits are relocated: the ones ranked worst by the target ranking are
 * replaced by the best unused target positions. v === .5 returns the grid unchanged.
 * `on` is the voice's idea of the pulse (SNARE_ON for snares); retreating off-pulse is voice-agnostic.
 */
export function place(grid, v, on = rankings(grid.length, 4).on) {
  if (v === 0.5) return grid;
  const ranking = v > 0.5 ? on : rankings(grid.length, 4).off;
  const rank = (i) => ranking.indexOf(i);
  const cur = positions(grid);
  const k = Math.round(Math.abs(v - 0.5) * 2 * cur.length);
  if (k === 0) return grid;
  const keep = [...cur].sort((a, b) => rank(a) - rank(b)).slice(0, cur.length - k);
  const free = ranking.filter((i) => !keep.includes(i));
  return fromPositions([...keep, ...free.slice(0, k)].sort((a, b) => a - b), grid.length);
}

/** Per-step accent multipliers: on-pulse steps stay at 1, off-pulse steps get quieter as v rises above .5. */
export function accents(v, { steps, pulse } = GRID44) {
  const off = v <= 0.5 ? 1 : 1 - 0.4 * (v - 0.5) * 2;
  return Array.from({ length: steps }, (_, i) => (i % pulse === 0 ? 1 : +off.toFixed(3))).join(' ');
}
