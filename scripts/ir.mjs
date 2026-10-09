// Import a recorded impulse response into samples/user/rooms/ (`npm run ir -- <in.wav> <name> [--seconds 4] [--predelay 10]`).
// Reads what lib/analyze.mjs readWav reads (16/24/32-bit, float, any rate, mono, stereo or 4-channel B-format W X Y Z),
// folds it to stereo, cuts the head to the first sample above 40 dB under the peak (deconvolved sweeps carry tens of ms of silence), removes the direct sound
// (the peak and 2.5 ms after it; --keep-direct leaves it) and measures the pre-delay from the first reflection,
// puts `predelay` ms of digital silence in front (superdough has no pre-delay control; room.irbegin reads the file from
// a fraction in, so one impulse serves several), keeps `seconds` of it, normalises the peak to .5, fades the last 50 ms
// and writes 16-bit at the source rate (superdough resamples at decode; room.size truncates the file, never stretches it).
// Licence per file goes in samples/user/rooms/LICENSE-ASSETS.md by hand; this script writes audio only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readWav } from '../lib/analyze.mjs';
import { writeWav } from './analyze.mjs';

const ROOT = path.resolve(import.meta.dirname, '..'), OUT = path.join(ROOT, 'samples', 'user', 'rooms');

/** Mono doubles; stereo stays; 4 channels are B-format (FuMa W X Y Z): L = W + Y, R = W - Y, a virtual pair facing the sides. */
export function toStereo(frames) {
  if (frames.length === 1) return [frames[0], Float32Array.from(frames[0])];
  if (frames.length === 2) return frames;
  if (frames.length === 4) { const [W, , Y] = frames; return [W.map((w, i) => w + Y[i]), W.map((w, i) => w - Y[i])]; }
  throw new Error(`${frames.length} channels: expected mono, stereo or 4-channel B-format`);
}

export function importIr(buf, { seconds = 4, predelayMs = 10, keepDirect = false } = {}) {
  const { rate, frames } = readWav(buf);
  let [l, r] = toStereo(frames);
  const scan = (from) => { let peak = 0, at = from; for (let i = from; i < l.length; i++) { const v = Math.max(Math.abs(l[i]), Math.abs(r[i])); if (v > peak) { peak = v; at = i; } } return { peak, at }; };
  // the floor is 40 dB under the peak, not absolute: a quiet noise floor before the arrival (room.wav had 5 ms of -55 dB) is not the start
  const firstAbove = (from, peak) => { const floor = peak * 10 ** (-40 / 20); let i = from; while (i < l.length && Math.abs(l[i]) < floor && Math.abs(r[i]) < floor) i++; return i; };
  let { peak, at } = scan(0);
  if (peak === 0) throw new Error('silent file');
  let start = firstAbove(0, peak);
  if (at - start > rate * .1) throw new Error(`peak at ${((at - start) / rate).toFixed(3)} s is not at the head: not an impulse response as downloaded`);
  if (!keepDirect) {
    // the convolver normalises by total energy, so a dry copy of the source 10-20 ms ahead of the room (91% of wood's energy)
    // would be a comb filter on every part; cut it through 2.5 ms past its peak and measure the pre-delay from the first reflection
    l = Float32Array.from(l); r = Float32Array.from(r);
    const end = Math.min(l.length, at + Math.round(rate * .0025) + 1);
    l.fill(0, start, end); r.fill(0, start, end);
    ({ peak } = scan(end));
    if (peak === 0) throw new Error('nothing after the direct sound');
    start = firstAbove(end, peak);
  }
  const pre = Math.round(rate * predelayMs / 1000), n = Math.round(rate * seconds), fade = Math.round(rate * .05), g = .5 / peak;
  const cut = (ch) => { const out = new Float32Array(n); for (let i = pre; i < n; i++) { const s = ch[start + i - pre]; if (s === undefined) break; const k = n - i; out[i] = s * g * (k < fade ? k / fade : 1); } return out; };
  return { rate, channels: [cut(l), cut(r)] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: o, positionals: [file, name] } = parseArgs({ allowPositionals: true, options: { seconds: { type: 'string', default: '4' }, predelay: { type: 'string', default: '10' }, 'keep-direct': { type: 'boolean', default: false } } });
  if (!file || !/^[a-z][a-z0-9-]*$/.test(name ?? '')) { console.error('usage: node scripts/ir.mjs <in.wav> <name> [--seconds 4] [--predelay 10] [--keep-direct]'); process.exit(2); }
  const { rate, channels } = importIr(fs.readFileSync(file), { seconds: +o.seconds, predelayMs: +o.predelay, keepDirect: o['keep-direct'] });
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${name}.wav`);
  writeWav(out, rate, channels);
  console.log(`${path.relative(ROOT, out)}: ${rate} Hz, ${o.seconds} s, pre-delay ${o.predelay} ms`);
}
