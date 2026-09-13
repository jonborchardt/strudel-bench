import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeWav } from '../scripts/analyze.mjs';
import { tone } from '../lib/analyze.mjs';
import { wavToMp3 } from '../scripts/mp3.mjs';

test('wavToMp3 writes an mp3 next to the wav', () => {
  const wav = path.join(import.meta.dirname, '_t_tone.wav');
  const t = tone(44100, 440, 1);
  writeWav(wav, 44100, [t, t]);
  try {
    const mp3 = wavToMp3(wav);
    assert.equal(mp3, wav.replace(/\.wav$/, '.mp3'));
    const buf = fs.readFileSync(mp3);
    assert.ok(buf.length > 1000 && buf.length < fs.statSync(wav).size, 'compressed but non-trivial');
    assert.equal(buf[0], 0xff, 'starts with an MPEG frame sync');
    assert.equal(buf[1] & 0xe0, 0xe0);
    fs.unlinkSync(mp3);
  } finally { fs.unlinkSync(wav); }
});

test('snippet settings: mono at a low bitrate is much smaller, and still an mp3', () => {
  const wav = path.join(import.meta.dirname, '_t_snip.wav');
  const t = tone(44100, 440, 2);
  writeWav(wav, 44100, [t, t]);
  try {
    const big = fs.readFileSync(wavToMp3(wav, { out: wav.replace(/\.wav$/, '.big.mp3') }));
    const small = fs.readFileSync(wavToMp3(wav, { kbps: 64, mono: true, out: wav.replace(/\.wav$/, '.small.mp3') }));
    assert.equal(small[0], 0xff, 'starts with an MPEG frame sync');
    assert.ok(small.length * 2 < big.length, `mono 64k (${small.length}) should be well under half of stereo 192k (${big.length})`);
    fs.unlinkSync(wav.replace(/\.wav$/, '.big.mp3'));
    fs.unlinkSync(wav.replace(/\.wav$/, '.small.mp3'));
  } finally { fs.unlinkSync(wav); }
});
