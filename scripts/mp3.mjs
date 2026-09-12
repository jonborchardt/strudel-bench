// WAV -> MP3 next to the source. usage: node scripts/mp3.mjs renders/x.wav [--kbps 192]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeMp3 } from '../web/mp3.mjs';
import { readWav } from './analyze.mjs';

export function wavToMp3(wavPath, { kbps = 192 } = {}) {
  const { rate, frames } = readWav(fs.readFileSync(wavPath));
  const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
  fs.writeFileSync(mp3Path, encodeMp3(frames, rate, { kbps }));
  return mp3Path;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => a.endsWith('.wav'));
  if (!file) { console.error('usage: node scripts/mp3.mjs renders/x.wav [--kbps 192]'); process.exit(2); }
  const k = args.indexOf('--kbps');
  console.log(wavToMp3(file, { kbps: k >= 0 ? Number(args[k + 1]) : undefined }));
}
