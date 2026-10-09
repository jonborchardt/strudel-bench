// Import a recorded impulse response into samples/user/rooms/ (`npm run ir -- <in.wav> <name> [--seconds 4] [--predelay 10]`).
// Reads what lib/analyze.mjs readWav reads (16/24/32-bit, float, any rate, mono, stereo or 4-channel B-format W X Y Z),
// folds it to stereo, cuts the head to the first sample above -60 dBFS (deconvolved sweeps carry tens of ms of silence),
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

export function importIr(buf, { seconds = 4, predelayMs = 10 } = {}) {
  const { rate, frames } = readWav(buf);
  const [l, r] = toStereo(frames);
  const floor = 10 ** (-60 / 20);
  let start = 0; while (start < l.length && Math.abs(l[start]) < floor && Math.abs(r[start]) < floor) start++;
  if (start === l.length) throw new Error('silent file');
  let peak = 0, at = 0; for (let i = start; i < l.length; i++) { const v = Math.max(Math.abs(l[i]), Math.abs(r[i])); if (v > peak) { peak = v; at = i; } }
  if (at - start > rate * .1) throw new Error(`peak at ${((at - start) / rate).toFixed(3)} s is not at the head: not an impulse response as downloaded`);
  const pre = Math.round(rate * predelayMs / 1000), n = Math.round(rate * seconds), fade = Math.round(rate * .05), g = .5 / peak;
  const cut = (ch) => { const out = new Float32Array(n); for (let i = pre; i < n; i++) { const s = ch[start + i - pre]; if (s === undefined) break; const k = n - i; out[i] = s * g * (k < fade ? k / fade : 1); } return out; };
  return { rate, channels: [cut(l), cut(r)] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: o, positionals: [file, name] } = parseArgs({ allowPositionals: true, options: { seconds: { type: 'string', default: '4' }, predelay: { type: 'string', default: '10' } } });
  if (!file || !/^[a-z][a-z0-9-]*$/.test(name ?? '')) { console.error('usage: node scripts/ir.mjs <in.wav> <name> [--seconds 4] [--predelay 10]'); process.exit(2); }
  const { rate, channels } = importIr(fs.readFileSync(file), { seconds: +o.seconds, predelayMs: +o.predelay });
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${name}.wav`);
  writeWav(out, rate, channels);
  console.log(`${path.relative(ROOT, out)}: ${rate} Hz, ${o.seconds} s, pre-delay ${o.predelay} ms`);
}
