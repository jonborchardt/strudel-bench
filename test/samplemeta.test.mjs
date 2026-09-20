import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { measureWav, metaFor, packMaps } from '../scripts/samplemeta.mjs';
import { writeWav } from '../scripts/analyze.mjs';

const USER = path.resolve(import.meta.dirname, '..', 'samples', 'user');
const sine = (seconds, amp, rate = 44100) => Float32Array.from({ length: Math.round(seconds * rate) }, (_, i) => amp * Math.sin(2 * Math.PI * 220 * i / rate));

test('measureWav: seconds, peak and rms of the loudest half second, in dBFS', () => {
  const f = path.join(import.meta.dirname, '_t_meta.wav');
  // a quiet second then a loud one: rms is the loud window's, not the average
  const quiet = sine(1, 0.05), loud = sine(1, 0.5), x = new Float32Array(quiet.length + loud.length);
  x.set(quiet); x.set(loud, quiet.length);
  writeWav(f, 44100, [x]);
  try {
    const m = measureWav(fs.readFileSync(f));
    assert.equal(m.seconds, 2);
    assert.ok(Math.abs(m.peak - -6) < 0.1, `peak ${m.peak}`);
    assert.ok(Math.abs(m.rms - -9) < 0.2, `rms ${m.rms} (0.5 / sqrt 2)`);
  } finally { fs.unlinkSync(f); }
});

test('metaFor and packMaps: a local pack is keyed the way userPacks() spells its files; a non-wav is left out', () => {
  const dir = path.join(USER, '_t_metapack');
  fs.mkdirSync(path.join(dir, 'hit'), { recursive: true });
  writeWav(path.join(dir, 'hit', 'a.wav'), 44100, [sine(0.5, 0.25)]);
  writeWav(path.join(dir, 'loose.wav'), 44100, [sine(0.25, 0.25)]);
  fs.writeFileSync(path.join(dir, 'hit', 'b.mp3'), '');
  try {
    const m = packMaps(['_t_metapack']);
    assert.equal(m.length, 1);
    assert.deepEqual(m[0].json, { hit: ['_t_metapack/hit/a.wav'], loose: ['_t_metapack/loose.wav'] });
    const meta = metaFor(m[0].json, m[0].dir);
    assert.deepEqual(Object.keys(meta).sort(), ['_t_metapack/hit/a.wav', '_t_metapack/loose.wav']);
    assert.equal(meta['_t_metapack/hit/a.wav'].seconds, 0.5);
    assert.ok(Math.abs(meta['_t_metapack/loose.wav'].peak - -12) < 0.1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
