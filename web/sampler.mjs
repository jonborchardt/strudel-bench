// The sampler panel's DOM-free half (index.html draws and wires it): waveform peaks, time labels, the break-point
// arithmetic behind the breaks box and the waveform clicks, and the file behind a sound name in strudel's sound map.
// Tested in Node.

/** Waveform columns: the largest |sample| in each of `columns` equal spans of `data`, 0..1. */
export function peaks(data, columns) {
  const out = new Array(columns).fill(0);
  for (let i = 0; i < data.length; i++) {
    const c = Math.min(columns - 1, Math.floor((i * columns) / data.length));
    const a = Math.abs(data[i]);
    if (a > out[c]) out[c] = a;
  }
  return out;
}

/** Seconds for a label: 2.35s under a minute, 1:02.50 above. */
export const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}` : `${s.toFixed(2)}s`);

/** `slices` as the page uses it: an array of break points as given, else a count (at least 1; anything unreadable is 1). */
export const sliceSpec = (v) => (Array.isArray(v) ? v : Math.max(1, Math.round(Number(v) || 1)));

/** A fraction of the file written the repo's way: 4 decimals, no leading zero (.0625). */
export const frac = (f) => String(+f.toFixed(4)).replace(/^0\./, '.');

/** Break points as fractions (rounded to what will be written) that lie strictly inside begin..end and rise strictly: what survives a trim or a typed list. */
export const breaksIn = (fr, begin, end) => fr.map((f) => +f.toFixed(4)).filter((f, i, a) => f > begin && f < end && (i === 0 || f > a[i - 1]));

/**
 * Break points typed in seconds -> fractions of `duration` (rounded to what will be written), or an error string when a
 * point is not strictly inside begin..end or the list does not rise. `[]` for an empty list.
 */
export function breakPoints(seconds, duration, begin, end) {
  const fr = seconds.map((s) => +(s / duration).toFixed(4));
  const bad = fr.findIndex((f, i) => !(f > begin && f < end) || (i > 0 && f <= fr[i - 1]));
  return bad < 0 ? fr : `break ${seconds[bad]}s: breaks must rise and lie inside the region (${fmtTime(begin * duration)} .. ${fmtTime(end * duration)})`;
}

/** The break list after a click at fraction `x` of the file: removes the break within `tol` of x, else inserts x in order; the list unchanged (the same array) when x is outside begin..end. */
export function toggleBreak(breaks, x, begin, end, tol) {
  const i = breaks.findIndex((b) => Math.abs(b - x) <= tol);
  if (i >= 0) return breaks.filter((_, k) => k !== i);
  if (!(x > begin && x < end)) return breaks;
  return [...breaks, +x.toFixed(4)].sort((a, b) => a - b);
}

/** The file `name` (or `name:n`) plays, from strudel's sound map (superdough stores full urls); null for a pitched map or an unknown sound. */
export function soundUrl(soundMap, name) {
  const [key, n = '0'] = String(name).toLowerCase().split(':');
  const list = soundMap[key]?.data?.samples;
  const i = Number(n);
  return Array.isArray(list) && list.length && Number.isInteger(i) ? list[((i % list.length) + list.length) % list.length] : null;
}
