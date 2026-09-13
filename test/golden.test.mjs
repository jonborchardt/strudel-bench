// Pins the events of the fixture songs in test/fixtures/ (copies of real songs, kept still): a change here is a change in lib/.
// The songs in songs/ are content: test/check.test.mjs only asks that they check clean. Fingerprints (begin, dur, s, bank, note, gain) so value-shape
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
const FIX = path.join(ROOT, 'test', 'fixtures');
const songs = fs.readdirSync(FIX).filter((f) => f.endsWith('.strudel')).sort();
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

test('every fixture song produces the golden events', async () => {
  const want = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : {};
  const got = {};
  for (const f of songs) got[f] = await fingerprint(path.join(FIX, f));
  if (process.env.UPDATE_GOLDEN) { fs.writeFileSync(GOLDEN, JSON.stringify(got, null, 2) + '\n'); return; }
  for (const f of songs) assert.equal(got[f], want[f], `${f}: events changed (UPDATE_GOLDEN=1 if intended)`);
});
