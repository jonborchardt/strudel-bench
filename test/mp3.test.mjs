import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeWav, synth } from '../scripts/analyze.mjs';
import { wavToMp3 } from '../scripts/mp3.mjs';

test('wavToMp3 writes an mp3 next to the wav', () => {
  const wav = path.join(import.meta.dirname, '_t_tone.wav');
  const tone = synth.tone(44100, 440, 1);
  writeWav(wav, 44100, [tone, tone]);
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
