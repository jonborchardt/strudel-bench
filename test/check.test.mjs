import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkFile } from '../scripts/check.mjs';

const tmp = (name, code) => {
  const f = path.join(import.meta.dirname, name);
  fs.writeFileSync(f, code);
  return f;
};

test('demo song checks clean', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.deepEqual(r.problems, []);
  assert.ok(r.events.length > 8);
  assert.ok(r.events.some((l) => l.includes('"s":"bd"')));
});

test('syntax error is reported', async () => {
  const f = tmp('_t_bad.strudel', 'note("c3"');
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.ok(r.problems.length); }
  finally { fs.rmSync(f); }
});

test('unknown sound is reported', async () => {
  const f = tmp('_t_unknown.strudel', 's("definitely_not_a_sound")');
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.match(r.problems[0], /unknown sound/); }
  finally { fs.rmSync(f); }
});

test('raw (non-song) files are queried over the default 4 cycles', async () => {
  const f = tmp('_t_raw.strudel', 's("bd*4")');
  try { const r = await checkFile(f); assert.equal(r.cycles, 4); }
  finally { fs.rmSync(f); }
});

test('song() files report per-section, per-layer state', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.deepEqual(r.problems, []);
  assert.equal(r.cycles, 20);
  assert.ok(r.sections.length >= 3);
  const drop = r.sections.find((s) => s.name === 'drop');
  assert.ok(drop.layers.drums.onsetsPerCycle > r.sections.find((s) => s.name === 'intro').layers.drums.onsetsPerCycle);
  assert.equal(typeof drop.layers.drums.attrs.density, 'number');
});

test('harmony line per section, default visible', async () => {
  const f = tmp('_t_harm.strudel', `song({ key: 'C:minor' }, [
  section('a', 1, { pad: {} }),
  section('b', 1, { key: 'Eb:major', progression: 'I V vi IV', pad: {} }),
])`);
  try {
    const r = await checkFile(f);
    assert.deepEqual(r.problems, []);
    assert.deepEqual(r.sections.map((s) => s.harmony), ['C:minor  i VI → Cm Ab', 'Eb:major  I V vi IV → Eb Bb Cm Ab']);
  } finally { fs.rmSync(f); }
});

test('bad numeral is a problem, not a crash', async () => {
  const f = tmp('_t_harm_bad.strudel', `song({}, [ section('drop', 1, { progression: 'i V7', pad: {} }) ])`);
  try { const r = await checkFile(f); assert.equal(r.ok, false); assert.match(r.problems[0], /section "drop".*numeral "V7"/); }
  finally { fs.rmSync(f); }
});
