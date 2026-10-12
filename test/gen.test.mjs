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
  const { generate, moods } = await import('../gen/form.mjs');
  assert.equal(generate(3, { mood: 'sad' }), generate(3, { mood: 'sad' }));
  assert.notEqual(generate(3, { mood: 'sad' }), generate(4, { mood: 'sad' }));
  assert.throws(() => generate(1, { mood: 'grumpy' }), /unknown mood/);
  const cycles = (src) => [...src.matchAll(/section\('\w+', (\d+)/g)].reduce((n, m) => n + Number(m[1]), 0);
  assert.equal(cycles(generate(1)), 64, 'the default length is 64 bars');
  assert.equal(cycles(generate(1, { bars: 128 })), 128);
  assert.ok(new Set([1, 2, 3, 4, 5, 6].map((s) => generate(s).match(/key: '(\w+)/)[1])).size > 1, 'small seeds pick different keys');
  for (const mood of moods()) {
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

test('lib/form.mjs carries generate for the page: no node imports, the same output as gen/form.mjs', async () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, '..', 'lib', 'form.mjs'), 'utf8');
  assert.doesNotMatch(src, /from 'node:/, 'lib ships to the browser');
  const lib = await import('../lib/form.mjs'), gen = await import('../gen/form.mjs');
  assert.equal(lib.generate(5, { mood: 'ominous', bars: 32 }), gen.generate(5, { mood: 'ominous', bars: 32 }));
  assert.ok(lib.moods().length > 4 && lib.moods().includes('cinematic'), 'moods() reads the overlays when called: on the page they load after the import, so the dialog asks at open');
  const { OVERLAYS } = await import('../lib/vocab.mjs'), was = OVERLAYS.cinematic; // generate validates against the live table too, not the snapshot taken at import
  delete OVERLAYS.cinematic;
  try { assert.throws(() => lib.generate(1, { mood: 'cinematic' }), /unknown mood/); } finally { OVERLAYS.cinematic = was; }
  assert.ok(lib.generate(1, { mood: 'cinematic' }).includes("section('drop'"));
});
