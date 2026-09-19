import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { writeWav } from '../scripts/analyze.mjs';
import { tone } from '../lib/analyze.mjs';
import { wavToMp3 } from '../scripts/mp3.mjs';
import { encodeMp3 } from '../web/mp3.mjs';

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

test('a quiet signal survives the encoder: lamejs mis-encodes a call carrying more than one frame, and quiet content vanishes', () => {
  // no decoder in Node: a CBR frame of near-silence is mostly zero padding, a frame carrying the tone is Huffman data
  const t = tone(44100, 440, 3).map((s) => s * 0.1);
  const mp3 = encodeMp3([t, t], 44100, { kbps: 96 });
  const zeros = mp3.reduce((n, b) => n + (b === 0), 0) / mp3.length;
  assert.ok(zeros < 0.3, `${Math.round(zeros * 100)}% zero bytes: the tone was encoded as silence`);
});
