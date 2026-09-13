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

test('gen/form.mjs: a skeleton per mood, deterministic per seed, that checks clean and has a climax', async () => {
  const { generate, MOODS } = await import('../gen/form.mjs');
  assert.equal(generate(3, { mood: 'sad' }), generate(3, { mood: 'sad' }));
  assert.notEqual(generate(3, { mood: 'sad' }), generate(4, { mood: 'sad' }));
  assert.throws(() => generate(1, { mood: 'grumpy' }), /unknown mood/);
  const cycles = (src) => [...src.matchAll(/section\('\w+', (\d+)/g)].reduce((n, m) => n + Number(m[1]), 0);
  assert.equal(cycles(generate(1)), 64, 'the default length is 64 bars');
  assert.equal(cycles(generate(1, { bars: 128 })), 128);
  assert.ok(new Set([1, 2, 3, 4, 5, 6].map((s) => generate(s).match(/key: '(\w+)/)[1])).size > 1, 'small seeds pick different keys');
  for (const mood of MOODS) {
    const f = path.join(import.meta.dirname, `_t_form_${mood}.strudel`);
    fs.writeFileSync(f, generate(1, { mood, bars: 32 }));
    try {
      const r = await checkFile(f);
      assert.deepEqual(r.problems, [], mood);
      assert.ok(r.sections.some((s) => s.role === 'climax'), mood);
      assert.equal(r.sections.reduce((n, s) => n + s.cycles, 0), 32, `${mood}: 32 bars`);
    } finally { fs.rmSync(f); }
  }
});
