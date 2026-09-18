// Prints the plain Strudel a song reduces to (see lib/dump.mjs). Read-only.
// usage: node scripts/dump.mjs songs/x.strudel
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { userPacks } from '../server.mjs';
import { registerSamples } from '../lib/packs.mjs';
console.log = () => {}; // strudel prints load banners to stdout; only the dump belongs there
const { ensureScope } = await import('./check.mjs'); // runs esm-fix before the dynamic strudel imports below
const core = await import('@strudel/core');
const mini = await import('@strudel/mini');
const tonal = await import('@strudel/tonal');
const { transpiler } = await import('@strudel/transpiler');
const { dump } = await import('../lib/dump.mjs');

export async function dumpFile(file) {
  await ensureScope();
  registerSamples(userPacks()); // a sample part may name a pack definition; the dump prints the pack sound it resolves to
  return dump(fs.readFileSync(file, 'utf8'), { modules: [core, mini, tonal], Pattern: core.Pattern, evaluate: (code) => core.evaluate(code, transpiler) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts/dump.mjs songs/x.strudel'); process.exit(2); }
  process.stdout.write((await dumpFile(file)) + '\n');
}
