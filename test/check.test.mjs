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

test('song() files report per-section, per-layer state', async () => {
  const r = await checkFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.deepEqual(r.problems, []);
  assert.ok(r.sections.length >= 3);
  const drop = r.sections.find((s) => s.name === 'drop');
  assert.ok(drop.layers.drums.onsetsPerCycle > r.sections.find((s) => s.name === 'intro').layers.drums.onsetsPerCycle);
  assert.equal(typeof drop.layers.drums.attrs.density, 'number');
});
