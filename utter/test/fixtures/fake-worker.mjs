// Stands in for worker.mjs: node fake-worker.mjs <ssmlFile> <outWav>, behaviour picked by FAKE_MODE.
import fs from 'node:fs';
import { wavOf } from '../_wav.mjs';
const [ssmlFile, outFile] = process.argv.slice(2), mode = process.env.FAKE_MODE;
if (process.env.FAKE_PIDFILE) fs.writeFileSync(process.env.FAKE_PIDFILE, String(process.pid));
if (mode === 'fail') { console.error('azure speech failed: No free synthesizer'); process.exit(1); }
if (mode === 'sleep') setInterval(() => {}, 1000);
else {
  const words = fs.readFileSync(ssmlFile, 'utf8').replace(/<[^>]*>/g, ' ').trim().split(/\s+/);
  fs.writeFileSync(outFile, wavOf(1));
  console.log('noise before the last line');
  console.log(JSON.stringify({ boundaries: words.map((text, i) => ({ text, offset: i * 2e6, duration: 1e6, type: 'WordBoundary' })) }));
}
