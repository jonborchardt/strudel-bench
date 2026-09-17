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

/** Snap settings: label -> subdivisions per beat (0 = off). */
export const SNAPS = { off: 0, '1/4': 1, '1/8': 2, '1/16': 4 };
export const snapDivisions = (bars, beatsPerBar, sub) => Math.round(bars * beatsPerBar * sub);
/** The nearest interior grid point of `divisions` equal parts of begin..end, or x itself when there is no interior point to snap to (divisions 0 or 1). */
export function snapTo(x, begin, end, divisions) {
  if (divisions <= 1) return x;
  const step = (end - begin) / divisions, k = Math.min(divisions - 1, Math.max(1, Math.round((x - begin) / step)));
  return +(begin + k * step).toFixed(6);
}
/** The bar count a region of `seconds` at `bpm` most likely stands for, from the usual powers of two. */
export function barsGuess(seconds, bpm, beatsPerBar = 4) {
  const bars = (seconds * bpm) / 60 / beatsPerBar;
  return [.25, .5, 1, 2, 4, 8, 16, 32].reduce((best, b) => (Math.abs(Math.log2(b / bars)) < Math.abs(Math.log2(best / bars)) ? b : best));
}
/**
 * Tempo of the region begin..end of a channel: onset strength (rectified rise of RMS in 5 ms hops), autocorrelated over
 * the lags of 60..200 bpm, with a mild preference for 80..160 so half and double tempos resolve the usual way, and the
 * peak refined between hops. bpm 0 when the region is shorter than about 2 s or nothing periodic stands out.
 */
export function detectTempo(data, rate, begin = 0, end = 1) {
  const hop = Math.max(1, Math.round(rate / 200)), s0 = Math.floor(begin * data.length), s1 = Math.floor(end * data.length);
  const n = Math.floor((s1 - s0) / hop);
  if (n < 400) return { bpm: 0, confidence: 0 };
  const env = new Float32Array(n);
  let prev = 0, total = 0;
  for (let i = 0; i < n; i++) { let e = 0; const o = s0 + i * hop; for (let j = 0; j < hop; j++) e += data[o + j] * data[o + j]; e = Math.sqrt(e / hop); env[i] = Math.max(0, e - prev); total += env[i]; prev = e; }
  if (!total) return { bpm: 0, confidence: 0 };
  const mean = total / n; for (let i = 0; i < n; i++) env[i] -= mean;
  const hps = rate / hop, lagMin = Math.floor((60 / 200) * hps), lagMax = Math.min(n - 1, Math.ceil((60 / 60) * hps));
  const r = new Float32Array(lagMax + 1);
  let best = -Infinity, bestLag = 0, sum = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let acc = 0; for (let i = 0; i + lag < n; i++) acc += env[i] * env[i + lag];
    r[lag] = acc / (n - lag); sum += Math.max(0, r[lag]);
    const bpm = (60 * hps) / lag, w = Math.max(.5, 1 - .25 * Math.abs(Math.log2(bpm / 113))); // ~113 is the middle of 80..160 in log terms
    if (r[lag] * w > best) { best = r[lag] * w; bestLag = lag; }
  }
  if (bestLag <= 0 || r[bestLag] <= 0) return { bpm: 0, confidence: 0 };
  const a = r[bestLag - 1] ?? r[bestLag], b = r[bestLag], c = r[bestLag + 1] ?? r[bestLag]; // parabolic refinement between hops
  const lag = bestLag + (a - c) / (2 * (a - 2 * b + c) || 1);
  const bpm = Math.round(((60 * hps) / lag) * 10) / 10;
  const avg = sum / (lagMax - lagMin + 1);
  return { bpm, confidence: Math.max(0, Math.min(1, avg ? (r[bestLag] / avg - 1) / 4 : 0)) };
}
