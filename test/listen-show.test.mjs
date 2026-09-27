// web/listen/show.mjs: the listen page's core. The audio element's clock becomes the song's, one stream feeds every
// world on show, and a scrub replays the song rather than starting the world over. No DOM here, as in the world tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { streamOf } from '../web/visual/export.mjs';
import { createShow, loadWorlds, parseHash, formatHash, WORLD_NAMES } from '../web/listen/show.mjs';
import tunnel from '../web/visual/tunnel.mjs';
import sediment from '../web/visual/sediment.mjs';

const songOf = (g) => g.song({ cps: .5, key: 'C:minor', seed: 3 }, [
  g.section('intro', 4, { role: 'establish', pad: { space: .8 }, drums: { density: .4 }, fx: { riser: 1 } }),
  g.section('drop', 4, { role: 'climax', bpm: 60, drums: { density: .9 }, bass: {}, melody: { notes: '0 2 4 7' } }),
]);
const dataOf = (g) => { const pat = songOf(g); return { score: composeVisual(pat.strudel), stream: streamOf(pat) }; };
// the page's frame loop, at a steady 60 fps
const through = (show, T) => { show.seek(0); for (let k = 1; k / 60 <= T + 1e-12; k++) show.at(k / 60); return show; };
const json = (x) => JSON.stringify(x, (k, v) => (typeof v === 'number' ? +v.toFixed(9) : v));

test('the audio clock becomes the song cycle, clamped at both ends', async () => {
  const g = await ready, { score, stream } = dataOf(g);
  const show = createShow({ score, stream, worlds: { tunnel } });
  const seconds = score.total / score.cps;
  show.seek(0);
  assert.equal(show.clock.cycle, 0);
  show.at(seconds / 2);
  assert.equal(show.clock.section, score.sections[1].name, 'half way in is the second section');
  show.seek(seconds + 30); // the mp3's reverb tail, or a scrub past the end
  assert.ok(show.clock.cycle < score.total && show.clock.section === score.sections[1].name, 'the end holds, never wraps to bar 1');
  show.seek(-5);
  assert.equal(show.clock.cycle, 0, 'before the start is the start');
});

test('seek: reproducible, equivalent to a play-through, and not a fresh start', async () => {
  const g = await ready, { score, stream } = dataOf(g);
  const T = 11.6;
  const a = createShow({ score, stream, worlds: { sediment } }).seek(T);
  const b = createShow({ score, stream, worlds: { sediment } }).seek(T);
  assert.equal(json(a.state ?? a.clock), json(b.state ?? b.clock), 'the same seek twice is the same moment');
  assert.deepEqual(a.clock, b.clock);
  const played = through(createShow({ score, stream, worlds: { sediment } }), T);
  // not bit-identity: an event exactly on a step boundary can land one 1/60 step either side of where a 60 fps
  // play-through put it, which diverges the seeded rng. What must match is the musical moment and the work done.
  assert.deepEqual(a.clock, played.clock, 'the same section, bar and beat');
  assert.equal(a.pending, played.pending, 'the same events have fired');
  const cold = createShow({ score, stream, worlds: { sediment } }).seek(0);
  assert.notEqual(a.pending, cold.pending, 'a seek replays the song, it does not start the world over');
});

test('one stream, many worlds: each world sees what it would see alone, and a world added late catches up', async () => {
  const g = await ready, { score, stream } = dataOf(g);
  const solo = through(createShow({ score, stream, worlds: { tunnel } }), 6);
  const both = through(createShow({ score, stream, worlds: { tunnel, sediment } }), 6);
  assert.deepEqual(both.names, ['tunnel', 'sediment']);
  assert.equal(both.pending, solo.pending, 'the same stream, consumed once per world');
  const late = createShow({ score, stream, worlds: { tunnel } });
  through(late, 6);
  late.add('sediment', sediment).seek(6);
  assert.ok(late.has('sediment') && late.names.length === 2);
  assert.equal(late.pending, solo.pending, 'the late world was caught up to the same moment');
  late.drop('tunnel');
  assert.deepEqual(late.names, ['sediment']);
});

test('loadWorlds: every world named in lib/visual.json loads by name and has the world shape', async () => {
  assert.ok(WORLD_NAMES.length >= 17, WORLD_NAMES.join(' '));
  const worlds = await loadWorlds([...WORLD_NAMES, 'not-a-world']);
  assert.deepEqual(Object.keys(worlds), WORLD_NAMES, 'every name resolves, an unknown one is skipped');
  for (const [n, w] of Object.entries(worlds))
    for (const k of ['name', 'init', 'step', 'draw']) assert.ok(w?.[k], `${n} has no ${k}`);
});

test('parseHash / formatHash: the share link is the whole state', () => {
  assert.deepEqual(parseHash('#demo.strudel'), { song: 'demo.strudel', mode: 'single', worlds: [] });
  assert.deepEqual(parseHash('#demo.strudel&w=train'), { song: 'demo.strudel', mode: 'single', worlds: ['train'] });
  assert.deepEqual(parseHash('#demo.strudel&ab=train,rave'), { song: 'demo.strudel', mode: 'ab', worlds: ['train', 'rave'] });
  assert.deepEqual(parseHash('#demo.strudel&grid'), { song: 'demo.strudel', mode: 'grid', worlds: [] });
  assert.deepEqual(parseHash(''), { song: null, mode: 'single', worlds: [] });
  assert.deepEqual(parseHash('#demo.strudel&nonsense=1'), { song: 'demo.strudel', mode: 'single', worlds: [] }, 'an unknown key is ignored');
  for (const v of [{ song: 'a.strudel', mode: 'single', worlds: [] }, { song: 'a.strudel', mode: 'single', worlds: ['ink'] },
    { song: 'a.strudel', mode: 'ab', worlds: ['ink', 'loom'] }, { song: 'a.strudel', mode: 'grid', worlds: [] }])
    assert.deepEqual(parseHash(formatHash(v)), v, JSON.stringify(v));
});
