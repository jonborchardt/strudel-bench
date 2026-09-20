// WAV -> MP3 next to the source. usage: node scripts/mp3.mjs renders/x.wav [--kbps 192] [--mono]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { encodeMp3 } from '../web/mp3.mjs';
import { readWav } from '../lib/analyze.mjs';

export function wavToMp3(wavPath, { kbps = 192, mono = false, out } = {}) {
  const { rate, frames } = readWav(fs.readFileSync(wavPath));
  const mp3Path = out || wavPath.replace(/\.wav$/i, '.mp3');
  fs.mkdirSync(path.dirname(mp3Path), { recursive: true });
  fs.writeFileSync(mp3Path, encodeMp3(frames, rate, { kbps, mono }));
  return mp3Path;
}

/** wavToMp3 on a worker thread: the encoder is synchronous and a whole-song wav takes it minutes, which would block the server. */
export const wavToMp3Async = (wavPath, opts) => new Promise((resolve, reject) => {
  const w = new Worker(fileURLToPath(import.meta.url), { workerData: { wavPath, opts } });
  w.once('message', resolve);
  w.once('error', reject);
});
if (!isMainThread && workerData?.wavPath) parentPort.postMessage(wavToMp3(workerData.wavPath, workerData.opts));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const file = args.find((a) => a.endsWith('.wav'));
  if (!file) { console.error('usage: node scripts/mp3.mjs renders/x.wav [--kbps 192] [--mono]'); process.exit(2); }
  const k = args.indexOf('--kbps');
  console.log(wavToMp3(file, { kbps: k >= 0 ? Number(args[k + 1]) : undefined, mono: args.includes('--mono') }));
}
