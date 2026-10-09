import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { compareTable, silent, cpsOf } from '../scripts/renderall.mjs';
import { writeWav } from '../scripts/analyze.mjs';

const m = (rms, peak, extra = {}) => ({ rms, peak, crest: 10, centroidHz: 1000, highRatio: .1, lowRatio: .3, width: .2, tail: .05, ...extra });

test('compareTable: dB deltas for level, plain deltas for the rest, songs missing on one side skipped', () => {
  const rows = compareTable({ a: m(.1, .5), only: m(.1, .5) }, { a: m(.2, .5, { centroidHz: 1200, tail: .1 }), other: m(.1, .5) });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].song, 'a');
  assert.equal(rows[0].rmsDb, 6);
  assert.equal(rows[0].peakDb, 0);
  assert.equal(rows[0].centroidHz, 200);
  assert.equal(rows[0].tail, .05);
});

test('cpsOf: every header form songs write', () => {
  assert.equal(cpsOf('song({ cps: .55 })'), .55);
  assert.equal(cpsOf('song({ cps: 132 / 240 })'), .55);
  assert.equal(cpsOf('const CPS = 58 / 240;\nsong({ cps: CPS })'), 58 / 240);
  assert.equal(cpsOf('song({ bpm: 120 })'), .5);
  assert.equal(cpsOf('setcps(0.533)'), .533);
  assert.equal(cpsOf('s("bd")'), .5);
});

test('silent: a wav of zeros is silent, one sample is not', () => {
  const tmp = path.resolve(import.meta.dirname, '_t_silent.wav');
  try {
    writeWav(tmp, 44100, [new Float32Array(1000), new Float32Array(1000)]);
    assert.equal(silent(fs.readFileSync(tmp)), true);
    const l = new Float32Array(1000); l[500] = .5;
    writeWav(tmp, 44100, [l, new Float32Array(1000)]);
    assert.equal(silent(fs.readFileSync(tmp)), false);
  } finally { fs.rmSync(tmp, { force: true }); }
});
