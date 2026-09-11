import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { dumpFile } from '../scripts/dump.mjs';

test('dump prints the plain strudel behind demo.strudel', async () => {
  const out = await dumpFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.match(out, /^const piece = \(lo, base, hi/); // helper inlined because a signal axis uses it
  assert.doesNotMatch(out, /f\.toString/);
  assert.match(out, /^setcps\(0\.5\)/m);
  assert.match(out, /const intro_drums = stack\(\n  s\("bd"\)\n    \.struct\("x ~ ~ ~ /);
  assert.match(out, /\.add\(note\(0\)\)/); // non-configurable operator getter, recovered by probing
  assert.match(out, /\.lpf\(saw\.range\(0\.3, 0\.7\)\.slow\(8\)\.fmap\(piece\(300, 2000, 8000, \{ log: true \}\)\)\)/); // signal axis
  assert.match(out, /\.jux\(rev\)/);
  assert.match(out, /arrange\(\n  \[4, stack\(intro_drums, intro_pad\)\],\n  \[8, stack\(verse_drums, verse_bass, verse_melody, verse_pad\)\],\n  \[8, stack\(drop_drums, drop_bass, drop_melody, drop_pad\)\],\n\)$/);
  assert.doesNotMatch(out, /_opIn|\/\*pattern\*\//);
});

test('an arped pad dumps self-contained: no plan.*, arpIndices defined', async () => {
  const fs = await import('node:fs');
  const file = path.resolve(import.meta.dirname, '..', 'songs', '_t_arp.strudel');
  fs.writeFileSync(file, `song({ cps: .5 }, [section('a', 2, { pad: { arp: 'up' } })])`);
  try {
    const out = await dumpFile(file);
    assert.doesNotMatch(out, /plan\./);
    assert.match(out, /^const arpIndices = /m);
    assert.match(out, /^const ARP_ORDERS = \{ up: /m);
    assert.match(out, /arpWith\(\(haps\) => seq\(\.\.\.arpIndices\("up", haps\.length\)\)/);
  } finally { fs.unlinkSync(file); }
});

test('dump keeps patterns stacked around a song(), not just the song sections', async () => {
  const fs = await import('node:fs');
  const file = path.resolve(import.meta.dirname, '..', 'songs', '_t_wrap.strudel');
  fs.writeFileSync(file, `const x = song({ cps: .5 }, [section('a', 2, { drums: {} })]);
const out = stack(x, s("metal").gain(.3));
out.strudle = x.strudle;
out`);
  try {
    const out = await dumpFile(file);
    assert.match(out, /const layers = arrange\(\n  \[2, stack\(a_drums\)\],\n\)/);
    assert.match(out, /\nstack\(\n  layers,\n  s\("metal"\)\n    \.gain\(0\.3\)\n\)$/);
  } finally { fs.unlinkSync(file); }
});
