import test from 'node:test';
import assert from 'node:assert/strict';
import { guessVoice, hitFeatures, words, bucket, EDGES } from '../lib/hitwords.mjs';

test('guessVoice: the specific word wins, map file strings work, nothing fits is other', () => {
  assert.equal(guessVoice('RolandTR909/rolandtr909-bd/Bassdrum-01.wav'), 'bd');
  assert.equal(guessVoice('rock-snare-kick'), 'bd'); // "rock snare" is the kit's name, the kick rule runs before the snare rule
  assert.equal(guessVoice('jazz-hh-open'), 'oh');
  assert.equal(guessVoice('crate_rim'), 'rim');
  assert.equal(guessVoice('Passerine_hihat'), 'hh');
  assert.equal(guessVoice('tom-lo'), 'mt');
  assert.equal(guessVoice('tambourine'), 'other');
});

test('hitFeatures and words on a synthetic kick: a click with a short deep decay reads tight deep click, all low', () => {
  const rate = 44100, n = rate, x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.sin(2 * Math.PI * 60 * i / rate) * Math.exp(-i / (rate * .03)); // 60 Hz, 30 ms time constant
  const f = hitFeatures({ rate, channels: 1, frames: [x] });
  assert.ok(f.attackMs < 10, `attack ${f.attackMs}`);
  assert.ok(f.decayMs < 150 && f.decayMs > 20, `decay ${f.decayMs}`);
  assert.ok(f.centroidHz < 150, `centroid ${f.centroidHz}`);
  assert.ok(f.low > .9, `low ${f.low}`);
  assert.equal(bucket(f, EDGES.bd), 'tight · deep');
  assert.match(words(f, 'bd'), /^tight deep (click|snap), all low, dull, tonal$/);
});
