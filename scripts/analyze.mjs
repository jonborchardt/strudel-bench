// WAV metrics with no dependencies. usage: node scripts/analyze.mjs a.wav [b.wav] [--json] [--cps .5]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// test helper: write 16-bit PCM WAV from an array of Float32Array channels (-1..1)
export function writeWav(filePath, rate, channelsData) {
  const channels = channelsData.length, n = channelsData[0].length;
  const dataSize = n * channels * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * channels * 2, 28); buf.writeUInt16LE(channels * 2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40);
  let off = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) {
    const s = Math.max(-1, Math.min(1, channelsData[c][i]));
    buf.writeInt16LE(Math.round(s * 32767), off); off += 2;
  }
  fs.writeFileSync(filePath, buf);
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

export function analyze({ rate, channels, frames }, { cps = 0.5, steps = 16 } = {}) {
  const n = frames[0].length;
  if (n === 0) throw new Error('empty audio: no samples');
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (const ch of frames) s += ch[i]; mono[i] = s / channels; }
  let peak = 0, sq = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(mono[i]); if (a > peak) peak = a; sq += mono[i] * mono[i]; }
  const rms = Math.sqrt(sq / n);
  const crest = peak / (rms || 1e-9);

  // spectral metrics over active frames
  const win = Float32Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FRAME));
  const gate = peak * Math.pow(10, -ACTIVE_FRAME_DB / 20);
  let cSum = 0, cW = 0, hi = 0, lo = 0, tot = 0, active = 0, flatSum = 0;
  const binHz = rate / FRAME;
  for (let start = 0; peak > 0 && start + FRAME <= n; start += HOP) {
    let fr = 0; for (let i = 0; i < FRAME; i++) fr += mono[start + i] ** 2; fr = Math.sqrt(fr / FRAME);
    if (fr < gate) continue;
    active++;
    const re = new Float32Array(FRAME), im = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i++) re[i] = mono[start + i] * win[i];
    fft(re, im);
    for (let k = 1; k < FRAME / 2; k++) {
      const mag = re[k] * re[k] + im[k] * im[k], f = k * binHz;
      cSum += f * mag; cW += mag; tot += mag;
      if (f >= 4000) hi += mag;
      if (f < 150) lo += mag;
    }
    let logSum = 0, linSum = 0;
    for (let k = 1; k < FRAME / 2; k++) { const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-12; logSum += Math.log(m); linSum += m; }
    flatSum += Math.exp(logSum / (FRAME / 2 - 1)) / (linSum / (FRAME / 2 - 1));
  }
  const centroidHz = cW ? cSum / cW : 0;
  const flatness = active ? flatSum / active : 0;

  // width: side/mid energy
  let mid = 0, side = 0;
  if (channels >= 2) for (let i = 0; i < n; i++) { const m = (frames[0][i] + frames[1][i]) / 2, s = (frames[0][i] - frames[1][i]) / 2; mid += m * m; side += s * s; }
  const width = channels >= 2 ? side / ((mid + side) || 1e-9) : 0;

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
  return { rms: r(rms, 4), peak: r(peak, 3), crest: r(crest, 2), onsetsPerSec: r(onsetsPerSec, 2), centroidHz: Math.round(centroidHz), highRatio: r(tot ? hi / tot : 0), lowRatio: r(tot ? lo / tot : 0), width: r(width), tail: r(tailRatio), activeFrames: active, swing: r(swing), jitter: r(jitter, 1), novelty: r(novelty), flatness: r(flatness, 4) };
}

export const synth = { tone: (rate, hz, secs, amp = .5) => Float32Array.from({ length: rate * secs }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / rate)) };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const jsonOut = args.includes('--json');
  const cpsIdx = args.indexOf('--cps');
  const cps = cpsIdx >= 0 ? Number(args[cpsIdx + 1]) : 0.5;
  const stepsIdx = args.indexOf('--steps');
  const steps = stepsIdx >= 0 ? Number(args[stepsIdx + 1]) : 16; // swing/jitter grid: 16 for 4/4, 12 for 3/4, 14 for 7/8
  const files = args.filter((a) => a.endsWith('.wav'));
  if (!files.length) { console.error('usage: node scripts/analyze.mjs a.wav [b.wav] [--json] [--cps .5] [--steps 16]'); process.exit(2); }
  const results = files.map((f) => analyze(readWav(fs.readFileSync(f)), { cps, steps }));
  if (jsonOut) { console.log(JSON.stringify(Object.fromEntries(files.map((f, i) => [f, results[i]])), null, 1)); process.exit(0); }
  const keys = Object.keys(results[0]);
  for (const k of keys) {
    const a = results[0][k], b = results[1]?.[k];
    const pct = a ? `${Math.round((b - a) / Math.abs(a) * 100)}%` : b === 0 ? '0%' : 'n/a';
    const delta = b === undefined ? '' : `   ${b > a ? '↑' : b < a ? '↓' : '='} ${pct}`;
    console.log(`${k.padEnd(14)} ${String(a).padStart(9)}${b === undefined ? '' : String(b).padStart(10)}${delta}`);
  }
}
