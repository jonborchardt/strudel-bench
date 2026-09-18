import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSamples } from '../lib/packs.mjs';
import { soundBehind, createSampleCache, createPreviewer } from '../web/preview.mjs';

// a decoded buffer's stand-in: the cache only ever reads channel 0, the rate and the duration
const buffer = () => ({ getChannelData: () => new Float32Array(2048), sampleRate: 22050, duration: 1 });
function cacheWith(map = { loop: { data: { samples: ['u/loop.wav'] } } }) {
  const urls = [];
  const cache = createSampleCache({
    soundMap: () => map,
    decode: async () => buffer(),
    fetchUrl: async (url) => { urls.push(url); return new ArrayBuffer(8); },
  });
  return { cache, urls };
}

test('bufferOf decodes once per sound and does not poison the cache on failure', async () => {
  const { cache, urls } = cacheWith();
  const a = await cache.bufferOf('loop'), b = await cache.bufferOf('loop');
  assert.equal(a, b, 'the same buffer comes back');
  assert.deepEqual(urls, ['u/loop.wav'], 'one fetch');
  await assert.rejects(cache.bufferOf('nope'), /no file behind "nope"/);
  await assert.rejects(cache.bufferOf('nope'), /no file behind "nope"/, 'a failed decode is forgotten, so a later call retries');
});

test('a sample definition resolves to the pack sound behind it, variant kept', async () => {
  registerSamples({ p: { sounds: { loop: ['u/loop.wav'] }, samples: { 'loop-kick': { sound: 'loop', end: .0625 } } } });
  try {
    assert.equal(soundBehind('loop-kick'), 'loop');
    assert.equal(soundBehind('loop-kick:1'), 'loop:1');
    assert.equal(soundBehind('kick'), 'kick', 'no definition: the name itself');
    const { cache, urls } = cacheWith();
    await cache.bufferOf('loop-kick');
    await cache.bufferOf('loop-kick:1');
    assert.deepEqual(urls, ['u/loop.wav', 'u/loop.wav'], "the definition's sound is what there is a file for");
  } finally { registerSamples({}); }
});

test('peaks and tempo are computed once per key, and again after forget', async () => {
  const { cache } = cacheWith();
  const buf = await cache.bufferOf('loop');
  const p = cache.peaksOf(buf, 'loop', 16), t = cache.tempoOf(buf, 'loop', 0, 1);
  assert.equal(cache.peaksOf(buf, 'loop', 16), p, 'cached');
  assert.equal(cache.tempoOf(buf, 'loop', 0, 1), t, 'cached');
  assert.notEqual(cache.peaksOf(buf, 'loop', 32), p, 'another width is another key');
  assert.notEqual(cache.tempoOf(buf, 'loop', 0, .5), t, 'another region is another key');
  cache.forget('loop');
  assert.notEqual(cache.peaksOf(buf, 'loop', 16), p, 'the file behind the name changed: so do its peaks');
  assert.notEqual(cache.tempoOf(buf, 'loop', 0, 1), t, 'and its detection');
});

function previewer() {
  const said = [], calls = { cps: [], patterns: [], hush: 0 };
  const pv = createPreviewer({
    ready: Promise.resolve({ setCps: (c) => calls.cps.push(c), setPattern: (p) => calls.patterns.push(p) }),
    status: (t) => said.push(t),
    hush: () => calls.hush++,
    resume: async () => {},
    gain: (p) => p,
    storage: null,
  });
  return { pv, said, calls };
}
const fakeBtn = () => { const on = new Set(); return { classList: { add: (c) => on.add(c), remove: (c) => on.delete(c), contains: (c) => on.has(c) } }; };

test('preview: one button at a time, the same button again stops it', async () => {
  const { pv, said, calls } = previewer();
  const btn = fakeBtn();
  assert.equal(pv.level, 1, 'no storage: x1');
  await pv.preview(btn, () => ({ pattern: {}, cps: .5, what: 'x', cycles: 1 }));
  assert.ok(btn.classList.contains('on'));
  assert.equal(pv.button, btn);
  assert.deepEqual(calls.cps, [.5]);
  assert.equal(calls.patterns.length, 1);
  assert.equal(said.at(-1), 'hearing x');
  await pv.preview(btn);
  assert.ok(!btn.classList.contains('on'), 'the button goes quiet');
  assert.equal(pv.button, null);
  assert.ok(calls.hush > 0, 'and the sound stops');
});

test('preview: a build that throws says why and leaves no button on', async () => {
  const { pv, said } = previewer();
  const btn = fakeBtn();
  await pv.preview(btn, () => { throw new Error('pick a sample first'); });
  assert.equal(said.at(-1), 'pick a sample first');
  assert.ok(!btn.classList.contains('on'));
  assert.equal(pv.button, null);
});

test('the preview level is said in the status and only when it is not x1', async () => {
  const { pv, said } = previewer();
  pv.setLevel(2);
  assert.equal(pv.level, 2);
  await pv.preview(fakeBtn(), () => ({ pattern: {}, cps: .5, what: 'x' }));
  assert.equal(said.at(-1), 'hearing x at x2');
  pv.stop();
  assert.equal(pv.button, null);
});
