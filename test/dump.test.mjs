import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dumpFile } from '../scripts/dump.mjs';
import { ready } from './_scope.mjs';

test('dump prints the plain strudel behind demo.strudel', async () => {
  const out = await dumpFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.match(out, /^await samples\('https:\/\/[^']+uzu-drumkit\.json'/m); // prebake header: the dump pastes into strudel.cc as-is
  assert.match(out, /^await aliasBank\('https:\/\/[^']+alias\.json'\)/m);
  assert.doesNotMatch(out, /samples\/user\//); // demo.strudel declares no local pack
  assert.match(out, /^const piece = \(lo, base, hi/m); // helper inlined because a signal axis uses it
  assert.doesNotMatch(out, /f\.toString/);
  assert.match(out, /^setcps\(0\.5\)/m);
  assert.match(out, /const intro_drums = stack\(\n  s\("bd"\)\n    \.struct\("x ~ ~ ~ /);
  assert.match(out, /\.add\(note\(0\)\)/); // non-configurable operator getter, recovered by probing
  assert.match(out, /\.lpf\(saw\.range\(0\.3, 0\.7\)\.slow\(8\)\.fmap\(piece\(300, 2000, 8000, \{ log: true \}\)\)\)/); // signal axis
  assert.match(out, /\.jux\(rev\)/);
  assert.match(out, /arrange\(\n  \[4, stack\(intro_drums, intro_pad\)\],\n  \[8, stack\(verse_drums, verse_bass, verse_melody, verse_pad, verse_fx\)\],\n  \[8, stack\(drop_drums, drop_bass, drop_melody, drop_melody2, drop_pad\)\],\n\)$/);
  assert.doesNotMatch(out, /_opIn|\/\*pattern\*\//);
});

test('dump leaves strudel untouched afterwards: wrappers off the globals and the Pattern prototype', async () => {
  const { Pattern, stack } = await import('@strudel/core');
  const before = Object.getOwnPropertyDescriptor(Pattern.prototype, 'fast');
  await dumpFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.equal(globalThis.stack, stack);
  assert.equal(Object.getOwnPropertyDescriptor(Pattern.prototype, 'fast').value, before.value);
  assert.equal(typeof globalThis.hush, 'function'); // the scope's stub is back, not the dump's
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
    // single-quoted: double quotes would reach the repl's transpiler as mini-notation, not as the order's name
    assert.match(out, /arpWith\(\(haps\) => seq\(\.\.\.arpIndices\('up', haps\.length, 8\)\)/);
  } finally { fs.unlinkSync(file); }
});

test('a song declaring a local pack gets the deployed samples/user map in the header', async () => {
  const out = await dumpFile(path.resolve(import.meta.dirname, '..', 'songs', 'ping.strudel'));
  assert.match(out, /^await samples\('https:\/\/\S+\/samples\/user\/strudel\.json', 'https:\/\/\S+\/samples\/user\/'\)$/m);
});

// The repl re-evaluates the dumped text, so anything the dump prints has to mean the same thing there as it did
// in lib: a closure printed with toString() that captured a variable, or a double-quoted string the transpiler
// turns into a mini pattern. Both fail silently — strudel logs "[query] error" and drops the cycle's events.
test('every fixture song plays the same dumped as it does built', async () => {
  const { evaluate } = await import('@strudel/core');
  const { transpiler } = await import('@strudel/transpiler');
  await ready;
  globalThis.aliasBank ??= async () => {}; // the header's bank alias; samples() is already stubbed by ensureScope
  const pat = async (code) => await (await evaluate(code, transpiler)).pattern;
  const stream = (p, n) => {
    const out = [];
    for (let c = 0; c < n; c++) for (const h of p.queryArc(c, c + 1)) out.push(`${h.whole?.begin} ${h.value.s ?? ''} ${h.value.note ?? ''}`);
    return out;
  };
  const dir = path.resolve(import.meta.dirname, 'fixtures');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.strudel'))) {
    const song = await pat(fs.readFileSync(path.join(dir, f), 'utf8'));
    const dumped = await pat(await dumpFile(path.join(dir, f)));
    const n = song.strudel?.total ?? 4;
    assert.deepEqual(stream(dumped, n), stream(song, n), `${f}: the dump does not play like the song`);
  }
});

test('the mix material dumps and plays back: room, compressor, humanize, position and velocity survive the round trip', async () => {
  const { evaluate } = await import('@strudel/core');
  const { transpiler } = await import('@strudel/transpiler');
  await ready;
  globalThis.aliasBank ??= async () => {};
  const file = path.resolve(import.meta.dirname, '..', 'songs', '_t_mix.strudel');
  fs.writeFileSync(file, `song({ cps: .5, seed: 3, room: { size: 1.2, fade: .3, damping: 6000 } }, [section('a', 2, { drums: { density: .7, humanize: { timingMs: 12, velocity: .1, correlation: 'bar' }, compressor: { threshold: -18, ratio: 3 } }, bass: { notes: '0 0 4 3', density: .75, position: -.3, velocity: '.8 1', duck: 'drums', duckAttack: .2 }, pad: { position: .4 } })])`);
  try {
    const out = await dumpFile(file);
    assert.doesNotMatch(out, /\/\*pattern\*\//, 'nothing printed as an opaque pattern');
    const song = (await evaluate(fs.readFileSync(file, 'utf8'), transpiler)).pattern, dumped = (await evaluate(out, transpiler)).pattern;
    const stream = (p) => p.queryArc(0, 2).map((h) => `${h.whole?.begin} ${JSON.stringify(h.value)}`).sort();
    assert.deepEqual(stream(dumped), stream(song), 'the dump plays exactly what the song builds, every control included');
    assert.ok(stream(song).some((s) => /"roomsize":1.2/.test(s)) && stream(song).some((s) => /"compressorRatio":3/.test(s)), 'and those controls are in the stream');
  } finally { fs.rmSync(file); }
});

test('a raw part dumps the pattern the file wrote', async () => {
  const file = path.resolve(import.meta.dirname, '..', 'songs', '_t_raw.strudel');
  fs.writeFileSync(file, `song({ cps: .5 }, [section('a', 2, { raw: { pattern: s("metal:2").struct("x ~ x x").lpf(1800), level: .5 } })])`);
  try { const out = await dumpFile(file); assert.match(out, /const a_raw = s\("metal:2"\)\n\s+\.struct\("x ~ x x"\)\n\s+\.lpf\(1800\)/); assert.match(out, /\.mul\(gain\(0\.5\)\)/); }
  finally { fs.rmSync(file); }
});

test('the dump prints the orbit each part plays on', async () => {
  const out = await dumpFile(path.resolve(import.meta.dirname, '..', 'songs', 'demo.strudel'));
  assert.match(out, /const intro_pad = [\s\S]*?\.orbit\(2\)/);
});

test('dump keeps patterns stacked around a song(), not just the song sections', async () => {
  const fs = await import('node:fs');
  const file = path.resolve(import.meta.dirname, '..', 'songs', '_t_wrap.strudel');
  fs.writeFileSync(file, `const x = song({ cps: .5 }, [section('a', 2, { drums: {} })]);
const out = stack(x, s("metal").gain(.3));
out.strudel = x.strudel;
out`);
  try {
    const out = await dumpFile(file);
    assert.match(out, /const layers = arrange\(\n  \[2, stack\(a_drums\)\],\n\)/);
    assert.match(out, /\nstack\(\n  layers,\n  s\("metal"\)\n    \.gain\(0\.3\)\n\)$/);
  } finally { fs.unlinkSync(file); }
});
