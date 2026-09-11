import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generate } from '../gen/euclid.mjs';
import { checkFile } from '../scripts/check.mjs';

test('generate is deterministic per seed and passes check', async () => {
  assert.equal(generate(7), generate(7));
  assert.notEqual(generate(7), generate(8));
  const f = path.join(import.meta.dirname, '_t_gen.strudel');
  fs.writeFileSync(f, generate(7));
  try {
    const r = await checkFile(f);
    assert.deepEqual(r.problems, []);
    assert.ok(r.events.length > 0);
  } finally { fs.rmSync(f); }
});
