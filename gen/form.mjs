// CLI over lib/form.mjs (the skeleton generator the Compose page's New song also calls):
// usage: node gen/form.mjs [--mood=euphoric] [--bars=64] [--seed=N] > songs/new.strudel
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from '../lib/form.mjs';
export { generate, moods } from '../lib/form.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opt = (k, d) => { const a = process.argv.find((a) => a.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  try { process.stdout.write(generate(Number(opt('seed', 1)), { mood: opt('mood', 'euphoric'), bars: Number(opt('bars', 64)) })); }
  catch (e) { console.error(e.message); process.exit(2); }
}
