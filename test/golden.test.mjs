// Pins the events of every song in songs/. Fingerprints (begin, dur, s, bank, note, gain) so value-shape
// changes (extra fields) don't trip it but any moved, added, removed or retuned event does.
// Regenerate on purpose only: UPDATE_GOLDEN=1 node --test test/golden.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { checkFile } from '../scripts/check.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const GOLDEN = path.join(ROOT, 'test', 'golden.json');
const songs = fs.readdirSync(path.join(ROOT, 'songs')).filter((f) => f.endsWith('.strudel') && !f.startsWith('_t_')).sort();
const r3 = (x) => (typeof x === 'number' ? x.toFixed(3) : String(x ?? ''));

async function fingerprint(file) {
  const { events, problems, cps, cycles } = await checkFile(file);
  assert.deepEqual(problems, [], file);
  // tempo and length are part of the song even though they move no event inside a cycle
  const lines = [`cps=${cps ?? ''} total=${cycles}`].concat(events.map((e) => {
    const sp = e.indexOf(' {');
    const v = JSON.parse(e.slice(sp + 1));
    return `${e.slice(0, sp)} ${v.s ?? ''} ${v.bank ?? ''} ${r3(v.note)} ${r3(v.gain)}`;
  }));
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

test('every song produces the golden events', async () => {
  const want = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : {};
  const got = {};
  for (const f of songs) got[f] = await fingerprint(path.join(ROOT, 'songs', f));
  if (process.env.UPDATE_GOLDEN) { fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 2) + '\n'); return; }
  for (const f of songs) assert.equal(got[f], want[f], `${f}: events changed (UPDATE_GOLDEN=1 if intended)`);
});
