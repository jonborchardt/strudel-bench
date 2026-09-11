// WAV -> MP3 next to the source. usage: node scripts/mp3.mjs renders/x.wav [--kbps 192]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mp3Encoder } from '@breezystack/lamejs';
import { readWav } from './analyze.mjs';

export function wavToMp3(wavPath, { kbps = 192 } = {}) {
  const { rate, channels, frames } = readWav(fs.readFileSync(wavPath));
  const pcm = frames.slice(0, 2).map((f) => Int16Array.from(f, (s) => Math.round(Math.max(-1, Math.min(1, s)) * 32767)));
  const enc = new Mp3Encoder(pcm.length, rate, kbps);
  const out = [];
  for (let i = 0; i < pcm[0].length; i += 1152 * 32) { // ponytail: whole file in memory; fine for song-length renders
    const chunk = enc.encodeBuffer(...pcm.map((c) => c.subarray(i, i + 1152 * 32)));
    if (chunk.length) out.push(Buffer.from(chunk));
  }
  out.push(Buffer.from(enc.flush()));
  const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
  fs.writeFileSync(mp3Path, Buffer.concat(out));
  return mp3Path;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => a.endsWith('.wav'));
  if (!file) { console.error('usage: node scripts/mp3.mjs renders/x.wav [--kbps 192]'); process.exit(2); }
  const k = args.indexOf('--kbps');
  console.log(wavToMp3(file, { kbps: k >= 0 ? Number(args[k + 1]) : undefined }));
}
