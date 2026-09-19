import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureRows, printMeasure } from '../scripts/measure.mjs';
import { analyze, tone } from '../lib/analyze.mjs';

const rate = 44100;
const stem = (name, frames, opts = {}) => ({ name, metrics: analyze({ rate, channels: 2, frames }, { bands: true, ...opts }) });

test('measureRows: dB under the mix, depth with its inputs, pan per part, and the masking pairs sorted worst first', () => {
  const low = tone(rate, 80, 1), lowToo = tone(rate, 100, 1, .25), high = tone(rate, 5000, 1, .25);
  const mix = low.map((x, i) => x + lowToo[i] + high[i]);
  const { parts, pairs } = measureRows([stem('mix', [mix, mix]), stem('bass', [low, low]), stem('pad', [lowToo, lowToo]), stem('melody', [high.map((x) => x * .2), high])]);
  assert.deepEqual(parts.map((p) => p.name), ['mix', 'bass', 'pad', 'melody']);
  assert.equal(parts[0].depth, null, 'the mix has no depth: it is the reference');
  assert.ok(parts[0].relativeDb < 0 && parts[1].relativeDb < 0 && parts[2].relativeDb < parts[1].relativeDb, JSON.stringify(parts.map((p) => p.relativeDb)));
  for (const p of parts.slice(1)) { assert.ok(p.depth >= 0 && p.depth <= 1); for (const k of ['relativeDb', 'highRatio', 'tail']) assert.ok(k in p, `${k} printed next to depth`); }
  assert.ok(parts[3].meanPan > 0.9 && parts[1].meanPan === 0.5, 'pan per part');
  assert.deepEqual(pairs.map((q) => [q.a, q.b]), [['bass', 'pad'], ['bass', 'melody'], ['pad', 'melody']]);
  assert.ok(pairs[0].low > 0.5 && pairs[1].low < 0.05, 'the two low tones mask each other, the high one masks neither');
  const text = printMeasure({ section: 's', parts, pairs });
  assert.match(text, /^== s: 3 parts/); assert.match(text, /\nbass /); assert.match(text, /bass \/ pad\s+low \d\.\d+/);
});
