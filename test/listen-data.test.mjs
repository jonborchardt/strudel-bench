// scripts/listen.mjs: the listen page's per-song data. A song() file carries its own score and length; a plain file
// has neither, so the fallback score and the tempo its setcps() asks for are what keep its visuals on the audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { showData } from '../scripts/listen.mjs';

const song = (f) => path.join(import.meta.dirname, '..', 'songs', f);

test('showData: a song() file gives its score, its stream in song time, and its own length', async () => {
  const d = await showData(song('demo.strudel'));
  assert.equal(d.song, 'demo.strudel');
  assert.equal(d.title.name, 'demo');
  assert.ok(d.score.world && d.score.cps > 0 && d.score.sections.length > 1, 'a real score');
  assert.ok(d.stream.length > 50, `only ${d.stream.length} events`);
  assert.ok(d.stream.every((e, i) => i === 0 || e.t >= d.stream[i - 1].t), 'sorted by audio time');
  assert.ok(d.stream.every((e) => e.t >= 0 && e.kind && 'gain' in e && 'pan' in e), 'every event has its time, kind and controls');
  assert.ok(d.stream.every((e) => e.t === Math.round(e.t * 1e4) / 1e4), 'times rounded to 4 decimals');
  assert.ok(Math.abs(d.seconds - d.score.total / d.score.cps) < 0.01, 'seconds is the song length');
});

test('showData: a file with no song() gets the fallback score at the tempo it sets, cut at `cycles`', async () => {
  const d = await showData(song('euclid.strudel'), { cycles: 8 });
  assert.ok(Math.abs(d.score.cps - 0.533) < 1e-9, `euclid.strudel's own setcps, not the 0.5 default (got ${d.score.cps})`);
  assert.equal(d.score.total, 8, 'the cut stands in for a length the file does not have');
  assert.equal(d.score.world, 'tunnel', 'the fallback identity');
  assert.ok(d.stream.length > 8, `only ${d.stream.length} events`);
  assert.ok(d.stream.every((e) => e.t <= 8 / 0.533 + 0.01), 'no event past the cut, in seconds at the file\'s own tempo');
  assert.ok(d.stream.some((e) => e.kind === 'drums'), 'a plain pattern still classifies its hits');
});

test('showData: a song that does not evaluate throws, with the source of the trouble in the message', async () => {
  const bad = path.join(import.meta.dirname, '..', 'songs', '_t_broken.strudel');
  const fs = await import('node:fs');
  fs.writeFileSync(bad, 'song({}, [section("a", 1, { drums: { density: )]');
  try { await assert.rejects(() => showData(bad), (e) => e instanceof Error && e.message.length > 0); }
  finally { fs.rmSync(bad, { force: true }); }
});
