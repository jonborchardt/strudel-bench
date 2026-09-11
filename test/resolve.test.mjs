import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

const SRC = `song({ cps: .5 }, [
  section('verse', 8, { role: 'develop',
    drums: { density: .6, groove: .6 },
    melody: { density: .5, brightness: saw.range(.3, .7).slow(8) },
  }),
  section('drop', 8, {
    drums:  { density: .9 },
  }),
])`;

test('locate finds sections, layers and numeric axes', async () => {
  await ready;
  const { locate } = await import('../scripts/resolve.mjs');
  const m = locate(SRC);
  assert.deepEqual(m.sections.map((s) => s.name), ['verse', 'drop']);
  assert.equal(m.sections[0].layers.drums.axes.density.value, .6);
  assert.equal(m.sections[0].layers.melody.axes.brightness.value, 'expr');
});

test('planEdits rewrites numbers, inserts missing axes, refuses expressions, preserves formatting', async () => {
  await ready;
  const { planEdits, applyEdits } = await import('../scripts/resolve.mjs');
  const { edits, refused, report } = planEdits(SRC, 'verse', '*', 'much darker');
  const out = applyEdits(SRC, edits);
  // dark = brightness -0.30, register -0.10; "much" x2 -> brightness -0.60, register -0.20.
  // drums: brightness inserted at 0.5 - .6 = -.1 -> clamped to 0 (saturated); register skipped (no adapter on drums).
  assert.match(out, /drums: \{ density: \.6, groove: \.6, brightness: 0 \}/);
  // melody: brightness refused (signal); register inserted at 0.5 - .2 = .3.
  assert.match(out, /melody: \{ density: \.5, brightness: saw\.range\(\.3, \.7\)\.slow\(8\), register: \.3 \}/);
  assert.ok(refused.some((r) => r.layer === 'melody' && r.axis === 'brightness'));
  assert.ok(out.includes("section('drop', 8, {\n    drums:  { density: .9 },"), 'other section untouched');
  assert.ok(report.some((r) => r.saturated), 'reports saturation');
});

test('non-song file exits with code 2', async () => {
  await ready;
  const { locate } = await import('../scripts/resolve.mjs');
  assert.throws(() => locate('note("c3")'), /not a song\(\) file/);
});
