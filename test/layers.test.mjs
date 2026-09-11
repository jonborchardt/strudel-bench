import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ready } from './_scope.mjs';

const LAYERS = ['drums', 'bass', 'melody', 'pad'];
const ctx = { cps: .5, key: 'C:minor', seed: 3, kit: 'RolandTR909', cycles: 4 };
const onsets = (p, cycles = 4) => p.queryArc(0, cycles).filter((h) => h.hasOnset());
const stripRandom = (h) => { const v = { ...h.value }; delete v.nudge; return v; };
const sig = (haps) => JSON.stringify(haps.map((h) => [h.whole.begin.valueOf(), h.whole.end.valueOf(), stripRandom(h)]));

test('every layer builds with no attrs', async () => {
  const g = await ready;
  for (const L of LAYERS) assert.ok(onsets(g[L]({}, ctx)).length > 0, L);
});

test('adapter at exactly 0.5 equals no adapter, for every cell', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    const base = sig(onsets(g[L]({}, ctx)));
    for (const a of Object.keys(g.strudleLib.cells[L] ?? {})) {
      assert.equal(sig(onsets(g[L]({ [a]: .5 }, ctx))), base, `${L}.${a} at .5 must be a no-op`);
    }
  }
});

test('every cell is queryable at 0 and 1', async () => {
  const g = await ready;
  for (const L of LAYERS) for (const a of Object.keys(g.strudleLib.cells[L] ?? {})) {
    for (const v of [0, 1]) assert.ok(onsets(g[L]({ [a]: v }, ctx)).length >= 0, `${L}.${a}@${v}`);
  }
});

test('density is monotone non-decreasing in onset count', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    const counts = [0, .25, .5, .75, 1].map((v) => onsets(g[L]({ density: v }, ctx)).length);
    for (let i = 1; i < counts.length; i++) assert.ok(counts[i] >= counts[i - 1], `${L} density ${counts}`);
    assert.ok(counts[4] > counts[0], `${L} density must change something`);
  }
});

test('drive never changes onset count', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    if (!g.strudleLib.cells[L]?.drive) continue;
    const n = [0, .25, .5, .75, 1].map((v) => onsets(g[L]({ drive: v }, ctx)).length);
    assert.ok(n.every((x) => x === n[0]), `${L} drive counts ${n}`);
  }
});

test('higher articulation gives shorter sounding events', async () => {
  const g = await ready;
  const len = (p) => onsets(p).reduce((s, h) => s + h.duration.valueOf() * (h.value.clip ?? 1), 0);
  for (const L of LAYERS) {
    if (!g.strudleLib.cells[L]?.articulation) continue;
    const [lo, mid, hi] = [.1, .5, .9].map((v) => len(g[L]({ articulation: v }, ctx)));
    assert.ok(lo >= mid && mid > hi, `${L} articulation lengths ${[lo, mid, hi]}`);
  }
});

test('weight never raises register (mean note non-increasing)', async () => {
  const g = await ready;
  const meanNote = (p) => { const ns = onsets(p).map((h) => h.value.note).filter((n) => typeof n === 'number'); return ns.reduce((a, b) => a + b, 0) / ns.length; };
  for (const L of ['bass', 'pad']) {
    const m = [0, .5, 1].map((v) => meanNote(g[L]({ weight: v }, ctx)));
    assert.ok(m[0] >= m[1] && m[1] >= m[2], `${L} weight mean notes ${m}`);
  }
});

test('structural axes reject signals', async () => {
  const g = await ready;
  assert.throws(() => onsets(g.drums({ density: g.saw }, ctx)), /structural/);
});
