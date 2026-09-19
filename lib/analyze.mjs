// WAV metrics with no dependencies: the page (verify card) and scripts/analyze.mjs (cli, writeWav) share this.

export const ACTIVE_FRAME_DB = 40;   // frames quieter than peak - 40 dB are ignored for spectral metrics
const FRAME = 2048, HOP = 1024;

export function readWav(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (String.fromCharCode(...buf.subarray(0, 4)) !== 'RIFF') throw new Error('not a RIFF/WAV file');
  let off = 12, fmt, data;
  while (off + 8 <= buf.length) {
    const id = String.fromCharCode(...buf.subarray(off, off + 4)); const size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') fmt = { tag: dv.getUint16(off + 8, true), channels: dv.getUint16(off + 10, true), rate: dv.getUint32(off + 12, true), bits: dv.getUint16(off + 22, true) };
    if (id === 'data') data = { start: off + 8, size };
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('missing fmt or data chunk');
  const { channels, rate, bits, tag } = fmt;
  const bytes = bits / 8, n = Math.floor(data.size / bytes / channels);
  const frames = Array.from({ length: channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) {
    const p = data.start + (i * channels + c) * bytes;
    frames[c][i] = tag === 3 ? dv.getFloat32(p, true) : bits === 16 ? dv.getInt16(p, true) / 32768 : bits === 24 ? ((dv.getUint8(p) | (dv.getUint8(p + 1) << 8) | (dv.getInt8(p + 2) << 16)) / 8388608) : dv.getInt32(p, true) / 2147483648;
  }
  return { rate, channels, frames };
}

function fft(re, im) { // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

// the three bands pairwise masking is read in (Hz): low is where bass and kick live, mid is where everything else collides
export const BANDS = { low: [0, 300], mid: [300, 3000], high: [3000, Infinity] };

/**
 * How far back a part reads, 0 (in your face) .. 1 (far): its level under the mix, its high-band share and its reverb tail,
 * the three things the ear reads distance from. Read the three inputs next to it: a high score from level alone is a
 * quiet part, not a distant one. ponytail: the weights and the 30 dB / .3 / .5 scales are heuristics, retune from renders.
 */
export function depthOf({ relativeDb, highRatio, tail }) {
  const c = (x) => Math.min(1, Math.max(0, x));
  return +(0.4 * c(-relativeDb / 30) + 0.3 * (1 - c(highRatio / 0.3)) + 0.3 * c(tail / 0.5)).toFixed(3);
}

/**
 * Pairwise masking between two stems analyzed with `bands: true` over the same render length: per band, the shared energy
 * (sum of min / sum of max over frames where both sound) times how often they sound together, 0 (never in each
 * other's way) .. 1 (the same energy in the same band at the same time).
 */
export function masking(a, b) {
  // each stem's band energy is scaled by its own peak over every band and frame: this is about where a part's energy
  // sits, not how loud it is (the level is the dB column), so a quiet pad in the bass's band still masks it
  const scale = (s) => 1 / (Math.max(...Object.values(s.bands).map((v) => Math.max(...v))) || 1);
  const sa = scale(a), sb = scale(b), out = {};
  for (const band of Object.keys(BANDS)) {
    const x = a.bands[band], y = b.bands[band], n = Math.min(x.length, y.length);
    let mn = 0, mx = 0, both = 0, either = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i] * sa, yi = y[i] * sb, ax = xi > 1e-4, by = yi > 1e-4; // -40 dB of the stem's own peak
      if (ax || by) either++;
      if (!(ax && by)) continue;
      both++; mn += Math.min(xi, yi); mx += Math.max(xi, yi);
    }
    out[band] = +(mx && either ? (mn / mx) * (both / either) : 0).toFixed(3);
  }
  return out;
}

export function analyze({ rate, channels, frames }, { cps = 0.5, steps = 16, bands = false } = {}) {
  const n = frames[0].length;
  if (n === 0) throw new Error('empty audio: no samples');
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (const ch of frames) s += ch[i]; mono[i] = s / channels; }
  let peak = 0, sq = 0, clipped = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(mono[i]); if (a > peak) peak = a; sq += mono[i] * mono[i]; }
  for (const ch of frames) for (let i = 0; i < n; i++) if (Math.abs(ch[i]) >= 0.999) clipped++; // samples at full scale, per channel: a wav clamps at 1, so this is what "peak 1" hides
  clipped /= n * channels;
  const rms = Math.sqrt(sq / n);
  const crest = peak / (rms || 1e-9);

  // spectral metrics over active frames
  const win = Float32Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FRAME));
  const gate = peak * Math.pow(10, -ACTIVE_FRAME_DB / 20);
  let cSum = 0, cW = 0, hi = 0, lo = 0, tot = 0, active = 0, flatSum = 0;
  const binHz = rate / FRAME;
  const bandE = bands ? Object.fromEntries(Object.keys(BANDS).map((k) => [k, []])) : null; // per-frame band energy, every frame (silent ones too) so two stems line up
  const re = new Float32Array(FRAME), im = new Float32Array(FRAME);
  for (let start = 0; start + FRAME <= n; start += HOP) {
    let fr = 0; for (let i = 0; i < FRAME; i++) fr += mono[start + i] ** 2; fr = Math.sqrt(fr / FRAME);
    const on = peak > 0 && fr >= gate;
    if (!on && !bandE) continue;
    if (!on && fr === 0) { for (const k of Object.keys(bandE)) bandE[k].push(0); continue; } // digital silence (a part alone is mostly this): its band energy is exactly 0, no FFT
    im.fill(0);
    for (let i = 0; i < FRAME; i++) re[i] = mono[start + i] * win[i];
    fft(re, im);
    let logSum = 0, linSum = 0;
    const be = { low: 0, mid: 0, high: 0 };
    for (let k = 1; k < FRAME / 2; k++) {
      const mag = re[k] * re[k] + im[k] * im[k], f = k * binHz;
      if (bandE) be[f < BANDS.low[1] ? 'low' : f < BANDS.mid[1] ? 'mid' : 'high'] += mag;
      if (!on) continue;
      cSum += f * mag; cW += mag; tot += mag;
      if (f >= 4000) hi += mag;
      if (f < 150) lo += mag;
      const m = Math.sqrt(mag) + 1e-12; logSum += Math.log(m); linSum += m; // spectral flatness on the magnitude spectrum
    }
    if (bandE) for (const k of Object.keys(be)) bandE[k].push(be[k]);
    if (!on) continue;
    active++;
    flatSum += Math.exp(logSum / (FRAME / 2 - 1)) / (linSum / (FRAME / 2 - 1));
  }
  const centroidHz = cW ? cSum / cW : 0;
  const flatness = active ? flatSum / active : 0;

  // width: side/mid energy. pan: where the energy sits, 0 left .. 1 right, per 10 ms and weighted by energy (meanPan), and how much it moves (panStd)
  let mid = 0, side = 0;
  if (channels >= 2) for (let i = 0; i < n; i++) { const m = (frames[0][i] + frames[1][i]) / 2, s = (frames[0][i] - frames[1][i]) / 2; mid += m * m; side += s * s; }
  const width = channels >= 2 ? side / ((mid + side) || 1e-9) : 0;
  let meanPan = 0.5, panStd = 0;
  if (channels >= 2) {
    const ph = Math.round(rate * 0.01); let W = 0, wp = 0, wpp = 0; // one pass: Σw, Σw·p, Σw·p², then std = sqrt(E[p²] − mean²)
    for (let i = 0; i + ph <= n; i += ph) { let l = 0, r = 0; for (let k = 0; k < ph; k++) { l += frames[0][i + k] ** 2; r += frames[1][i + k] ** 2; } const w = l + r, p = w > 0 ? r / w : 0; W += w; wp += w * p; wpp += w * p * p; }
    if (W > 0) { meanPan = wp / W; panStd = Math.sqrt(Math.max(0, wpp / W - meanPan ** 2)); }
  }

  // onsets: peaks in a 10 ms energy envelope's positive difference
  const hop = Math.round(rate * 0.01);
  const env = [];
  for (let i = 0; i + hop <= n; i += hop) { let e = 0; for (let k = 0; k < hop; k++) e += mono[i + k] ** 2; env.push(Math.sqrt(e / hop)); }
  const flux = env.map((e, i) => Math.max(0, e - (env[i - 1] ?? 0)));
  const thr = Math.max(...flux) * 0.25;
  let onsets = 0;
  let lastOnset = -10;
  const onsetTimes = [];
  for (let i = 1; i < flux.length - 1; i++) if (flux[i] > thr && flux[i] >= flux[i - 1] && flux[i] > flux[i + 1] && (onsets === 0 || i - lastOnset > 3)) { onsets++; lastOnset = i; onsetTimes.push(i * hop / rate); }
  const onsetsPerSec = onsets / (n / rate);

  // tail: energy in the last 10% of each cycle window vs the first 10%
  const cyc = Math.round(rate / cps), tenth = Math.round(cyc * 0.1);
  let head = 0, tail = 0, cycles = 0;
  for (let c = 0; c + cyc <= n; c += cyc) { let h = 0, t = 0; for (let k = 0; k < tenth; k++) { h += mono[c + k] ** 2; t += mono[c + cyc - tenth + k] ** 2; } head += h; tail += t; cycles++; }
  const tailRatio = cycles ? tail / ((head + tail) || 1e-9) : 0;

  // swing: mean lateness of onsets nearest an off-beat eighth, in eighths. jitter: std dev (ms) of distance to the nearest sixteenth.
  const sixteenth = 1 / cps / steps, eighth = 2 * sixteenth;
  const late = [], dev = [];
  for (const t of onsetTimes) {
    const k = Math.round(t / eighth);
    if (k % 2 === 1) late.push(t / eighth - k);
    dev.push((t - Math.round(t / sixteenth) * sixteenth) * 1000);
  }
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const swing = Math.max(0, mean(late));
  const jitter = Math.sqrt(mean(dev.map((d) => (d - mean(dev)) ** 2)));

  // novelty: 1 - mean correlation between consecutive cycles' 10 ms energy envelopes
  const per = Math.round(cyc / hop);
  const corrs = [];
  for (let c = 0; (c + 2) * per <= env.length; c++) {
    const a = env.slice(c * per, (c + 1) * per), b = env.slice((c + 1) * per, (c + 2) * per);
    const ma = mean(a), mb = mean(b);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < per; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    corrs.push(da && db ? num / Math.sqrt(da * db) : 1);
  }
  const novelty = corrs.length ? 1 - mean(corrs) : 0;

  const r = (x, d = 3) => +x.toFixed(d);
  const out = { rms: r(rms, 4), peak: r(peak, 3), clipped: r(clipped, 6), crest: r(crest, 2), onsetsPerSec: r(onsetsPerSec, 2), centroidHz: Math.round(centroidHz), highRatio: r(tot ? hi / tot : 0), lowRatio: r(tot ? lo / tot : 0), width: r(width), meanPan: r(meanPan), panStd: r(panStd), tail: r(tailRatio), activeFrames: active, swing: r(swing), jitter: r(jitter, 1), novelty: r(novelty), flatness: r(flatness, 4) };
  if (bandE) out.bands = bandE;
  return out;
}

export const tone = (rate, hz, secs, amp = .5) => Float32Array.from({ length: rate * secs }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate));
