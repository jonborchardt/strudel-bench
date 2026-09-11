// 16-step grid strings: 'x' = hit, '.' = rest. All drum/bass rhythm decisions are made on these
// so that structural axes stay deterministic and drive can move hits without changing their number.
export const STEPS = 16;
export const ON_PULSE = [0, 8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15];   // best-first
export const OFF_PULSE = [2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15, 4, 12, 0, 8]; // best-first
// The snare's "primary pulse" is the backbeat, not the downbeat: ranking it with ON_PULSE piles it onto
// the kick at drive 1. Off-pulse is the same retreat for every voice, so only the on ranking varies.
export const SNARE_ON = [4, 12, 6, 14, 2, 10, 0, 8, 1, 3, 5, 7, 9, 11, 13, 15]; // backbeat-first

export const TEMPLATES = {
  house:    { bd: 'x...x...x...x...', sd: '....x.......x...', hh: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.', cp: '....x.......x...' },
  breaks:   { bd: 'x..x..x...x.x...', sd: '....x..x.x..x...', hh: 'x.xxx.xxx.xxx.xx', oh: '......x.......x.', cp: '..........x.....' },
  minimal:  { bd: 'x.......x.......', sd: '........x.......', hh: '..x...x...x...x.', oh: '..............x.', cp: '.......x........' },
  halftime: { bd: 'x.........x.....', sd: '........x.......', hh: 'x.x.x.x.x.x.x.x.', oh: '..............x.', cp: '...x......x.....' },
};

export const countX = (g) => [...g].filter((c) => c === 'x').length;
export const positions = (g) => [...g].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0);
export const fromPositions = (ps) => Array.from({ length: STEPS }, (_, i) => (ps.includes(i) ? 'x' : '.')).join('');
export const gridToMini = (g) => [...g].map((c) => (c === 'x' ? 'x' : '~')).join(' ');

/**
 * Move hits toward the pulse (v > .5) or away from it (v < .5) without changing their number.
 * k = round(|v-.5|*2 * count) hits are relocated: the ones ranked worst by the target ranking are
 * replaced by the best unused target positions. v === .5 returns the grid unchanged.
 * `on` is the voice's idea of the pulse (SNARE_ON for snares); retreating off-pulse is voice-agnostic.
 */
export function place(grid, v, on = ON_PULSE) {
  if (v === 0.5) return grid;
  const ranking = v > 0.5 ? on : OFF_PULSE;
  const rank = (i) => ranking.indexOf(i);
  const cur = positions(grid);
  const k = Math.round(Math.abs(v - 0.5) * 2 * cur.length);
  if (k === 0) return grid;
  const keep = [...cur].sort((a, b) => rank(a) - rank(b)).slice(0, cur.length - k);
  const free = ranking.filter((i) => !keep.includes(i));
  return fromPositions([...keep, ...free.slice(0, k)].sort((a, b) => a - b));
}

/** Per-step accent multipliers: on-pulse steps stay at 1, off-pulse steps get quieter as v rises above .5. */
export function accents(v) {
  const off = v <= 0.5 ? 1 : 1 - 0.4 * (v - 0.5) * 2;
  return Array.from({ length: STEPS }, (_, i) => (i % 4 === 0 ? 1 : +off.toFixed(3))).join(' ');
}
