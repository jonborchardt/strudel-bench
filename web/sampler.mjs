// The sampler panel's DOM-free half (index.html draws and wires it): waveform peaks, time labels, and the file behind
// a sound name in strudel's sound map. Tested in Node.

/** Waveform columns: the largest |sample| in each of `columns` equal spans of `data`, 0..1. */
export function peaks(data, columns) {
  const out = new Array(columns).fill(0);
  for (let i = 0; i < data.length; i++) {
    const c = Math.min(columns - 1, Math.floor((i * columns) / data.length));
    // round off float32-vs-float64 noise (data is Float32Array; e.g. .2 reads back as .20000000298023224)
    const a = Math.round(Math.abs(data[i]) * 1e6) / 1e6;
    if (a > out[c]) out[c] = a;
  }
  return out;
}

/** Seconds for a label: 2.35s under a minute, 1:02.50 above. */
export const fmtTime = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}` : `${s.toFixed(2)}s`);

/** The file `name` (or `name:n`) plays, from strudel's sound map (superdough stores full urls); null for a pitched map or an unknown sound. */
export function soundUrl(soundMap, name) {
  const [key, n = '0'] = String(name).toLowerCase().split(':');
  const list = soundMap[key]?.data?.samples;
  return Array.isArray(list) && list.length ? list[Number(n) % list.length] : null;
}
