// web/visual/export.mjs, the parts that run in Node: the offline stream of a song, the title, the frame loop. The
// codecs and the muxers are the browser's; scripts/video.mjs exercises them through the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { streamOf, titleOf, frameCount, renderFrames, drawTitle, LEAD, TAIL } from '../web/visual/export.mjs';
import { clockOf, fallbackScore } from '../web/visual/host.mjs';
import { composeVisual } from '../lib/visual.mjs';
import tunnel from '../web/visual/tunnel.mjs';
import ink from '../web/visual/ink.mjs';

const song = (g) => g.song({ cps: .5, key: 'C:minor', seed: 3 }, [
  g.section('intro', 2, { role: 'establish', pad: { space: .8 }, drums: { density: .3 }, fx: { riser: 1 } }),
  g.section('drop', 2, { role: 'climax', bpm: 60, drums: { density: .9 }, bass: {}, melody: { notes: '0 2 4 7' } }), // 2 bars over 4 song cycles
]);
const ctxStub = () => { const calls = {}, grad = { addColorStop() {} }; return new Proxy({}, { get: (o, k) => (k === 'calls' ? calls : (...a) => { calls[k] = (calls[k] ?? 0) + 1; return String(k).startsWith('create') ? grad : undefined; }), set: () => true }); };

test('streamOf: every part\'s haps, tagged, in song time; a section with its own tempo scaled; a wrapper or plain pattern read whole', async () => {
  const g = await ready;
  const pat = song(g), ev = streamOf(pat);
  assert.ok(ev.length > 20);
  assert.ok(ev.every((e, i) => i === 0 || e.t >= ev[i - 1].t), 'sorted by time');
  assert.ok(ev.some((e) => e.layer === 'drums' && e.voice === 'bd') && ev.some((e) => e.layer === 'melody' && e.note !== null));
  const bass = ev.filter((e) => e.layer === 'bass');
  assert.ok(bass.every((e) => e.cycle >= 2 && e.cycle < 6), 'the drop spans song cycles 2..6');
  assert.ok(Math.abs(bass[0].t - bass[0].cycle / .5) < 1e-9, 'audio time is the song cycle over the song cps');
  const first = ev.find((e) => e.layer === 'drums' && e.cycle >= 2);
  assert.ok(first.dur >= 0.1 && first.dur < 4, 'durations in song cycles');
  const wrapped = g.stack(pat, g.s('hh*4')); wrapped.strudel = pat.strudel;
  const wev = streamOf(wrapped);
  assert.ok(wev.every((e) => e.layer === null) && wev.some((e) => e.voice === 'hh'), 'a wrapper: no parts, the values read');
  const plain = streamOf(g.s('bd sd'), 2);
  assert.deepEqual(plain.map((e) => [e.kind, e.voice, e.t]), [['drums', 'bd', 0], ['drums', 'sd', 1], ['drums', 'bd', 2], ['drums', 'sd', 3]]);
});

test('titleOf: the song name and its first comment line, flags skipped, the name prefix dropped', () => {
  assert.deepEqual(titleOf('demo.strudel', '// @blog\n// demo: intro → verse → drop.\nsong({}, [])'), { name: 'demo', line: 'intro → verse → drop.' });
  assert.deepEqual(titleOf('x.strudel', 'song({}, [])'), { name: 'x', line: '' });
});

test('renderFrames: exactly fps frames per second of lead, song and tail; the clock holds on the last moment through the tail; the title only at the start; deterministic', async () => {
  const g = await ready;
  const pat = song(g), score = composeVisual(pat.strudel), stream = streamOf(pat), seconds = pat.strudel.total / .5;
  const run = async (world) => {
    const ctx = ctxStub(), titles = [], emitted = [];
    const r = await renderFrames({ world, score, stream, seconds, title: { name: 't', line: 'l' }, ctx, w: 640, h: 360, emit: async (k, t) => { emitted.push(k); titles.push(ctx.calls.fillText ?? 0); }, yieldEvery: 1000 });
    return { r, ctx, titles, emitted };
  };
  const { r, titles, emitted } = await run(tunnel);
  assert.equal(r.frames, frameCount(seconds));
  assert.equal(r.frames, Math.ceil((LEAD + seconds + TAIL) * 30));
  assert.deepEqual(emitted.slice(0, 3), [0, 1, 2]);
  assert.ok(titles[5] > 0, 'the title is drawn during the lead');
  assert.equal(titles.at(-1), titles[Math.round((LEAD + 3) * 30)], 'and no more after it fades');
  assert.equal(r.perf.clock.section, 'drop', 'the tail holds the last section');
  assert.equal(r.perf.clock.boundary, false);
  assert.equal(r.perf.pending, 0, 'every event was delivered');
  const a = JSON.stringify((await run(ink)).r.perf.state), b = JSON.stringify((await run(ink)).r.perf.state);
  assert.equal(a, b);
  assert.ok(JSON.parse(a).marks.length > 20, 'ink painted the song');
});

test('a negative cycle is the start, not the end: the title lead and the live clock\'s first lookahead', () => {
  const score = { ...fallbackScore(), total: 8, sections: [{ name: 'a', at: 0, until: 4, bars: 4, energy: 1, riser: 0, dropout: 0 }, { name: 'b', at: 4, until: 8, bars: 4, energy: 1, riser: 0, dropout: 0 }] };
  const c = clockOf(score, -0.15);
  assert.deepEqual([c.section, c.cycle, c.bar], ['a', 0, 0]);
  assert.equal(clockOf(score, 0.1, c).boundary, false);
  const ctx = ctxStub(); drawTitle(ctx, 640, 360, { name: 'n', line: '' }, 0.2); assert.equal(ctx.calls.fillText, 1);
});
