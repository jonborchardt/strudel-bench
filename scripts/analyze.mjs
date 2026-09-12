// WAV metrics cli. usage: node scripts/analyze.mjs a.wav [b.wav] [--json] [--cps .5]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, readWav } from '../lib/analyze.mjs';

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
