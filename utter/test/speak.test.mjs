// speak(): the cache, the retry loop and the rule that one attempt has really stopped before the next begins.
// Every synth here is a fake; nothing touches the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { speak, wordsOf, cacheKey, estimateCost, BACKOFF_MS, FORMAT } from '../speak.mjs';
import { wavOf } from './_wav.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'utter-'));
const tick = (word, at, len, type = 'WordBoundary') => ({ text: word, offset: at * 1e7, duration: len * 1e7, type });
const BOUNDS = [tick('hold', .1, .2), tick(',', .3, .05, 'PunctuationBoundary'), tick('on', .4, .25)];
const good = (wav = wavOf(1), boundaries = BOUNDS) => async () => ({ wav, boundaries });
const noSleep = () => Promise.resolve();
const failing = (msg) => async () => { throw new Error(msg); };
/** A synth that runs each fake in turn, one per attempt, and counts the calls. */
const sequence = (...fakes) => { const f = async (ssml, o) => fakes[Math.min(f.calls++, fakes.length - 1)](ssml, o); f.calls = 0; return f; };
/** A fake that only ends when aborted, taking `ms` to clean up first; `log` records the order of events. */
const stalls = (log, ms = 0) => (ssml, { signal }) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => { log.push('abort'); setTimeout(() => { log.push('stopped'); reject(new Error('aborted')); }, ms); });
});

test('wordsOf: spoken words only, end is start plus duration', () => {
  assert.deepEqual(wordsOf(BOUNDS), [{ text: 'hold', start: .1, end: .3 }, { text: 'on', start: .4, end: .65 }]);
});

test('a live call returns the wav, its words, and what it cost', async () => {
  const r = await speak({ text: 'hold, on' }, { synth: good(wavOf(1.5)) });
  assert.equal(r.words.length, 2);
  assert.equal(r.seconds, 1.5);
  assert.equal(r.rate, 48000);
  assert.equal(r.chars, 8);
  assert.equal(r.cost, estimateCost(8));
  assert.equal(r.spent, r.cost);
  assert.equal(r.cached, false);
  assert.equal(r.voice, 'en-US-AndrewMultilingualNeural');
  assert.match(r.ssml, /^<speak /);
  assert.equal(estimateCost(1e6), 15);
});

test('no word boundaries is an error, not an empty result', async () => {
  await assert.rejects(speak({ text: 'x' }, { synth: good(wavOf(1), [tick('.', 0, .1, 'PunctuationBoundary')]) }), /no word boundaries/);
});

test('a result that is not a wav is refused', async () => {
  await assert.rejects(speak({ text: 'x' }, { synth: good(Buffer.from('not audio')) }), /wav/);
});

test('words that do not fit the audio are refused, and never cached', async () => {
  const cacheDir = tmp();
  await assert.rejects(speak({ text: 'x' }, { synth: good(wavOf(1), [tick('a', .2, .3), tick('b', .6, 2)]), cacheDir }), /outside the 1 s of audio/);
  await assert.rejects(speak({ text: 'x' }, { synth: good(wavOf(1), [tick('a', .2, 0)]), cacheDir }), /no duration/);
  assert.deepEqual(fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [], []);
});

test('each transient failure is retried', async () => {
  for (const msg of ['No free synthesizer', 'websocket error code: 1013', 'StatusCode: 1006', 'Unable to contact server', '429', 'Too Many Requests', 'ResourceExhausted']) {
    const synth = sequence(failing(msg), good());
    const r = await speak({ text: 'x' }, { synth, sleep: noSleep });
    assert.equal(synth.calls, 2, msg);
    assert.equal(r.words.length, 2, msg);
  }
});

test('a real error is not retried', async () => {
  const synth = sequence(failing('Invalid voice name'), good());
  await assert.rejects(speak({ text: 'x' }, { synth, sleep: noSleep }), /Invalid voice name/);
  assert.equal(synth.calls, 1);
});

test('retries follow the backoff list and then give up', async () => {
  assert.deepEqual(BACKOFF_MS, [2000, 5000, 10000, 20000, 60000, 120000]);
  const waits = [], synth = sequence(failing('429'));
  await assert.rejects(speak({ text: 'x' }, { synth, sleep: async (ms) => { waits.push(ms); } }), /429/);
  assert.deepEqual(waits, BACKOFF_MS);
  assert.equal(synth.calls, BACKOFF_MS.length + 1);
});

test('a timed-out attempt has finished stopping before the next attempt starts', async () => {
  const log = [];
  const synth = sequence(stalls(log, 50), async () => { log.push('attempt2'); return { wav: wavOf(1), boundaries: BOUNDS }; });
  const r = await speak({ text: 'x' }, { synth, timeoutMs: 20, sleep: noSleep });
  assert.deepEqual(log, ['abort', 'stopped', 'attempt2']);
  assert.equal(r.words.length, 2);
});

