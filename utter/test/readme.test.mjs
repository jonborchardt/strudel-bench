// The README is the package's promise, so its examples are run and its parameter table is checked against PARAMS.
// The examples run against a fake synthesizer: nothing here reaches Azure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as utter from '../index.mjs';
import { wavOf } from './_wav.mjs';

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const AsyncFunction = (async () => {}).constructor;
const fakeSynth = async (ssml) => {
  const words = ssml.replace(/<[^>]*>/g, ' ').trim().split(/\s+/);
  return { wav: wavOf(words.length * .3 + .2), boundaries: words.map((text, i) => ({ text, offset: (.1 + i * .3) * 1e7, duration: .25e7, type: 'WordBoundary' })) };
};

test('every parameter is in the README table', () => {
  for (const name of Object.keys(utter.PARAMS)) assert.match(README, new RegExp('^\\| `' + name + '` \\|', 'm'), `${name} has no row`);
});

test('every js example runs', async () => {
  const blocks = [...README.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.ok(blocks.length >= 3, `expected several examples, found ${blocks.length}`);
  const api = { ...utter, speak: (spec, opts = {}) => utter.speak(spec, { ...opts, synth: opts.synth ?? fakeSynth, cacheDir: undefined }), console: { log() {} } };
  for (const code of blocks) {
    const body = code.replace(/^import .*$/gm, '');
    await new AsyncFunction(...Object.keys(api), body)(...Object.values(api)).catch((e) => assert.fail(`${e.message}\n--- in:\n${code}`));
  }
});

test('the example that shows a fake synth does not itself need Azure', () => {
  const block = [...README.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]).find((b) => b.includes('synth: fake'));
  assert.ok(block, 'the example exists');
  assert.equal(block.match(/\bspeak\(/g).length, 1, 'one call, and it is the one given the fake');
});

test('it says what must be said, and holds no key', () => {
  for (const must of ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION', 'estimate', 'not a musical note', 'canonical']) assert.ok(README.includes(must), must);
  assert.ok(!/\b[0-9a-f]{32}\b/i.test(README) && !/\b[A-Za-z0-9]{60,}\b/.test(README), 'nothing that looks like a key');
});
