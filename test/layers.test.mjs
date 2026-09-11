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

test('every cell moves something at 0 or at 1', async () => {
  const g = await ready;
  for (const L of LAYERS) for (const a of Object.keys(g.strudleLib.cells[L] ?? {})) {
    const mid = sig(onsets(g[L]({ [a]: .5 }, ctx)));
    const lo = sig(onsets(g[L]({ [a]: 0 }, ctx))), hi = sig(onsets(g[L]({ [a]: 1 }, ctx)));
    assert.ok(lo !== mid || hi !== mid, `${L}.${a} changes nothing at either end`);
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

test('groove never changes onset count', async () => {
  const g = await ready;
  for (const L of LAYERS) {
    if (!g.strudleLib.cells[L]?.groove) continue;
    const n = [0, .25, .5, .75, 1].map((v) => onsets(g[L]({ groove: v }, ctx)).length);
    assert.ok(n.every((x) => x === n[0]), `${L} groove counts ${n}`);
  }
});

// density 1 so every layer has material finer than a swing slice: quarter notes sit on slice starts and
// have nothing to swing, which is why the bass default (4/cycle) would not move here.
test('groove 1 displaces onsets relative to groove .5', async () => {
  const g = await ready;
  const at = (L, v) => onsets(g[L]({ density: 1, groove: v }, ctx)).map((h) => h.whole.begin.valueOf()).sort((a, b) => a - b);
  for (const L of LAYERS) {
    if (!g.strudleLib.cells[L]?.groove) continue;
    assert.notDeepEqual(at(L, 1), at(L, .5), `${L} groove 1 must move at least one onset`);
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

test('brightness and weight both act on the bass filter, neither overwrites the other', async () => {
  const g = await ready;
  const cutoff = (attrs) => onsets(g.bass(attrs, ctx))[0].value.cutoff;
  const both = cutoff({ brightness: .9, weight: .9 });
  assert.ok(both > cutoff({ brightness: .5, weight: .9 }), `brightness must still raise the cutoff under weight: ${both} vs ${cutoff({ brightness: .5, weight: .9 })}`);
  assert.ok(cutoff({ brightness: .9, weight: .5 }) > both, `weight must still lower the cutoff under brightness: ${cutoff({ brightness: .9, weight: .5 })} vs ${both}`);
});

test('drive below .5 moves onsets off the pulse without changing their number', async () => {
  const g = await ready;
  const at = (L, v) => onsets(g[L]({ drive: v }, ctx)).map((h) => h.whole.begin.valueOf()).sort((a, b) => a - b);
  for (const L of ['drums', 'bass']) {
    const base = at(L, .5), low = at(L, 0);
    assert.equal(low.length, base.length, `${L} drive 0 must keep the onset count`);
    assert.notDeepEqual(low, base, `${L} drive 0 must move onsets`);
  }
});

test('drums width keeps its baseline spread at .5 and widens from there', async () => {
  const g = await ready;
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const pans = (w) => Object.fromEntries(onsets(g.drums({ density: .75, width: w }, ctx)).map((h) => [h.value.s, h.value.pan]));
  const mid = pans(.5);
  assert.ok(near(mid.hh, .6), `hh pan at width .5 should be .6, got ${mid.hh}`);
  assert.ok(near(mid.oh, .4), `oh pan at width .5 should be .4, got ${mid.oh}`);
  for (const [s, p] of Object.entries(pans(0))) assert.ok(near(p, .5), `${s} pan at width 0 should be .5, got ${p}`);
  assert.ok(near(pans(1).hh, 1), `hh pan at width 1 should be 1, got ${pans(1).hh}`);
});

test('the articulation choke puts only the hats in a cut group', async () => {
  const g = await ready;
  const cuts = Object.fromEntries(onsets(g.drums({ density: .75, articulation: .9 }, ctx)).map((h) => [h.value.s, h.value.cut]));
  assert.equal(cuts.hh, 1, 'hh must choke');
  assert.equal(cuts.oh, 1, 'oh must choke');
  assert.equal(cuts.bd, undefined, 'bd must not be in a cut group');
  assert.equal(cuts.sd, undefined, 'sd must not be in a cut group');
});

test('drive 1 pulls the kick onto the pulse and leaves the snare on the backbeat', async () => {
  const g = await ready;
  const steps = (s) => [...new Set(onsets(g.drums({ drive: 1 }, ctx)).filter((h) => h.value.s === s)
    .map((h) => h.whole.begin.valueOf() % 1).sort((a, b) => a - b))];
  assert.deepEqual(steps('sd'), [.25, .75], 'snare must stay on the backbeat, not double the kick');
  assert.deepEqual(steps('bd'), [0, .25, .5, .75], 'kick must stay on the pulse');
});

test('structural axes reject signals', async () => {
  const g = await ready;
  assert.throws(() => onsets(g.drums({ density: g.saw }, ctx)), /structural/);
});

test('sound, sounds and level are material: defaults equal omission, values reach the events', async () => {
  const g = await ready;
  assert.equal(sig(onsets(g.bass({ sound: 'sawtooth', level: 1 }, ctx))), sig(onsets(g.bass({}, ctx))));
  assert.ok(onsets(g.bass({ sound: 'triangle' }, ctx)).every((h) => h.value.s === 'triangle'));
  assert.ok(onsets(g.melody({ sound: 'square' }, ctx)).every((h) => h.value.s === 'square'));
  assert.ok(onsets(g.pad({ sound: 'triangle' }, ctx)).every((h) => h.value.s === 'triangle'));
  const d = onsets(g.drums({ sounds: { sd: 'rim' } }, ctx));
  assert.ok(d.some((h) => h.value.s === 'rim') && !d.some((h) => h.value.s === 'sd') && d.some((h) => h.value.s === 'bd'));
  const base = onsets(g.pad({}, ctx))[0].value.gain, half = onsets(g.pad({ level: .5 }, ctx))[0].value.gain;
  assert.ok(Math.abs(half - base / 2) < 1e-9, `${half} vs ${base}`);
  assert.throws(() => g.drums({ sounds: { tom: 'lt' } }, ctx), /sounds/);
  assert.throws(() => g.bass({ level: 'loud' }, ctx), /level/);
});

test('fill adds a snare roll only in the last cycle, by request or before a climax', async () => {
  const g = await ready;
  const inCycle = (hs, c) => hs.filter((h) => Math.floor(h.whole.begin.valueOf()) === c).length;
  const base = onsets(g.drums({}, ctx)), filled = onsets(g.drums({ fill: true }, ctx));
  for (const c of [0, 1, 2]) assert.equal(inCycle(filled, c), inCycle(base, c), `cycle ${c}`);
  assert.equal(inCycle(filled, 3), inCycle(base, 3) + 8);
  const m = g.song({}, [g.section('a', 2, { drums: {} }), g.section('b', 2, { role: 'climax', drums: {} }), g.section('c', 2, { drums: { fill: false } })]).strudle;
  const n = (i) => onsets(m.sections[i].layers.drums.pattern, 2).length;
  const plain = onsets(g.drums({}, { ...ctx, cycles: 2 }), 2).length;
  assert.equal(n(0), plain + 8, 'a fills into the climax');
  assert.equal(n(1), plain, 'b has no climax after it');
  assert.equal(n(2), plain, 'fill: false wins');
});

test('pad arp spreads the chord into 8 notes per cycle; omitted equals baseline', async () => {
  const g = await ready;
  assert.equal(sig(onsets(g.pad({ arp: undefined }, ctx))), sig(onsets(g.pad({}, ctx))));
  const up = onsets(g.pad({ arp: 'up' }, ctx), 1);
  assert.equal(up.length, 8);
  const notes = up.map((h) => h.value.note);
  assert.ok(notes[0] < notes[1] && notes[1] < notes[2] && notes[3] === notes[0], notes.join());
  const down = onsets(g.pad({ arp: 'down' }, ctx), 1).map((h) => h.value.note);
  assert.ok(down[0] > down[1] && down[1] > down[2]);
  assert.equal(onsets(g.pad({ arp: '0 2' }, ctx), 1).length, 2);
  assert.throws(() => g.pad({ arp: 'Up' }, ctx), /arp/);
});

test('melody follow transposes by the chord root; phrase lengthens the line', async () => {
  const g = await ready;
  const c1 = (p) => onsets(p, 2).filter((h) => h.whole.begin.valueOf() >= 1).map((h) => h.value.note);
  const c0 = (p) => onsets(p, 1).map((h) => h.value.note);
  const plain = g.melody({}, ctx), follow = g.melody({ follow: true }, ctx);
  assert.deepEqual(c0(follow), c0(plain), 'cycle 0 is degree i either way');
  // default progression is i VI: cycle 1 is a sixth up in scale steps
  assert.deepEqual(c1(follow).map((n, i) => n - c1(plain)[i]).every((d) => d === 8 || d === 9), true);
  const two = g.melody({ phrase: 2 }, ctx);
  assert.equal(onsets(two, 1).length, onsets(plain, 1).length);
  assert.notEqual(JSON.stringify(c1(two)), JSON.stringify(c0(two)), 'a 2-cycle phrase does not repeat after one cycle (pick another ctx.seed if this seed happens to)');
});
