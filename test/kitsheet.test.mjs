import test from 'node:test';
import assert from 'node:assert/strict';
import { kitVoices, sheetSource, kitTable } from '../scripts/kitsheet.mjs';

const map = { RolandTR909_bd: ['a/bd.wav'], RolandTR909_sd: ['a/sd.wav'], RolandTR909_hh: ['a/hh.wav'], Tiny_bd: ['t/bd.wav'] };
test('kitVoices lists what the map has, in KIT_VOICES order', () => {
  assert.deepEqual(kitVoices(map, 'RolandTR909'), ['bd', 'sd', 'hh']);
  assert.deepEqual(kitVoices(map, 'Tiny'), ['bd']);
});
test('sheetSource: one two-bar section per kit, only its voices, bar lines in the template', () => {
  const src = sheetSource(['RolandTR909', 'Tiny'], map);
  assert.match(src, /section\('RolandTR909', 2, \{ kit: 'RolandTR909', drums: \{ template: \{ bd: '[^']+\|[^']+', sd: /);
  assert.match(src, /section\('Tiny', 2, \{ kit: 'Tiny', drums: \{ template: \{ bd: '[^']+' \}/);
  assert.doesNotMatch(src, /Tiny'[^\n]*hh:/);
});
test('kitTable: rate/bits/seconds from meta, rms spread, songs using it', () => {
  const meta = { 'a/bd.wav': { seconds: .5, rms: -10, peak: -3, rate: 44100, bits: 16 }, 'a/sd.wav': { seconds: .3, rms: -14, peak: -4, rate: 44100, bits: 16 }, 'a/hh.wav': { seconds: .1, rms: -20, peak: -8, rate: 22050, bits: 8 } };
  const [row] = kitTable(['RolandTR909'], map, meta, { RolandTR909: ['x.strudel'] });
  assert.equal(row.rate, '22050-44100'); assert.equal(row.bits, '8-16'); assert.equal(row.rmsSpread, 10); assert.deepEqual(row.songs, ['x.strudel']);
});
test('kitTable: float files read as 32 in the range and print 32f', () => {
  const m = { K_bd: ['k/a.wav'], K_sd: ['k/b.wav'] };
  const meta = { 'k/a.wav': { seconds: 1, rms: -10, rate: 48000, bits: '32f' }, 'k/b.wav': { seconds: 1, rms: -10, rate: 48000, bits: 24 } };
  assert.equal(kitTable(['K'], m, meta, {})[0].bits, '24-32f');
  assert.equal(kitTable(['K'], { K_bd: ['k/a.wav'] }, meta, {})[0].bits, '32f');
});
