import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileList } from '../scripts/samples.mjs';

test('fileList handles string, array, and note-map values and skips _base', () => {
  const json = {
    _base: 'https://x/',
    a: 'a/one.wav',
    b: ['b/1.wav', 'b/2.wav'],
    piano: { A0: 'A0v8.mp3', C1: 'C1v8.mp3' },
  };
  assert.deepEqual(fileList(json).sort(), ['A0v8.mp3', 'C1v8.mp3', 'a/one.wav', 'b/1.wav', 'b/2.wav']);
});
