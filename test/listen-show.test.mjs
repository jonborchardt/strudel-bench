// web/listen/show.mjs: the listen page's core. The audio element's clock becomes the song's, one stream feeds every
// world on show, and a scrub replays the song rather than starting the world over. No DOM here, as in the world tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';
import { composeVisual } from '../lib/visual.mjs';
import { streamOf } from '../web/visual/export.mjs';
import { createShow, loadWorlds, tileGrid, parseHash, formatHash, WORLD_NAMES } from '../web/listen/show.mjs';
import tunnel from '../web/visual/tunnel.mjs';
import sediment from '../web/visual/sediment.mjs';

const songOf = (g, visual) => g.song({ cps: .5, key: 'C:minor', seed: 3, ...(visual ? { visual } : {}) }, [
  g.section('intro', 4, { role: 'establish', pad: { space: .8 }, drums: { density: .4 }, fx: { riser: 1 } }),
  g.section('drop', 4, { role: 'climax', bpm: 60, drums: { density: .9 }, bass: {}, melody: { notes: '0 2 4 7' } }),
]);
const dataOf = (g, visual) => { const pat = songOf(g, visual); return { score: composeVisual(pat.strudel), stream: streamOf(pat) }; };
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

test('seek: the replay is capped, so a long song and seventeen worlds cannot freeze the page', async () => {
  const g = await ready, { score, stream } = dataOf(g);
  // a world that only counts its steps: what a seek costs is the number of world.step calls, and nothing else here
  const counter = () => { const c = { steps: 0 }; c.world = { name: 'count', init: () => ({}), step: () => { c.steps++; }, draw: () => {} }; return c; };
  const near = counter(), far = counter();
  createShow({ score, stream, worlds: { count: near.world } }).seek(10);
  createShow({ score, stream, worlds: { count: far.world } }).seek(600); // a scrub ten minutes into a long song
  assert.ok(far.steps < 1200, `${far.steps} steps: a replay must be bounded, not the whole song up to the seek`);
  assert.ok(far.steps <= near.steps * 2, `ten minutes in cost ${far.steps} steps against ${near.steps} at ten seconds`);
  // and the cap does not change a seek inside it: the short song still replays whole, events and all
  const whole = counter();
  const show = createShow({ score, stream, worlds: { count: whole.world } }).seek(10);
  assert.equal(whole.steps, 601, 'ten seconds is 600 steps plus the one that lands on second 0');
  assert.equal(show.pending, stream.filter((e) => e.t > 10).length, 'and everything up to the seek has fired, with the rest still queued');
});

test('a world is handed an event just before it is due, never the whole song at once', async () => {
  const g = await ready, { score, stream } = dataOf(g);
  // host.mjs re-sorts everything still queued on every frame, so a deep queue costs per step what the world does not.
  // Keeping it shallow is the whole reason seventeen worlds can be stepped at once; nothing else here depends on it.
  const show = createShow({ score, stream, worlds: { tunnel } });
  show.seek(0);
  let deepest = 0;
  for (let k = 1; k / 60 <= score.total / score.cps; k++) { show.at(k / 60); deepest = Math.max(deepest, show.queued); }
  assert.ok(deepest <= 8, `the host queue reached ${deepest} of ${stream.length} events; it must stay shallow`);
  assert.equal(show.pending, 0, 'and by the end every event has been delivered');
});

test('loadWorlds: every world named in lib/visual.json loads by name and has the world shape', async () => {
  assert.ok(WORLD_NAMES.length >= 17, WORLD_NAMES.join(' '));
  const worlds = await loadWorlds([...WORLD_NAMES, 'not-a-world']);
  assert.deepEqual(Object.keys(worlds), WORLD_NAMES, 'every name resolves, an unknown one is skipped');
  for (const [n, w] of Object.entries(worlds))
    for (const k of ['name', 'init', 'step', 'draw']) assert.ok(w?.[k], `${n} has no ${k}`);
});

test('tileGrid: the wall fills its width in 16:9 boxes, and the awkward counts still fit', () => {
  const wide = tileGrid(18, 1300, { gap: 8, min: 230 });
  assert.equal(wide.cols, 5);
  assert.equal(wide.rows, 4, '18 in 5 columns is four rows, the last one short');
  assert.ok(Math.abs(wide.tw * 5 + 8 * 4 - 1300) < 1e-9, 'the columns and the gaps between them are the whole width');
  assert.ok(Math.abs(wide.th - (wide.tw * 9) / 16) < 1e-9, 'every box is 16:9');
  assert.equal(wide.at(0).x, 0);
  assert.equal(wide.at(5).y, wide.th + 8, 'the sixth box starts the second row');
  assert.ok(Math.abs(wide.at(4).x + wide.tw - 1300) < 1e-9, 'the last column ends flush');
  assert.equal(tileGrid(18, 1300, { cols: 1 }).cols, 1, 'one column when the view asks for one');
  assert.equal(tileGrid(1, 1300).cols, 1, 'never more columns than there are boxes');
  assert.equal(tileGrid(18, 200, { min: 230 }).cols, 1, 'a width under the minimum is one column, not zero');
  assert.equal(tileGrid(0, 1300).rows, 1, 'no boxes still describes one row rather than dividing by zero');
  assert.ok(tileGrid(18, 1300).height > 0 && Number.isFinite(tileGrid(18, 1300).height));
});

test('parseHash / formatHash: the share link is the whole state', () => {
  assert.deepEqual(parseHash('#demo.strudel'), { song: 'demo.strudel', mode: 'single', worlds: [] });
  assert.deepEqual(parseHash('#demo.strudel&w=train'), { song: 'demo.strudel', mode: 'single', worlds: ['train'] });
  assert.deepEqual(parseHash('#demo.strudel&ab=train,rave'), { song: 'demo.strudel', mode: 'single', worlds: [] }, 'a link from when there was a comparison mode degrades to the song');
  assert.deepEqual(parseHash('#demo.strudel&grid'), { song: 'demo.strudel', mode: 'grid', worlds: [] });
  assert.deepEqual(parseHash(''), { song: null, mode: 'single', worlds: [] });
  assert.deepEqual(parseHash('#demo.strudel&nonsense=1'), { song: 'demo.strudel', mode: 'single', worlds: [] }, 'an unknown key is ignored');
  for (const v of [{ song: 'a.strudel', mode: 'single', worlds: [] }, { song: 'a.strudel', mode: 'single', worlds: ['ink'] },
    { song: 'a.strudel', mode: 'grid', worlds: [] }])
    assert.deepEqual(parseHash(formatHash(v)), v, JSON.stringify(v));
});