test('what an abandoned attempt produces late never reaches the result', async () => {
  const late = (ssml, { signal }) => new Promise((resolve) => {
    signal.addEventListener('abort', () => setTimeout(() => resolve({ wav: wavOf(3), boundaries: [tick('LATE', 0, 1)] }), 10)); // settles after abort, with a result
  });
  const r = await speak({ text: 'x' }, { synth: sequence(late, good()), timeoutMs: 20, sleep: noSleep });
  assert.deepEqual(r.words.map((w) => w.text), ['hold', 'on']);
  assert.equal(r.seconds, 1);
});

test('an attempt that will not stop ends the call: no overlapping retry', async () => {
  const never = () => new Promise(() => {}); // ignores the abort entirely
  const synth = sequence(never, good());
  await assert.rejects(speak({ text: 'x' }, { synth, timeoutMs: 20, stopGraceMs: 30, sleep: noSleep }), /could not stop/);
  assert.equal(synth.calls, 1);
});

test('a timeout with no retries left says so', async () => {
  await assert.rejects(speak({ text: 'x' }, { synth: stalls([]), timeoutMs: 20, backoff: [], sleep: noSleep }), /timed out/);
});

test('cache: a repeat call makes no call and returns the same bytes and words', async () => {
  const cacheDir = tmp(), synth = sequence(good());
  const a = await speak({ text: 'x' }, { synth, cacheDir });
  const b = await speak({ text: 'x' }, { synth, cacheDir });
  assert.equal(synth.calls, 1);
  assert.equal(b.cached, true);
  assert.equal(b.spent, 0);
  assert.equal(b.cost, a.cost, 'the character cost is still reported as information');
  assert.ok(b.wav.equals(a.wav));
  assert.deepEqual(b.words, a.words);
  assert.equal(b.key, a.key);
});

test('cache: anything that changes the audio is a different entry', async () => {
  const cacheDir = tmp(), synth = sequence(good());
  await speak({ text: 'x' }, { synth, cacheDir });
  await speak({ text: 'x', rate: '-10%' }, { synth, cacheDir });
  await speak({ text: 'x' }, { synth, cacheDir, region: 'westeurope' });
  assert.equal(synth.calls, 3);
  assert.notEqual(cacheKey({ ssml: 'a', format: FORMAT, region: 'r' }), cacheKey({ ssml: 'a', format: 'Riff24Khz16BitMonoPcm', region: 'r' }));
});

test('cache: an incomplete or damaged entry is a miss, never a hit', async () => {
  for (const damage of [
    (d, k) => fs.unlinkSync(path.join(d, k + '.json')),
    (d, k) => fs.unlinkSync(path.join(d, k + '.wav')),
    (d, k) => fs.writeFileSync(path.join(d, k + '.wav'), fs.readFileSync(path.join(d, k + '.wav')).subarray(0, 100)),
    (d, k) => fs.writeFileSync(path.join(d, k + '.json'), '{ not json'),
  ]) {
    const cacheDir = tmp(), synth = sequence(good());
    const a = await speak({ text: 'x' }, { synth, cacheDir });
    damage(cacheDir, a.key);
    const b = await speak({ text: 'x' }, { synth, cacheDir });
    assert.equal(b.cached, false);
    assert.equal(synth.calls, 2);
  }
});

test('fresh: synthesizes despite a valid entry, and replaces it whole', async () => {
  const cacheDir = tmp(), synth = sequence(good(wavOf(1)), good(wavOf(2), [tick('new', .1, .2)]));
  const a = await speak({ text: 'x' }, { synth, cacheDir });
  const b = await speak({ text: 'x' }, { synth, cacheDir, fresh: true });
  assert.equal(synth.calls, 2);
  assert.equal(b.cached, false);
  const c = await speak({ text: 'x' }, { synth: failing('should not be called'), cacheDir });
  assert.equal(c.cached, true);
  assert.equal(c.seconds, 2, 'the wav is the fresh attempt\'s');
  assert.deepEqual(c.words.map((w) => w.text), ['new'], 'and so are the words');
  assert.deepEqual(fs.readdirSync(cacheDir).sort(), [a.key + '.json', a.key + '.wav'], 'nothing left behind');
});

test('fresh: a failed synthesis leaves the old entry exactly as it was', async () => {
  const cacheDir = tmp();
  const a = await speak({ text: 'x' }, { synth: good(), cacheDir });
  const before = ['.wav', '.json'].map((e) => fs.readFileSync(path.join(cacheDir, a.key + e)));
  await assert.rejects(speak({ text: 'x' }, { synth: failing('Invalid voice name'), cacheDir, fresh: true }), /Invalid voice/);
  ['.wav', '.json'].forEach((e, i) => assert.ok(fs.readFileSync(path.join(cacheDir, a.key + e)).equals(before[i]), e));
});

test('no cacheDir: nothing is written', async () => {
  const cwd = tmp(), was = process.cwd();
  process.chdir(cwd);
  try { await speak({ text: 'x' }, { synth: good() }); } finally { process.chdir(was); }
  assert.deepEqual(fs.readdirSync(cwd), []);
});
