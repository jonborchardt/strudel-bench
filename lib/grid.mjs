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

export const positions = (g) => [...g].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0);
export const fromPositions = (ps, steps) =>Array.from({ length: steps }, (_, i) => (ps.includes(i) ? 'x' : '.')).join('');
export const gridToMini = (g) => [...g].map((c) => (c === 'x' ? 'x' : '~')).join(' ');

/**
 * Move hits toward the pulse (v > .5) or away from it (v < .5) without changing their number.
 * k = round(|v-.5|*2 * count) hits are relocated: the ones ranked worst by the target ranking are
 * replaced by the best unused target positions. v === .5 returns the grid unchanged.
 * `voice` names the ranking that is this voice's idea of the pulse ('on', or 'snare' for snares); retreating
 * off-pulse is voice-agnostic. `r` is rankings(steps, pulse) for the section's meter.
 */
export function place(grid, v, r = rankings(grid.length, 4), voice = 'on') {
  if (v === 0.5) return grid;
  const ranking = v > 0.5 ? r[voice] : r.off;
  const rank = (i) => ranking.indexOf(i);
  const cur = positions(grid);
  const k = Math.round(Math.abs(v - 0.5) * 2 * cur.length);
  if (k === 0) return grid;
  const keep = [...cur].sort((a, b) => rank(a) - rank(b)).slice(0, cur.length - k);
  const free = ranking.filter((i) => !keep.includes(i));
  return fromPositions([...keep, ...free.slice(0, k)].sort((a, b) => a - b), grid.length);
}

/** Per-step accent multipliers: on-pulse steps stay at 1, off-pulse steps get quieter as v rises above .5. */
export function accents(v, { steps, pulse }) {
  const off = v <= 0.5 ? 1 : 1 - 0.4 * (v - 0.5) * 2;
  return Array.from({ length: steps }, (_, i) => (i % pulse === 0 ? 1 : +off.toFixed(3))).join(' ');
}
